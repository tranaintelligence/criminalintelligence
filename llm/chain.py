"""Direct legal-analysis chain with deterministic source verification.

Normal chat no longer initializes or calls Chroma, BM25, or a reranker. The LLM
returns analysis plus candidate legal references. Exact statutory wording is
then populated only from :mod:`legal_sources.registry`.
"""

from __future__ import annotations

import asyncio
import base64
import json
import re
import time
from typing import Optional

import httpx

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from config import settings
from key_manager import (
    QuickModelUnavailableError,
    clear_quick_temporarily_unavailable,
    get_active_provider_pools,
    get_current_provider_key_record,
    get_active_key_count,
    get_current_key_record,
    is_quota_error,
    is_quick_temporarily_unavailable,
    mark_quick_temporarily_unavailable,
    record_provider_attempt,
    record_provider_key_attempt,
    rotate_provider_key,
    rotate_key,
)
from legal_sources.registry import LawSourceRegistry, get_registry
from llm.prompts import (
    COMPLAINT_FIR_ANALYSIS_PROMPT,
    COMPLAINT_FIR_ANALYSIS_SYSTEM_PROMPT,
)
from models.schemas import AnalysisResponse, SourceChunk, StructuredAnalysis
from utils.logger import get_logger

logger = get_logger(__name__)

_llms = {}
_REPEATED_WORDS = re.compile(r"\b(\w+)(?:\s+\1){2,}\b", re.IGNORECASE)
_EXPLICIT_LAW_SECTION = re.compile(
    r"(?<!\w)(?:(BNS|BNSS|BSA|IPC|CRPC|IEA)\s*(?:section\s*)?(\d+[A-Za-z]?(?:\(\d+\))?)|"
    r"(?:section\s*)?(\d+[A-Za-z]?(?:\(\d+\))?)\s+(?:of\s+)?(BNS|BNSS|BSA|IPC|CRPC|IEA))(?!\w)",
    re.IGNORECASE,
)
_DIRECT_SECTION_INTENT = re.compile(
    r"\b(?:explain|describe|meaning\s+of|what\s+is|tell\s+me\s+about)\b",
    re.IGNORECASE,
)
_SECTION_SOURCE_SYSTEM_PROMPT = """\
You explain one specific Indian statutory provision using the verified source
record supplied in the user's message. Treat the record as the sole authority
for the requested provision. The Act code and section number identify one exact
provision; never replace it with a similarly numbered section from another Act.
Do not use memory or other Acts to fill gaps in this provision. Explain the
provided text in plain language, and do not claim anything that the text does
not support. Always show the official statutory reference format:
[Ref: <Act Full Name>, Section <Number> — previously Section <Old Section> <Old Act> if applicable].
Return a valid JSON object matching the analysis schema. Put the
explanation in general_analysis and return the exact requested code and section
as the only applicable_laws item. Leave quote and exact_text empty; the backend
will attach the verified source text.
"""
_PROVIDER_BASE_URLS = {
    "groq": "https://api.groq.com/openai/v1",
    "cerebras": "https://api.cerebras.ai/v1",
}


class EmptyAnalysisError(RuntimeError):
    """The provider completed without returning anything the chat can show."""


def _require_readable_analysis(analysis: StructuredAnalysis) -> StructuredAnalysis:
    text_fields = [
        analysis.conversational_reply,
        analysis.general_analysis,
        analysis.situation_meaning,
        analysis.bail_status,
        analysis.handling_authority,
        *(analysis.next_24_hours or []),
        *(analysis.rights or []),
    ]
    has_text = any(isinstance(value, str) and value.strip() for value in text_fields)

    # If top-level narrative is empty but statutory laws were identified, synthesize readable text
    if not has_text and analysis.applicable_laws:
        laws_summary = []
        for law in analysis.applicable_laws:
            sec_title = f"{law.act or 'Statutory Provision'} {f'Sec. {law.section}' if law.section else ''}".strip()
            detail = law.explanation or law.quote or ""
            if sec_title or detail:
                laws_summary.append(f"• **{sec_title}**: {detail}" if detail else f"• **{sec_title}**")

        if laws_summary:
            analysis.situation_meaning = (
                "### Statutory Analysis & Identified Provisions\n\n"
                "The following governing statutory provisions and legal sections were identified based on the document details:\n\n"
                + "\n\n".join(laws_summary)
                + "\n\n**Procedural Impact**: Notice of appearance, procedural safeguards against arbitrary arrest, and mandatory statutory bail protections apply to these offences under current Indian criminal legislation."
            )
            if not analysis.general_analysis:
                analysis.general_analysis = (
                    "Statutory evaluation of the document identifies governing provisions under Indian criminal law. "
                    "Review the verified statutory sections and procedural safeguards."
                )
            if not analysis.bail_status:
                analysis.bail_status = (
                    "Review specific bailable/non-bailable classification for each section identified. "
                    "For offences punishable up to 7 years, notice under BNSS Sec. 35(3) is mandatory before arrest."
                )
            if not analysis.handling_authority:
                analysis.handling_authority = "Jurisdictional Police Station / Designated Judicial Magistrate Court."
            has_text = True

    if not has_text:
        raise EmptyAnalysisError(
            "The AI model returned an empty analysis. Please try again. If it keeps happening, "
            "reattach the image or paste the document text into the chat."
        )
    return analysis


def _model_family(model: str) -> str:
    value = (model or "").lower()
    if "gpt-oss" in value or "gpt_oss" in value:
        return "gpt-oss"
    if "llama" in value:
        return "llama"
    return "other"


def _quick_routes():
    """Return active Quick Thinking records in model-family priority order."""

    provider_order = {"groq": 0, "cerebras": 1, "google": 2}
    routes = []
    for (provider, model, mode), records in get_active_provider_pools().items():
        if mode != "quick" or provider not in provider_order:
            continue
        for record in records:
            family = _model_family(model)
            if family in ("llama", "gpt-oss"):
                route_priority = 0
            else:
                route_priority = 2
            routes.append((
                route_priority,
                provider_order.get(provider, 9),
                record.rotation_order,
                record,
            ))
    return [item[3] for item in sorted(routes, key=lambda item: item[:3])]


def _provider_url(record) -> str:
    return (getattr(record, "base_url", None) or _PROVIDER_BASE_URLS.get(record.provider, "")).rstrip("/")


def _message_text(message) -> str:
    content = message.content
    if isinstance(content, list):
        return "".join(str(item.get("text", "")) if isinstance(item, dict) else str(item) for item in content)
    return str(content)


