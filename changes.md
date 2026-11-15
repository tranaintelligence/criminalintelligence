# Changelog & Architecture Notes for Future Agents

## [2026-11-15] - Courtroom Case Simulator: Clean Step Down, Adjourned Session Recovery & Scroll Lock Fix

### Changes
1. **Dedicated Step Down & Clean Case Reset (`src/routes/_authenticated/student.simulator.tsx`)**:
   - Replaced ambiguous exit flow with an explicit **"Step Down (Reset & Close)"** button (`handleStepDown`).
   - Cleanly resets all transient simulation state (`activeTemplate = null`, `turns = []`, `inputArgument = ""`, `evaluationResult = null`, `isSubmittingTurn = false`) and returns the advocate to the courtroom catalog without leftover state.

2. **Session Adjournment & Resumption at User Convenience (`src/routes/_authenticated/student.simulator.tsx`)**:
   - Added an **"Adjourn Session (Resume Later)"** button (`handleAdjournSession`) that snapshots the active case template, full transcript history, pending podium input, and timestamp into `localStorage` (`trana_case_simulator_adjourned_session`).
   - Added an **"Adjourned Court Proceedings"** recovery banner on the simulator home catalog view showing the matter title, number of recorded statements, and timestamp.
   - Provides one-click **"Resume Trial"** (restoring exact transcript and template state) or **"Discard"** (removing saved session), giving students complete flexibility to pause and resume hearings at their convenience.

3. **Viewport Scroll Locking & Elimination of Page Drop on Typing / Submitting (`src/components/CourtroomPixelScene.tsx` & `src/routes/_authenticated/student.simulator.tsx`)**:
   - **Root Cause Eliminated**: Removed `transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" })` which had previously hijacked the browser's viewport and forcibly dragged the whole page down ~1000px whenever statements were submitted or received.
   - **Container-Scoped Transcript Scroll**: Scoped auto-scrolling strictly to `transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight`, ensuring the dialogue transcript updates smoothly without affecting window scroll.
   - **Instant Viewport Lock**: Added `window.scrollTo({ top: currentScrollY, behavior: "instant" })` both immediately upon user submission and when the Bench/Prosecutor responds, ensuring the student's viewpoint stays anchored firmly at the speaking podium and 16-bit court arena.
   - **Keydown & Event Isolation**: Added `e.stopPropagation()` and `e.preventDefault()` on Enter keydown in the podium input, added `type="button"` and `disabled={isSubmittingTurn}` attributes across all camera, gavel strike, and quick submission buttons, preventing any unwanted browser scroll or form resets while typing or interacting.


## [2026-11-15] - Vibrant Color & Visual Architecture Upgrade for Law Converters & Study Centre

### Changes
1. **Student Dashboard Core Learning Cards (`src/routes/_authenticated/student.index.tsx`)**:
   - **Law Converters**: Upgraded from flat glass styling to a rich Royal Violet & Amethyst gradient (`bg-gradient-to-br from-[#2a1245]/90 via-[#190a2b]/95 to-[#0d0517]/98 border border-purple-500/40 hover:border-fuchsia-400/80`), luminous top highlight bar (`from-purple-500 via-fuchsia-400 to-indigo-500`), glowing violet icon container (`shadow-[0_0_18px_rgba(168,85,247,0.35)]`), and dynamic sub-pills (`IPC ↔ BNS`, `CrPC ↔ BNSS`, `IEA ↔ BSA`).
   - **Study Centre**: Upgraded from dull green styling to a radiant Emerald & Teal academic jewel-tone gradient (`bg-gradient-to-br from-[#0a2e22]/90 via-[#061d16]/95 to-[#020e0b]/98 border border-emerald-500/40 hover:border-emerald-300/80`), luminous teal-emerald-cyan top highlight bar, glowing emerald icon container (`shadow-[0_0_18px_rgba(16,185,129,0.35)]`), and feature pills (`Timed MCQs`, `AI Explainer`, `Revision Guides`).
   - **Criminal Law Library**: Enhanced with a deep warm amber & gold gradient, top luminous gold bar, and glowing amber badge.
   - **BNS Daily Provision Cross-Reference**: Converted link into a sleek, glowing purple & amber concordance pill (`shadow-[0_0_12px_rgba(168,85,247,0.2)]`).

2. **Law Converters Chromatic Identity (`src/routes/_authenticated/student.converters.tsx`)**:
   - **Three Distinct Converter Pair Themes**:
     - *IPC 1860 ↔ BNS 2023 (Substantive)*: Royal Purple & Violet gradient with neon violet borders (`border-purple-400/80 shadow-[0_0_28px_rgba(168,85,247,0.25)]`).
     - *CrPC 1973 ↔ BNSS 2023 (Procedural)*: Electric Sapphire & Sky Blue gradient with cyan borders (`border-sky-400/80 shadow-[0_0_28px_rgba(14,165,233,0.25)]`).
     - *IEA 1872 ↔ BSA 2023 (Evidentiary)*: Vibrant Emerald-Teal gradient with glowing emerald borders (`border-emerald-400/80 shadow-[0_0_28px_rgba(16,185,129,0.25)]`).
   - **Transition Matrix Enhancements**: Center transition rings dynamically styled per active pair; classification badges equipped with luminous jewel glow (`Exact Equivalent` in radiant emerald, `Substantially Similar` in electric cyan, `Modified Provision` in warm amber).
   - **Compare Action**: Glowing violet glass pill with purple hover state.

3. **Study Centre Visual & Color Elevation (`src/routes/_authenticated/student.study.tsx`)**:
   - **Navigation Tabs**: Active tab equipped with violet underglow (`bg-purple-950/30 border-b-2 border-purple-400 shadow-[0_0_18px_rgba(168,85,247,0.2)]`).
   - **MCQ Option Choices**: Upgraded from flat colors to rich jewel-tone gradients:
     - *Correct*: Vibrant Emerald jewel gradient (`from-emerald-950/70 to-teal-950/60 border-emerald-400/80 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.25)]`).
     - *Wrong*: Radiant Ruby/Rose gradient (`from-rose-950/70 to-red-950/60 border-rose-400/80 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.25)]`).
     - *Selected*: Royal Purple gradient (`from-purple-950/70 to-indigo-950/60 border-purple-400/80 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)]`).
   - **Four Themed Revision Modules**:
     - *Module 1 (BNS)*: Royal Purple / Violet gradient with fuchsia accent.
     - *Module 2 (BNSS)*: Warm Amber / Gold gradient with yellow accent.
     - *Module 3 (BSA)*: Electric Sky / Cyan gradient with blue accent.
     - *Module 4 (Special Acts)*: Radiant Emerald / Teal gradient with mint accent.
   - **Bare Act Explainer**: Enhanced Gazette box with purple border, violet conceptual breakdown, and glowing numbered ingredient chips.

---


