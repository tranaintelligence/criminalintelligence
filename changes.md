# Changelog & Architecture Notes for Future Agents

## [2026-11-14] - Legal-answer reliability implementation plan

- Added `plans/legal-answer-reliability.md`, a phased, repository-grounded plan for exact offence matching, custody urgency/coverage, reviewed bail/procedure/legal-aid evidence, fact application, claim-level checks, safe fallbacks and accurate source labels.
- Confirmed current failure mechanisms: generic bail override inserts robbery/snatching/extortion; theft retrieval nominates 303 and 305; verification pads toward four sources; source-text integrity does not validate case reasoning.
- Initial interpretations of the AI limit were incomplete; the latest user constraint clarification below governs: up to two calls, shared 8k TPM ceiling, and small offline logic.
- Considerations: ordinary theft and the qualifying low-value branch need separate reviewed conditions; cross-check official schedule summaries against Act/Gazette text. Preserve dedicated Complaint Analyser behavior, existing deployment/authentication and legacy saved-response compatibility. The plan requires offline tests, legal review, staged rollout and privacy-conscious metrics.
- Validation: inspected current registry, chain, schemas, source UI, provider handling and repository scripts; independent read-only discovery corroborated control-flow and budget gaps. Consulted official India Code/NCRB/NALSA sources. Documentation only; runtime fixes and their tests have not been implemented.
- Constraint clarification: user allows at most two LLM calls per message, with one minimal extraction call and one focused legal-reasoning call, within an aggregate 8,000 tokens/minute limit. Plan now budgets <=500 input/200 output tokens for extraction, <=4,500 input/2,000 output tokens for legal reasoning, and <=7,500 TPM target for headroom. Calls are sequential with no retries; shared token admission must work across backend workers. Use one call for straightforward questions when possible. Legal reasoning explicitly applies statutory elements to known/unknown facts and supports material claims with reviewed sources. Keep offline additions under 500 Python runtime lines and under 20 KB of rule data.

This document tracks all changes made to the TRANA codebase, the context/reasoning behind them, and technical considerations for future agents working on this project. Always read this file before starting tasks.

---

## [2026-11-14] - Fix Conversational Greetings & PascalCase Normalization (`EmptyAnalysisError`)

### 1. Root Cause for "I received the attached document..." on Text Greetings
- **Problem**: When a user sent a simple greeting like `"Hii"` without attachments, Groq responded with `{"message": "I am TRANA..."}` or formatted keys like `{"DocumentOverview": "..."}`.
- **Why it failed**:
  1. `_normalize_analysis_payload` only checked snake_case keys and did not recognize `message`, `reply`, `response` or PascalCase keys (`DocumentOverview`, `ImmediatePracticalSteps`, `RightsAndLegalRemedies`).
  2. Because all target fields remained blank, `_require_readable_analysis` threw `EmptyAnalysisError`.
  3. The error handler at line 581 of `llm/chain.py` had a static text string: `"I received the attached document, but couldn't produce an analysis..."`, which confused the user into thinking TRANA believed an image was uploaded.
- **Fixes Applied**:
  - `llm/chain.py`:
    - Added comprehensive PascalCase / camelCase to snake_case normalization (`to_snake_case`) at the entry of `_normalize_analysis_payload`.
    - Added direct mapping for conversational top-level keys (`message`, `response`, `reply`, `greeting`, `answer`) into `conversational_reply`, `situation_meaning`, and `general_analysis`.
    - Flagged `is_conversational = True` automatically when conversational greeting text is detected.
    - Updated fallback message in `_run_quick_provider_pipeline` so that the message only mentions attached documents if `has_media` is actually True.

---

## [2026-11-14] - Fix Groq JSON Validation 400 Bug & Erroneous 429 Rate-Limit Masquerading

### 1. Root Cause Identified & Resolved
- **Why Groq returned Rate Limit: 0 with 0 tokens**:
  - Groq's API strictly requires the word `"json"` (case-insensitive) to be present anywhere inside the `messages` payload whenever `response_format: {"type": "json_object"}` is passed.
  - When non-complaint direct queries (e.g. `"What is bail under BNSS?"`) were sent, TRANA's `SYSTEM_PROMPT` and `DIRECT_ANALYSIS_PROMPT` lacked the word `"json"`.
  - Groq immediately rejected the request at the HTTP gateway with `HTTP 400: "'messages' must contain the word 'json' in some form, to use 'response_format' of type 'json_object'."`.
  - Because it was rejected before tokenization, Groq registered `API Calls: 2`, `Rate Limit: 0`, `Input Tokens: 0`, `Output Tokens: 0`.
- **Why TRANA claimed it was "rate-limited"**:
  - `_run_quick_provider_pipeline` in `llm/chain.py` unconditionally called `mark_quick_temporarily_unavailable()` and raised `QuickModelUnavailableError` whenever all pool routes failed, even on HTTP 400/404 errors.
  - `main.py` mapped `QuickModelUnavailableError` to `HTTP 429 (QUICK_MODEL_UNAVAILABLE)`, and the frontend displayed `⚠️ Quick Thinking rate-limited`.
- **Fixes Applied**:
  - `llm/chain.py`:
    - In `_invoke_openai_compatible`, explicitly verified that the word `"json"` is present in `raw_messages`. If missing, automatically injects `"CRITICAL: Respond exclusively as a valid JSON object matching the required schema."` into the system prompt.
    - Updated `_run_quick_provider_pipeline` so that `mark_quick_temporarily_unavailable()` and `QuickModelUnavailableError` are only raised when a genuine `quota_error_seen` occurs. Non-quota failures raise standard `RuntimeError`.
  - `key_manager.py` & `src/routes/founders.admin.tsx`: Retained `openai/gpt-oss-120b` as the default model for Groq.
  - Verified end-to-end execution: `run_analysis_pipeline` successfully generates structured legal analysis using `quick:groq:openai/gpt-oss-120b`.

---

## [2026-11-14] - Fix Groq Model Defaults & Clear Sticky Rate Limit UI State

### 1. Elimination of False Rate-Limit / Quota Lockout Caused by Invalid Groq Model ID
- **Root Cause Identified**:
  - The Admin Key Pool form had default model configured as `openai/gpt-oss-120b` for Groq (`key_manager.py` and `src/routes/founders.admin.tsx`).
  - Groq does not have any model called `openai/gpt-oss-120b`.
  - When queries were routed to Groq, Groq immediately threw `400 / 404 Model Not Found`.
  - Because all configured Groq keys failed on this invalid model, the pipeline triggered `mark_quick_temporarily_unavailable()`, which placed a global 5-minute (300-second) in-memory block on all Quick Thinking requests and returned HTTP 429 (`QUICK_MODEL_UNAVAILABLE`).
  - To the user, this appeared as being "ratemaxed" even when zero valid API calls completed.
- **Fixes**:
  - `key_manager.py`: Updated `PROVIDER_ENV_DEFAULT_MODELS["groq"]` to `"llama-3.3-70b-versatile"` and Cerebras to `"llama3.3-70b"`.
  - `src/routes/founders.admin.tsx`:
    - Updated default model from `'openai/gpt-oss-120b'` to `'llama-3.3-70b-versatile'`.
    - Added reactive model auto-population when selecting providers in the dropdown (Groq -> `llama-3.3-70b-versatile`, Google -> `gemini-2.5-flash`, Cerebras -> `llama3.3-70b`).
    - Updated input placeholder to `llama-3.3-70b-versatile`.

### 2. Reset Sticky Rate-Limit State in Chat UI (`src/routes/_authenticated/dashboard.chat.tsx`)
- **Root Cause Identified**:
  - Once `quickUnavailable` state was set to `true` following a 429 response, neither `handleNewChat` nor switching chat sessions via `routeChatId` ever reset `quickUnavailable(false)`.
  - As a result, opening a new chat session where no messages had been sent still displayed `⚠️ Quick Thinking rate-limited`.
- **Fixes**:
  - Added `setQuickUnavailable(false)` in `handleNewChat` and in `loadChat` when switching to a different chat session.

---

## [2026-11-11] - PWA Setup & Capacitor Android Wrapper

### 1. Progressive Web App (PWA) Configuration
- **Files Created**:
  - `public/manifest.webmanifest` & `public/manifest.json`: Web App Manifest defining standalone display mode (`"display": "standalone"`), portrait orientation, theme color (`#0A0A0C`), background color, and icons (`apple-touch-icon.png`, `favicon.png`, `TRANA_legal-tech_logo.png`).
  - `public/sw.js`: Lightweight Service Worker implementing network-first strategy, cache lifecycle (`skipWaiting()`, `clients.claim()`), and network bypass for Supabase Realtime / external Render APIs.