def _normalize_analysis_payload(payload: object) -> dict:
    """Make common provider JSON conventions safe for our Pydantic schema."""

    if not isinstance(payload, dict):
        raise ValueError("provider response JSON was not an object")
    
    # Flatten and normalize all keys from PascalCase/camelCase/spaced to lowercase snake_case
    normalized = {}
    for k, v in payload.items():
        if isinstance(k, str):
            s1 = re.sub(r'(.)([A-Z][a-z]+)', r'\1_\2', k)
            s2 = re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', s1)
            snake_k = re.sub(r'[^a-z0-9_]+', '_', s2.lower()).strip('_')
            normalized[snake_k] = v
            clean_k = re.sub(r"[^a-z0-9_]+", "_", k.strip().lower()).strip("_")
            normalized[clean_k] = v
        normalized[k] = v

    def as_text(value, default=""):
        if value is None:
            return default
        if isinstance(value, str):
            return value
        if isinstance(value, (dict, list)):
            return json.dumps(value, ensure_ascii=False)
        return str(value)

    def as_bool(value, default=False):
        if value is None:
            return default
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {"true", "yes", "1"}:
                return True
            if lowered in {"false", "no", "0", ""}:
                return False
        return bool(value)

    def as_text_list(value):
        if value is None:
            return []
        if not isinstance(value, list):
            value = [value]
        return [as_text(item) for item in value if item is not None]

    # Map common aliases and synonyms from diverse LLM providers
    conversational_text = (
        normalized.get("conversational_reply")
        or normalized.get("message")
        or normalized.get("response")
        or normalized.get("reply")
        or normalized.get("greeting")
        or normalized.get("answer")
        or normalized.get("text")
        or ""
    )
    if conversational_text and not normalized.get("conversational_reply"):
        normalized["conversational_reply"] = as_text(conversational_text)

    if not normalized.get("situation_meaning"):
        normalized["situation_meaning"] = (
            normalized.get("complaint_analysis")
            or normalized.get("document_overview")
            or normalized.get("summary_of_allegations")
            or normalized.get("summary")
            or normalized.get("overview")
            or normalized.get("analysis")
            or normalized.get("statutory_analysis")
            or normalized.get("case_summary")
            or normalized.get("allegations_summary")
            or normalized.get("details")
            or normalized.get("conversational_reply")
            or ""
        )
    if not normalized.get("general_analysis"):
        has_breakdown_fields = bool(
            normalized.get("bail_status")
            or normalized.get("next_24_hours")
            or normalized.get("rights")
        )
        normalized["general_analysis"] = (
            normalized.get("legal_analysis")
            or normalized.get("section_wise_legal_analysis")
            or normalized.get("legal_summary")
            or normalized.get("findings")
            or normalized.get("explanation")
            or normalized.get("content")
            or ("" if has_breakdown_fields else normalized.get("situation_meaning", ""))
            or normalized.get("conversational_reply")
            or ""
        )
    if not normalized.get("bail_status"):
        normalized["bail_status"] = (
            normalized.get("bail")
            or normalized.get("arrest_and_bail_position")
            or normalized.get("bail_eligibility")
            or normalized.get("bail_analysis")
            or normalized.get("bail_provisions")
            or ""
        )
    if not normalized.get("handling_authority"):
        normalized["handling_authority"] = (
            normalized.get("authority")
            or normalized.get("competent_authority")
            or normalized.get("jurisdiction")
            or normalized.get("investigating_agency")
            or normalized.get("police_station")
            or ""
        )
    if not normalized.get("legal_reasoning"):
        normalized["legal_reasoning"] = (
            normalized.get("reasoning")
            or normalized.get("statutory_reasoning")
            or normalized.get("legal_analysis")
            or ""
        )
    if not normalized.get("next_24_hours"):
        normalized["next_24_hours"] = (
            normalized.get("immediate_steps")
            or normalized.get("immediate_practical_steps")
            or normalized.get("action_plan")
            or normalized.get("recommended_actions")
            or normalized.get("steps")
            or normalized.get("procedural_steps")
            or []
        )
    if not normalized.get("rights"):
        normalized["rights"] = (
            normalized.get("legal_rights")
            or normalized.get("rights_and_legal_remedies")
            or normalized.get("accused_rights")
            or normalized.get("citizen_rights")
            or normalized.get("statutory_safeguards")
            or []
        )
    if not normalized.get("is_conversational"):
        text_check = (str(normalized.get("situation_meaning") or "") + " " + str(normalized.get("general_analysis") or "")).lower()
        if any(phrase in text_check for phrase in ["how can i help", "no fir, complaint", "no document has been provided", "please upload", "please describe the facts"]):
            normalized["is_conversational"] = True

    for field_name in (
        "general_analysis",
        "situation_meaning",
        "bail_status",
        "handling_authority",
    ):
        normalized[field_name] = as_text(normalized.get(field_name))
    for field_name in ("is_conversational", "requires_sources", "suggest_lawyer"):
        normalized[field_name] = as_bool(normalized.get(field_name), False)
    normalized["conversational_reply"] = (
        None if normalized.get("conversational_reply") is None
        else as_text(normalized.get("conversational_reply"))
    )
    normalized["next_24_hours"] = as_text_list(normalized.get("next_24_hours"))
    normalized["rights"] = as_text_list(normalized.get("rights"))
    source_indices = normalized.get("relevant_source_indices") or []
    if not isinstance(source_indices, list):
        source_indices = [source_indices]
    normalized["relevant_source_indices"] = [
        int(value) for value in source_indices
        if isinstance(value, (int, float)) or (isinstance(value, str) and value.strip().lstrip("-").isdigit())
    ]

    laws = normalized.get("applicable_laws", [])
    if isinstance(laws, dict):
        laws = [laws]
    normalized_laws = []
    for law in laws if isinstance(laws, list) else []:
        if not isinstance(law, dict):
            continue
        normalized_law = dict(law)
        for field_name in (
            "act",
            "code",
            "section",
            "quote",
            "explanation",
            "quote_status",
        ):
            normalized_law[field_name] = as_text(normalized_law.get(field_name))
        for field_name in ("subsection", "exact_text", "source_url", "source_version", "source_hash"):
            if normalized_law.get(field_name) is not None:
                normalized_law[field_name] = as_text(normalized_law[field_name])
        normalized_law["verified"] = as_bool(normalized_law.get("verified"), False)
        normalized_laws.append(normalized_law)
    normalized["applicable_laws"] = normalized_laws
    return normalized


def _parse_structured_analysis_content(content) -> StructuredAnalysis:
    """Parse provider JSON while tolerating harmless prose/fence wrappers."""

    if isinstance(content, list):
        content = "".join(
            str(item.get("text", "")) if isinstance(item, dict) else str(item)
            for item in content
        )
    text = str(content or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE | re.DOTALL).strip()

    decoder = json.JSONDecoder()
    start = text.find("{")
    if start < 0:
        raise ValueError("provider response did not contain a JSON object")
    payload, _ = decoder.raw_decode(text[start:])
    return StructuredAnalysis.model_validate(_normalize_analysis_payload(payload))


async def _invoke_openai_compatible(record, messages, timeout: float | None) -> StructuredAnalysis:
    base_url = _provider_url(record)
    if not base_url:
        raise RuntimeError(f"No compatible base URL configured for provider {record.provider}.")
    raw_messages = [
        {
            "role": (
                "system"
                if isinstance(message, SystemMessage)
                else "assistant"
                if isinstance(message, AIMessage)
                else "user"
            ),
            "content": _message_text(message),
        }
        for message in messages
    ]
    if record.provider == "groq":
        # Groq strictly requires the word 'json' (case-insensitive) in messages when json_object mode is requested.
        has_json_word = any("json" in m["content"].lower() for m in raw_messages)
        if not has_json_word:
            if raw_messages and raw_messages[0]["role"] == "system":
                raw_messages[0]["content"] += "\n\nCRITICAL: Respond exclusively as a valid JSON object matching the required schema."
            else:
                raw_messages.insert(0, {"role": "system", "content": "Respond exclusively as a valid JSON object matching the required schema."})

    payload = {
        "model": record.model,
        "messages": raw_messages,
        "temperature": settings.llm_temperature,
        "max_tokens": 1200,
    }
    if record.provider == "groq":
        payload["response_format"] = {"type": "json_object"}
        if _model_family(record.model) == "gpt-oss":
            payload["include_reasoning"] = False
            payload["reasoning_effort"] = "low"
    headers = {"Authorization": f"Bearer {record.secret}", "Content-Type": "application/json"}
    request_timeout = timeout or 20.0
    async with httpx.AsyncClient(timeout=request_timeout) as client:
        response = await client.post(f"{base_url}/chat/completions", headers=headers, json=payload)
    if response.status_code >= 400:
        # Check if provider returned failed_generation (e.g. Groq json_validate_failed)
        try:
            err_body = response.json()
            err_info = err_body.get("error", {})
            failed_gen = err_info.get("failed_generation")
            if failed_gen and isinstance(failed_gen, str) and failed_gen.strip():
                logger.info("%s returned non-JSON text in failed_generation: rescuing response", record.provider)
                text = failed_gen.strip()
                try:
                    return _require_readable_analysis(_parse_structured_analysis_content(text))
                except Exception:
                    return StructuredAnalysis(
                        general_analysis=text,
                        situation_meaning=text,
                        is_conversational=True,
                        suggest_lawyer=False,
                    )
        except Exception:
            pass
        raise RuntimeError(f"{record.provider} HTTP {response.status_code}: {response.text[:300]}")
    body = response.json()
    usage = body.get("usage") or {}
    if usage:
        logger.info(
            "LLM token usage provider=%s model=%s prompt=%s completion=%s total=%s",
            record.provider,
            record.model,
            usage.get("prompt_tokens"),
            usage.get("completion_tokens"),
            usage.get("total_tokens"),
        )
    try:
        content = body.get("choices", [{}])[0].get("message", {}).get("content", "")
        logger.debug("GROQ RAW CONTENT: %s", content)
        return _require_readable_analysis(_parse_structured_analysis_content(content))
    except (json.JSONDecodeError, ValueError, TypeError) as exc:
        if hasattr(exc, "errors"):
            details = "; ".join(
                f"{'.'.join(str(part) for part in error.get('loc', ())) or 'root'}:{error.get('type', 'validation')}"
                for error in exc.errors()
            )
            logger.warning("%s structured response validation fields: %s", record.provider, details[:500])
        raise RuntimeError(f"{record.provider} returned invalid structured analysis JSON.") from exc