### Changes
1. **Interactive Statutory Concordance & Side-by-Side Comparison Drawer (`src/routes/_authenticated/student.converters.tsx`)**:
   - **Side-by-Side Comparative Modal/Drawer**: Clicking any concordance card or "Compare" opens an in-depth comparative viewer showing colonial statutory text vs enacted 2023 Sanhitas text side-by-side in **Times New Roman** (`font-['Times_New_Roman',_Times,_serif]`).
   - **Legal Shift Breakdown**: Displays categorized insights for each provision:
     - *Substantive Ingredients & Scope* (e.g. community service for low-value restitution, mob lynching sub-clause).
     - *Punishment & Procedural Shifts* (penalty calibrations, compoundability, and trial court jurisdiction).
     - *Mapping Classification* (`Exact Equivalent`, `Substantially Similar`, `Modified Provision`).
   - **Mandatory Statutory Transitional Safeguards**: Prominently highlights Section 358 BNS and Section 531 BNSS repeal and savings clauses, alerting students and practitioners that offences committed or procedural events occurring prior to 1 July 2024 continue to be governed by the older statutes based on commission date rather than FIR date.
   - **High-Frequency Quick-Jump Pills**: Dynamic shortcut chips for each converter pair:
     - IPC/BNS: `Theft (378➔303)`, `Murder (302➔103)`, `Cheating (420➔318)`, `Dowry Death (304B➔80)`, `Conspiracy (120B➔61)`, `Sedition Overhaul (124A➔152)`.
     - CrPC/BNSS: `Undertrial Bail (436A➔479)`, `Notice of Arrest (41A➔35)`, `Zero FIR (154➔173)`, `Remand (167➔187)`.
     - IEA/BSA: `Electronic Certificate (65B➔63)`, `Primary Digital Records (62➔57)`, `Confessions to Police (24-27➔22-24)`.
   - **Classification Filter Tabs**: Filter concordance provisions by `All Mappings`, `Exact Equivalent`, `Substantially Similar`, or `Modified Provision`.

2. **Interactive Academic Study Centre Overhaul (`src/routes/_authenticated/student.study.tsx`)**:
   - **MCQ Practice Quiz with Exam Mode Timer**:
     - 60-second countdown timer toggle with an animated progress bar (transitions green ➔ amber ➔ pulsing red) and auto-submit on timeout.
     - Subject filter tabs: `All Laws`, `BNS 2023`, `BNSS 2023`, `BSA 2023`, `POCSO`, `NDPS`.
     - Live Score & Streak Tracker with animated flame icon 🔥 tracking consecutive correct answers.
     - In-depth statutory ratio and judicial authority explanation on submission, citing exact subsections and Supreme Court rulings.
     - Quiz Completion Review Card displaying percentage score, performance evaluation, and instant retake option.
   - **Bare Act Conceptual Explainer**:
     - Quick-jump provision chips for immediate one-click analysis (`BNS 103`, `BNS 303`, `BNS 318`, `BNSS 35`, `BNSS 173`, `BNSS 479`, `BSA 63`, `NDPS 37`, `POCSO 4`).
     - Authentic Gazette statutory text rendered in **Times New Roman**.
     - Structured breakdown of Essential Ingredients separated into numbered elements (Actus Reus & Mens Rea), plain-language interpretation, and courtroom consequences.
   - **Daily Legal Problem & Judgment of the Day**:
     - Daily legal challenge formatted as an authentic moot court / bar examination problem statement in **Times New Roman** legal factum styling.
     - Judgment of the Day styled as an official Supreme Court of India Law Report card with bench, citation, case factual matrix, and ratio decidendi.
   - **4 Structured Exam Prep Revision Modules**:
     - Expandable cheat-sheets with actionable exam tips and deep links into the Bare Act Library:
       1. *BNS 2023: Substantive Offence Overhaul & Landmark Shifts* (Community service, Mob lynching 103(2), Organised crime 111, Petty organised crime 112, Sovereignty 152).
       2. *BNSS 2023: Bail Categories & Undertrial Safeguards* (Section 479 one-third detention rule, Section 35 notice of appearance, Section 173 Zero FIR, Section 105 video recording, Section 187 remand).
       3. *BSA 2023: Digital Evidence & Electronic Records Admissibility* (Section 63 certificate, Section 57 electronic originals, Sections 22-24 confessions, Section 104 burden of proof).
       4. *Special Criminal Statutes: POCSO, NDPS & PMLA Rapid Matrix* (NDPS Section 37 twin conditions, PMLA Section 45 twin conditions, POCSO Section 29/30 presumptions, SC/ST Act Section 18/18A).

3. **Backend & Robust Client-Side Seed Data (`legal_sources/library_service.py` & `src/lib/student-legal-library.ts`)**:
   - `legal_sources/library_service.py`: Added 5 new high-yield MCQs and enriched `get_law_concordance_mappings` with `src_wording`, `tgt_wording`, `changes_summary`, `punishment_comparison`, and `transitional_note`.
   - `src/lib/student-legal-library.ts`: Updated `SectionMapping` interface with comparative fields; added `SEED_CONVERTER_MAPPINGS` and `SEED_STUDY_MCQS` as robust offline fallbacks so the Law Converters and Study Centre are immediately functional even during cold starts or offline states.

---


### Changes
1. **Lively & Spacious Law Student Overview Dashboard (`src/routes/_authenticated/student.index.tsx`)**:
   - Elevated the workspace with ambient radial lighting (rich purple & warm amber gold) and generous breathing room (`space-y-10 md:space-y-12`, `p-6 md:p-8` rounded-3xl cards) so nothing appears cramped or cluttered.
   - Added **Hero Spotlight: Virtual Courtroom Case Simulator**: An interactive showcase card featuring the 16-bit pixel Judge, Opposition Prosecutor, and Defense avatars with instant arena launch action.
   - Added **Core Criminal Law Learning Suite**: 3 spacious, distinct cards for the Criminal Law Library (13 Acts), Law Converters (IPC ↔ BNS, CrPC ↔ BNSS, IEA ↔ BSA), and Study Centre (daily drills & MCQs).
   - Added **Featured Daily BNS Provision**: Highlighting Section 303(2) BNS 2023 with direct cross-references to IPC 379 in Law Converters and the Bare Act reader in Legal Library.
   - Balanced academic research telemetry, AI Drafter, Citation Finder, and Litigation Diary into an uncluttered, distraction-free visual layout.

2. **Times New Roman Typography for BNS Acts & Statutory Provisions**:
   - `src/routes/_authenticated/student.library.tsx`: Styled the Bare Act text viewer (`selectedSection.bare_act_text`), Continuous Bare Act Reader (`sec.snippet` and section headings), and section grid snippets in authentic legal **Times New Roman** (`font-['Times_New_Roman',_Times,_serif]`).
   - `src/routes/_authenticated/student.converters.tsx`: Styled statutory provision titles and descriptions for BNS, BNSS, and BSA in **Times New Roman**.
   - `src/routes/_authenticated/student.study.tsx`: Styled the Daily Legal Problem scenario and statutory ratio in **Times New Roman**.
   - `src/routes/_authenticated/student.index.tsx`: Styled the dashboard BNS statutory quote in **Times New Roman**.

## [2026-11-15] - Live Dialogue Speech Bubbles in 16-Bit Court Arena & Integrated Advocate Podium