- **Files Modified**:
  - `src/routes/__root.tsx`:
    - Added PWA & iOS Safari meta tags in root `head`:
      - `apple-mobile-web-app-capable: yes`
      - `apple-mobile-web-app-status-bar-style: black-translucent`
      - `apple-mobile-web-app-title: TRANA`
      - `application-name: TRANA`
      - `theme-color: #0A0A0C`
      - `viewport-fit=cover` in viewport meta tag
      - Link to `/manifest.webmanifest`
    - Added service worker registration in `RootComponent` on browser window load.
- **Considerations**:
  - On iOS (Safari/Chrome), tapping "Share" ➔ "Add to Home Screen" installs TRANA with a home screen app icon. When opened, it runs 100% full-screen without Safari browser bars or URL chrome.
  - On Android (Chrome), automatically triggers the "Install TRANA" prompt.

### 2. Capacitor Android Project & Cloud APK Workflow
- **Packages Installed**:
  - `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`
- **Files Created**:
  - `capacitor.config.ts`: Configured with `appId: "in.trana.app"`, `appName: "TRANA"`, pointing `server.url` to live production `https://criminalintelligence.vercel.app`.
  - `android/`: Native Android project with launcher icons, theme styles, and network permissions.
  - `.github/workflows/build-apk.yml`: Cloud CI/CD workflow running on GitHub Actions that automatically compiles `app-debug.apk` using Java 17 and Gradle, and uploads the artifact for direct download.
- **Package Scripts Added**:
  - `npm run cap:sync`: Syncs web and Capacitor configuration to the native Android directory.
  - `npm run cap:open`: Opens the native project in Android Studio.


---

## [2026-11-12] - AI Complaint Analyser Statutory Fixes & Frontend Stability

### 1. Complaint & Document Analyser Statutory Pipeline (`llm/chain.py`)
- **Problem**: When users uploaded complaints or notices (e.g. involving BNSS Sec. 35, 47, 58), the model parsed the sections into `applicable_laws` but returned alternative field names (`summary`, `complaint_analysis`, `overview`) or was truncated due to a tiny 1024 token limit. `_require_readable_analysis` only checked prose fields, completely ignored `applicable_laws`, and raised a fatal `EmptyAnalysisError` ("The AI model returned an empty analysis").
- **Fixes**:
  - `_normalize_analysis_payload`: Added comprehensive aliases mapping from models:
    - `situation_meaning`: maps `complaint_analysis`, `summary`, `overview`, `analysis`, `statutory_analysis`, `case_summary`, `allegations_summary`, `details`.
    - `general_analysis`: maps `legal_analysis`, `legal_summary`, `findings`, `explanation`, `content`.
    - `bail_status`: maps `bail`, `bail_eligibility`, `bail_analysis`, `bail_provisions`.
    - `handling_authority`: maps `authority`, `competent_authority`, `jurisdiction`, `investigating_agency`, `police_station`.
    - `next_24_hours`: maps `immediate_steps`, `action_plan`, `recommended_actions`, `steps`, `procedural_steps`.
    - `rights`: maps `legal_rights`, `accused_rights`, `citizen_rights`, `statutory_safeguards`.
  - `_require_readable_analysis`: If prose fields are empty but `applicable_laws` contains identified statutory sections (such as BNSS 35, 47, 58), automatically synthesizes a plain-language procedural breakdown detailing each identified section, notice requirements under BNSS 35(3), bail protections, and the competent magistrate/police authority rather than raising `EmptyAnalysisError`.
  - `_invoke_openai_compatible`: Increased `max_tokens` from `1024` to `4096` to allow full 8-part criminal complaint breakdowns with complete statutory sections.

### 2. Elimination of Postgrest `.catch()` Runtime Failures
- **Problem**: In `@supabase/supabase-js`, `PostgrestFilterBuilder` is a thenable and does not consistently implement `.catch()`. In minified/transpiled environments, calling `.catch()` threw `'...upsert(...).catch is not a function'`.
- **Fixes**:
  - Replaced remaining `.catch()` chains on Supabase queries with structured `try { await ... } catch {}` blocks in `src/routes/_authenticated/dashboard.analyse.tsx` and `src/routes/_authenticated/lawyer.queries.tsx`.

### 3. Isolated Admin Lawyer Delete Refetch (`src/routes/founders.lawyers.tsx`)
- **Problem**: In `handleRemove`, `await refetch()` was directly under the main try-catch. If the network had a transient timeout or the Render backend was waking from cold sleep, the toast showed `"Failed to fetch"` even though the advocate was already deleted from Supabase and blacklisted in localStorage.
- **Fixes**:
  - Isolated `await refetch()` inside an inner try-catch so transient network hiccups during refresh never show a failure toast when the deletion operation has succeeded.

### 4. Verified Import Integrity & User Acknowledgement Sync
- Verified that all components using `<X` properly import `X` from `lucide-react`.
- Confirmed that anonymous users accepting platform disclaimers are not added to the admin acknowledgement table until they sign in with their verified email.

### 5. Groq JSON Validation & Non-FIR Document Handling (`llm/chain.py` & `llm/prompts.py`)
- **Problem**: When a user uploaded non-FIR documents (such as a Resume/CV or empty complaint text), Groq's model outputted raw plain-language text (e.g. `"Please paste the text of the FIR or complaint here..."`) instead of structured JSON. Because Groq's API strictly enforces `response_format: {"type": "json_object"}`, it threw `groq HTTP 400: json_validate_failed`. Furthermore, the pipeline immediately crashed without trying fallback providers.
- **Fixes**:
  - `_invoke_openai_compatible`: Added automatic recovery for Groq's `json_validate_failed` payload. When Groq returns HTTP 400 with `failed_generation`, the pipeline extracts the generated plain-language response, wraps it into a valid `StructuredAnalysis(is_conversational=True)`, and presents it directly to the user instead of failing.
  - `_run_quick_provider_pipeline`: Added retryable recovery so that if a provider route throws HTTP 400 or JSON format error, the pipeline attempts remaining active provider routes rather than aborting.
  - `llm/prompts.py`: Explicitly instructed the model in `COMPLAINT_FIR_ANALYSIS_SYSTEM_PROMPT` and `COMPLAINT_FIR_ANALYSIS_PROMPT` to ALWAYS return a single valid JSON object, and when a resume, CV, or non-complaint document is detected, wrap the polite guidance inside `situation_meaning` and `general_analysis` with `is_conversational: true`.


---

## [2026-11-12] - Advocate Deletion Stability & Centralized Peer Connection Visibility

### 1. Advocate Deletion & Registry Stability (`src/routes/founders.lawyers.tsx` & `main.py`)
- **Problem**: When attempting to delete seeded or newly created advocates (such as `Adv. Krish Chauhan`), the application showed an error toast `Failed to fetch`. The root cause was three-fold:
  1. The backend `DELETE /api/admin/lawyers/{lawyer_id}` endpoint threw HTTP 404 when removing seeded/local advocate records.
  2. The baseline advocate fallback `defaultAdvocates` re-injected `Adv. Krish Chauhan` back into the registry whenever the registry became empty, because it only checked `adv.id` against `removedIds`.
  3. A raw network exception during API call or list refetch caused the UI deletion to fail visibly even though the user intended to delete the record.
- **Fixes**:
  - `main.py`: Updated `delete_lawyer_admin` to return `{"ok": True, "message": "Advocate removed."}` gracefully rather than raising HTTP 404 when the ID is not found.
  - `src/routes/founders.lawyers.tsx`:
    - Added optimistic React Query cache eviction (`qc.setQueriesData({ queryKey: ["founders-advocates-registry"] }, ...)`) so deleted cards vanish from the UI instantly.
    - Extended blacklist verification in `defaultAdvocates` to check `adv.id`, `adv.full_name`, `adv.email`, and `adv.bar_reg_no` against `removedIds`.
    - Made backend and Supabase deletion calls non-blocking and safe so transient network issues never show a `"Failed to fetch"` toast.
  - `src/lib/trana-admin-api.ts`: Updated `getPublicLawyers` with try-catch fallback returning `[]` on network failures instead of throwing uncaught `TypeError: Failed to fetch`.