async def _run_quick_provider_pipeline(messages, deadline: float | None):
    routes = _quick_routes()
    has_media = any(
        isinstance(message.content, list)
        and any(isinstance(part, dict) and part.get("type") == "media" for part in message.content)
        for message in messages
    )
    if has_media:
        # Image and scanned-PDF bytes must reach a model with native vision
        # input. OpenAI-compatible routes in this application are text-only.
        routes = [
            record for record in routes
            if record.provider == "google" and "gemini" in (record.model or "").lower()
        ]
        if not routes:
            raise RuntimeError(
                "This chat contains an image or scanned PDF, but no vision-capable Gemini route is configured. "
                "Configure a Gemini model to analyze visual attachments."
            )
    # One request per chat: choose one eligible route and do not rotate.
    routes = routes[:1]
    if not routes:
        raise QuickModelUnavailableError("Quick Thinking is temporarily unavailable because no Quick Thinking providers are configured.")
    attempted = set()
    empty_analysis_error = None
    quota_error_seen = False
    last_error = None
    diagnostic_log = []
    for record in routes:
        route_identity = (record.id, record.model)
        if route_identity in attempted:
            continue
        attempted.add(route_identity)
        is_gemma_fallback = False
        remaining = max(0.1, (deadline - time.monotonic()) if deadline else 8.0)
        diagnostic_log.append(
            f"route start: provider={record.provider} model={record.model} key_id={record.id}"
        )
        try:
            if record.provider == "google":
                llm, _, key_id = _get_llm("quick", force_reinit=True, key_record=record)
                structured = None if is_gemma_fallback else llm.with_structured_output(StructuredAnalysis)
                remaining = max(0.1, (deadline - time.monotonic()) if deadline else remaining)
                response = await asyncio.wait_for(
                    structured.ainvoke(messages), timeout=remaining
                )
                candidate = (
                    response if isinstance(response, StructuredAnalysis)
                    else StructuredAnalysis.model_validate(response)
                )
                analysis = _require_readable_analysis(candidate)
            else:
                key_id = record.id
                analysis = await _invoke_openai_compatible(record, messages, remaining)
            record_provider_key_attempt(record.id, record.provider, record.model, record.mode, "success")
            clear_quick_temporarily_unavailable()
            diagnostic_log.append(
                f"route success: provider={record.provider} model={record.model}"
            )
            return _sanitize_analysis(analysis), f"quick:{record.provider}:{record.model}"
        except Exception as exc:
            last_error = exc
            quota_error = is_quota_error(exc)
            quota_error_seen = quota_error_seen or quota_error
            record_provider_key_attempt(record.id, record.provider, record.model, record.mode, "quota" if quota_error else "failure", exc)
            logger.warning("Quick provider route failed: provider=%s model=%s error=%s", record.provider, record.model, exc)
            safe_error = str(exc)
            if getattr(record, "secret", None):
                safe_error = safe_error.replace(record.secret, "[REDACTED]")
            diagnostic_log.append(
                f"route failure: provider={record.provider} model={record.model} "
                f"error_type={type(exc).__name__} error={safe_error}"
            )
            if isinstance(exc, EmptyAnalysisError):
                # A vision model can occasionally finish with an empty
                # structured payload. Treat that as a failed route and try
                # the next configured Gemini key/model before surfacing it.
                empty_analysis_error = exc
                break
            if quota_error:
                mark_quick_temporarily_unavailable()
                raise QuickModelUnavailableError(
                    "Quick Thinking is temporarily unavailable because the selected provider is rate-limited."
                ) from exc
            raise RuntimeError(f"Quick Thinking provider request failed: {exc}") from exc
    if empty_analysis_error is not None:
        fallback_msg = (
            "I received the attached document, but couldn't produce an analysis from the single provider request. Please resend the images or ask about a specific clause so I can try a narrower analysis."
            if has_media else
            "I received your message, but couldn't formulate a specific legal analysis. Please share more details about your situation or ask a specific question about Indian criminal law (BNS, BNSS, BSA)."
        )
        return StructuredAnalysis(
            general_analysis=fallback_msg,
            situation_meaning=fallback_msg,
        ), "quick:empty-response"
    if quota_error_seen:
        mark_quick_temporarily_unavailable()
        raise QuickModelUnavailableError("Quick Thinking is temporarily unavailable because the selected provider is rate-limited.")
    raise RuntimeError(f"All configured Quick Thinking providers failed: {last_error or 'unknown error'}")


