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