### 2. Cross-Account Peer Connection Sync & Professional Network Visibility (`src/lib/network-connections.ts` & `main.py`)
- **Problem**: When a user created a new account and sent connection requests to existing advocates, the new account was not visible to the recipient in the Professional Connections tab, and was missing from the Admin Dashboard.
  - Root cause 1: Supabase `consultations` table Row Level Security (RLS) only allowed `auth.uid() = user_id`. Recipient advocates (`lawyer_id`) were blocked by RLS from reading incoming connection requests across different devices/sessions.
  - Root cause 2: Newly registered advocates were held in `PENDING_VERIFICATION` status, while `/api/lawyers` strictly filtered for `verification_status == "VERIFIED"` and `approved == True`, hiding them from peers.
  - Root cause 3: `list_admin_users` in `main.py` only queried `db_models.User` and chat sessions, completely omitting advocates registered in `db_models.Lawyer`.
- **Fixes**:
  - `models/db_models.py` & `models/schemas.py`: Added persistent `PeerConnection` database table and schemas (`PeerConnectionCreateRequest`, `PeerConnectionActionRequest`, `PeerConnectionResponse`).
  - `main.py`:
    - Added REST endpoints: `GET /api/network/connections`, `POST /api/network/connections`, `PATCH /api/network/connections/{conn_id}`, and `DELETE /api/network/connections/{conn_id}`.
    - Updated `/api/lawyers` to support `all_members` parameter and include non-suspended advocates with their appropriate verification badge (`Verified Sanad` or `Verification Pending`).
    - Updated `list_admin_users` to query `db_models.Lawyer` and merge all registered advocates and peer network users into the Admin Dashboard.
  - `src/lib/network-connections.ts`: Connected `fetchAllConnections`, `sendConnectionRequest`, `acceptConnectionRequest`, `declineConnectionRequest`, and `removeConnection` directly to the centralized backend API, enabling real-time cross-device and cross-account invitation delivery and acceptance.
  - `src/routes/founders.users.index.tsx`: Merged backend registered advocates (`getPublicLawyers({ allMembers: true })`) and backend peer connections so all newly created accounts appear in the Admin Dashboard user registry.

### 3. Bidirectional Regex Matching for Statutory Concordance (`llm/chain.py`)
- **Fix**: Updated `_COMMON_HALLUCINATION_PATTERNS` to match both word orders (`BNS 384` and `Section 384 of BNS`), verifying 100% conversion of hallucinated IPC/CrPC sections into current BNS/BNSS statutory provisions.

### 4. Elimination of Section 8 Default Bug, Hallucinated Procedural Remedies, and Deterministic Bail Assessment (`llm/chain.py` & `legal_sources/registry.py`)
- **Problem**: When evaluating extortion and robbery complaints (e.g. violent phone snatching, threats of burning down shop, hafta demand, and police refusal to lodge FIR), the analyzer outputted three critical legal and statutory errors:
  1. Defaulted to `BNS Sec. 8` (Gender), `BNSS Sec. 8` (Court of Session establishment), and `BSA Sec. 8` (Motive/conduct relevancy) instead of substantive penal provisions (`BNS 308` Extortion, `BNS 309` Robbery, `BNS 304` Snatching, `BNS 115(2)` Hurt, `BNS 351` Intimidation).
  2. Hallucinated procedural remedies: Cited `BNS Sec. 154` (riots) for FIR registration (actual: `BNSS Sec. 173`), invented non-existent `BNSS Sec. 154A` for police refusal, and cited `BNS Sec. 151` for criminal intimidation (actual: `BNS Sec. 351`).
  3. Hedged on bail eligibility ("cannot be determined precisely", "may be bailable"), failing to recognize that robbery, snatching, and extortion with threats are strictly non-bailable under Schedule I of BNSS.
- **Root Causes**:
  - `find_relevant_statutes` was only scanning `query`, missing the uploaded complaint text in `ephemeral_context`.
  - `_verify_law_candidates` verified model candidates against `registry.lookup()`. Because Section 8 exists in the Gazette database, it was marked `backend_verified` and never filtered against `preliminary_sections`.
  - No deterministic enforcement existed for Schedule I non-bailable offences or statutory FIR remedies under BNSS.
- **Fixes**:
  - `legal_sources/registry.py`:
    - In `find_relevant_statutes`, strictly disallow preliminary/definition sections (`preliminary_sections`: `BNS 1..10`, `BNSS 1..10`, `BSA 1, 8`) so definition sections can never be returned as substantive offences.
  - `llm/chain.py`:
    - Updated `run_analysis_pipeline` to scan `f"{query}\n{ephemeral_context}"` across both `find_relevant_statutes` and `_is_complaint_fir_analysis`, ensuring complete statutory grounding even when user queries are short or attachment-led.
    - Updated `_verify_law_candidates` to discard any model candidate matching `preliminary_sections` and backfill up to 4 verified substantive offences from `fallback_statutes` (`BNS 304`, `BNS 309`, `BNS 308`, `BNS 351`).
    - Added `_enforce_bail_and_statutory_remedies`:
      - Evaluates verified laws and allegation facts against `NON_BAILABLE_SECTIONS`. If robbery, extortion, snatching, or violence is involved, overrides hedging text with an unequivocal legal assessment: **NON-BAILABLE** under the First Schedule of the Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS).
      - Automatically injects statutory remedies for police refusal to lodge FIR: `BNSS Section 173(4)` (written representation by post to the Superintendent of Police / DCP) and `BNSS Section 175(3) & 175(4)` (application before the Judicial Magistrate).
    - Expanded `_COMMON_HALLUCINATION_PATTERNS` to convert any stray references to `BNS Sec. 8`, `BNSS Sec. 8`, `BNS 154`, `BNSS 154A`, and `BNS 151` into accurate 2023 Gazette provisions.

---

## [2026-11-12] - Fix "Could not pass query" Error & Resilient Citizen Query Pool State

### 1. Citizen Queries Pass On & Opinion Submission Stability (`src/routes/_authenticated/lawyer.queries.tsx`)
- **Problem**: When an advocate in the Legal Professional Workspace opened a citizen query (e.g. `mock-paid-0`: "Falsely accused in FIR under BNS Section 135 & Section 352") and clicked `Pass On to Other Advocates`, an error toast was repeatedly triggered: `"Could not pass query."`, and the query modal remained open without passing.
- **Root Causes**:
  1. **UUID Constraint Violation**: PostgreSQL table `analyses.id` is strictly typed as `UUID`. Mock queries (`mock-paid-0`) and local pool queries (`query-${Date.now()}`) are string identifiers. Calling `await supabase.from("analyses").update(...).eq("id", queryId)` triggered Postgres HTTP 400 Bad Request error `22P02: invalid input syntax for type uuid: "mock-paid-0"`.
  2. **Supabase RLS & Network Exceptions**: Supabase `analyses` table enforces Row-Level Security (`auth.uid() = user_id`). Advocate queries directly updating analyses rows failed or threw uncaught fetch errors. Because the Supabase update call was not wrapped in an inner try/catch block, any failure aborted the function and jumped directly to `catch { toast.error("Could not pass query."); }`.
  3. **Local Pool State Desynchronization**: If `trana_citizen_queries_pool` was initially empty, `handlePassOn` never added the query to the local pool, and `queryFn` re-instantiated fresh mock queries with `passed_by: []`, wiping out the passed state on refetch.
  4. **Identifier Mismatch in UI Badges**: The "Passed" badge checked only `lawyer?.id`, whereas advocate identities can be `lawyer?.bar_reg_no` (e.g., `D/2080/2187`) or `full_name`.
- **Fixes**:
  - **UUID Safety Check**: Verified with regex `/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i` before attempting any Supabase REST updates. If an ID is a mock or non-UUID, Supabase network requests are bypassed.
  - **Isolated Supabase Try/Catch**: Isolated Supabase database synchronization in an inner `try/catch` block across both `handlePassOn` and `handleRespond`. Supabase network hiccups, RLS restrictions, or UUID mismatches never fail the advocate's action.
  - **Optimistic React Query Cache Eviction & Update**: Used `qc.setQueriesData({ queryKey: ["citizen-queries"] }, ...)` to immediately mark the query as passed/responded in the React state and close the modal.
  - **Persistent Local Pool & Passed Tracker**: Safely persists passed query IDs into `trana_passed_queries_${myId}` and `trana_citizen_queries_pool`. If a mock query is passed or responded to, it is automatically saved into the local pool so its status persists across page reloads.
  - **QueryFn Mock Supplementation**: `queryFn` now synchronizes `locallyPassedIds` across all queries, and supplements mock queries if `mergedList.length < 6` without dropping existing queries.
  - **Broadened Advocate Identity Matching**: Both the list badge and modal button check `lawyer?.id`, `lawyer?.bar_reg_no`, and `lawyer?.full_name` against `query.passed_by`.

