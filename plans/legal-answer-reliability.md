# TRANA legal-answer reliability implementation plan

Status: implementation in progress. Core scoped chat fixes landed 2026-11-14; staged rollout and full evaluation remain.

## Objective and constraints

Correct the supplied custody/theft failure through evidence selection, bounded generation, and deterministic validation. A retrieved provision proves the source text exists; it does not prove the model's conclusion applies to the user's facts.

Commercial objective: minimize measured tokens and cost per successful answer while preserving legal accuracy. At most two LLM calls per message; one is the normal path. Start with deterministic local intake. Add a tiny extraction call only when ambiguity/complexity makes it worthwhile; it extracts facts, exact sections, urgency, and user questions but never decides law or drafts an answer. The grounded answer call applies reviewed law to facts and explains its reasoning. 8,000 input-plus-output tokens/minute is a hard throughput ceiling, not an answer target. No retries, provider fallback, repair, or reviewer calls. On failure or unavailable budget, use deterministic safe response. Preserve existing output limits and 20-second deadline.

- Never retry. Use deterministic local parsing by default; make the tiny extraction call only when expected quality gain justifies its token cost. Compile the legal prompt from needed instructions, facts, reviewed rules, and excerpts; remove unrelated prompt sections, repeated directives, old assistant turns, and unused schema fields. Measure provider-reported tokens and cost per stage; reduce median and p95 while meeting legal-quality gates. Enforce 8,000 TPM as a shared hard ceiling, never a target. Set the minimum output budget that reliably covers urgent rights/actions/reasoning. Reserve estimated usage across workers before each call; release unused reservation when usage is reported. Disable SDK retries. No LLM calls for validation or fallback.
- Preserve existing provider-specific output ceilings initially: OpenAI-compatible route 4,096 tokens; Google quick route 1,024 tokens. They currently differ. Measure truncation before changing either; append required rights and action steps from reviewed rules outside generation.
- Keep offline additions small: no local model, embeddings, new retrieval index, large rules engine, or new database. Reuse the existing registry; add only compact reviewed rules and small pure-Python helpers (under 500 new runtime lines; under 20 KB rule data). Count all input/output tokens. Prefer supported tokenizer counts; otherwise estimate conservatively. Never truncate material facts or legal qualifications: reduce history and optional evidence first, then use one-call mode or deterministic fallback.
- The total wall-clock deadline includes preparation, both attempts, validation, and rendering preparation. Never start another attempt after time or input/output allowance is exhausted. Preserve more restrictive existing account limits and rate limits.
- No schema migration, authentication changes, hosting changes, new vector database, or resurrection of legacy RAG. Preserve Vercel frontend, Render backend, Supabase, and Google OAuth.
- Scope: normal criminal-law chat. Keep the dedicated Complaint Analyser prompt and behavior isolated; test shared code against it. No broad UI redesign or claim that all Indian legal issues are covered.

## Phase 0 — Documentation discovery and baseline

Read before implementation:

| Existing source | Verified pattern and implication |
| --- | --- |
| `legal_sources/README.md`; `legal_sources/registry.py:24,389,407` | Frozen `LawRecord`, startup hash validation, local official-text corpus; reuse for source identity and provenance. A hash establishes stored-text integrity, not continuing legal currency. |
| `legal_sources/registry.py:499` | `find_relevant_statutes(query, top_k=4)` returns `(LawRecord, former_citation, canonical_title)` tuples; explicit matching is followed by broader heuristics. It is not semantic proof of applicability. |
| `llm/chain.py:1004,1186,1314` | `run_analysis_pipeline`, `_build_prompt_messages`, `_requested_law_record`; normal chat uses direct generation plus registry checks, not local RAG. The requested-law helper returns only the first reference. |
| `llm/chain.py:752,864` | `_enforce_bail_and_statutory_remedies` can overwrite with unrelated robbery/snatching/extortion text; `_verify_law_candidates` backfills and limits sources to four. Remove those failure mechanisms within this scope. |
| `llm/chain.py:390,493,847`; `config.py` | OpenAI-compatible output 4,096; Google quick output 1,024; Google has an inner two-attempt loop and outer route iteration; analysis deadline 20 seconds. Apply one shared attempt budget, not a new retry layer. |
| `models/schemas.py:292,321`; `src/lib/trana-types.ts` | Existing `ApplicableLaw`, `StructuredAnalysis`, `AnalysisResponse`; extend additively with defaults and preserve old saved responses. |
| `src/components/Chat/MessageBubble.tsx:34,272`; `dashboard.chat.tsx` | Existing source badges and answer formatting; verify visible output, not merely backend fields. |
| `main.py` history clipping and `/api/analyze`; `package.json`; `vitest.config.ts` | Reuse bounded history and endpoint response contract; frontend has Vitest/build scripts. No existing Python test suite was found in initial discovery. |