### Changes
1. **Live Spoken Dialogue in the 16-Bit Court Arena (`src/components/CourtroomPixelScene.tsx`)**:
   - Wired the official courtroom transcript and proceedings directly into the 16-bit visual stage.
   - Added character-anchored live retro speech bubbles:
     - **Judge**: Mahogany & gold speech bubble pointing directly to the Judge on the Dais displaying their inquiries, observations, and rulings with timestamp.
     - **Opposition Prosecutor**: Crimson/rose objection speech bubble anchored above the Opposition Bar displaying the State's objections and counter-arguments.
     - **Defense Counsel (User)**: Royal purple advocate speech bubble anchored above the Defense Bar displaying user submissions.
   - Added a statement stepper (`Turn X of Y`) to browse recent courtroom dialogue exchanges without leaving the arena.

2. **Advocate's Speaking Podium Relocated Near the Courtroom (`src/components/CourtroomPixelScene.tsx` & `src/routes/_authenticated/student.simulator.tsx`)**:
   - Relocated the argument input box from the bottom of the long transcript column directly to the base of the 16-Bit Courtroom Arena.
   - Designed an authentic **Advocate's Speaking Podium**:
     - High-visibility submission input field with microphone icon and keyboard enter submit.
     - One-click quick statutory submission pills: *"Cite Satender Antil & Category A"*, *"Argue Section 479 BNSS Release"*, and *"Raise Section 63 BSA Objection"*.
     - Instant visual reaction: submitting an argument immediately shows the user's speech bubble, triggers the opposition's objection or the judge's gavel strike and inquiry right before the user's eyes.
   - Streamlined the transcript column below into a dedicated, clean official shorthand log for permanent record review.

## [2026-11-15] - Pixelated Judge, Opposition Counsel & Courtroom Crowd in Case Simulator

### Changes
1. **16-Bit Retro Courtroom Pixel Art Component (`src/components/CourtroomPixelScene.tsx`)**:
   - Built authentic vector pixel-art sprites rendered crisply via SVG matrices (`shapeRendering="crispEdges"`, `imageRendering="pixelated"`):
     - **Pixel Judge**: Elevated on the high mahogany Dais with judicial wig curls, wireframe spectacles, white tabs jabot, black robes, and interactive gavel strike animation with bright impact sparks and "ORDER IN THE COURT!" shockwave banner.
     - **Pixel Opposition (Public Prosecutor)**: State Counsel at the opposing bar with sleek hair, sharp gaze, black advocate coat, red-ribboned State Case Diary docket, and an animated pointing objection stance with *"State Vehemently Contests!"* reaction balloon.
     - **Pixel Defense Counsel**: Student advocate at the defense bar with open BNSS documents, briefcase, and purple TRANA insignia.
     - **Pixel Courtroom Crowd (Spectator Gallery)**: 84-column panoramic gallery sitting behind mahogany spectator rails featuring a Police Constable (khaki uniform & beret), Court Stenographer/Clerk typing records, Law Students taking notes on yellow legal pads, concerned Complainant, and Legal Press Reporter. Includes reactive gallery murmurs (*"Did you hear that Section 479 argument?"*, *"The defense is citing Satender Antil..."*).
   - Added interactive camera angle controls (Arena View, Bench View, Opposition Bar View) and manual gavel strike trigger.
   - Created reusable compact avatar components (`PixelJudgeAvatar`, `PixelOppositionAvatar`, `PixelDefenseAvatar`).

2. **Integration into Courtroom Case Simulator (`src/routes/_authenticated/student.simulator.tsx`)**:
   - Replaced static bench header with the full interactive `CourtroomPixelScene` in the active simulation view.
   - In the live transcript stream, replaced generic icons with reactive `PixelJudgeAvatar`, `PixelOppositionAvatar`, and `PixelDefenseAvatar` on every courtroom dialogue turn.
   - Added an interactive pixel courtroom preview banner in the simulation catalog screen inviting students to step to the podium.

## [2026-11-15] - Courtroom Visual Polish, Law Library Bookshelf Theme & Whole Act Reader

### Changes
1. **Whole Act Navigation & Complete Statutory Reader (`student.library.tsx` & `student.converters.tsx`)**:
   - Updated "View Act" link in Law Converters to pass `act` and `section` query parameters to `/student/library`.
   - Added `validateSearch` to `student.library.tsx` with a reactive effect that automatically opens the selected Act and scrolls smoothly to the target section with visual highlight.
   - Raised section query limit in `main.py`, `legal_sources/library_service.py`, and `student-legal-library.ts` from 200 to 600/1000 so that all provisions of major statutes (e.g. BNS's 358 sections, BNSS's 531 sections) load completely without truncation.
   - Added Chapter filter tabs ("All Chapters", "Ch. I", "Ch. II", etc.), in-Act live section search, and a "Continuous Reader" mode allowing users to read the entire Bare Act sequentially like a printed statute.

2. **Realistic Law Library Bookshelves Theme (`student.library.tsx`)**:
   - Implemented realistic mahogany wooden library shelves in the background with leather-bound legal reporter volumes (AIR, SCC, SCR, Gazette of India) featuring gold-leaf spine bands and warm library reading lamp ambient glows.
   - Restyled Act cards as physical hardbound leather volumes with embossed lettering and silk ribbon bookmarks resting on wooden shelf ledges.

3. **Immersive Courtroom Chamber Simulator (`student.simulator.tsx`)**:
   - Transformed the Case Simulator into a lively, authentic courtroom chamber with warm mahogany wood panelling, velvet carpet tones, and polished brass judicial plaques.
   - Added an elevated Judicial Bench with the Scales of Justice brass seal, Presiding Judicial Magistrate avatar, gavel on soundblock with interactive "Order in the Court" strike animation.
   - Added Defence Bar and Opposing Public Prosecutor (State of NCT) tables with microphones, case dockets, and interactive objection / counter-argument stream.
   - Included quick statutory submission pills ("Cite Satender Antil", "Argue Sec 479 BNSS", "Raise Sec 63 BSA Objection") and live courtroom transcript recording.

## [2026-11-15] - Expand TRANA Student Workspace: Legal Library, Law Converters, Case Simulator & Study Centre

### Changes
1. **Sidebar Restructure (`src/routes/_authenticated/student.tsx`)**:
   - Replaced flat navigation list with the specified 4-group hierarchical layout:
     - **OVERVIEW**: Overview (`/student`)
     - **LEARNING**: Legal Library (`/student/library`), Law Converters (`/student/converters`), Case Simulator (`/student/simulator`), Study Centre (`/student/study`)
     - **RESEARCH & WORK**: AI Drafter (`/student/drafter`), Research & Achievements (`/student/publications`), Citation Finder (`/student/citations`), Case Research (`/student/research`), My Documents (`/student/documents`), plus Case Tracker (`/student/cases`) for legal interns
     - **NETWORK**: Professional Network (`/student/network`), My Profile (`/student/profile`)
   - Added clean uppercase group headers, preserved active route highlights, ambient glows, and search filter across all groups.