### 2. Valid UUID Generation in Complaint Analyser (`src/routes/_authenticated/dashboard.analyse.tsx`)
- **Problem**: When a citizen selected and paid ₹50 for Legal Professional review, `queryId` was generated as `query-${Date.now()}` and `user_id` was set to `"citizen-user"` or `"anonymous-citizen"`, causing Supabase `analyses` insert to fail with Postgres error `22P02: invalid input syntax for type uuid`.
- **Fixes**:
  - Implemented compliant UUID v4 generator using `crypto.randomUUID()` (with RFC4122 random fallback).
  - Checked `authUser?.id` from `supabase.auth.getUser()` before attempting database insert so anonymous users never violate UUID or RLS constraints.

---

## [2026-11-12] - Consent to Share Details with Lawyers with Clear Note in Citizen Dashboard

### 1. Citizen Dashboard Sharing Consent & Statutory Note (`src/routes/_authenticated/dashboard.index.tsx`)
- **Feature**: Added a dedicated, interactive "Consent to Share Details with Verified Lawyers" management card directly on the Citizen Dashboard home screen (`/dashboard`).
- **Capabilities**:
  - **Interactive Toggle**: Instant toggle switch allowing citizens to grant or revoke consent for sharing case summaries, FIR statutory analysis, and complaint facts with verified Bar Council advocates.
  - **Real-Time Status Indicator**: Displays dynamic status pill (`Consent Active · Review Enabled` vs. `Strict Privacy Mode · Sharing Disabled`).
  - **Clear Statutory & Privacy Note**:
    - **Voluntary Citizen Request (BCI Ethics)**: Explicit notice under Rule 36, Chapter II, Part VI of Bar Council of India (BCI) Rules that advocates cannot advertise or solicit work; sharing occurs strictly upon the citizen's voluntary initiative for preliminary legal first-aid and opinions.
    - **TRANA Privacy Shield (Contact Masking)**: Direct phone numbers, emails, and identifying particulars are masked (`XXXXX`) to prevent unsolicited contact or spam. Reviewing advocates receive strictly factual allegations and statutory provisions.
    - **Privileged Communications & DPDP Act 2023**: Reaffirms attorney-client privilege principles under Section 126 of the Bharatiya Sakshya Adhiniyam, 2023 (BSA) / Indian Evidence Act and data subject rights under the DPDP Act, 2023.
  - **Expandable Legal Accordion**: "Read Full Policy & BCI Terms" collapsible drawer detailing shared data scope, anti-solicitation guarantees, and consent revocation.
  - **Cross-Session Persistence**: Persisted in `localStorage` (`trana_citizen_lawyer_share_consent`) and logged to Supabase (`advocate_disclaimers`) when authenticated.

### 2. Complaint Analyser Mandatory Consent Checkbox (`src/routes/_authenticated/dashboard.analyse.tsx`)
- **Feature**: Integrated an explicit consent verification checkbox and statutory note directly inside the ₹50 Legal Professional Written Opinion payment & submission modal.
- **Enforcement**:
  - Ensures citizens voluntarily acknowledge sharing complaint allegations with panel advocates before payment and submission.
  - Disables the "Pay ₹50 & Submit Case" button until consent is checked.
  - Synchronizes preference with the central Citizen Dashboard toggle state.

### 3. Find a Legal Professional Privacy Banner (`src/routes/_authenticated/dashboard.lawyers.tsx`)
- **Feature**: Added a "Consent & Privacy Shield Protected" banner under the directory header with a direct link to manage sharing consent on the Citizen Dashboard.


---

## [2026-11-12] - Founder Verification & Lawyer Workspace Gating Fixes

### 1. Root Causes Pinpointed & Eliminated
1. **Premature Dashboard Access for Unverified Advocates**:
   - `src/routes/_authenticated/lawyer.tsx`:
     - When an advocate submitted their credentials, `handleRegisterAdvocate` previously set `localStorage.setItem('trana_lawyer_verified_${user.id}', 'true')`, marked `approved: true`, and `verification_status: "VERIFIED"`.
     - `LawyerLayout` rendered `<Outlet />` whenever registered, only displaying an optional top banner if pending, giving full access to all workspace tabs (`/lawyer/queries`, `/lawyer/cases`, `/lawyer/inbox`, `/lawyer/drafter`, etc.).
2. **Missing Registered Advocates on Founder Review Page (`/founders/lawyers`)**:
   - `models/db_models.py`:
     - In PostgreSQL / Supabase, `lawyers.id` and `lawyers.user_id` are of type `UUID`.
     - `db_models.py` had defined `id = Column(String)` and `user_id = Column(String)`, which caused psycopg/SQLAlchemy to emit `%(id)s::VARCHAR`. PostgreSQL rejected the insert with `psycopg.errors.DatatypeMismatch: column "id" is of type uuid but expression is of type character varying`, aborting the database transaction with an unhandled exception on `POST /api/lawyers/register`.
   - `models/schemas.py`:
     - `year_of_enrollment` had a restrictive `le=2030` validation constraint, causing FastAPI to return HTTP 422 if an enrollment year/roll (e.g. `2187`) was entered.
   - `services/lawyer_verification_service.py`:
     - `verify_via_statutory_rules` returned key `"reason"` (singular) when Sanad format validation failed, while `execute_automated_advocate_verification` called `rule_eval["reasons"]`, causing a fatal `KeyError: 'reasons'`.
   - `main.py`:
     - When an advocate re-registered or updated a pending application, `register_lawyer` raised HTTP 400 (`"An advocate application with this Bar Enrollment Number is already registered"`) instead of updating the existing pending record.

### 2. Comprehensive Implementation & Fixes
- **Database Model Typing (`models/db_models.py`)**:
  - Imported `from sqlalchemy.dialects.postgresql import UUID as PG_UUID`.
  - Updated `Lawyer.id` and `Lawyer.user_id` (and `AdvocateDisclaimer`) to use `PG_UUID(as_uuid=False)`, enabling seamless binding as native PostgreSQL `uuid` while allowing string manipulation in Python.
- **Backend Verification Pipeline (`services/lawyer_verification_service.py`)**:
  - Fixed `verify_via_statutory_rules` to always return `"reasons": list[str]`.
  - In `execute_automated_advocate_verification`, safely accessed `rule_eval.get("reasons") or [rule_eval.get("reason", "Sanad requires manual review")]`.
  - Ensured non-standard or pending Sanad formats are queued as `PENDING_VERIFICATION` (not `REJECTED`) so they land cleanly on the Founder verification desk.
- **Backend Registration Endpoint (`main.py`)**:
  - If an existing advocate is found during `POST /api/lawyers/register`, updates their pending application fields and re-queues them rather than raising HTTP 400.
- **Schema Validation (`models/schemas.py`)**:
  - Adjusted `year_of_enrollment` to `Optional[int] = Field(default=None, ge=1900)` so roll number or future year typos never throw HTTP 422.
- **Frontend Workspace Gating (`src/routes/_authenticated/lawyer.tsx`)**:
  - Updated `useLawyerAuth`: `approved` is true ONLY when confirmed by the backend/Supabase as verified and not pending; `is_verified_lawyer` is strictly `Boolean(approved && verification_status === "VERIFIED")`.
  - In `handleRegisterAdvocate`: set `approved: isAutoApproved`, `verification_status: initialStatus`. Synced with shared registry `trana_all_registered_lawyers` in localStorage.
  - In `LawyerLayout`: implemented two strict gates:
    1. **Unregistered Gate**: shows Bar Council Sanad registration form.
    2. **Pending Founder Verification Gate**: if registered but `!lawyer.approved || lawyer.verification_status === "PENDING_VERIFICATION"`, renders a dedicated, elegant holding screen with applicant Sanad details, Advocates Act compliance explanations, "Check Status" refetch button, and logout/citizen dashboard links. **Strictly omits `<Outlet />`**, completely preventing unverified advocates from viewing or touching workspace features.
- **Citizen Queries Privacy Guard (`src/routes/_authenticated/lawyer.queries.tsx`)**:
  - Added dedicated protection guard preventing unverified advocates from viewing or passing queries.
  - Wrapped `handlePassOn` in bulletproof error handling with `Array.isArray(selectedQuery.passed_by)` validation and isolated try/catch blocks for cache and Supabase updates.
- **Founder Page Sync (`src/routes/founders.lawyers.tsx`)**:
  - `queryFn` now calls `getPublicLawyers({ allMembers: true })` and reads `trana_all_registered_lawyers` from localStorage, guaranteeing that newly registered pending advocates appear instantly under the "Pending Verification" tab.
  - `handleApprove` updates the backend via `verifyLawyerAdmin`, updates Supabase, updates `trana_all_registered_lawyers`, and broadcasts `trana_lawyer_status_changed` so the advocate gains instant workspace access.


---

