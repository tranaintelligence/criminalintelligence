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
from dataclasses import replace
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
    DIRECT_ANALYSIS_PROMPT,
    SYSTEM_PROMPT,
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
_SECTION_SOURCE_SYSTEM_PROMPT = SYSTEM_PROMPT + "\n\n" + _SECTION_SOURCE_SYSTEM_PROMPT
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
            if family == "gpt-oss":
                route_priority = 0
            elif family == "llama":
                route_priority = 1
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
    normalized = dict(payload)

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
    if not normalized.get("situation_meaning"):
        normalized["situation_meaning"] = (
            normalized.get("complaint_analysis")
            or normalized.get("summary")
            or normalized.get("overview")
            or normalized.get("analysis")
            or normalized.get("statutory_analysis")
            or normalized.get("case_summary")
            or normalized.get("allegations_summary")
            or normalized.get("details")
            or ""
        )
    if not normalized.get("general_analysis"):
        normalized["general_analysis"] = (
            normalized.get("legal_analysis")
            or normalized.get("legal_summary")
            or normalized.get("findings")
            or normalized.get("explanation")
            or normalized.get("content")
            or normalized.get("situation_meaning")
            or ""
        )
    if not normalized.get("bail_status"):
        normalized["bail_status"] = (
            normalized.get("bail")
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
    if not normalized.get("next_24_hours"):
        normalized["next_24_hours"] = (
            normalized.get("immediate_steps")
            or normalized.get("action_plan")
            or normalized.get("recommended_actions")
            or normalized.get("steps")
            or normalized.get("procedural_steps")
            or []
        )
    if not normalized.get("rights"):
        normalized["rights"] = (
            normalized.get("legal_rights")
            or normalized.get("accused_rights")
            or normalized.get("citizen_rights")
            or normalized.get("statutory_safeguards")
            or []
        )

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
    payload = {
        "model": record.model,
        "messages": [
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
        ],
        "temperature": settings.llm_temperature,
        "max_tokens": 4096,
    }
    if record.provider == "groq":
        # GPT-OSS exposes reasoning separately. JSON Object Mode keeps the
        # assistant content parseable across Groq responses, while disabling
        # the reasoning field prevents it from being mixed into the answer.
        payload["response_format"] = {"type": "json_object"}
        payload["include_reasoning"] = False
        if _model_family(record.model) == "gpt-oss":
            payload["reasoning_effort"] = "low"
    headers = {"Authorization": f"Bearer {record.secret}", "Content-Type": "application/json"}
    request_timeout = timeout or 20.0
    async with httpx.AsyncClient(timeout=request_timeout) as client:
        response = await client.post(f"{base_url}/chat/completions", headers=headers, json=payload)
    if response.status_code >= 400:
        raise RuntimeError(f"{record.provider} HTTP {response.status_code}: {response.text[:300]}")
    body = response.json()
    try:
        content = body.get("choices", [{}])[0].get("message", {}).get("content", "")
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
        # Gemini API quotas are model-specific. Gemma 4 can also read image
        # inputs, so try it once with the first configured Google key when a
        # Gemini route is quota-limited or returns an empty structured result.
        if (settings.llm_model or "").lower().startswith("gemma-4"):
            routes.insert(1, replace(routes[0], model=settings.llm_model))
    if not routes:
        raise QuickModelUnavailableError("Quick Thinking is temporarily unavailable because no Quick Thinking providers are configured.")
    attempted = set()
    empty_analysis_error = None
    quota_error_seen = False
    diagnostic_log = []
    for record in routes:
        route_identity = (record.id, record.model)
        if route_identity in attempted:
            continue
        attempted.add(route_identity)
        is_gemma_fallback = has_media and record.model == settings.llm_model and (
            record.model or ""
        ).lower().startswith("gemma-4")
        if is_gemma_fallback and not (quota_error_seen or empty_analysis_error):
            continue
        remaining = max(0.1, (deadline - time.monotonic()) if deadline else 8.0)
        diagnostic_log.append(
            f"route start: provider={record.provider} model={record.model} key_id={record.id}"
        )
        try:
            if record.provider == "google":
                llm, _, key_id = _get_llm("quick", force_reinit=True, key_record=record)
                structured = None if is_gemma_fallback else llm.with_structured_output(StructuredAnalysis)
                analysis = None
                for attempt in range(2):
                    diagnostic_log.append(
                        f"generation attempt: provider={record.provider} model={record.model} "
                        f"attempt={attempt + 1}/2"
                    )
                    request_messages = messages
                    if attempt:
                        request_messages = [
                            *messages,
                            HumanMessage(content=(
                                "Your previous response contained no readable analysis. "
                                "Analyze the attached document now. Put the complete, useful "
                                "answer in general_analysis. If text is unclear, say what is "
                                "unclear and still summarize the readable clauses. Do not return "
                                "blank fields."
                            )),
                        ]
                    remaining = max(0.1, (deadline - time.monotonic()) if deadline else remaining)
                    if is_gemma_fallback:
                        response = await asyncio.wait_for(
                            llm.ainvoke(request_messages), timeout=remaining
                        )
                        candidate = _parse_structured_analysis_content(response.content)
                    else:
                        response = await asyncio.wait_for(
                            structured.ainvoke(request_messages), timeout=remaining
                        )
                        candidate = (
                            response if isinstance(response, StructuredAnalysis)
                            else StructuredAnalysis.model_validate(response)
                        )
                    try:
                        analysis = _require_readable_analysis(candidate)
                        break
                    except EmptyAnalysisError as exc:
                        empty_analysis_error = exc
                        diagnostic_log.append(
                            f"empty structured response: provider={record.provider} "
                            f"model={record.model} attempt={attempt + 1}/2"
                        )
                        if attempt:
                            raise
                if analysis is None:
                    raise EmptyAnalysisError("The model returned no readable analysis.")
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
            quota_error = is_quota_error(exc) or isinstance(exc, asyncio.TimeoutError)
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
                continue
            error_text = str(exc).lower()
            retryable = quota_error or any(marker in error_text for marker in (
                "http 408", "http 500", "http 502", "http 503", "connection", "temporarily",
            ))
            if not retryable:
                if empty_analysis_error is None:
                    raise RuntimeError(f"Quick Thinking provider configuration failed: {exc}") from exc
                continue
            continue
    if empty_analysis_error is not None:
        # The request completed, but every vision route returned blank fields.
        # Return a clear, non-empty answer so clients never render an empty chat
        # bubble or lose the fact that the image request reached the model.
        return StructuredAnalysis(
            general_analysis=(
                "I received the attached document, but couldn't produce an "
                "analysis after retrying. Please resend the images or ask about "
                "a specific clause so I can try a narrower analysis.\n\n"
                "Temporary diagnostics for this request (credentials and image "
                "content are excluded):\n```text\n"
                + "\n".join(diagnostic_log)
                + "\n```"
            )
        ), "quick:vision-empty-response"
    mark_quick_temporarily_unavailable()
    raise QuickModelUnavailableError("Quick Thinking is temporarily unavailable because all configured Quick Thinking providers are rate-limited or unavailable.")


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
    (re.compile(r"\b(?:Section\s+)?420\s+(?:of\s+)?BNS\b", re.IGNORECASE), "Section 318 of BNS (formerly Section 420 IPC)"),
    (re.compile(r"\b(?:Section\s+)?302\s+(?:of\s+)?BNS\b", re.IGNORECASE), "Section 103 of BNS (formerly Section 302 IPC)"),
    (re.compile(r"\b(?:Section\s+)?304A\s+(?:of\s+)?BNS\b", re.IGNORECASE), "Section 106 of BNS (formerly Section 304A IPC)"),
    (re.compile(r"\b(?:Section\s+)?498A\s+(?:of\s+)?BNS\b", re.IGNORECASE), "Section 85 of BNS (formerly Section 498A IPC)"),
    (re.compile(r"\b(?:Section\s+)?376\s+(?:of\s+)?BNS\b", re.IGNORECASE), "Section 64 of BNS (formerly Section 376 IPC)"),
    (re.compile(r"\b(?:Section\s+)?379\s+(?:of\s+)?BNS\b", re.IGNORECASE), "Section 303 of BNS (formerly Section 379 IPC)"),
    (re.compile(r"\b(?:Section\s+)?506\s+(?:of\s+)?BNS\b", re.IGNORECASE), "Section 351 of BNS (formerly Section 506 IPC)"),
    (re.compile(r"\b(?:Section\s+)?41A?\s+(?:of\s+)?BNSS\b", re.IGNORECASE), "Section 35 of BNSS (formerly Section 41/41A CrPC)"),
    (re.compile(r"\b(?:Section\s+)?438\s+(?:of\s+)?BNSS\b", re.IGNORECASE), "Section 482 of BNSS (formerly Section 438 CrPC)"),
    (re.compile(r"\b(?:Section\s+)?437\s+(?:of\s+)?BNSS\b", re.IGNORECASE), "Section 480 of BNSS (formerly Section 437 CrPC)"),
    (re.compile(r"\b(?:Section\s+)?436\s+(?:of\s+)?BNSS\b", re.IGNORECASE), "Section 478 of BNSS (formerly Section 436 CrPC)"),
    (re.compile(r"\b(?:Section\s+)?165\s+(?:of\s+)?BNSS\b", re.IGNORECASE), "Section 185 of BNSS (formerly Section 165 CrPC)"),
    (re.compile(r"\b(?:Section\s+)?65B\s+(?:of\s+)?BSA\b", re.IGNORECASE), "Section 63 of BSA (formerly Section 65B Indian Evidence Act)"),
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

    # Backfill with verified statutes retrieved for this query if model produced no valid laws
    if not verified_laws and fallback_statutes:
        for record in fallback_statutes[:3]:
            key = (record.code, record.section)
            if key in seen_keys:
                continue
            seen_keys.add(key)
            flaw = ApplicableLaw(
                act=record.act,
                code=record.code,
                section=record.section,
                subsection=record.subsection,
                exact_text=record.exact_text,
                quote=record.exact_text,
                explanation=record.heading or getattr(record, "canonical_title", "") or f"Statutory provision under {record.code} Section {record.section}.",
                source_url=record.source_url,
                source_version=record.source_version,
                source_hash=record.source_hash,
                quote_status="backend_verified",
                verified=True,
            )
            verified_laws.append(flaw)
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

    # Retain up to 4 applicable laws and source chunks
    analysis.applicable_laws = verified_laws[:4]
    return source_chunks[:4]


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
    requested_law = _requested_law_record(query, registry)
    relevant_statutes = registry.find_relevant_statutes(query, top_k=4)
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
        if requested_law is not None and _DIRECT_SECTION_INTENT.search(query or "") and not has_media:
            _enforce_direct_section_match(structured_analysis, requested_law, registry)
        source_chunks = _verify_law_candidates(structured_analysis, registry, fallback_statutes=fallback_records)
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

    if requested_law is not None and _DIRECT_SECTION_INTENT.search(query or "") and not media_attachments:
        _enforce_direct_section_match(structured_analysis, requested_law, registry)
    source_chunks = _verify_law_candidates(structured_analysis, registry, fallback_statutes=fallback_records)
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


def _is_complaint_fir_analysis(query: str) -> bool:
    q = (query or "").lower()
    return any(marker in q for marker in [
        "trana complaint and fir analyser",
        "complaint and fir analyser",
        "complaint / fir analysis",
        "criminal complaint / fir analysis",
        "complaint and fir analysis",
        "complaint analyser",
        "fir analyser",
        "analyze the uploaded document",
    ])


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

    is_complaint_fir = _is_complaint_fir_analysis(query)
    if is_complaint_fir:
        prompt = COMPLAINT_FIR_ANALYSIS_PROMPT.format(
            question=query,
            ephemeral_context=ephemeral_context or "(No uploaded document was provided.)",
        )
    else:
        prompt = DIRECT_ANALYSIS_PROMPT.format(
            question=query,
            ephemeral_context=ephemeral_context or "(No uploaded document was provided.)",
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
            "Explain only this provision. Do not describe another Act's "
            "section with the same number. Cite this exact Act and section."
        )
    elif relevant_statutes:
        statute_blocks = []
        for rec, former, title in relevant_statutes:
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

    active_system_prompt = COMPLAINT_FIR_ANALYSIS_SYSTEM_PROMPT if is_complaint_fir else SYSTEM_PROMPT
    messages = [SystemMessage(content=active_system_prompt)]
    for item in conversation_history or []:
        role = item.get("role")
        content = str(item.get("content") or "").strip()
        if not content:
            continue
        if role == "assistant":
            messages.append(AIMessage(content=content))
        elif role == "user":
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