def _clean_model_text(
    value: str,
    max_length: int = 1200,
    preserve_newlines: bool = False,
) -> str:
    """Remove obvious provider repetition before content reaches the user."""

    if preserve_newlines:
        lines = (value or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
        cleaned = "\n".join(re.sub(r"[ \t]+", " ", line).strip() for line in lines)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    else:
        cleaned = re.sub(r"\s+", " ", value or "").strip()
    cleaned = _REPEATED_WORDS.sub(r"\1", cleaned)
    if len(cleaned) <= max_length:
        return cleaned

    boundary = max(
        cleaned.rfind("\n\n", 0, max_length),
        cleaned.rfind(". ", 0, max_length),
        cleaned.rfind("! ", 0, max_length),
        cleaned.rfind("? ", 0, max_length),
    )
    if boundary < max_length * 0.75:
        boundary = cleaned.rfind(" ", 0, max_length)
    if boundary < 1:
        boundary = max_length
    return cleaned[:boundary].rstrip() + "…"


_COMMON_HALLUCINATION_PATTERNS = [
    (re.compile(r"\b(?:Section\s+)?420\s+(?:of\s+)?BNS\b", re.IGNORECASE), "Section 318 of BNS (formerly Section 420 IPC - Cheating)"),
    (re.compile(r"\b(?:Section\s+)?302\s+(?:of\s+)?BNS\b", re.IGNORECASE), "Section 103 of BNS (formerly Section 302 IPC - Murder)"),
    (re.compile(r"\b(?:Section\s+)?304A\s+(?:of\s+)?BNS\b", re.IGNORECASE), "Section 106 of BNS (formerly Section 304A IPC - Death by negligence)"),
    (re.compile(r"\b(?:Section\s+)?498A\s+(?:of\s+)?BNS\b", re.IGNORECASE), "Section 85 of BNS (formerly Section 498A IPC - Cruelty by husband/in-laws)"),
    (re.compile(r"\b(?:Section\s+)?376\s+(?:of\s+)?BNS\b", re.IGNORECASE), "Section 64 of BNS (formerly Section 376 IPC - Rape)"),
    (re.compile(r"\b(?:(?:Sec(?:tion)?\.?\s*)?379\s+(?:of\s+)?BNS|BNS\s+(?:Sec(?:tion)?\.?\s*)?379)\b", re.IGNORECASE), "Section 303 of BNS (formerly Section 379 IPC - Theft)"),
    (re.compile(r"\b(?:(?:Sec(?:tion)?\.?\s*)?384\s+(?:of\s+)?BNS|BNS\s+(?:Sec(?:tion)?\.?\s*)?384)\b", re.IGNORECASE), "Section 308 of BNS (formerly Section 384 IPC - Extortion)"),
    (re.compile(r"\b(?:(?:Sec(?:tion)?\.?\s*)?392\s+(?:of\s+)?BNS|BNS\s+(?:Sec(?:tion)?\.?\s*)?392)\b", re.IGNORECASE), "Section 309 of BNS (formerly Section 392 IPC - Robbery)"),
    (re.compile(r"\b(?:(?:Sec(?:tion)?\.?\s*)?323\s+(?:of\s+)?BNS|BNS\s+(?:Sec(?:tion)?\.?\s*)?323)\b", re.IGNORECASE), "Section 115(2) of BNS (formerly Section 323 IPC - Voluntarily causing hurt)"),
    (re.compile(r"\b(?:(?:Sec(?:tion)?\.?\s*)?504\s+(?:of\s+)?BNS|BNS\s+(?:Sec(?:tion)?\.?\s*)?504)\b", re.IGNORECASE), "Section 352 of BNS (formerly Section 504 IPC - Intentional insult)"),
    (re.compile(r"\b(?:(?:Sec(?:tion)?\.?\s*)?506\s+(?:of\s+)?BNS|BNS\s+(?:Sec(?:tion)?\.?\s*)?506)\b", re.IGNORECASE), "Section 351 of BNS (formerly Section 506 IPC - Criminal intimidation)"),
    (re.compile(r"\b(?:(?:Sec(?:tion)?\.?\s*)?8\s+(?:of\s+)?BNS|BNS\s+(?:Sec(?:tion)?\.?\s*)?8)\b", re.IGNORECASE), "Section 308/309 of BNS (Extortion / Robbery)"),
    (re.compile(r"\b(?:(?:Sec(?:tion)?\.?\s*)?8\s+(?:of\s+)?BNSS|BNSS\s+(?:Sec(?:tion)?\.?\s*)?8)\b", re.IGNORECASE), "Section 173 of BNSS (FIR registration)"),
    (re.compile(r"\b(?:(?:Sec(?:tion)?\.?\s*)?8\s+(?:of\s+)?BSA|BSA\s+(?:Sec(?:tion)?\.?\s*)?8)\b", re.IGNORECASE), "Section 8 of BSA (Relevancy of motive and conduct)"),
    (re.compile(r"\b(?:(?:Sec(?:tion)?\.?\s*)?154\s*A\s+(?:of\s+)?BNSS|BNSS\s+(?:Sec(?:tion)?\.?\s*)?154\s*A)\b", re.IGNORECASE), "Section 173(4) / 175(3) of BNSS (statutory procedure upon police refusal to register FIR)"),
    (re.compile(r"\b(?:(?:Sec(?:tion)?\.?\s*)?154\s+(?:of\s+)?BNSS|BNSS\s+(?:Sec(?:tion)?\.?\s*)?154)(?!\s*\(4\))\b", re.IGNORECASE), "Section 173 of BNSS (FIR registration — formerly Section 154 CrPC)"),
    (re.compile(r"\b(?:(?:Sec(?:tion)?\.?\s*)?154\s+(?:of\s+)?BNS|BNS\s+(?:Sec(?:tion)?\.?\s*)?154)\b", re.IGNORECASE), "Section 173 of BNSS (FIR registration under new criminal code)"),
    (re.compile(r"\b(?:(?:Sec(?:tion)?\.?\s*)?151\s+(?:of\s+)?BNS|BNS\s+(?:Sec(?:tion)?\.?\s*)?151)\b", re.IGNORECASE), "Section 351 of BNS (Criminal Intimidation — formerly Section 506 IPC)"),
    (re.compile(r"\b(?:(?:Sec(?:tion)?\.?\s*)?41A?\s+(?:of\s+)?BNSS|BNSS\s+(?:Sec(?:tion)?\.?\s*)?41A?)\b", re.IGNORECASE), "Section 35 of BNSS (formerly Section 41/41A CrPC)"),
    (re.compile(r"\b(?:(?:Sec(?:tion)?\.?\s*)?438\s+(?:of\s+)?BNSS|BNSS\s+(?:Sec(?:tion)?\.?\s*)?438)\b", re.IGNORECASE), "Section 482 of BNSS (formerly Section 438 CrPC - Anticipatory bail)"),
    (re.compile(r"\b(?:(?:Sec(?:tion)?\.?\s*)?437\s+(?:of\s+)?BNSS|BNSS\s+(?:Sec(?:tion)?\.?\s*)?437)\b", re.IGNORECASE), "Section 480 of BNSS (formerly Section 437 CrPC - Regular bail)"),
    (re.compile(r"\b(?:(?:Sec(?:tion)?\.?\s*)?436\s+(?:of\s+)?BNSS|BNSS\s+(?:Sec(?:tion)?\.?\s*)?436)\b", re.IGNORECASE), "Section 478 of BNSS (formerly Section 436 CrPC - Bailable bail)"),
    (re.compile(r"\b(?:(?:Sec(?:tion)?\.?\s*)?165\s+(?:of\s+)?BNSS|BNSS\s+(?:Sec(?:tion)?\.?\s*)?165)\b", re.IGNORECASE), "Section 185 of BNSS (formerly Section 165 CrPC - Police search)"),
    (re.compile(r"\b(?:(?:Sec(?:tion)?\.?\s*)?65B\s+(?:of\s+)?BSA|BSA\s+(?:Sec(?:tion)?\.?\s*)?65B)\b", re.IGNORECASE), "Section 63 of BSA (formerly Section 65B Indian Evidence Act - Electronic records)"),
]


def _correct_common_statutory_hallucinations(text: str) -> str:
    if not text:
        return text
    cleaned = text
    for pattern, replacement in _COMMON_HALLUCINATION_PATTERNS:
        cleaned = pattern.sub(replacement, cleaned)
    return cleaned


def _sanitize_analysis(analysis: StructuredAnalysis) -> StructuredAnalysis:
    """Bound structured fields and fix common statutory hallucinations."""

    for field_name in (
        "conversational_reply",
        "general_analysis",
        "situation_meaning",
        "bail_status",
        "handling_authority",
    ):
        value = getattr(analysis, field_name)
        if isinstance(value, str):
            value = _correct_common_statutory_hallucinations(value)
            if field_name == "general_analysis":
                setattr(
                    analysis,
                    field_name,
                    _clean_model_text(value, max_length=6000, preserve_newlines=True),
                )
            else:
                setattr(analysis, field_name, _clean_model_text(value))

    for field_name in ("next_24_hours", "rights"):
        cleaned_values = []
        for value in getattr(analysis, field_name)[:5]:
            value = _correct_common_statutory_hallucinations(value)
            cleaned = _clean_model_text(value, max_length=400)
            if cleaned and cleaned not in cleaned_values:
                cleaned_values.append(cleaned)
        setattr(analysis, field_name, cleaned_values)

    return analysis


NON_BAILABLE_SECTIONS: set[tuple[str, str]] = {
    ("BNS", "309"),  # Robbery
    ("BNS", "308"),  # Extortion
    ("BNS", "304"),  # Snatching
    ("BNS", "310"),  # Dacoity
    ("BNS", "311"),  # Dacoity with murder
    ("BNS", "103"),  # Murder
    ("BNS", "105"),  # Culpable homicide
    ("BNS", "106"),  # Causing death by negligence / Hit and run
    ("BNS", "108"),  # Abetment of suicide
    ("BNS", "109"),  # Attempt to murder
    ("BNS", "64"),   # Rape
    ("BNS", "70"),   # Gang rape
    ("BNS", "85"),   # Cruelty by husband / relatives
    ("BNS", "117"),  # Voluntarily causing grievous hurt
    ("BNS", "118"),  # Voluntarily causing hurt/grievous hurt by dangerous weapons
    ("BNS", "124"),  # Acid attack
    ("BNS", "137"),  # Kidnapping
    ("BNS", "140"),  # Kidnapping or abducting with intent to secretly confine
    ("BNS", "305"),  # Theft in dwelling house
    ("BNS", "331"),  # House-trespass after preparation for hurt/assault
    ("BNS", "111"),  # Organised crime
    ("BNS", "112"),  # Petty organised crime
    ("BNS", "113"),  # Terrorist act
}


def _enforce_bail_and_statutory_remedies(
    analysis: StructuredAnalysis,
    context_text: str = "",
) -> StructuredAnalysis:
    """Deterministically classify bail eligibility and enforce statutory remedies under BNSS."""

    text_corpus = (
        f"{context_text} "
        f"{analysis.situation_meaning or ''} "
        f"{analysis.general_analysis or ''} "
        f"{analysis.bail_status or ''}"
    ).lower()

    fir_refusal_keywords = [
        "refused to lodge", "refuse to lodge", "refused to register", "refusing to register",
        "police refused", "refused fir", "no fir", "not filing fir", "police station refused"
    ]
    if any(kw in text_corpus for kw in fir_refusal_keywords):
        sp_remedy = (
            "Right against refusal to register FIR: Under Section 173(4) of BNSS, if the officer in charge of a "
            "police station refuses to record your complaint for a cognizable offence, you have the statutory right to "
            "send the substance of the information in writing and by post to the Superintendent of Police (SP / DCP)."
        )
        magistrate_remedy = (
            "Judicial Magistrate Application: If the SP fails to investigate or register the FIR, you have the right "
            "to make an application before the competent Judicial Magistrate under Section 175(3) & 175(4) of BNSS "
            "directing the police to investigate."
        )
        existing_rights = [r.lower() for r in (analysis.rights or [])]
        rights_list = list(analysis.rights or [])
        if not any("173(4)" in r or "superintendent of police" in r for r in existing_rights):
            rights_list.insert(0, sp_remedy)
        if not any("175(3)" in r or "magistrate" in r for r in existing_rights):
            rights_list.append(magistrate_remedy)
        analysis.rights = rights_list[:5]

    return analysis


def _get_llm(model_preference: str = "deep", force_reinit: bool = False, key_record=None):
    """Lazily initialize the selected Google model for the active API key."""

    global _llms
    key_record = key_record or get_current_key_record()
    if key_record is None:
        raise RuntimeError("No active Gemini API keys are configured.")
    target_model = getattr(key_record, "model", None) or (
        "gemini-2.5-flash" if model_preference == "quick" else settings.llm_model
    )

    cache_key = (target_model, key_record.id)
    if cache_key in _llms and not force_reinit:
        return _llms[cache_key], target_model, key_record.id

    from langchain_google_genai import ChatGoogleGenerativeAI

    _llms[cache_key] = ChatGoogleGenerativeAI(
        model=target_model,
        temperature=settings.llm_temperature,
        google_api_key=key_record.secret,
        # The response is a compact structured analysis. A large output budget
        # makes Gemma spend much longer producing JSON and increases the risk of
        # repetitive generations without improving the user-facing answer.
        max_output_tokens=3072 if model_preference == "deep" else 1024,
        retries=1,
    )
    logger.info(
        "LLM initialized: provider=google_genai, model=%s, temp=%.2f",
        target_model,
        settings.llm_temperature,
    )
    return _llms[cache_key], target_model, key_record.id


def _verify_law_candidates(
    analysis: StructuredAnalysis,
    registry: LawSourceRegistry,
    fallback_statutes: list | None = None,
) -> list[SourceChunk]:
    """Hydrate model candidates from the registry, resolve concordances, and strictly discard hallucinations."""

    from models.schemas import ApplicableLaw

    preliminary_sections = {
        ("BNS", "1"), ("BNS", "2"), ("BNS", "3"), ("BNS", "4"), ("BNS", "5"),
        ("BNS", "6"), ("BNS", "7"), ("BNS", "8"), ("BNS", "9"), ("BNS", "10"),
        ("BNSS", "1"), ("BNSS", "2"), ("BNSS", "6"), ("BNSS", "7"), ("BNSS", "8"),
        ("BNSS", "9"), ("BNSS", "10"), ("BSA", "1"), ("BSA", "2"), ("BSA", "8"),
    }

    source_chunks: list[SourceChunk] = []
    verified_laws = []
    seen_keys: set[tuple[str, str]] = set()

    for law in analysis.applicable_laws:
        # Never trust quote/exact_text supplied by the provider, even if a model
        # ignores the prompt and returns a plausible-looking quotation.
        law.quote = ""
        law.exact_text = None
        law.source_url = None
        law.source_version = None
        law.source_hash = None
        law.quote_status = "unverified"
        law.verified = False

        record = registry.lookup(
            law.act,
            law.section,
            code=law.code,
            subsection=law.subsection,
        )
        if record is None:
            # Deterministically resolve concordances (e.g. IPC 420 -> BNS 318, CrPC 438 -> BNSS 482)
            record = registry.resolve_concordance(law.code or law.act, law.section)

        if record is None:
            # STRICT GUARD: Discard hallucinated or unverified sections
            logger.warning(
                "Discarding unverified/hallucinated legal citation: act=%r code=%r section=%r",
                law.act,
                law.code,
                law.section,
            )
            continue

        key = (record.code, record.section)
        if key in preliminary_sections:
            logger.warning(
                "Discarding preliminary/definition law candidate from model: code=%r section=%r",
                record.code,
                record.section,
            )
            continue

        if key in seen_keys:
            continue
        seen_keys.add(key)

        law.act = record.act
        law.code = record.code
        law.section = record.section
        law.subsection = record.subsection
        law.exact_text = record.exact_text
        law.quote = record.exact_text
        law.source_url = record.source_url
        law.source_version = record.source_version
        law.source_hash = record.source_hash
        law.quote_status = "backend_verified"
        law.verified = True
        verified_laws.append(law)

        source_chunks.append(
            SourceChunk(
                content=record.exact_text,
                document_name=record.act,
                act=record.act,
                code=record.code,
                section=record.section,
                subsection=record.subsection,
                exact_text=record.exact_text,
                quote=record.exact_text,
                verified=True,
                relevance_score=1.0,
                source_url=record.source_url,
                source_version=record.source_version,
                source_hash=record.source_hash,
                quote_status="backend_verified",
            )
        )

    analysis.applicable_laws = verified_laws
    return source_chunks


def _apply_bns_303_bail_rule(analysis: StructuredAnalysis, context_text: str) -> SourceChunk | None:
    """Apply the reviewed BNSS First Schedule classification for BNS 303(2)."""
    alleges_theft = any(
        (law.code or law.act).upper() == "BNS"
        and re.match(r"^303(?:\(2\))?$", str(law.section).strip())
        for law in analysis.applicable_laws
    )
    if not alleges_theft:
        return None

    schedule_text = (
        "BNSS First Schedule, Part I, entry BNS 303(2): Theft — Cognizable; Non-bailable; "
        "triable by Any Magistrate. Separate low-value entry: where the stolen property's value is "
        "less than ₹5,000 and its value is returned or the property restored, the entry is "
        "Non-cognizable and Bailable. BNS Section 303(2)'s community-service punishment also "
        "requires a first conviction."
    )
    context = (context_text or "").lower()
    same_property_exception = bool(re.search(
        r"(?:stolen\s+(?:property|item)|property\s+stolen|item\s+stolen)"
        r"[^.!?;]{0,100}(?:less\s+than|below|under|worth|valued\s+at)"
        r"[^.!?;]{0,35}(?:₹\s*|rs\.?\s*|rupees?\s*)?[0-4],?\d{0,3}\b"
        r"[^.!?;]{0,100}(?:returned|restored)",
        context,
    ))
    if same_property_exception:
        analysis.bail_status = (
            "Bailable under the BNSS First Schedule's separate entry for theft valued below ₹5,000 "
            "when the value is returned or the property is restored. The community-service punishment "
            "under BNS 303(2) additionally requires a first conviction. Confirm the value and return/restoration facts."
        )
    else:
        analysis.bail_status = (
            "Ordinary theft under BNS 303(2) is non-bailable under the BNSS First Schedule, but bail "
            "is still possible: the Magistrate may consider release under BNSS 480. The Schedule has "
            "a separate bailable entry if the stolen property's value is below ₹5,000 and its value is "
            "returned or the property restored; the community-service punishment also requires a first conviction. "
            "The value, prior-conviction and return/restoration facts were not established here."
        )
    return SourceChunk(
        content=schedule_text,
        document_name="BNSS First Schedule",
        act="Bharatiya Nagarik Suraksha Sanhita, 2023",
        code="BNSS",
        section="First Schedule, Part I — BNS 303(2)",
        quote="",
        verified=False,
        source_url="https://www.ncrb.mha.gov.in/uploads/SankalanPortal/ScheduleBNSS.html",
        source_version="NCRB BNSS First Schedule, reviewed 2026-11-14",
        quote_status="unverified",
    )


def _ensure_custody_first_aid(analysis: StructuredAnalysis, context_text: str) -> SourceChunk | None:
    """Fill essential custody rights and immediate steps when custody is stated."""
    text = (context_text or "").lower()
    affirmative_custody = bool(re.search(
        r"\b(?:arrested|in custody|police custody|detained|taken into custody)\b", text
    ))
    if not affirmative_custody:
        return None
    if (
        re.search(r"\b(?:hypothetically|if someone is arrested|if a person is arrested)\b", text)
        and not re.search(r"\b(?:my|our|his|her|their|brother|sister|son|daughter|husband|wife|father|mother)\b", text)
    ):
        return None
    if re.search(r"\b(?:not arrested|wasn't arrested|not in custody)\b", text) and not re.search(
        r"\b(?:was|has been|got|had been) arrested\b", text
    ):
        return None

    required_rights = [
        "For an offence punishable up to seven years, BNSS Section 35 requires police to assess whether arrest is necessary; if it is not, they should issue an appearance notice. Ask for the full grounds of arrest under Section 47. Cognizability alone does not make arrest automatic.",
        "The arrested person may meet an advocate of their choice during interrogation under BNSS Section 38.",
        "Police must inform a nominated relative or friend of the arrest and place of detention under BNSS Section 48.",
        "They must be taken before a Magistrate without unnecessary delay and not detained beyond 24 hours, excluding necessary travel time, under BNSS Sections 57–58 and Article 22(2) of the Constitution.",
        "A person in custody is eligible for free legal services under Section 12(g) of the Legal Services Authorities Act, 1987; ask the Magistrate or jail legal aid clinic for a DLSA lawyer, or call NALSA 15100.",
    ]
    analysis.rights = required_rights

    required_steps = [
        "Call the police station; confirm the FIR number, arrest time, officer in charge, and where the person is being held.",
        "Ask when and where the person will be produced before the Magistrate; record the time and court details.",
        "Request a DLSA lawyer through the police station or Magistrate now; call NALSA 15100 if needed.",
        "Ask the legal aid lawyer to review the FIR and seek bail before the competent court. Non-bailable means bail is discretionary, not barred.",
    ]
    analysis.next_24_hours = required_steps
    aid_text = (
        "NALSA states that persons in custody are eligible for free legal services under Section 12(g) "
        "of the Legal Services Authorities Act, 1987. NALSA legal-aid helpline: 15100."
    )
    return SourceChunk(
        content=aid_text,
        document_name="National Legal Services Authority — Legal Aid",
        act="Legal Services Authorities Act, 1987",
        code="LSA",
        section="Section 12(g)",
        quote="",
        verified=False,
        source_url="https://nalsa.gov.in/legal-aid/",
        source_version="NALSA Legal Aid page, reviewed 2026-11-14",
        quote_status="unverified",
    )


async def run_analysis_pipeline(
    query: str,
    document_filter: Optional[str] = None,
    top_k: Optional[int] = None,
    model_preference: Optional[str] = "quick",
    user_id: Optional[str] = None,
    ephemeral_context: Optional[str] = None,
    conversation_history: Optional[list[dict[str, str]]] = None,
    source_registry: LawSourceRegistry | None = None,
    media_attachments: Optional[list[dict]] = None,
) -> AnalysisResponse:
    """Run direct model analysis and deterministic legal-source verification.

    ``document_filter``, ``top_k``, and ``user_id`` remain accepted for API
    compatibility with older callers, but normal chat does not use local RAG.
    ``ephemeral_context`` is still passed to the model as user-provided context.
    ``conversation_history`` contains bounded, already-compacted prior turns.
    """

    del document_filter, top_k, user_id, model_preference
    model_preference = "quick"

    start_time = time.time()
    registry = source_registry if source_registry is not None else get_registry()
    recent_user_context = "\n".join(
        str(item.get("content") or "").strip()[:1200]
        for item in (conversation_history or [])[-4:]
        if item.get("role") == "user" and str(item.get("content") or "").strip()
    )
    scan_text = f"{recent_user_context}\n{query or ''}\n{ephemeral_context or ''}".strip()
    requested_law = _requested_law_record(query, registry)
    relevant_statutes = _select_relevant_statutes(query or "", scan_text, registry)
    fallback_records = [rec for rec, _, _ in relevant_statutes]
    has_media = bool(media_attachments)
    if has_media and not any(
        record.provider == "google" and "gemini" in (record.model or "").lower()
        for record in _quick_routes()
    ):
        raise RuntimeError(
            "This chat contains an image or scanned PDF, but no vision-capable Gemini route is configured. "
            "Configure a Gemini model to analyze visual attachments."
        )
    if model_preference == "quick" and is_quick_temporarily_unavailable() and not _quick_routes():
        raise QuickModelUnavailableError(
            "Quick Thinking is temporarily unavailable because all configured Quick Thinking providers are rate-limited or unavailable."
        )

    messages = _build_prompt_messages(
        query,
        ephemeral_context,
        conversation_history,
        requested_law=requested_law,
        relevant_statutes=relevant_statutes,
        media_attachments=media_attachments,
    )

    if model_preference == "quick":
        structured_analysis, actual_model_used = await _run_quick_provider_pipeline(
            messages,
            time.monotonic() + min(settings.analysis_deadline_seconds, 20.0),
        )
        if not has_media:
            _ensure_requested_law_candidate(structured_analysis, requested_law)
        if requested_law is not None and _DIRECT_SECTION_INTENT.search(query or "") and not has_media:
            _enforce_direct_section_match(structured_analysis, requested_law, registry)
        source_chunks = _verify_law_candidates(structured_analysis, registry, fallback_statutes=fallback_records)
        structured_analysis = _enforce_bail_and_statutory_remedies(structured_analysis, scan_text)
        schedule_source = _apply_bns_303_bail_rule(structured_analysis, scan_text)
        aid_source = _ensure_custody_first_aid(structured_analysis, scan_text)
        if schedule_source:
            source_chunks.append(schedule_source)
        if aid_source:
            source_chunks.append(aid_source)
        elapsed = round(time.time() - start_time, 2)
        return AnalysisResponse(
            query=query,
            analysis=structured_analysis,
            sources=source_chunks,
            model_used=actual_model_used,
            processing_time_seconds=elapsed,
        )

    active_model_preference = model_preference
    deep_fallback_used = False
    deadline = (
        time.monotonic() + settings.analysis_deadline_seconds
        if model_preference == "deep"
        else None
    )
    llm, actual_model_used, key_id = _get_llm(active_model_preference)
    quick_key_attempts = 0
    while True:
        try:
            structured_llm = llm.with_structured_output(StructuredAnalysis)
            timeout = None
            if deadline is not None:
                remaining = max(0.1, deadline - time.monotonic())
                timeout = min(settings.deep_timeout_seconds, remaining) if active_model_preference == "deep" else remaining
            invoke = structured_llm.ainvoke(messages)
            response = await asyncio.wait_for(invoke, timeout=timeout) if timeout else await invoke
            structured_analysis = (
                response
                if isinstance(response, StructuredAnalysis)
                else StructuredAnalysis.model_validate(response)
            )
            structured_analysis = _sanitize_analysis(structured_analysis)
            _require_readable_analysis(structured_analysis)
            record_provider_attempt(key_id, actual_model_used, "success")
            if active_model_preference == "quick":
                clear_quick_temporarily_unavailable()
            break
        except asyncio.TimeoutError as exc:
            record_provider_attempt(key_id, actual_model_used, "failure", exc)
            if model_preference == "deep" and active_model_preference == "deep" and not deep_fallback_used:
                logger.warning(
                    "Deep Thinking exceeded %.1fs; falling back to Gemini Flash before the %.1fs deadline.",
                    settings.deep_timeout_seconds,
                    settings.analysis_deadline_seconds,
                )
                if is_quick_temporarily_unavailable():
                    raise RuntimeError(
                        "Deep Thinking exceeded its response deadline and Quick Thinking is temporarily unavailable."
                    ) from exc
                active_model_preference = "quick"
                deep_fallback_used = True
                llm, actual_model_used, key_id = _get_llm("quick", force_reinit=True)
                continue
            logger.error("LLM generation exceeded the response deadline.")
            raise RuntimeError(
                "The analysis exceeded the 20-second response deadline. Please try again."
            ) from exc
        except Exception as exc:
            last_error = exc
            quota_error = is_quota_error(exc)
            record_provider_attempt(
                key_id,
                actual_model_used,
                "quota" if quota_error else "failure",
                exc,
            )
            if quota_error:
                logger.warning("Rate limit hit during LLM generation. Attempting key rotation...")
                if active_model_preference == "quick":
                    quick_key_attempts += 1
                    if quick_key_attempts >= max(1, get_active_key_count()):
                        mark_quick_temporarily_unavailable()
                        raise QuickModelUnavailableError(
                            "Quick Thinking is temporarily unavailable because Gemini Flash "
                            "has reached the limit on all configured API keys."
                        ) from exc
                if rotate_key():
                    llm, actual_model_used, key_id = _get_llm(
                        active_model_preference,
                        force_reinit=True,
                    )
                    continue
            logger.error("LLM generation failed: %s", exc)
            raise RuntimeError(f"LLM generation failed: {exc}") from exc

    if not media_attachments:
        _ensure_requested_law_candidate(structured_analysis, requested_law)
    custody_intent = bool(re.search(
        r"\b(?:arrested|arrest|detained|in custody|police custody|remand|bail|24\s*hours)\b",
        f"{query or ''} {ephemeral_context or ''}",
        re.I,
    ))
    if (
        requested_law is not None
        and _DIRECT_SECTION_INTENT.search(query or "")
        and not custody_intent
        and not media_attachments
    ):
        _enforce_direct_section_match(structured_analysis, requested_law, registry)
    source_chunks = _verify_law_candidates(structured_analysis, registry, fallback_statutes=fallback_records)
    structured_analysis = _enforce_bail_and_statutory_remedies(structured_analysis, scan_text)
    schedule_source = _apply_bns_303_bail_rule(structured_analysis, scan_text)
    aid_source = _ensure_custody_first_aid(structured_analysis, scan_text)
    if schedule_source:
        source_chunks.append(schedule_source)
    if aid_source:
        source_chunks.append(aid_source)
    elapsed = round(time.time() - start_time, 2)
    logger.info(
        "Direct analysis complete — %d verified sources, %.2fs elapsed.",
        len(source_chunks),
        elapsed,
    )

    return AnalysisResponse(
        query=query,
        analysis=structured_analysis,
        sources=source_chunks,
        model_used=actual_model_used,
        processing_time_seconds=elapsed,
    )


def _is_complaint_fir_analysis(query: str, ephemeral_context: Optional[str] = None) -> bool:
    """Detect whether a query specifically targets the dedicated Complaint & FIR Analyser tool."""
    q = (query or "").lower().strip()
    ctx = (ephemeral_context or "").lower().strip()
    
    # Explicit tool marker sent from the dedicated Complaint Analyser tool (/dashboard/analyse)
    if "[trana complaint and fir analyser]" in q or "trana complaint and fir analyser" in q or "complaint and fir analyser" in q:
        return True
        
    # An uploaded document explicitly submitted for dedicated complaint/fir analysis
    if ("analyze the uploaded document" in q or "complaint / fir analysis" in q) and ctx:
        return True
        
    return False


def _build_prompt_messages(
    query: str,
    ephemeral_context: Optional[str],
    conversation_history: Optional[list[dict[str, str]]],
    requested_law=None,
    relevant_statutes: Optional[list] = None,
    media_attachments: Optional[list[dict]] = None,
) -> list:
    """Build messages with prior turns before the newest user prompt."""

    if requested_law is not None and _DIRECT_SECTION_INTENT.search(query or "") and not media_attachments:
        # A direct provision lookup is self-contained. Use a narrow system
        # instruction and omit chat history so a previous mistaken answer
        # cannot compete with the registry text for the model's attention.
        ref_line = (
            f"[Ref: {requested_law.act}, Section {requested_law.section} — {requested_law.former_citation}]"
            if getattr(requested_law, "former_citation", None)
            else f"[Ref: {requested_law.act}, Section {requested_law.section}]"
        )
        return [
            SystemMessage(content=_SECTION_SOURCE_SYSTEM_PROMPT),
            HumanMessage(
                content=(
                    "Explain the provision requested below in plain language. "
                    "The verified record is the sole authority for this provision.\n\n"
                    f"USER QUERY:\n{query}\n\n"
                    f"VERIFIED ACT: {requested_law.act}\n"
                    f"VERIFIED CODE: {requested_law.code}\n"
                    f"VERIFIED SECTION: {requested_law.section}\n"
                    f"MANDATORY REFERENCE: {ref_line}\n"
                    "VERIFIED STATUTORY TEXT FROM THE OFFICIAL GAZETTE:\n"
                    f"{requested_law.exact_text}"
                )
            ),
        ]

    is_complaint_fir = _is_complaint_fir_analysis(query, ephemeral_context)
    if is_complaint_fir:
        prompt = COMPLAINT_FIR_ANALYSIS_PROMPT.format(
            question=query,
            ephemeral_context=ephemeral_context or "(No uploaded document was provided.)",
        )
    else:
        prompt = (
            "Answer the Indian-law question directly and concisely. Apply relevant rules to stated facts; treat allegations as allegations, "
            "identify missing facts, answer every question, and give practical steps when requested. Use supplied source text for legal claims, "
            "cite Act and section, and state when support is missing. Do not introduce an alternative offence unless facts support it and label it conditional. "
            "For custody, prioritize free legal aid: request a DLSA lawyer through the Magistrate/police station and give NALSA 15100. "
            "Explain arrest grounds, family notice, and production within 24 hours excluding travel; do not imply automatic release. "
            "Non-bailable does not mean bail impossible. Distinguish alleged offence from procedure and never invent sections. "
            "Return the required JSON schema.\n\n"
            f"QUESTION:\n{query}\n\nFACTS / CONTEXT:\n{ephemeral_context or '(none)'}"
        )
    if media_attachments:
        prompt += (
            "\n\nATTACHMENT-LED INSTRUCTIONS: The user has supplied image or scanned-document "
            "attachments as part of this request. Inspect their visible contents before "
            "classifying the request. If the user says only 'analyze' or gives another short "
            "instruction, treat it as a request to analyze the attached document; for a "
            "contract, give a practical Indian contract review in general_analysis. If the "
            "user asks whether you can see the images, answer from what is actually visible "
            "and identify the document or readable sections. Do not use the out-of-scope "
            "response merely because the text prompt is brief. If the attachment is unreadable "
            "or is not a contract/legal document, explain what you can and cannot identify."
        )
    if requested_law is not None:
        ref_line = (
            f"[Ref: {requested_law.act}, Section {requested_law.section} — {requested_law.former_citation}]"
            if getattr(requested_law, "former_citation", None)
            else f"[Ref: {requested_law.act}, Section {requested_law.section}]"
        )
        prompt += (
            "\n\nEXACT REQUESTED STATUTE FROM THE VERIFIED SOURCE REGISTRY "
            "(this Act and section are the user's requested subject; do not "
            "substitute another code's same-numbered section):\n"
            f"Act/code: {requested_law.act} ({requested_law.code})\n"
            f"Section: {requested_law.section}\n"
            f"Official Reference: {ref_line}\n"
            f"Text: {requested_law.exact_text}\n"
            "Use this as the alleged/provision reference when relevant. Other procedural provisions may also apply; distinguish them from charged offences."
        )
    if re.search(r"\bBNS\s*(?:section\s*)?303(?:\(\d+\))?\b", f"{query or ''} {ephemeral_context or ''}", re.I):
        prompt += (
            "\n\nReviewed BNSS First Schedule, Part I, BNS 303(2) classification: ordinary theft is "
            "cognizable and non-bailable. A separate entry is non-cognizable and bailable where value "
            "is below ₹5,000 and the value is returned or the stolen property restored. BNS 303(2) "
            "community-service punishment additionally requires a first conviction. Cite the Schedule, "
            "explain that non-bailable does not mean bail impossible, and do not assume the exception facts. "
            "Source: https://www.ncrb.mha.gov.in/uploads/SankalanPortal/ScheduleBNSS.html"
        )
    if relevant_statutes:
        statute_blocks = []
        for rec, former, title in relevant_statutes:
            if requested_law is not None and (rec.code, rec.section) == (requested_law.code, requested_law.section):
                continue
            ref_str = (
                f"[Ref: {rec.act}, Section {rec.section} — {former}]"
                if former
                else f"[Ref: {rec.act}, Section {rec.section}]"
            )
            heading_str = f" ({title})" if title else ""
            statute_blocks.append(
                f"### {rec.code} Section {rec.section}{heading_str}\n"
                f"Official Reference: {ref_str}\n"
                f"Verbatim Statutory Text (Gazette of India):\n\"\"\"\n{rec.exact_text}\n\"\"\""
            )
        if statute_blocks:
            prompt += (
                "\n\nOFFICIAL STATUTORY PROVISIONS EXTRACTED VERBATIM FROM THE 2023 GAZETTE PUBLICATIONS (BNS, BNSS, BSA):\n"
                "Ground your legal analysis, rights, bail determination, and procedures STRICTLY in the following official provisions. "
                "Do NOT invent sections, and do NOT confuse IPC/CrPC numbers with BNS/BNSS numbers. Whenever citing a section, use the exact statutory reference format:\n\n"
                + "\n\n---\n\n".join(statute_blocks)
            )

    active_system_prompt = COMPLAINT_FIR_ANALYSIS_SYSTEM_PROMPT if is_complaint_fir else (
        "You are TRANA, an Indian legal information assistant. Apply supplied legal sources to facts, explain uncertainty, "
        "avoid inventing law or guaranteeing outcomes, and return valid JSON matching the analysis schema."
    )
    messages = [SystemMessage(content=active_system_prompt)]
    for item in (conversation_history or [])[-4:]:
        role = item.get("role")
        content = str(item.get("content") or "").strip()[:1200]
        if not content:
            continue
        if role == "user":
            messages.append(HumanMessage(content=content))
    content = prompt
    if media_attachments:
        blocks = []
        for attachment in media_attachments:
            mime_type = attachment.get("content_type", "")
            raw = attachment.get("content", b"")
            if mime_type not in {"image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "application/pdf"}:
                continue
            blocks.append({
                "type": "media",
                "mime_type": mime_type,
                "data": base64.b64encode(raw).decode("ascii"),
            })
        blocks.append({"type": "text", "text": prompt})
        content = blocks
    messages.append(HumanMessage(content=content))
    return messages


def _requested_law_record(query: str, registry: LawSourceRegistry):
    """Resolve an explicitly named code and section before asking the model."""

    match = _EXPLICIT_LAW_SECTION.search(query or "")
    if not match:
        return None
    if match.group(1):
        code, section = match.group(1), match.group(2)
    else:
        section, code = match.group(3), match.group(4)
    return registry.resolve_concordance(code=code, section=section)


def _ensure_requested_law_candidate(analysis: StructuredAnalysis, record) -> None:
    """Keep a user-named provision in the evidence set even if generation omits it."""
    if record is None:
        return
    if any(
        (law.code or law.act).upper() == record.code and str(law.section).strip() in {
            record.section,
            f"{record.section}({record.subsection})" if record.subsection else record.section,
        }
        for law in analysis.applicable_laws
    ):
        return
    from models.schemas import ApplicableLaw

    analysis.applicable_laws.insert(0, ApplicableLaw(
        act=record.act,
        code=record.code,
        section=record.section,
        subsection=record.subsection,
        explanation="Provision expressly named by the user; allegation only, not a finding that it applies.",
    ))


def _select_relevant_statutes(query: str, scan_text: str, registry: LawSourceRegistry) -> list:
    """Retrieve a compact evidence set without inferring BNS 305 from theft alone."""
    statutes = registry.find_relevant_statutes(scan_text, top_k=3)
    custody_query = bool(re.search(
        r"\b(?:arrested|arrest|detained|in custody|police custody|remand|bail|24\s*hours)\b",
        scan_text,
        re.I,
    ))
    if custody_query:
        present = {(record.code, record.section) for record, _, _ in statutes}
        for section in ("35", "38", "47", "48", "57", "58", "480"):
            record = registry.lookup(code="BNSS", section=section)
            if record and (record.code, record.section) not in present:
                statutes.append((record, None, record.heading or ""))
                present.add((record.code, record.section))
    if _EXPLICIT_LAW_SECTION.search(query or "") and re.search(
        r"\bBNS\s*(?:section\s*)?303(?:\(\d+\))?\b", query or "", re.I
    ):
        aggravated_context = re.search(
            r"\b(?:dwelling house|means of transport|place of worship|vehicle used for transport|cargo|warehouse)\b",
            scan_text,
            re.I,
        )
        if not aggravated_context:
            statutes = [
                item for item in statutes
                if not (item[0].code == "BNS" and item[0].section == "305")
            ]
    return statutes


def _enforce_direct_section_match(
    analysis: StructuredAnalysis,
    record,
    registry: LawSourceRegistry,
) -> None:
    """Keep a mismatched generated section from being presented as verified."""

    from models.schemas import ApplicableLaw

    resolved_candidates = [
        registry.lookup(
            law.act,
            law.section,
            code=law.code,
            subsection=law.subsection,
        )
        for law in analysis.applicable_laws
    ]
    has_matching_citation = any(
        candidate is not None
        and (candidate.code, candidate.section) == (record.code, record.section)
        for candidate in resolved_candidates
    )
    has_conflicting_citation = not has_matching_citation or any(
        candidate is not None
        and (candidate.code, candidate.section) != (record.code, record.section)
        for candidate in resolved_candidates
    )

    if has_conflicting_citation:
        # Do not silently rewrite (and thereby "verify") a different model
        # answer as the section the user requested. Fail closed; the verified
        # statutory text is still attached as a source below.
        analysis.general_analysis = (
            "I couldn't reliably match the explanation to the section you "
            "asked about. Here is the verified statutory text:\n\n" + record.exact_text
        )
        analysis.situation_meaning = ""
        analysis.bail_status = ""
        analysis.next_24_hours = []
        analysis.rights = []
        analysis.handling_authority = ""

    matching_law = next(
        (
            law
            for law, candidate in zip(analysis.applicable_laws, resolved_candidates)
            if candidate is not None
            and (candidate.code, candidate.section) == (record.code, record.section)
        ),
        None,
    )
    analysis.applicable_laws = [
        matching_law
        or ApplicableLaw(act=record.act, code=record.code, section=record.section)
    ]
    analysis.requires_sources = True