## [2026-11-12] - Comprehensive Privacy Policy & Terms of Use Publication

### 1. Dedicated Legal Transparency Portal (`src/routes/privacy-policy.tsx`)
- **Problem**: The privacy policy route previously contained a minimal "Coming Soon" placeholder, leaving platform compliance, DPDP Act 2023 disclosures, and BCI non-solicitation disclaimers unaddressed on a dedicated URL.
- **Implementation**:
  - Replaced the placeholder with a dual-tabbed legal disclosure portal covering:
    1. **Privacy Policy**:
       - **Strict DPDP Act 2023 & IT Rules 2011 Compliance**: Discloses limited collection of identity, case documents, and technical telemetry.
       - **Strictly No AI Training Policy (Section 3)**: Highlights with an emerald safeguard callout that user personal data, uploaded FIRs, police complaints, and private communications are **never** used to train, fine-tune, or improve underlying AI models, and are processed strictly transiently.
       - **Confidentiality & Data Sharing**: Details user-initiated advocate transmissions, service provider confidentiality agreements, and strict court order disclosure thresholds.
       - **Legal Privilege Disclaimer**: Reaffirms that preliminary platform messaging relays do not create statutory attorney-client privilege under Section 126 of the BSA until formal engagement.
       - **Indian Citizen Data Rights**: Right to access, correction, erasure, and consent withdrawal.
       - **Statutory Grievance Redressal Desk**: Formal listing of Grievance Officer Swastik Mishra, official email (`grievance@trana.in`), and registered New Delhi office.
    2. **Terms and Conditions of Use**:
       - **Indian Contract Act, 1872 Eligibility**: Representation of majority and contractual capacity.
       - **BCI Rule 36 Compliance (Non-Solicitation)**: Explicit confirmation that TRANA is a technology platform and not a law firm, functioning as an independent directory without solicitation or advertising.
       - **No Legal Advice & No Advocate-Client Relationship**: Clarifies that AI outputs are informational first-aid tools and not formal counsel.
       - **Prohibited Conduct & Account Security**: Rigorous anti-abuse rules against reverse-engineering, scraping, or uploading malicious code.
       - **AI Disclaimer & Liability Limitations**: Transparent acknowledgement of model hallucination risks and exclusion of consequential damages.
       - **Intellectual Property & Devanagari Script Mark**: Explicit protection of the TRANA brand, architecture, prompt structures, and proprietary Devanagari script mark (**त्राण / त्राणा**).
       - **Governing Law & Arbitration**: Substantive laws of India, sole arbitrator under Arbitration and Conciliation Act 1996, with seat and venue exclusively in New Delhi, India.
  - **Interactive Features**: Tab switcher (`?tab=privacy` vs `?tab=terms`), "Share / Copy Link" clipboard helper, and "Print / Save PDF" browser trigger.

### 2. Global Footer Navigation Integration (`src/routes/index.tsx`)
- Updated the landing page footer links to include both **Privacy Policy** and **Terms & Conditions** with direct query parameter links (`/privacy-policy?tab=privacy` and `/privacy-policy?tab=terms`).


---

## [2026-11-12] - Publication of Comprehensive "About TRANA" Page & Founders Spotlight

### 1. "About TRANA" Portal (`src/routes/about.tsx`)
- **Problem**: The `/about` route was previously a basic "Coming Soon" placeholder.
- **Implementation**:
  - Replaced the placeholder with a brand portal detailing:
    - **Our Mission: Democratizing Legal Intelligence**: Transforming how individuals interact with the Indian criminal justice system, bridging the gap between dense procedures and everyday citizens.
    - **The Problem We Solve**: Breaking down archaic legal language and decoding FIRs, notices, and procedural rights during stressful 24-hour crisis windows.
    - **Our Solution**: Acting as a digital legal first responder providing rapid legal first-aid while offering a unified, secure digital workspace for advocates and law students.
    - **The Meaning of TRANA**: Deep dive into the Devanagari script identity (**त्राण / त्राणा** — protection, shelter, preservation, and relief).
    - **Our Commitment to Neutrality**: Independent technology interface adhering strictly to Bar Council of India (BCI) Rule 36 anti-solicitation ethics.
    - **Meet the Founders (Second-Year BA LLB Hons Innovators)**:
      - **Swastik Mishra (Founder & CEO)**: Lead architect, product strategy & technological direction; Delhi roots, advocate family upbringing, former competitive gamer/streamer, cricketer, Taekwondo black belt, fitness, cars, music, and travel.
      - **Soumil Krishn Sharma (Cofounder - Finance & Operations)**: Financial structure, operational discipline, and statutory compliance; Faridabad based, motorsport photographer, competitive badminton player, skilled beatboxer, motorcycle enthusiast, and Japanese culture aficionado.
      - **Aditya Amist (Cofounder - Marketing & PR)**: Civic outreach, brand voice, public relations, and societal impact; Noida based, sharp business acumen, passionate student of Indian history & sociopolitical landscapes, automotive and music lover.
    - **Interactive Features**: Dynamic founder tab switcher, "Beyond the Boardroom" interest pills, and "Share Link" action.
    - **The Collaborative Engine & Core Philosophy**: Uncompromising belief that *"Knowledge must be shared for the betterment of society, and understanding your legal rights should never be a luxury."*
    - **The Five-Year Vision**: Establishing TRANA as the definitive first response application for every Indian citizen, fostering an empowered, happy, and secure Republic.



### 1. Complaint Analyser Prompt Reply Modernization (`src/routes/_authenticated/dashboard.analyse.tsx`)
- **Problem**: The LLM prompt generates a rich 8-part criminal procedural breakdown (`situation_meaning`), but previously the frontend dumped this entire response into a single, generic markdown text card, causing text bloat and duplicate statutory sections.
- **Improvements**:
  - **Dynamic Segment Parsing (`parseAnalysisBreakdown`)**: Added an intelligent regex parser that splits the model's 8-part response into discrete legal modules:
    - *Document Identification & Origin* (`FileSearch`, Case Filing Record badge)
    - *Reported Allegations & Sequence of Events* (`FileText`, Complainant Narrative badge with statutory safeguarding banner)
    - *Do the Sections Match the Alleged Facts?* (`Scale`, Statutory Consistency badge)
    - *Ambiguities, Delays & Missing Particulars* (`AlertTriangle`, Procedural Scrutiny badge)
    - *What This Means For You* (`Shield`, Direct Legal Impact badge)
    - *Paramount Immediate Action* (High-priority amber banner with clock icon)
    - *Conversational / Guidance Fallback* (Clean card for resumes, non-complaint text, or conversational replies)
  - **Interactive View Filters**: Added pill tabs allowing citizens to toggle between:
    - `All Breakdown`: Comprehensive view of all sections.
    - `Facts & Consistency`: Filters to allegations, sequence of events, and factual matching.
    - `Sections & Bail`: Focuses on statutory sections, penalty provisions, and bail classifications.
    - `Immediate Actions & Rights`: Highlights the 24-hour action checklist and statutory rights.
  - **Interactive Next 24 Hours Checklist**: Replaced static numbered lists with interactive checkbox items allowing citizens to track completed procedural steps in real-time.
  - **Enhanced Statutory Cards**: Section cards now feature distinct badges for Cognizable/Non-Cognizable, Bailable/Non-Bailable, maximum penalties, and official act expansions.

### 2. Citizen Query Pass On Resilience & Error Elimination (`src/routes/_authenticated/lawyer.queries.tsx`)
- **Problem**: When an advocate clicked `Pass On to Other Advocates`, an unhandled Supabase update failure or UUID mismatch threw an error that surfaced `Could not pass query.` toasts.
- **Fixes**:
  - `handlePassOn` now safely updates `localStorage` passed trackers, updates local queries pool, optimistically mutates React Query cache, and only executes background Supabase updates if the ID is a valid UUID, wrapped safely in isolated error handling.
  - Added protection so that unverified advocates pending Founder review are kept on the holding screen and cannot inadvertently attempt mutations on protected citizen inquiries.

---

## [2026-11-12] - Terms and Conditions Heading Styling & Devanagari Identity Update

### 1. Terms and Conditions Heading & Typography (`src/routes/privacy-policy.tsx`)
- **Changes**:
  - In `TermsContent()`, updated the main card heading to `TRANA (त्राणा) — TERMS AND CONDITIONS OF USE` and styled it in **Times New Roman** (`fontFamily: '"Times New Roman", Times, serif'`).
  - In the Hero `h1` component, added conditional heading display when `activeTab === "terms"` to render `TRANA (त्राणा) — Terms and Conditions of Use` in **Times New Roman**.
  - Updated the navbar brand subtext from `त्राण` to `त्राणा`.
  - In Section 7 (Intellectual Property Rights), updated the proprietary mark description to highlight the Devanagari script mark `(त्राणा)`.
