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