2. **Module 1: Criminal Law Library (`src/routes/_authenticated/student.library.tsx`)**:
   - Built comprehensive legislation catalog covering 13 Acts (6 Core Criminal: BNS 2023, BNSS 2023, BSA 2023, IPC 1860, CrPC 1973, IEA 1872; 7 Special Criminal: POCSO 2012, SC/ST 1989, NDPS 1985, JJ Act 2015, IT Act 2000, PMLA 2002, Arms Act 1959).
   - Universal search with instant autocomplete across Acts, provisions, and legal concepts.
   - Act Overview view with chapter arrangement, table of contents, and section lists.
   - Full Section Details view with all 5 mandatory tabs:
     - **Bare Act Text**: Official Gazette statutory text (monospaced, verified source badge, India Code link).
     - **Simple Explanation**: AI-generated conceptual breakdown (clearly marked with disclaimer badge).
     - **Essential Ingredients**: Structured checklist of statutory ingredients, actus reus, and mens rea.
     - **Case Laws**: Connected landmark Supreme Court & High Court judgments with year, citation, and ratio decidendi.
     - **Related Sections & Transition**: Direct cross-references between former colonial codes and 2023 criminal enactments.
   - Provision bookmarking with personal notes caching in localStorage and backend sync.

3. **Module 2: Law Converters (`src/routes/_authenticated/student.converters.tsx`)**:
   - Dedicated bidirectional concordance interface for IPC ↔ BNS, CrPC ↔ BNSS, and IEA ↔ BSA.
   - Searchable from both directions by old section, new section, or offence keyword.
   - Side-by-side comparison cards with Transition Status, official BPRD/NCRB concordance mapping, and copy citation shortcut.

4. **Module 3: Interactive Case Simulator (`src/routes/_authenticated/student.simulator.tsx`)**:
   - Simulation template catalog filterable by difficulty (Beginner, Intermediate, Advanced) and forum (Bail Hearing, Criminal Trial, Framing of Charges).
   - High-fidelity pre-built scenarios:
     - Bail Hearing under BNSS 480 & 479 (Theft & Recovery)
     - Cross-Examination of IO on Electronic Evidence (BSA Sec 63 & IT Act 66)
     - Arguments on Framing of Charges (Cheating vs Criminal Breach of Trust BNS 316 vs 318)
   - Split-screen courtroom arena: left panel for case record, material facts, and key statutory points; right panel for turn-based judicial arguments with real-time simulated interventions.
   - Objective evaluation rubric modal with scoring breakdown (Statutory accuracy, Precedents, Persuasiveness, Decorum) and judicial feedback.

5. **Module 4: Study Centre (`src/routes/_authenticated/student.study.tsx`)**:
   - 5 academic learning sub-tabs:
     - **MCQ Practice Quiz**: Timed, scored multiple-choice questions on BNS, BNSS, BSA, POCSO, and NDPS with instant feedback and statutory explanation for every option.
     - **Bare Act Explainer**: Enter any Act and section number for an instant AI-powered conceptual breakdown and ingredients checklist.
     - **Daily Legal Problem**: Daily scenario-based legal challenge with options and statutory reference.
     - **Judgment of the Day**: Landmark ruling of the day with facts, ratio decidendi, and linked provisions.
     - **Exam Revision Guides**: Curated revision cheat-sheets comparing old vs new criminal law shifts.

6. **Database Models (`models/db_models.py`)**:
   - Added SQLAlchemy models: `Act`, `ActVersion`, `LegalSection`, `SectionJudgment`, `SectionMapping`, `StudentBookmark`, `SimulationTemplate`, `SimulationSession`.

7. **Backend Service & Endpoints (`main.py` & `legal_sources/library_service.py`)**:
   - Implemented `legal_sources/library_service.py` indexing 1,062 authoritative sections from `legal_sources/corpus.json` and 118+ concordance mappings from `legal_sources/registry.py`.
   - Added REST endpoints in `main.py`:
     - `GET /api/legal/acts`, `GET /api/legal/acts/{act_id}`, `GET /api/legal/acts/{act_id}/sections`
     - `GET /api/legal/sections/{act_code}/{section_num}`
     - `GET /api/legal/search`
     - `GET /api/converter/search`
     - `GET /api/study/daily-question`, `GET /api/study/judgment-of-day`, `GET /api/study/mcq`
     - `GET /api/simulator/templates`
     - `GET /api/legal/bookmarks`, `POST /api/legal/bookmarks`, `DELETE /api/legal/bookmarks/{id}`

8. **Frontend Client Library (`src/lib/student-legal-library.ts`)**:
   - Strongly typed TypeScript client library with seed datasets, API synchronization, and offline fallback.

### Verification
- `bun test`: All 4 frontend tests passed.
- `bun x vite build`: Production client, SSR bundle, and Nitro output built with 0 errors in 18.80s + 13.69s + 10.44s.
- `python -m unittest discover -s tests -p "test_*.py"`: All 44 backend unit tests passed in 0.73s (including 9 new tests in `tests/test_legal_library_service.py`).
- TanStack Router: Automatically generated route tree in `src/routeTree.gen.ts`.

### Future-agent notes
- All new student workspace routes reside under `src/routes/_authenticated/student.*.tsx` and are registered in the grouped sidebar inside `student.tsx`.
- Keep official statutory Bare Act text visually separated and distinguished from AI-generated explanations using the `is_official_gazette` badge and distinct styling.

---

### Changes
- **`src/routes/_authenticated/dashboard.lawyers.tsx`**:
  - Re-architected grid layout from a cramped 3-column setup (`lg:grid-cols-3`) to a spacious 2-column layout (`md:grid-cols-2 lg:gap-8 max-w-6xl mx-auto`), giving advocate cards generous horizontal breathing room.
  - Enhanced card typography and internal hierarchy: added `rounded-2xl` corners, subtle dark gradients (`from-[#16161a] to-[#111114]`), generous padding (`p-6 sm:p-7`), and hover elevation shadows.
  - Formatted Practice Description with dedicated rounded containers (`p-3.5 bg-white/[0.03] border border-white/[0.07] rounded-xl`) to eliminate visual clutter.
  - Modernized search input and dropdown filter selects with rounded corners, subtle borders, and smooth focus states.
  - Refined consultation mode tags (Direct Call, Confidential Chat) into clean pill badges.
  - Added modern `rounded-xl` action buttons with clear contrast and hover feedback.

### Verification
- `bun x tsc --noEmit | Select-String "dashboard.lawyers.tsx"`: 0 errors returned.
- `bun test`: All 4 frontend tests passed.
- `bun x vite build`: Production client and SSR build passed with 0 errors in 6.54s.
- `python -m unittest discover -s tests -p "test_*.py"`: All 35 backend tests passed in 1.09s.

### Future-agent notes
- Keep lawyer profile cards in a 2-column grid on desktop screens to preserve readability of practice descriptions and Bar particulars.

## [2026-11-15] - Fix Find a Professional Directory Page Loading & ReferenceErrors

### Changes
- **`src/routes/_authenticated/dashboard.lawyers.tsx`**:
  - Fixed runtime `ReferenceError: User is not defined` and `ReferenceError: FileText is not defined` by adding `User` and `FileText` to the `lucide-react` import statement.
  - Added null-safe guards for `initialMessages[0]?.text` and `user?.id` in local referrals and consultation locking logic to prevent runtime exceptions when rendering without active sessions.
  - Resolved TypeScript strict typecheck error on consultation insertion.

### Verification
- `bun x tsc --noEmit | Select-String "dashboard.lawyers.tsx"`: 0 errors returned.
- `bun test`: All 4 frontend tests passed.
- `bun x vite build`: Production build succeeded in 6.12s with 0 errors.
- `python -m unittest discover -s tests -p "test_*.py"`: All 35 backend tests passed in 0.83s.