Allowed APIs: `LawSourceRegistry.lookup(act=None, section=None, *, code=None, subsection=None)`, `resolve_concordance(code, section)`, `find_relevant_statutes(query, top_k=4)`, and `StructuredAnalysis.model_validate(...)`. New application helpers below are proposals, not existing APIs. Read complete function bodies before editing; do not assume external SDK parameters.

Independent read-only discovery confirmed further constraints: normal execution forcibly selects Quick mode, so the later Deep branch is unreachable here; do not build the fix in that branch. Theft concept rules nominate both 303 and 305 (`registry.py:262`), independently of source padding. Existing deadline calculations clamp exhausted time to 0.1 seconds (`chain.py:508,534`), and HTTP timeouts are not an outer wall-clock deadline. Provider telemetry counts routes rather than individual Google generations (`chain.py:564,574`; `key_manager.py:649`), and environment-key accounting differs. Correct these budget measurements in the scoped integration. Quota telemetry is not proof that request admission limits already exist: inventory actual enforced limits and preserve them. Treat timeouts separately from provider quota errors. Missing source hashes are currently generated during loading (`registry.py:88`); require explicit reviewed hashes for newly added rules/evidence rather than presenting generated hashes as provenance verification.

Official legal review inputs, accessed 2026-11-14:

- BNSS official India Code text: https://www.indiacode.nic.in/bitstream/123456789/20340/1/bnss%2C_2023.pdf
- NCRB First Schedule: https://www.ncrb.mha.gov.in/uploads/SankalanPortal/ScheduleBNSS.html
- NALSA legal aid: https://nalsa.gov.in/legal-aid/
- Official Delhi legal-services portal for jurisdiction-specific directory review: https://dslsa.org/ (verify current contacts during source preparation; do not invent local phone numbers).

Cross-check web schedule summaries against official Act/Gazette before approving fixtures: the NCRB displayed ordinary-theft punishment row appears inconsistent with ordinary BNS 303(2) text. Do not import its punishment column blindly. Review amendments, commencement, territorial applicability, and relevant exceptions; a source URL alone is insufficient. The Schedule includes a separate low-value theft entry: classification must use reviewed branch conditions, not section number alone.

Deliverables: baseline fixture capturing the supplied failure, source manifest with reviewed dates/versions and pinpoint references, actual provider limits/configuration inventory, and an allowed-API checklist. Obtain the exact original failed prompt/response if available; until then label the reconstructed Delhi custody scenario as reconstructed.

Verify: reproduce current wrong-offence insertion and source padding using fake provider output with no paid calls. Guard: do not change production behavior during discovery or accept the expected answer as legal authority.

## Phase 1 — Exact references, facts, and question coverage

Implement a small pure Python intake module, proposed `llm/legal_intake.py`, called before evidence selection. Copy code/section normalization conventions from `legal_sources/registry.py:47,76`; retain subsection and original input span separately.