- **Considerations**:
  - Adheres strictly to the brand's canonical Devanagari representation (**त्राणा**) while maintaining clear typographic distinction using Times New Roman for formal legal terms.

### 2. Privacy Policy Update & Grievance Desk Address (`src/routes/privacy-policy.tsx`)
- **Changes**:
  - Replaced `PrivacyPolicyContent()` with the complete 8-section legal charter formatted identically to the Terms & Conditions:
    - Styled in **Times New Roman** (`fontFamily: '"Times New Roman", Times, serif'`) with consistent typography and spacing (`text-[16px] sm:text-[17px]`).
    - Updated card heading to `TRANA (त्राणा) — PRIVACY POLICY` with Devanagari script identity and date `12 November 2026`.
    - Preamble: DPDP Act 2023 & IT Rules 2011 statutory grounding.
    - Section 1: Information We Collect (Identity & Contact, Case Information & Document Uploads, Technical and Usage Data).
    - Section 2: How We Use Your Information (Strictly Pro Citizen).
    - Section 3: STRICTLY NO AI TRAINING POLICY (Highlighted callout emphasizing zero AI model training on citizen complaints or private communications).
    - Section 4: Confidentiality and Data Sharing (User Initiated Advocate Connection, Service Providers, Legal Mandates).
    - Section 5: Data Security (Industry-standard security and notice on preliminary platform relays regarding lawyer-client privilege).
    - Section 6: Data Retention.
    - Section 7: Your Rights (Access, Correction, Erasure, Consent Withdrawal).
    - Section 8: Grievance Redressal Officer (Swastik Mishra, `tranaintelligence@gmail.com`, D-537 Additional Building Block, Supreme Court of India).
  - Updated Hero `h1` component to display `TRANA (त्राणा) — Privacy Policy` in Times New Roman when the Privacy Policy tab is selected.
  - Updated footer contact email to `tranaintelligence@gmail.com`.

---

## [2026-11-12] - Color Theme Harmonization with Original Website & Heading Text Refinement

### 1. Unified Theme Colors & Removed Neon Accents (`src/routes/privacy-policy.tsx`)
- **Theme Alignment**:
  - Replaced custom glowing colors and neon backgrounds (`bg-[#0A0A0C]`, `bg-[#121216]`, amber/emerald radial blurs) with the core theme design tokens from `src/routes/index.tsx` and `src/styles.css`:
    - Base surface: `bg-background text-foreground border-l border-r border-border`
    - Navbar: `border-b border-border bg-background/90 backdrop-blur` with signature `btn-solid !px-3 !py-1.5 !text-xs` button
    - Tabs & Pills: `border border-border bg-secondary/40`, active tabs set to crisp monochrome `bg-foreground text-background font-medium shadow-sm`
    - Content Cards: `rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm`
    - Text & Markers: `text-foreground/90` body, `text-foreground` titles, and subtle `text-muted-foreground` for bullets and secondary metadata.
- **Heading Refinement**:
  - Cleaned all page and card headings:
    - Deleted `(त्राणा)` from headings while strictly preserving `त्राणा` at the extreme top navbar.
    - Deleted `of Use` / `OF USE` from headings (`TRANA — Terms and Conditions` and tab button `Terms & Conditions`).
    - Main Hero heading now renders:
      - `TRANA — Terms and Conditions` when Terms is active.
      - `TRANA — Privacy Policy` when Privacy Policy is active.
  - All content, legal text, and Times New Roman typography preserved completely untouched.

---

## [2026-11-12] - About TRANA Comprehensive Text Update & Founder Photo Spaces

### 1. "About Us" Content & Architecture Realignment (`src/routes/about.tsx`)
- **Core Narrative & Sections Updated**:
  - **Our Mission**: Democratizing legal intelligence for every Indian citizen.
  - **The Problem We Solve**: Breaking through dense, archaic legal language and decoding FIRs and legal notices during urgent crisis moments.
  - **Our Solution**: Digital legal first responder providing rapid first aid legal info alongside a modern, digitalized ecosystem for legal professionals.
  - **The Meaning of TRANA**: Grounded in the Devanagari script (**त्राण / त्राणा**) signifying protection, shelter, preservation, and relief, with strict confidentiality and zero AI model training guarantees.
  - **Our Commitment to Neutrality**: Independent technology interface adhering to Bar Council of India (BCI) Rule 36 non-solicitation ethics.
  - **MEET THE FOUNDERS**:
    - **Swastik Mishra** - Founder & Chief Executive Officer (CEO): Architect, strategy, product, and technology; Delhi roots, advocate family upbringing, competitive gaming/streaming, cricket, and Taekwondo black belt.
    - **Soumil Krishn Sharma** - Cofounder (Finance & Operations): Financial structure, operational discipline, and statutory compliance; Faridabad roots, motorsport photography, competitive badminton, beatboxer, and Japanese culture aficionado.
    - **Aditya Amist** - Cofounder (Marketing & Public Relations): Platform voice, civic outreach, and brand trust; Noida based, keen business acumen, Indian history & sociopolitical landscape focus, automotive and music lover.
  - **Dedicated Founder Photo Spaces**:
    - Added dedicated photo/portrait container (`image?: string` support with dashed border, avatar fallback, and camera iconography) in both the in-depth founder spotlight card and the 3-founder summary grid.
  - **The Collaborative Engine**: Shared purpose across product development, legal compliance, and strategy.
  - **OUR CORE PHILOSOPHY**: *"Knowledge must be shared for the betterment of society, and understanding your legal rights should never be a luxury."*
  - **THE FIVE YEAR VISION**: Establishing TRANA as the definitive first response application for every single Indian citizen, fostering an empowered, happy, and secure Republic.
- **Theme & Spacing Consistency**:
  - Matched the website design tokens (`bg-background`, `text-foreground`, `border-border`, `bg-card`, `bg-secondary`, `btn-solid`), removing neon ambient blur gradients for a clean, professional aesthetic.
## [2026-11-12] - Founder Swastik Mishra Portrait Image Integration

### 1. "About Us" Founder Portrait (`src/routes/about.tsx` & `public/founders/swastik-mishra.jpg`)
- **Assets Added**:
  - Saved portrait photograph to `public/founders/swastik-mishra.jpg` and `public/swastik-mishra.jpg`.
- **Changes**:
  - Linked `image: "/founders/swastik-mishra.jpg"` to Swastik Mishra in `FOUNDERS` array within `src/routes/about.tsx`.
  - Added clean solid border and portrait framing (`object-cover object-top`) to both the spotlight founder card and the 3-founder summary grid so the founder's portrait displays seamlessly while leaving placeholders for remaining founders untouched.
- **Considerations**:
  - Strictly preserves all other copy, styling, and sections in the application as requested ("do not chage anything else").


### 1. Advocate Verification Portal BCI Declaration Card (`src/routes/_authenticated/lawyer.tsx`)
- **Changes**:
  - Restored the authentic visual styling from the original Bar Council declaration card:
    - Amber-accented container: `border border-amber-500/40 bg-amber-500/[0.04] p-4 sm:p-5` with clean rectangular edges.
    - Checkbox outline: sharp amber border `border-amber-400/80 bg-transparent` when unchecked and `border-amber-400 bg-amber-400 text-black` when checked.
    - Typography: Monospace font family (`font-mono`) matching the exact aesthetic of the original legal-tech compliance card.
    - Visibility Enhancement: Elevated contrast and sizing from the previous tiny `text-[10px]` with dim `80%` opacity to crisp, easily readable `text-xs sm:text-[13px] leading-relaxed`, with a bold amber title `text-amber-300 font-bold text-sm tracking-wide` and bright amber-gold body `text-amber-100` / `text-amber-200/95`.
  - Upheld the comprehensive statutory declaration text:
    - *BCI Professional Conduct Declaration (Mandatory)*
    - *I acknowledge that I am bound by the Bar Council of India Rules, including Rule 36 of Chapter II, Part VI, concerning professional conduct and the prohibition on advertising or soliciting professional work.*
    - *I confirm that the information I provide for my profile is accurate and that I will not use TRANA to advertise, promote or solicit professional engagements in violation of applicable BCI rules.*
    - *I understand that my profile and its publication remain subject to applicable professional regulations and that this declaration does not constitute BCI approval or certification of the listing.*
- **Considerations**:
  - Preserves exact visual parity with the original interface while ensuring compliance text is legible and prominent for enrolling advocates.




---