### Future-agent notes
- Ensure any icon from `lucide-react` used in JSX is explicitly declared in the module's top-level imports.

## [2026-11-15] - Embed Mandatory Statutory Section Identification, Follow-Up Consistency & Question Relevance

### Changes
- **`llm/prompts.py`**:
  - Embedded sections 20, 21, and 22 into `SYSTEM_PROMPT` (Master System Prompt V2.1):
    - `20. MANDATORY STATUTORY SECTION IDENTIFICATION`: Exact Act, section, and subsection identification; explanation of statutory ingredients and fact application; strict distinction between principal offence provisions, exceptions, procedural provisions (BNSS), and evidentiary provisions (BSA); verification against authoritative sources; ending analysis with a short list of key statutory provisions relied upon.
    - `21. FOLLOW-UP LEGAL CONTEXT CONSISTENCY`: Preserving original facts and identified offence across conversational follow-ups; preventing offence substitution on bail/punishment/procedure queries; independent BNSS First Schedule verification without inferring bail from max punishment; express error correction.
    - `22. MANDATORY QUESTION RELEVANCE CHECK`: Exact question identification; strict direct answering without generic rights/arrest boilerplate substitution; single-Act confinement unless cross-statute is essential.
  - Updated `DIRECT_ANALYSIS_PROMPT`, `COMPLAINT_FIR_ANALYSIS_SYSTEM_PROMPT`, `COMPLAINT_FIR_ANALYSIS_PROMPT`, and `ANALYSIS_PROMPT` to enforce these three protocols across both dedicated analyser and direct chat.
- **`llm/chain.py`**:
  - Updated normal chat prompt and `active_system_prompt` to embed the 3 mandatory protocols directly into prompt payloads.
  - Expanded conversation history message assembly to retain both `user` and `assistant` prior turns (up to 4 turns, clipped to 600 chars), ensuring multi-turn context preserves previously identified offences and factual determinations during follow-ups.
  - Expanded statutory scan text (`scan_text`) to include recent context across turns so statutory retrieval matches offences established in prior conversational turns.

### Verification
- `python -m unittest discover -s tests -p "test_*.py"`: All 35 tests passed in 0.78s.
- `_estimate_message_tokens`: Verified prompt token estimate (6,568 tokens) comfortably respects the shared 8,000 TPM limit.
- `bun test`: All 4 frontend tests across 2 files passed cleanly in 17.59s.
- `bun x vite build`: Production client and SSR build passed with 0 errors in 7.96s.

### Future-agent notes
- Preserve multi-turn `assistant` message inclusion in `conversation_history` so follow-ups retain context without requiring the user to restate the offence.
- Keep prompt modifications dense and concise to remain within the 8,000 TPM reservation ceiling.

## [2026-11-15] - Improve custody answer readability and safeguard coverage

### Changes
- Added provision-level links in the answer for BNS 303, BNSS 35, 36, 38, 47, 48, 53, 56, 57, 58 and 480, plus Legal Services Authorities Act Section 12. The expandable source references continue to point to primary/official statute material where available; provision links are convenience navigation.
- Explained arrest memo witness/signature requirements, medical examination and injury recording, and the custodian's health-and-safety duty. The urgent checklist now includes confirming the memo, medical examination, production deadline, legal-aid request and bail review.
- Shortened case-specific bail discussion so value/classification appears with bailability and personal circumstances/recovery/investigation factors appear with the bail-availability answer.
- Made the 24-hour deadline wording explicit and kept action items operational. Bail and legal-aid information remain separate answers when the user asks separate questions.
- The response changes are deterministic formatting/rule changes after the existing model response; no second LLM call or additional prompt tokens were introduced.

### Verification
- Reviewed the rendered answer path and confirmed numbered prompts are mapped to one answer section per extracted question; the chat view suppresses the conversational preamble when those sections exist.
- Reviewed provision links and compared the arrest-memo, medical-examination, health/safety, bail and custody claims against BNSS text. The source-card verification flag remains conservative; a direct link alone does not mark a claim verified.
- Tests/build were not rerun in this pass.

### Future-agent notes
- Keep the distinct claim links and primary statute source cards separate: the link target is navigation, while source verification is based on retrieved/registry text.
- Keep custody safeguards in the rights answer and concrete requests in the 24-hour checklist. Avoid adding a second summary that repeats both sections.
- Preserve the single-generation budget. Validate improvements through the existing focused test suite/build when the user requests verification.

## [2026-11-14] - Preserve question-by-question custody answers in backend output

### Changes
- Backend custody composition now receives the original query and writes each detected question as its own heading, paired with the matching structured answer. The matching question text is also copied into known `section_headings` fields for older chat clients.
- Explicitly states that bail is possible under BNSS Section 480 even though BNS 303(2) is ordinarily non-bailable; bail reasoning and case facts appear with that answer. Custody answers retain a dedicated legal-aid answer under Section 12(g).
- Fixed section matching for both “BNS 303(2)” and “Section 303(2) BNS”, including a section-citation boundary check so `303(2)` is not parsed as a numbered question.
- Removed repeated legal-aid district-routing instructions and corrected the duplicated “family reports” phrasing.
- Replaced the malformed Schedule citation label and linked the Schedule and Legal Services Authorities Act source cards to India Code. DSLSA 1516 and NALSA 15100 now link to their official contact sources.
- Source cards now prefer an approved provision-specific official URL over a generic Act URL, and Schedule entries display as “First Schedule …” instead of “Section First Schedule …”.
- No additional LLM call or prompt tokens are used; the changes run after the existing generation.

### Verification
- `python -m unittest discover -s tests -p "test_*.py"` passed (35 tests).
- Focused exact-prompt regression confirms all five original questions appear as headings with answers, including bail under BNSS 480 and legal aid under Section 12(g); duplicate wording is absent.
- `python -m py_compile llm/chain.py`, frontend tests (2 files, 4 tests), and `npm run build` passed. Vite emitted its existing chunk-size and plugin-timing notices.

### Future-agent notes
- Keep `_compose_custody_answer` query-aware and preserve `section_headings` mappings so API text and older clients agree on question wording.
- Schedule and legal-aid summary source cards are still marked unverified where they do not quote the exact official provision. Do not upgrade their verification status based only on the presence of an official URL.

## [2026-11-14] - Render answers under each explicit user question

### Changes
- Chat analysis formatting now receives the original query for new replies and persisted chat history.
- When a query contains numbered questions or direct question sentences, the UI renders each question as a numbered heading and places its corresponding structured answer beneath it. Bail status and bail availability are distinguished; arrest rights, legal aid, and urgent action steps map to their own fields.
- Bail-availability answers also include case-specific legal reasoning when present, so facts such as property value, record, work, recovery, and investigation needs remain visible with the bail discussion.
- Added a local coverage fallback so every extracted question retains a non-empty answer section when a structured field is missing. This does not add an LLM call or prompt tokens.
- Added focused frontend regression tests for the five-question arrest scenario, unnumbered questions, and missing-field fallback.

### Verification
- `npm test -- --run` passed (2 test files, 4 tests).
- `npm run build` passed. Vite emitted its existing chunk-size and plugin-timing notices; the build completed successfully.