- Extract all explicit references with identities `(code, section, subsection)`, supporting `BNS 303(2)`, `section 303(2) of BNS`, multiple sections, and common spacing/case variants. Never merge BNS 35 with BNSS 35 or silently replace an explicit modern-code reference through an IPC concordance.
- Store facts with provenance: current user, earlier user message, attachment. Prior assistant output is never evidence that a person was charged or arrested. Resolve “he is still there” from bounded user history; keep uncertainty explicit.
- Separate alleged FIR sections, possible alternative offences, and procedural provisions. The FIR allegation is the starting point, not a finding of guilt. Additional offences require identified factual ingredients and explicit conditional labeling.
- Build a coverage checklist: offence explanation, bail, grounds of arrest, counsel, family notification, production deadline, legal aid, competent authority, and requested immediate/24-hour steps. Require only relevant categories; do not give a crisis playbook to greetings or general statutory questions.
- Detect current custody/urgency using explicit facts and conservative patterns, including negation (“not arrested”), hypothetical/academic queries, and multilingual variants supported by the product. If ambiguous, provide safe conditional steps and ask only essential follow-up questions without delaying urgent information.

Verify: table tests for multiple references, subsection loss, conflicting history, denied arrest, greeting, academic query, missing facts, and prompt injection in attachment text. Guard: no extra LLM extraction call; unsupported languages/facts remain uncertain.

## Phase 2 — Reviewed evidence and offence-specific rules

Reuse the registry and offline corpus workflow in `legal_sources/README.md`. Add a small versioned rule/source file for the supported custody/theft slice, proposed `legal_sources/procedural_rules.json`; do not build a general legal inference engine.

- Retrieve exact alleged provisions first, then required procedural sources. For this scenario include BNS 303(2) and needed context in 303(1), BNSS First Schedule row/exception, 35, 38, 47, 48, 57/58, 480, and reviewed legal-aid authority (Legal Services Authorities Act sections 12(g)/13 as applicable). These are roles in an evidence bundle, not additional charged offences.
- Add independently addressable Schedule rows and legal-aid sources with immutable IDs, URL, pinpoint, jurisdiction, effective/review dates, version, hash, conditions, and reviewer status. A parent section match is not an exact subsection match: extract and review subsection spans or label the quotation as the whole parent section.
- For every material legal proposition define a reviewed rule ID, conditions, allowed wording, evidence IDs, and uncertainty behavior. Bail classification, court discretion, arrest safeguards, and legal-aid eligibility use these rules; they must not be inferred from words appearing in generated prose.
- Replace the generic bail override with branch-aware outputs. Ordinary 303(2) classification and the qualifying low-value branch must be distinguished. Unknown value, first-conviction status, or restoration facts cannot be assumed. Explain non-bailable versus availability of bail under BNSS 480 without promising release. Review the section's police/court powers; avoid the existing blanket claim that police can never grant non-bailable bail.
- Remove minimum-four source backfill for this path. Return only evidence used in the answer. Replace the fixed four-source ceiling with role-based evidence selection; preserve all essential citations within an explicit context budget. Source cards can be collapsed without dropping claim references.
- Keep BNS 305 conditional unless charged or factually supported. Explicit provision lookup and custody scenario are distinct intents: a scenario mentioning 303(2) still needs BNSS procedure and legal-aid evidence. Remove “explain only this provision” instructions from that scenario path.
- Missing/stale/conflicting evidence yields an explicit limited answer and practical legal-aid route, not guessed legal classification. Cache only versioned public evidence, never a prior family's personalized answer.

Verify: source hash/ID checks; branch fixtures; unknown section; no BNS/BNSS collisions; no padded robbery/extortion sources. Guard: do not scrape authorities in live requests or treat a matching section title as claim verification.

## Phase 3 — Two compact calls for grounded legal reasoning