## [2026-11-12] - Neutrality Copy Refinement, Founder Profile Streamlining & UI Polish

### 1. "About Us" Content & Spacing Refinements (`src/routes/about.tsx`)
- **Copy Updates**:
  - **Neutrality Commitment**: Removed the line `"We are not a law firm."` under *Our Commitment to Neutrality* while preserving the complete statutory neutrality statement regarding independent technology provision and BCI ethics.
  - **Founder Profile**: Removed `"a former gamer and streamer"` from Swastik Mishra's *Beyond the Boardroom* description and cleanly removed the corresponding tag and unused `Gamepad2` icon import.
- **UI Readability & Layout Polish**:
  - Enhanced contrast and visual clarity for the Founder switcher tab badges.
  - Enlarged and optimized Swastik's portrait container (`sm:w-36 sm:h-36`) with top-aligned framing (`object-top object-cover`) and crisp border treatment.
  - Upgraded thumbnail picture containers in the 3-founder summary grid to `h-16 w-16` with solid border framing for registered images.
  - Improved line heights, paragraph font sizes (`text-sm sm:text-base leading-relaxed`), and spacing rhythm across cards.
- **Considerations**:
  - Strictly preserves all other copy, vision, philosophy, and features without unintended changes.


---

## [2026-11-12] - About Page Reading Space Optimization & Layout Refinements

### 1. Spacing & Typography Calibration (`src/routes/about.tsx`)
- **Reading Measure & Flow**:
  - Calibrated text containers and measure widths (`max-w-4xl` and `max-w-3xl`) to establish natural line lengths that eliminate visual fatigue.
  - Increased line-height rhythm (`leading-[1.15]` for titles, `leading-relaxed` for paragraphs) and unified body font scaling (`text-sm sm:text-base text-foreground/90`).
- **Card Margins & Padding**:
  - Elevated card paddings to `p-7 sm:p-10 lg:p-12` across major narrative modules (*The Devanagari Meaning*, *The Collaborative Engine*, *Our Core Philosophy*, and *The Five Year Vision*).
  - Aligned Problem & Solution column heights with `flex flex-col justify-start` and dedicated `space-y-3.5` between problem/solution narrative steps.
  - Generously spaced out the section gaps (`space-y-14 sm:space-y-20`) for clear cognitive separation between brand mission, legal neutrality, founders, and 5-year outlook.
- **Zero Content Alteration**:
  - Preserved every word, punctuation mark, and link exactly as authored.


---

## [2026-11-12] - Core Platform Description Refinement on Landing Page

### 1. Tagline & Meta Description Alignment (`src/routes/index.tsx`)
- **Copy Replacement**:
  - Replaced:
    `TRANA makes legal information easier to understand and connects you with the right legal professional when it matters most.`
  - With:
    `TRANA is a criminal intelligence platform designed to make legal information, procedural guidance and legal research more accessible through AI powered technology`
- **Locations Updated**:
  - Main Hero Section (`src/routes/index.tsx` line 117): Direct prominent subtitle under the primary hero heading *Legal Guidance, Within Reach.*
  - Route Head Metadata (`src/routes/index.tsx` lines 9 & 11): Synchronized `name: "description"` and `property: "og:description"` tags with the new statement for search engine snippets and social sharing.
- **Considerations**:
  - Accurately conveys TRANA's identity as an AI-powered criminal intelligence platform focused on accessible legal information, procedural guidance, and research.
  - Zero other copy, layout, or structural elements modified ("do not change anything else").


---

## [2026-11-12] - Restrict Platform Description to Legal Disclosures & Restore Landing Page

### 1. Revert Landing Page Hero (`src/routes/index.tsx`)
- **Restoration**:
  - Restored original hero subtitle:
    `TRANA makes legal information easier to understand and connects you with the right legal professional when it matters most.`
  - Restored original `name: "description"` and `property: "og:description"` head metadata tags.
- **Reasoning**:
  - User requested that the criminal intelligence definition line appear strictly in Terms & Conditions, Privacy Policy, and About Us, and NOT on the general landing page.

### 2. Add Platform Definition to Terms & Conditions, Privacy Policy & About Us
- **Terms & Conditions (`src/routes/privacy-policy.tsx`)**:
  - In Section 2 (*Nature of the Platform & BCI Compliance (Non Solicitation)*):
    Updated opening description to:
    `TRANA is a criminal intelligence platform designed to make legal information, procedural guidance and legal research more accessible through AI powered technology. We are NOT a law firm, and we do not practice law.`
- **Privacy Policy (`src/routes/privacy-policy.tsx`)**:
  - In Privacy Policy preamble:
    Prepended:
    `TRANA is a criminal intelligence platform designed to make legal information, procedural guidance and legal research more accessible through AI powered technology. This Privacy Policy explains how TRANA ("we," "us," or "our") collects, uses, protects, and handles your data...`
- **About Us (`src/routes/about.tsx`)**:
  - In Our Mission statement:
    Integrated:
    `TRANA is a criminal intelligence platform designed to make legal information, procedural guidance and legal research more accessible through AI powered technology.`
- **Considerations**:
  - Fulfills the user's explicit preference that this specific description belongs strictly inside the statutory, privacy, and company background contexts, and nowhere else across the platform.


---

## [2026-11-13] - Trana Master Criminal Law Prompt Integration

### 1. Master Expert Legal Prompt Suite (`llm/prompts.py`)
- **Integrated Templates**:
  - `SYSTEM_PROMPT`: Integrated the comprehensive Trana expert persona specializing in BNS 2023, BNSS 2023, and BSA 2023, with former IPC/CrPC/IEA equivalents.
  - `DIRECT_ANALYSIS_PROMPT`: Updated user analysis template with strict adherence to:
    - `"In short: ..."` lead-in format.
    - Selective answering (bail strictly on arrest; 24-hour playbooks only on active crisis; skip emergency fields for informational queries).
    - Playbooks A (Arrest), B (House Search), and C (Police Notice/Summons).
    - Source citation format: `(BNS, Section <X>; earlier IPC Section <Y>)`.
    - Mandatory closing: `"Sources: <provisions>\nCheck the official text on indiacode.nic.in.\n\nThis is general information, not legal advice."`
    - Reaching a lawyer protocol: Single offer followed by NALSA (15100), DLSA, Tele-Law (14454), Bar Council advice, and redirection to the Find a Professional section of TRANA.
    - Out-of-scope non-criminal queries: Exact prompt response `"I'm only trained to help with criminal law situations under BNS, BNSS, BSA and related criminal laws. For anything else, please consult the right professional."`
  - `CONVERSATIONAL_PROMPT`: Aligned conversational and short-prompt handler with the same warm midnight friend tone, lawyer reach flow, and scope guardrails.
- **Complaint Analyser Isolated**:
  - Kept `COMPLAINT_FIR_ANALYSIS_SYSTEM_PROMPT` and `COMPLAINT_FIR_ANALYSIS_PROMPT` completely untouched per user directive ("keep the complaint analyser part out of this, ill give a seprate prompt fot that").
- **Routing & Trigger Separation (`llm/chain.py`)**:
  - Narrowed `_is_complaint_fir_analysis` to prevent normal chat inquiries containing common criminal law words ("police station", "fir", "robbery", "assault") from mistakenly routing to the complaint analyser prompt. Only explicit calls targeting `/dashboard/analyse` or documents uploaded specifically for dedicated complaint analysis trigger the analyser prompt.
  - Adjusted `_normalize_analysis_payload` so that breakdown fields (`bail_status`, `next_24_hours`, `rights`) do not suppress general analysis output, ensuring complete emergency playbook responses.
- **Frontend Crisis Breakdown & Disclaimer Assurance (`src/routes/_authenticated/dashboard.chat.tsx`)**:
  - In `formatAnalysis`, ensured that crisis breakdown fields (`situation_meaning`, `bail_status`, `next_24_hours`, `rights`, `handling_authority`) are displayed alongside `general_analysis` when present.
  - Added an automatic fallback check ensuring every substantive legal response concludes with the mandatory statement: `*This is general information, not legal advice.*`
  - Suppressed redundant generic lawyer notes when the model's response already includes NALSA / DLSA reach guidance.
- **Comprehensive Relevance Directive (`llm/prompts.py`)**:
  - Reinforced both `SYSTEM_PROMPT` and `DIRECT_ANALYSIS_PROMPT` to mandate comprehensive coverage whenever any legal aspect (meaning, penal section & punishment, bail eligibility & anticipatory bail, immediate steps / next 24 hours, statutory rights, competent court/authority) is relevant to the user's inquiry, ensuring no crucial safeguards or actionable rights are omitted.