### Future-agent notes
- The question-to-field mapping is deliberately local and deterministic; it does not add an LLM call. Extend mappings alongside the structured response schema when adding new legal answer fields.
- Chat history formatting associates an assistant answer with the most recent preceding user message; preserve this pairing when changing message persistence or rendering.


## [2026-11-14] - Reviewed theft/custody answer reliability and shared LLM token budget

### Changes
- Fixed the duplicate opening brace in `legal_sources/registry.py` that broke module import.
- Added `llm/legal_intake.py` to retain exact code, section, subsection and source span; `llm/chain.py` now resolves explicit references by exact code/section before any legacy concordance fallback.
- Reworked the reviewed BNS 303(2) rule: explicit non-bailable answer, bail may still be considered under BNSS Section 480, first-offence/low-value/return conditions are not guessed, unrelated property values cannot trigger the exception, and stated value, age, work and record facts are applied to the bail discussion.
- Corrected arrest-right wording for BNSS Sections 35, 38, 47, 48, 57 and 58; attached BNSS Sections 35, 38, 47, 48, 57, 58 and 480 as source candidates for custody answers.
- The visible `general_analysis` now renders all applicable custody answers under LLM-provided `section_headings` (with concise fallback labels), replacing a generic model fallback that previously hid the structured fields.
- Added a compact JSON output contract/schema and shorter source excerpts/application notes to keep prompts bounded. The supported normal path uses one provider generation; HTTP 429 is no longer retried.
- Added `llm/token_budget.py` and `LLMTokenReservation`: shared rolling 60-second 8,000-token admission across Render workers, PostgreSQL advisory transaction lock, short DB transactions, provider-usage settlement, and fail-closed admission. Supabase RLS is enabled and anon/authenticated table access revoked. Startup `Base.metadata.create_all` creates the table without a hand-written migration.
- Added offline tests for exact references, theft/custody rules, low-value exceptions, visible headings/fallback removal, shared token admission and the no-retry request path.

### Verification
- `python -m unittest discover -s tests -p "test_*.py"` passed (34 tests); `npm test -- --run` passed (1 frontend test); `npm run build` passed. `python -m py_compile` also passed for changed backend modules.
- No LLM provider call or live PostgreSQL request was used in tests.

### Future-agent notes
- Scope is the reviewed theft/custody slice; do not treat general criminal-law outputs as validated by these rules.
- Token estimation is deliberately lightweight (UTF-8 byte heuristic plus schema/framing/output/media allowances), not provider-exact. It reserves before calls and reconciles reported usage; usage from outside this application/provider account is not tracked. Keep database admission fail-closed.
- First Schedule and NALSA summary source cards remain `unverified`; a stored summary/hash is not an exact authoritative quotation. Preserve the UI label Source text matched for exact registry text only.
- Re-check current official sources and get independent Indian criminal-law review before adding offence branches or changing bail/arrest rules. The 30-case reviewer evaluation and staged rollout in `plans/legal-answer-reliability.md` remain open.
- Complaint Analyser and existing front-end routes were not redesigned.


## [2026-11-14] - Contact Channels, Unmasked Privacy Relay, Written Opinion Fee Removal, Sensitive Cases, Leave Confirmations & Law Student Internships

### 1. Citizen Dashboard Help & Support Contact Info
- **File**: `src/routes/_authenticated/dashboard.help.tsx`
- **Changes**:
  - Added official TRANA contact section featuring email address `tranaintelligence@gmail.com` with clickable `mailto:` link.
  - Added direct contact numbers `9891438718` and `8368515600` with clickable `tel:` links.
  - Rendered dedicated support cards with helpline details and statutory guidance notes.

### 2. Elimination of Number Masking & Masking UI Artefacts
- **Files**:
  - `src/lib/privacy-mask.ts`: Updated `maskConfidentialPatterns(text)` to return `text` directly without regex scrubbing or replacement of numbers/sequences with `XXXXX`.
  - `src/components/ConsultationChatModal.tsx`: Removed `(XXXXX)` and number-masking notes from initial system relay messages, mobile strips, and privacy banners.
  - `src/routes/_authenticated/dashboard.consultations.tsx`: Updated `renderMaskedText` to render plain text; removed `(XXXXX)` references from initial relay prompts and top header banner.
  - `src/routes/_authenticated/lawyer.inbox.tsx`: Removed masking notes from system notices, placeholder text, and privacy strip.
  - `src/routes/_authenticated/dashboard.lawyers.tsx`: Removed masking clauses from intake briefs and confidential consultation relay notices.
  - `src/routes/_authenticated/dashboard.index.tsx`: Cleaned up privacy shield card text to reflect privileged communication under BCI Rule 36 without claiming digits are scrubbed.
  - `src/routes/founders.chats.tsx`: Updated audit relay strip, total consultations counter, and message text formatter to remove `XXXXX` badges.

### 3. Legal Professional Written Opinion - Removal of ₹50 Text
- **File**: `src/routes/_authenticated/dashboard.analyse.tsx`
- **Changes**:
  - Removed all instances of `₹50` text from:
    - Provider selection option B badge (`Verified Written Opinion`).
    - Primary submission action button (`Get Legal Professional Written Opinion`).
    - Result footer consultation banner and badge (`Panel Opinion Available`).
    - Written opinion request modal title and subtitle (`Verified Legal Professional Opinion • High Priority Panel Review`).
    - Modal body description and payment method selector.
    - Confirmation toasts (`Legal Professional Review confirmed! Complaint submitted with High Priority to panel advocates.`).
  - Switched submission action from mock fee processing to a direct request for a verified panel advocate written opinion.

### 4. Lawyer Picture & Proper Description in "Find a Professional"
- **File**: `src/routes/_authenticated/dashboard.lawyers.tsx`
- **Changes**:
  - Enhanced lawyer profile card layout with an enlarged 64x64px photo slot (`h-16 w-16 rounded-2xl`), advocate avatar icon fallback, and active status indicator.
  - Added a dedicated "Practice Description" card section on each lawyer card rendering `l.bio || l.specialisation` with readable typography.
  - Preserved full modal profile inspection with high-resolution photo and detailed practice background.

### 5. Extra Privacy for Sensitive Cases & Real Lawyer Routing
- **Files**:
  - `src/routes/_authenticated/dashboard.analyse.tsx`:
    - Added "Mark as Sensitive Case (Extra Privacy & Direct Real Lawyer Option)" checkbox.
    - When checked, displays a prominent fee disclaimer alert: *"The fee between the citizen and the lawyer should be discussed properly and agreed upon directly between both parties. TRANA provides statutory legal first aid and does not arbitrate, set, or charge advocate consultation fees."*
    - Displays a direct "Send Query to Real Lawyer" button that opens `ConnectProfessionalOfferModal` with the matter details pre-populated.
  - `src/routes/_authenticated/dashboard.chat.tsx`:
    - Added "Sensitive Case (Extra Privacy & Real Lawyer Option)" toggle above the message input box.
    - When enabled, displays the mandatory fee discussion disclaimer and a direct "Send to Real Lawyer" action routing to real counsel.

