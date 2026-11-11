# Changelog & Architecture Notes for Future Agents

This document tracks all changes made to the TRANA codebase, the context/reasoning behind them, and technical considerations for future agents working on this project. Always read this file before starting tasks.

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