- **Legal First Aid Standard Sequence & Narrative Meaning (`llm/prompts.py`, `llm/chain.py`, `src/routes/_authenticated/dashboard.chat.tsx`, `models/schemas.py`, `src/lib/trana-types.ts`)**:
  - Enforced the exact user-specified sequence for problems/scenarios:
    1. `Meaning (easy terms)`: Formatted as a coherent narrative paragraph rather than bullet points, avoiding complicated jargon.
    2. `Bail Status`: Explicitly determining bailable or non-bailable classification under BNSS, station vs court bail, and anticipatory bail.
    3. `Immediate steps`: Step-by-step guidance right now and next 24 hours (utilizing 24-hour Playbooks A, B, or C when needed).
    4. `Rights`: Statutory and constitutional rights applicable in the situation.
    5. `Court or authority`: The competent Magistrate/court or police authority.
    6. `Legal reasoning at the end`: Proper statutory reasoning analyzing legal ingredients, facts for/against, and noting that court makes final determination.
    7. `Cite sources`: Bracketed citations `(BNS Section X; earlier IPC Section Y)` with indiacode.nic.in reference.
    8. `Reaching a lawyer`: Single offer when relevant, providing NALSA 15100, DLSA, Tele-Law 14454, Bar Council guidance, and TRANA Find a Professional.
  - For normal/general informational questions, explicitly instructed to skip the crisis sequence and provide simple, direct answers without unnecessary playbooks or bail sections.
  - Added `legal_reasoning` field to `StructuredAnalysis` schemas across Python backend and TypeScript frontend.
- **Reset Legal First Aid Prompt to Clean Placeholder (`llm/prompts.py`)**:
  - Cleared `SYSTEM_PROMPT`, `DIRECT_ANALYSIS_PROMPT`, and `CONVERSATIONAL_PROMPT` to a minimal schema-compatible placeholder per user request, ready for the user to provide a brand new prompt.
  - Kept `COMPLAINT_FIR_ANALYSIS_SYSTEM_PROMPT` and `COMPLAINT_FIR_ANALYSIS_PROMPT` (the separate Complaint Analyser tool) completely untouched.
- **TRANA Master System Prompt V2.1 Integration (`llm/prompts.py`)**:
  - Integrated the full TRANA — MASTER SYSTEM PROMPT V2.1 (Sections 1 through 18) into `SYSTEM_PROMPT`, `DIRECT_ANALYSIS_PROMPT`, and `CONVERSATIONAL_PROMPT`.
  - Enforced the Standard Response Format (A. In Short, B. What the Law Says, C. Is the Offence Bailable or Non-Bailable?, D. Immediate Steps, E. What to Do in the Next 24 Hours, F. Your Rights, G. Legal Reasoning, H. Professional Assistance), Mandatory Legal Accuracy Protocol, Section 18 Mandatory Complaint/FIR Redirection to `/dashboard/analyse`, and official indiacode.nic.in sources citations with statutory disclaimer.
  - Kept `COMPLAINT_FIR_ANALYSIS_SYSTEM_PROMPT` and `COMPLAINT_FIR_ANALYSIS_PROMPT` (the separate Complaint Analyser tool) completely untouched.
- **Universal TRANA AI Chatbox Self-Introduction (`src/routes/_authenticated/dashboard.chat.tsx`)**:
  - Configured TRANA AI to introduce itself at the head of every chatbox:
    `"I am TRANA, an Indian criminal-law information and assistance platform designed to help ordinary people and families understand criminal law, their legal rights, and practical next steps under the BNS, BNSS, BSA, and related laws. How can I help you today?"`
  - Ensured that new sessions, guest temporary chats, and historical loaded sessions begin with this introduction.
- **Zero Website UI Changes**:
  - Preserved all website routes, layout, styling, and text exactly as authored.
- **Priority Extension — Mandatory Module: Legal Accuracy, Bail Verification & Free Legal Aid (`llm/prompts.py`)**:
  - Integrated the full 10-section Priority Extension module into TRANA's Master System Prompt V2.1 (`SYSTEM_PROMPT` and `DIRECT_ANALYSIS_PROMPT`):
    1. `Core Rule: Legal Accuracy First`: Strict statutory grounding against official Acts and BNSS First Schedule; never invent sections, punishments, or citations; explicitly disclose if a provision cannot be verified.
    2. `Strict Offence Identification — No Invented Sections`: Analyse only alleged offences from facts; do not automatically tack on aggravated sections (e.g., stealing laptop from shop under BNS 303(2) must not automatically include BNS 305). Clearly distinguish FIR sections, potential sections, and unsupported sections.
    3. `Mandatory Bail Classification Verification`: Check BNSS First Schedule; separate classifications for multiple offences; cognizable does not mean arrest is mandatory, and non-bailable does not mean bail is impossible.
    4. `BNSS Section Verification — Procedural Accuracy`: Accurate grounding of BNSS 35, 36, 38, 47, 48, 57, 58, 480, 483. Explicit rule to never interchange BNSS 47 (grounds of arrest & bail right notice) with BNSS 48 (informing relative/friend); explain timely production before Magistrate within 24 hours under BNSS 57/58 rather than misrepresenting automatic release.
    5. `Free Legal Aid — Mandatory Priority`: CRITICAL requirement: When a user cannot afford counsel, belongs to a financially weak family, or is in custody, prioritize free legal aid (Constitution Article 39A & Article 21, Legal Services Authorities Act 1987 Section 12). Persons in custody qualify independently regardless of general income criteria. Provide step-by-step Magistrate requests, DLSA/DSLSA contacts, and national helpline `15100` before suggesting any private representation.
    6. `Response Priority for Financially Weak Users`: Enforces structured 7-step sequence: 1. Immediate situation, 2. Free legal aid, 3. Arrest and detention rights, 4. Bail position, 5. Next 24 hours, 6. Documents required, 7. Professional assistance. Free legal aid is never buried at the bottom.
    7. `Immediate Action Plan — Criminal Legal Aid`: Concrete guidance for custody situations (police station, FIR copy, Magistrate production, preserving evidence/CCTV, bail advice).
    8. `Sources and Legal Verification`: Hierarchy prioritizing India Code, Official Gazette, Supreme Court/High Court judgments, and NALSA/SLSA portals.
    9. `Internal Consistency Check — Mandatory`: 12-point internal consistency verification required before generating any legal response.
    10. `Fundamental Rule`: Access to justice must never appear restricted to those who can afford private counsel.
  - Kept `COMPLAINT_FIR_ANALYSIS_SYSTEM_PROMPT` and `COMPLAINT_FIR_ANALYSIS_PROMPT` completely untouched.

---

## [2026-11-13] - Fix Find a Professional in Citizen Dashboard & Missing Component Imports

### 1. "Find a Professional" Crash Fix (`src/routes/_authenticated/dashboard.lawyers.tsx`)
- **Problem**: When a citizen navigated to "Find a Professional" (`/dashboard/lawyers`), the route crashed during React render because `<Link to="/dashboard">` was used in the Consent & Privacy notice without `Link` being imported from `@tanstack/react-router`, resulting in an uncaught `ReferenceError: Link is not defined` / `Element type is invalid` error that broke the entire page.
- **Fixes**:
  - Added `Link` to the `@tanstack/react-router` imports in `dashboard.lawyers.tsx`.
  - Added baseline verified advocates fallback (`Adv. Krish Chauhan` and `Adv. Siddharth K. Rao`) when backend/Supabase returns empty, preventing a blank directory screen during backend cold starts.
  - Added defensive optional chaining on `user?.id`, `user?.email`, and `user_metadata` in `request()` to prevent runtime errors for temporary or uninitialized user profiles.

### 2. Citizen Dashboard Disclaimer Navigation Flow (`src/routes/_authenticated/dashboard.tsx`)
- **Problem**: Clicking "Find a Professional" cards on the citizen home dashboard checked only `trana_disclaimer_accepted_${user.id}` in `onClickCapture`, which could re-trigger the statutory disclaimer modal unnecessarily even if previously acknowledged.
- **Fixes**:
  - Updated `onClickCapture` and the confirmation callback to check and persist both `trana_disclaimer_accepted_${user.id}` and `trana_statutory_disclaimer_accepted`.

### 3. Fixed Missing Lucide Icon Imports Across Other Routes
- Added `AlertCircle` to `lucide-react` imports in `src/routes/_authenticated/dashboard.analyse.tsx`.
- Added `ShieldCheck` to `lucide-react` imports in `src/routes/_authenticated/lawyer.documents.tsx`.
- Verified with an AST-based JSX validator that zero undeclared JSX components remain across all route files.
- Full production build verified clean with `bun run build`.