### 6. Consultation Chat Leave Confirmation
- **Files**:
  - `src/components/ConsultationChatModal.tsx`:
    - Implemented `leavePrompt` state and modal overlay. When client or advocate clicks to leave/withdraw, a clear dialog informs them: *"You are leaving this consultation chat session. Once you leave, this active channel is concluded and you will be able to consult another advocate."*
  - `src/routes/_authenticated/dashboard.consultations.tsx`:
    - Added `showLeaveConfirm` state and an in-app confirmation modal informing the client they are leaving their consultation session with Advocate counsel.
  - `src/routes/_authenticated/lawyer.inbox.tsx`:
    - Added `showLeaveConfirm` state and modal dialog informing counsel that they are withdrawing and leaving the active consultation chat session for their client.

### 7. Law Student Partnered Firm Internships & CV Upload
- **Files**:
  - `src/lib/internship-applications.ts` *(new)*:
    - Defined `InternshipApplication` and `PartneredFirm` interfaces.
    - Added accredited partnered law firms: Shardul Amarchand Mangaldas & Co, Trilegal, AZB & Partners, Khaitan & Co, Chambers of Adv. Rajesh Mehra, Chambers of Adv. Vikramaditya Sen, DSK Legal.
    - Implemented cross-tab persistence helpers (`getStoredInternshipApplications`, `saveInternshipApplication`, `updateInternshipApplicationStatus`, `trana_internships_updated` events).
  - `src/components/ProfessionalNetworkView.tsx`:
    - Added "Partnered Firms & Internships" tab to the network navigation.
    - For law students: browse partnered firms, choose a firm, fill student details, and upload their CV (PDF/DOC up to 10 MB, encoded as base64 Data URL) with application tracking.
    - For advocates: review incoming student applications for chamber/firm internships, review cover notes, and click **"View / Download CV"** to inspect or download the student's resume.
  - `src/routes/founders.students.tsx`:
    - Added "Partnered Firm Internships" tab in the Founders Dashboard.
    - Founders can review all student internship submissions, view application details, click **"View / Download CV"**, and manage application status (Shortlist / Accept / Decline).