Integrate at `run_analysis_pipeline` and `_build_prompt_messages`, using existing schema/prompt construction patterns. Add request-local call-count and shared token-budget guards. Call 1 is a compact structured extraction only when needed; validate its fields offline and never trust it as legal analysis. Call 2 receives exact facts, user questions, source passages and a focused legal-reasoning prompt. Its reasoning must proceed through issue/allegation, applicable rule, material facts for and against each element, missing facts, conditional application, and limited conclusion. Link each legal claim to an approved evidence/rule ID. Select a route once for the sequence; no retry or provider/key fallback if either call fails. If the first output is malformed, skip call 2 and use deterministic fallback. If the token reservation cannot fit both calls, use one-call mode with a smaller grounded prompt or deterministic fallback. Disable SDK retries and verify wire request counts.

- Give the second call a compact fact record, exact alleged sections, required answer checklist, reviewed rules and only relevant evidence spans. Reserve generation for plain-language explanation and legal fact application.
- Require reasoning that identifies the allegation, material facts, offence ingredients supported/missing, and why each procedural rule matters. Treat assertions as allegations; do not make guilt findings or predict bail outcomes.
- Add optional structured `claims`, `coverage`, and `answer_status` fields with backwards-compatible defaults. Each material claim has a stable ID, output destination, fact references, evidence IDs and applicable reviewed rule ID. The backend owns validation status and authoritative quotation fields; discard model-supplied verification flags.
- Compose critical legal conclusions, rights and legal-aid/action instructions from reviewed rules. Allow model-written reasoning only as clearly bounded application with valid fact/evidence references; disclose unsupported inferences rather than upgrading them to verified claims. Do not claim deterministic validation proves arbitrary prose entailment.
- Keep JSON output enforcement and existing greeting recovery. A quota/configuration failure remains distinguishable from incomplete legal evidence. Preserve existing rate-limit behavior without resetting budget on fallback.

Verify: fake transport captures one request on the normal path, at most two for justified complex cases; enforce shared TPM reservations across workers. Measure token/cost distributions and reduce median/p95 while legal gates pass. Cover errors without retries and assert the 8,000 TPM hard ceiling. Guard: no third call, hidden SDK retry, or AI reviewer.

## Phase 4 — Validate the final answer and supply safe fallback

Proposed pure module `llm/answer_validation.py`, invoked after all normalizers, source attachment, bail handling and sanitizer mutations. Copy Pydantic conventions from `models/schemas.py`; validate the actual response that will be rendered.