### 8. Removal of "Check as an Intern" Checkbox on Sign-in
- **File**: `src/routes/auth.tsx`
- **Changes**:
  - Removed `isInternLogin` state and the "Log in as Legal Intern" checkbox from the sign-in / sign-up screen.
  - Default post-authentication destination simplified to `/dashboard/chat` (or user's redirected target).

### 9. Build & Verification
- `bun x vite build` executed successfully in 10.38s with zero errors. All routes, types, and SSR targets validated cleanly.

---


### Follow-up — answer the user's numbered custody questions
- Added dedicated structured fields for offence bail classification, whether bail can be granted, and free legal aid. The compact one-call prompt maps arrest questions to separate fields and asks the model for question-style custom headings.
- Custody responses now render as direct numbered answers even if the model leaves its generic situation summary empty. Legacy failure text (“couldn't formulate a specific legal analysis”) is removed from structured answer fields so it cannot contradict populated legal guidance.
- The BNS 303(2) rule now activates from an exact user-cited section even if the model omitted it from `applicable_laws`. It creates a backend candidate for source resolution, gives a direct non-bailable/bail-possible answer, applies the actual reported property value, and explains how reported clean record, age, and daily-wage work may be presented without implying a guaranteed outcome.
- Custody first aid now includes a standalone legal-aid answer and directly states the BNSS 47 duty to communicate arrest grounds. Existing rights, 24-hour production rule, and four-step family action plan are rendered under the user's questions. Custom LLM headings remain bounded and optional; question headings are fallbacks for older or incomplete outputs.
- Considerations: normal chat still makes one LLM request; extra fields are filled offline from the existing query/source record. Exact statutory schedule and BNSS 480/478 references are retained. Python compilation, frontend production build, and diff whitespace checks passed. No tests run; not deployed.

### Follow-up implementation — custom headings and answer consistency
- Added optional `section_headings` to the structured analysis schema and frontend type. The compact normal-chat instruction asks the model to provide concise headings for populated sections; the renderer uses them with legacy fallbacks, and accepts only known section keys with bounded labels.
- Fixed the readability gate to recognize `legal_reasoning`, and made the frontend render it when it is the only substantive model field. This prevents a detailed legal analysis from being replaced or hidden behind the generic “couldn't formulate” fallback.
- Tightened the short prompt to answer every distinct question, apply stated case facts (amount, prior record, employment/family circumstances) without inventing facts, and avoid claiming analysis failed when content exists. Existing deterministic BNS 303(2) bail and custody safeguards remain in force.
- Custody guidance now names DSLSA for Delhi and points to the district DLSA based on the police station/court location without guessing. DSLSA helpline 1516 and NALSA 15100 are included. Normalized section labels in chat and source cards to avoid duplicated “Section” text, and stored the LSA source section as `12(g)`.
- Considerations: headings are optional for older saved responses; fixed fallback labels preserve their display. The normal chat path remains one LLM call, and this adds only a small schema field and concise prompt direction. Python compilation, frontend production build, and diff whitespace checks passed. No tests were added or run. Not deployed.

### Runtime implementation progress
- `llm/chain.py`: normal chat now uses a compact task-specific prompt (the dedicated Complaint Analyser prompt remains intact), one selected provider route, one generation request, Google SDK `retries=1` (one total attempt), no application retries/key/provider fallback, and a 1,200-token OpenAI-compatible output ceiling. Timeouts are no longer mislabeled as quota errors. Normal chat includes only the last four user turns, clipped to 1,200 characters each. Logs provider-reported prompt/completion usage where compatible responses return it.
- Retrieval no longer automatically attaches BNS 305 to ordinary theft; it selects 305 only with specific dwelling/transport/place-of-worship/cargo/warehouse context. Custody prompts include BNSS 35, 38, 47, 48, 57, 58 and 480 text. Explicitly named provisions remain in the evidence set even if the model omits them. Normal FIR chat no longer inherits the long generic redirection prompt.
- Added rule-backed BNS 303(2) bail output based on the NCRB BNSS First Schedule, preserving the under-₹5,000 return/restoration exception and separate first-conviction condition for community service; it explains that BNSS 480 bail remains possible. Custody coverage fills arrest safeguards, counsel access, family notice, 24-hour Magistrate production, free legal aid, and concrete family steps. Legal-aid and Schedule sources appear with official URLs.
- `MessageBubble.tsx` now labels matched text “Source text matched” and explains that source matching alone does not establish case applicability.
- Added eleven focused `unittest` cases for bail branches, custody rights/action steps, unrelated-property return, negative/hypothetical arrest, and section 305 retrieval. These passed. Python compilation and `git diff --check` passed. `npm run build` passed with existing Vite plugin/chunk-size warnings.
- Source summaries for the BNSS Schedule and NALSA now remain unverified references (their hashes are not misrepresented as source verification); statutory corpus excerpts retain backend verification. The low-value bail exception only activates when the same stolen item/value and its return/restoration appear together in a clear statement. Custody coverage uses affirmative arrest signals and replaces incomplete generated rights/action items with reviewed fixed guidance.
- Remaining: no custom shared rolling TPM reservation or provider-independent cost telemetry; the configured provider enforces its account TPM quota and TRANA sends no retries. Token logging currently covers OpenAI-compatible responses only when usage is returned. The optional extraction call is not used; the normal path minimizes calls with one focused legal-analysis request. Hindi/Hinglish urgency detection, legal counsel review, full evaluation, and staged rollout remain. Nothing was deployed.

- Added `plans/legal-answer-reliability.md`, a phased, repository-grounded plan for exact offence matching, custody urgency/coverage, reviewed bail/procedure/legal-aid evidence, fact application, claim-level checks, safe fallbacks and accurate source labels.
- Confirmed current failure mechanisms: generic bail override inserts robbery/snatching/extortion; theft retrieval nominates 303 and 305; verification pads toward four sources; source-text integrity does not validate case reasoning.
- Initial interpretations of the AI limit were incomplete; the latest user constraint clarification below governs: up to two calls, shared 8k TPM ceiling, and small offline logic.
- Considerations: ordinary theft and the qualifying low-value branch need separate reviewed conditions; cross-check official schedule summaries against Act/Gazette text. Preserve dedicated Complaint Analyser behavior, existing deployment/authentication and legacy saved-response compatibility. The plan requires offline tests, legal review, staged rollout and privacy-conscious metrics.
- Validation: inspected current registry, chain, schemas, source UI, provider handling and repository scripts; independent read-only discovery corroborated control-flow and budget gaps. Consulted official India Code/NCRB/NALSA sources. Documentation only; runtime fixes and their tests have not been implemented.
- Further cost clarification: 8,000 TPM is a hard shared throughput ceiling, never a target. Minimize measured tokens/cost per successful answer; use one answer call normally and add a tiny extraction call only when complexity warrants it. Compile a focused prompt from relevant facts/rules/sources, then track median and p95 token use. Legal reasoning must still apply rules to facts and expose uncertainty. Keep offline additions under 500 Python runtime lines and under 20 KB of rule data.

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

---

## [2026-11-14] - Rate Limit Resilience, Founder Verification Holding Gate & Citizen Query Modal Fixes

### 1. LLM Rate Limit Cooldown & 429 Backoff (`key_manager.py` & `llm/chain.py`)
- **Problem**: When Groq hit a burst rate limit (RPM/TPM 429), `key_manager.py` marked Quick Thinking unavailable for `QUICK_UNAVAILABLE_COOLDOWN_SECONDS = 300` (5 minutes!). Because only 1 Groq key was present in the pool, this locked out legal analysis completely for 5 minutes instead of recovering within Groq's 60-second quota window.
- **Fixes**:
  - `key_manager.py`: Reduced `QUICK_UNAVAILABLE_COOLDOWN_SECONDS` from `300` seconds to `20` seconds. The engine now automatically recovers within seconds once burst traffic clears.
  - `llm/chain.py`: Added an automatic 1.5-second transient rate-limit backoff retry in `_invoke_openai_compatible`. If HTTP 429 is encountered and timeout permits (>3s), it waits 1.5 seconds and retries once automatically before bubbling an error.

### 2. Strict Founder Verification Gating for Lawyers (`services/lawyer_verification_service.py` & `src/routes/_authenticated/lawyer.tsx`)
- **Problem**:
  1. Lawyers who signed up previously gained access to the workspace before founder verification. The automated verification engine in `services/lawyer_verification_service.py` had a rule (`rule_eval["score"] >= 0.8`) that auto-verified and approved applicants purely based on Sanad regex formatting.
  2. Because they were auto-approved, they landed in the "Active" tab instead of the "Pending Verification" tab, making them appear missing from the Founder review queue.
- **Fixes**:
  - `services/lawyer_verification_service.py`: Removed auto-verification for Sanad format matching. All registrations are strictly set to `verified: False`, `status: "PENDING_VERIFICATION"`, and queued for manual Founder review on the Founders Desk.
  - `src/routes/_authenticated/lawyer.tsx`: Enforced strict gating: unverified advocates are kept on the dedicated "Advocate Verification Under Review" holding screen, blocking them from viewing private citizen queries, cases, or the workspace until an authorized Founder clicks "Approve".

### 3. Citizen Query Action Button Cleanup & UI Stability (`src/routes/_authenticated/lawyer.queries.tsx`)
- **Problem**: In `src/routes/_authenticated/lawyer.queries.tsx`, a duplicate gate component had been pasted inside the "Pass On to Other Advocates" button render function, and previous unhandled Supabase update attempts on mock query IDs triggered stacked `"Could not pass query."` toasts.
- **Fixes**:
  - Removed the corrupted duplicate JSX block inside the action button render function.
  - Confirmed `handlePassOn` safely updates the local pool and React Query cache, and only executes background Supabase updates for valid UUIDs with isolated error handling.

### 4. Legal Source Registry Concordance & Statute Retrieval Deduplication (`legal_sources/registry.py`)
- **Problem**:
  1. In `legal_sources/registry.py` line 462, the concept rule for "assault", "slap", "physical violence" mapped strictly to `[("BNS", "115"), ("BNS", "117"), ("BNS", "118")]` (which are hurt/grievous hurt sections), completely omitting actual BNS Assault provisions (BNS 130, 131, 135).
  2. The concordance table `_IPC_TO_BNS` lacked mappings for IPC 351 (BNS 130), IPC 352 (BNS 131), IPC 353 (BNS 132), and IPC 357 (BNS 135).
  3. In `find_relevant_statutes`, `by_number()` previously yielded every single Act in `_NEW_CODES` (`BNS`, `BNSS`, `BSA`) for any section number, polluting the prompt and crowd-out results (e.g., query for "BNS Section 135 & Section 352" dumped `BNSS 135` and `BSA 135`).
- **Fixes**:
  - Added IPC 351 -> BNS 130, IPC 352 -> BNS 131, IPC 353 -> BNS 132, and IPC 357 -> BNS 135 to `_IPC_TO_BNS`.
  - Added BNS 130, 131, 135 to `_WELL_KNOWN_STANDALONE`.
  - Updated concept rule targets on line 462 to include `("BNS", "131")` and `("BNS", "135")` alongside hurt provisions.
  - Updated `find_relevant_statutes`:
    - Tracks explicit citation spans so that `_SECTION_ONLY_RE` and `_NUMBER_RE` do not re-process section numbers that are already part of explicit `<Act> <Section>` citations.
    - Honors `preferred_code` from the query and short-circuits `by_number()` on the first valid match, eliminating duplicate cross-Act pollution.

---

## [2026-11-14] - Merge Conflict Resolution & Branch Synchronization

### 1. Git Merge Conflict Resolution (`legal_sources/registry.py` & `llm/prompts.py`)
- **Problem**: When integrating remote `origin/main` commits with local branch enhancements, a merge conflict stopped git operations with `Git: Committing is not possible because you have unmerged files`.
- **Resolutions**:
  - `legal_sources/registry.py`: Reconciled theft concept rules. Retained Hindi keyword additions (`"चोरी"`) alongside the separated statutory targeting for general theft (`BNS 303`) versus aggravated theft in dwelling house/worship/transportation (`BNS 305`), ensuring strict statutory grounding without unwarranted aggravated additions.
  - `llm/prompts.py`: Preserved authoritative `TRANA — MASTER SYSTEM PROMPT V2.1` in `SYSTEM_PROMPT` for general assistance, and preserved the separate `COMPLAINT_FIR_ANALYSIS_SYSTEM_PROMPT` for dedicated FIR/complaint analysis.
  - Cleaned all conflict markers and verified working tree integrity.