- Check exact alleged-section preservation, source existence/version, rule conditions, subsection boundaries, explicit-question coverage, internal consistency, supported authority and absence of unrelated substituted offences.
- Critical custody coverage must include grounds of arrest; applicable BNSS 35 safeguards; counsel access (explain BNSS 38's scope accurately); informing a relative/friend; production before a Magistrate within 24 hours excluding necessary travel, unless released earlier; custody-based legal-aid eligibility; and concrete next steps. Never describe 24 hours as automatic release, or valid judicial remand as inherently unlawful detention.
- The action list directs family to confirm station/FIR details, arrest time and court production; request DLSA/DSLSA counsel; prepare counsel's bail request and necessary records; preserve relevant evidence. Distinguish actions now, before production and within 24 hours; do not imply the family should wait a full day.
- Verify material claims against structured rules and evidence, not citation count or keyword presence. A valid URL cannot establish that unrelated prose is correct. Legal-aid availability is not a promise of a particular outcome.
- On missing critical coverage, discard unsafe generated claims and deterministically compose the reviewed supported response with explicit limitations. On missing authoritative classification evidence, omit classification certainty while retaining supported urgent assistance. No semantic repair generation.
- Set statuses such as `validated`, `limited_evidence`, or `safe_fallback`, where `validated` means this bounded contract passed, never that an independent lawyer verified the legal conclusion. Re-run checks after fallback composition.

Verify: adversarial fake outputs with empty steps, fake citations, correct citation/wrong claim, “bail impossible,” hallucinated 305, missing family notice, 24-hour automatic-release claim, and truncated JSON all produce safe output. Guard: don't append a correction while leaving contradictory prose visible; don't cap rights arrays before required items survive.

## Phase 5 — Accurate UI and compatible rendering

Use `src/components/Chat/MessageBubble.tsx`, `dashboard.chat.tsx` formatting, and `src/lib/trana-types.ts`; preserve route structure and layout.

- Rename “Verified Statute” to “Source text matched”; explain that registry text integrity does not verify case applicability or legal advice. Legacy responses get the same narrow label without manufactured claim validation.
- Render concise offence/bail explanation, free aid, relevant rights, next actions and claim-linked sources. For custody and financial hardship prioritize free legal aid before private-lawyer suggestions. Show evidence limitations and distinguish conditional alternative sections.
- Keep citations alongside the claims they support; resolve evidence IDs using backend source metadata. Do not let four-card limits hide essential procedural authority. Preserve the general-information disclaimer.

Verify: Vitest component tests for new/legacy responses, missing metadata, limited-evidence status, citation destinations and visible custody steps; `npm run build`. Guard: no blanket “answer verified” badge or exposure of internal budget/validation jargon to users.

## Phase 6 — Evaluation, rollout and stop condition

Create offline `unittest` fixtures and a small curated evaluation set (at least 30 cases), recording source versions and expected rules. Use mocked providers for CI; standard-library tests avoid introducing a backend test dependency solely for this change.

Required cases: reconstructed Delhi 303(2) custody case; qualifying/nonqualifying/unknown low-value conditions; FIR expressly adds 305; multiple offences with different bail classifications; explicit section-only question; no FIR; unknown arrest time; already remanded; cannot afford counsel; custody regardless of income; non-Delhi location; prior assistant wrongly alleges robbery; negated and academic arrests; Hindi/Hinglish if supported; unavailable/changed source; shared token budget exhaustion; call 1 and call 2 failures; deadline expiry; malformed/truncated output; irrelevant sources; existing greetings, media, contract and Complaint Analyser regressions.

Acceptance gates:

- Every critical fixture preserves alleged offence identity, distinguishes bail classification/discretion, covers applicable arrest rights/legal aid and gives requested actionable steps. Zero unsupported offence substitution, fabricated citations, false verification labels or guaranteed bail/release statements.
- Every material legal assertion in the supported slice resolves to approved rule/evidence IDs; unknown or out-of-slice claims are limited rather than marked verified. All explicit user questions have a supported answer or explicit evidence limitation.
- Review outputs against the six supplied rubric categories with an Indian criminal-law reviewer before expanding coverage. Target at least 8/10 per category; automated fixture passes alone do not establish that legal-quality score.
- One LLM request on the normal path and at most two only when extraction is justified. Enforce 8,000 TPM as a hard aggregate ceiling; measure and minimize token/cost per answer. Keep no retries, current output ceilings, small runtime size, and 20-second deadline. Record fallback and token/cost distributions.
- Run `python -m unittest discover -s tests -p 'test_*.py'` after creating the suite; targeted frontend tests via `npm test -- <test-file>` and production build. Exact test filenames are implementation deliverables, not existing files.

Rollout: default-off feature flag for the bounded chat pipeline; validate locally/staging first, then small controlled rollout. Measure failure category, coverage, source version, provider attempts, token usage where returned, latency and fallback frequency. Never log raw FIRs, personal identifiers, attachment contents, secrets or full conversation text for these metrics. Compare quality and latency before wider rollout. Keep the emergency source-label correction independent of the backend flag. Roll back the new path if critical violations occur; do not represent the old path as validated.

Stop when all scoped gates pass. Defer national offence-rule coverage, new languages, comprehensive amendment tracking, case-law research, OCR improvements, database analytics and dedicated Complaint Analyser redesign. End each implementation phase with `changes.md` evidence/considerations and a scoped commit/sync as required by AGENTS.md.

Suggested commit sequence: intake/reference tests; reviewed sources and rules; bounded grounded generation; final validation/fallback; accurate UI; evaluation/rollout documentation. This plan authoring task commits only this document and its changelog entry.
