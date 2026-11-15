import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { 
  GraduationCap, Sparkles, Scale, Search, Landmark, FileText, 
  Users, ArrowUpRight, BookOpen, ShieldCheck, Clock, CheckCircle2, Award,
  Gavel, Library, ArrowLeftRight, ChevronRight, Play, ExternalLink, HelpCircle
} from "lucide-react";
import { useUserRole } from "@/lib/user-role";
import { getLocalConnections } from "@/lib/network-connections";
import { LegalNewsFeed } from "@/components/LegalNewsFeed";
import { MassAnnouncementBanner } from "@/components/MassAnnouncementBanner";
import {
  PixelJudgeAvatar,
  PixelOppositionAvatar,
  PixelDefenseAvatar,
} from "@/components/CourtroomPixelScene";

export const Route = createFileRoute("/_authenticated/student/")({
  head: () => ({
    meta: [
      { title: "Law Student Workspace — TRANA" },
      { name: "description", content: "Academic legal research, AI drafting, courtroom case simulation, criminal law library, and professional networking for law scholars." },
      { property: "og:title", content: "Law Student Workspace — TRANA" },
    ],
  }),
  component: StudentOverviewPage,
});

function StudentOverviewPage() {
  const { user } = Route.useRouteContext();
  const { studentProfile } = useUserRole(user?.id, user?.email);

  const isIntern = Boolean(
    studentProfile?.isIntern ||
    (typeof window !== "undefined" && localStorage.getItem("trana_is_intern") === "true")
  );

  const [savedDocsCount, setSavedDocsCount] = useState(0);
  const [trackedCasesCount, setTrackedCasesCount] = useState(0);
  const [publicationsCount, setPublicationsCount] = useState(0);
  const [connectionsCount, setConnectionsCount] = useState(0);

  useEffect(() => {
    // Saved documents count
    try {
      const stored = localStorage.getItem("trana_saved_documents");
      if (stored) {
        const list = JSON.parse(stored);
        if (Array.isArray(list)) setSavedDocsCount(list.length);
      }
    } catch {}

    // Tracked cases count
    try {
      const raw = localStorage.getItem(`trana_tracked_cases_student_${user?.id}`);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) setTrackedCasesCount(list.length);
      }
    } catch {}

    // Publications count
    try {
      const pubRaw = localStorage.getItem("trana_student_publications_feed");
      if (pubRaw) {
        const pList = JSON.parse(pubRaw);
        if (Array.isArray(pList)) setPublicationsCount(pList.length);
      } else {
        setPublicationsCount(4);
      }
    } catch {
      setPublicationsCount(4);
    }

    // Active connections
    try {
      const myNorm = (user?.id || "").toLowerCase().trim();
      const allConn = getLocalConnections();
      const active = allConn.filter(
        (c) =>
          c.status === "accepted" &&
          (c.fromUserId.toLowerCase().trim() === myNorm || c.toUserId.toLowerCase().trim() === myNorm)
      );
      setConnectionsCount(active.length);
    } catch {}
  }, [user?.id]);

  const studentName = studentProfile?.fullName || user?.name || user?.email?.split("@")[0] || "Law Student";
  const university = studentProfile?.university || "Law University";
  const degree = studentProfile?.degree || "5-Year B.A. LL.B. (Hons)";
  const yearOfStudy = studentProfile?.yearOfStudy || "Scholar";
  const rollNo = studentProfile?.studentIdNumber;
  const city = studentProfile?.city;

  return (
    <div className="space-y-10 md:space-y-12 max-w-7xl mx-auto pb-12">
      {/* ══════════════════════════════════════════════════════════════════
          AMBIENT LIGHTING & SUBTLE ROYAL PURPLE / GOLD GLOWS
          ══════════════════════════════════════════════════════════════════ */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none">
        <div className="absolute top-10 left-1/4 w-[600px] h-[350px] bg-purple-900/[0.12] blur-[150px] rounded-full" />
        <div className="absolute top-40 right-10 w-[500px] h-[300px] bg-amber-600/[0.08] blur-[160px] rounded-full" />
      </div>

      {/* Live Procedural Webinars & Mass Announcements */}
      <MassAnnouncementBanner currentDashboard="students" className="mb-4" />

      {/* ══════════════════════════════════════════════════════════════════
          HERO CHAMBER BANNER (CLEAN & SPACIOUS)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-white/[0.08] pb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-neutral-400 font-mono">
            <span>Academic Legal Portal</span>
            <span>•</span>
            <span className="text-purple-400 font-semibold">{degree}</span>
            <span>•</span>
            <span className="text-amber-400/90 font-semibold">2023 Sanhitas Ready</span>
          </div>

          <h1 className="font-display text-3xl md:text-5xl font-medium text-white tracking-tight">
            Welcome back, {studentName}
          </h1>

          <p className="text-xs md:text-sm text-neutral-400 flex flex-wrap items-center gap-2 pt-1 font-sans">
            <span className="text-neutral-200">{university}</span>
            <span>•</span>
            <span className="text-purple-300 font-mono">{yearOfStudy}</span>
            {rollNo && (
              <>
                <span>•</span>
                <span className="apple-glass-pill px-2.5 py-0.5 text-[11px] font-mono text-purple-300 bg-purple-950/40 border border-purple-500/30">
                  Roll No: {rollNo}
                </span>
              </>
            )}
            {city && (
              <>
                <span>•</span>
                <span className="text-neutral-400 font-mono text-xs">{city}</span>
              </>
            )}
          </p>
        </div>

        {/* Quick Launch Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/student/simulator"
            className="bg-amber-400 hover:bg-amber-300 text-black px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-[0.12em] transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-105 cursor-pointer"
          >
            <Gavel className="h-4 w-4" />
            <span>Courtroom Simulator</span>
          </Link>
          <Link
            to="/student/library"
            className="apple-glass-pill px-4 py-2.5 text-xs font-mono uppercase tracking-[0.1em] text-amber-300 hover:text-white transition-all flex items-center gap-2 shadow-sm border-amber-500/30 bg-black/60"
          >
            <Library className="h-3.5 w-3.5 text-amber-400" />
            <span>Legal Library</span>
          </Link>
          <Link
            to="/student/drafter"
            className="apple-glass-pill px-4 py-2.5 text-xs font-mono uppercase tracking-[0.1em] text-neutral-300 hover:text-white transition-all flex items-center gap-2 shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span>AI Drafter</span>
          </Link>
          <Link
            to="/student/network"
            className="apple-glass-pill px-4 py-2.5 text-xs font-mono uppercase tracking-[0.1em] text-neutral-300 hover:text-white transition-all flex items-center gap-2 shadow-sm"
          >
            <Users className="h-3.5 w-3.5" />
            <span>Network</span>
          </Link>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          HERO SPOTLIGHT: 16-BIT COURTROOM CASE SIMULATOR
          ══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-3xl bg-gradient-to-r from-[#24130a] via-[#160a04] to-[#0c0502] border-2 border-amber-500/40 p-6 md:p-8 shadow-[0_15px_40px_rgba(0,0,0,0.85)] relative overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 opacity-80" />

        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Featured Interactive Module</span>
              </span>
              <span className="text-xs font-mono text-neutral-400">
                16-Bit Judicial Arena
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl font-serif font-bold text-white tracking-wide">
              Virtual Courtroom Case Simulator
            </h2>

            <p className="text-xs md:text-sm text-neutral-300 leading-relaxed font-sans font-light">
              Step to the speaking podium before the <strong>Hon'ble Presiding Judge</strong>, argue against <strong>Opposing State Prosecutor</strong> objections, and persuade the live <strong>Courtroom Spectator Gallery</strong> across bail hearings, trials, and framing of charges under BNSS & BNS.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-2">
              <Link
                to="/student/simulator"
                className="bg-amber-400 hover:bg-amber-300 text-black px-5 py-2.5 rounded-full text-xs font-extrabold flex items-center gap-2 shadow-lg transition-transform hover:scale-105 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-black" />
                <span>Enter Courtroom Arena</span>
              </Link>
              <span className="text-xs font-mono text-amber-300/80 px-3 py-1">
                Beginner • Intermediate • Advanced Benches
              </span>
            </div>
          </div>

          {/* Interactive Pixel Courtroom Avatars Preview */}
          <div className="flex items-end gap-3.5 bg-black/75 p-4 px-6 rounded-2xl border border-amber-500/30 shadow-inner shrink-0">
            <div className="text-center">
              <PixelDefenseAvatar />
              <span className="text-[10px] font-mono text-purple-300 block mt-1.5 font-bold">Defense (You)</span>
            </div>
            <div className="text-center scale-125 mx-2">
              <PixelJudgeAvatar />
              <span className="text-[10px] font-mono text-amber-300 block mt-1.5 font-bold">Hon'ble Judge</span>
            </div>
            <div className="text-center">
              <PixelOppositionAvatar isObjecting={true} />
              <span className="text-[10px] font-mono text-rose-300 block mt-1.5 font-bold">Prosecutor</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          CORE LEARNING & CRIMINAL LAW SUITE (3 SPACIOUS CARDS)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <p className="text-[0.7rem] uppercase tracking-[0.2em] text-neutral-400 font-mono">
            Criminal Law Learning Modules
          </p>
          <span className="text-[11px] font-mono text-amber-300/80">
            13 Acts • BPRD Concordance • Bare Act Corpus
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Module 1: Criminal Law Library */}
          <Link
            to="/student/library"
            className="group apple-glass-card p-6 md:p-7 flex flex-col justify-between hover:border-amber-500/40 transition-all shadow-xl hover:-translate-y-1"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-300 group-hover:scale-110 transition-transform">
                  <Library className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                  13 Acts Indexed
                </span>
              </div>

              <h3 className="font-serif text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                Criminal Law Library
              </h3>

              <p className="text-xs text-neutral-300 leading-relaxed font-light">
                Explore complete official Gazette Bare Act statutory text across <strong>BNS 2023</strong>, <strong>BNSS 2023</strong>, <strong>BSA 2023</strong>, POCSO, NDPS, and legacy codes with 5-tab breakdowns and continuous reader mode.
              </p>
            </div>

            <div className="mt-6 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-amber-300 group-hover:text-white">
              <span>Open Law Library</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </Link>

          {/* Module 2: Law Converters */}
          <Link
            to="/student/converters"
            className="group apple-glass-card p-6 md:p-7 flex flex-col justify-between hover:border-purple-500/40 transition-all shadow-xl hover:-translate-y-1"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-300 group-hover:scale-110 transition-transform">
                  <ArrowLeftRight className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                  IPC ↔ BNS
                </span>
              </div>

              <h3 className="font-serif text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                Law Converters
              </h3>

              <p className="text-xs text-neutral-300 leading-relaxed font-light">
                Bidirectional statutory concordance engine mapping <strong>IPC ↔ BNS</strong>, <strong>CrPC ↔ BNSS</strong>, and <strong>IEA ↔ BSA</strong> with BPRD/NCRB classifications, punishment shifts, and procedural changes.
              </p>
            </div>

            <div className="mt-6 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-purple-300 group-hover:text-white">
              <span>Open Concordance</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </Link>

          {/* Module 3: Study Centre */}
          <Link
            to="/student/study"
            className="group apple-glass-card p-6 md:p-7 flex flex-col justify-between hover:border-emerald-500/40 transition-all shadow-xl hover:-translate-y-1"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-300 group-hover:scale-110 transition-transform">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                  Daily MCQ & Quiz
                </span>
              </div>

              <h3 className="font-serif text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                Study Centre
              </h3>

              <p className="text-xs text-neutral-300 leading-relaxed font-light">
                Master criminal jurisprudence with timed MCQ drills on BNS/BNSS, AI Bare Act explainer for instant ingredients, daily legal problems, and exam revision guides.
              </p>
            </div>

            <div className="mt-6 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-emerald-300 group-hover:text-white">
              <span>Open Study Centre</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </Link>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          DAILY BNS PROVISION SPOTLIGHT (RENDERED IN TIMES NEW ROMAN)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-3xl bg-black/75 border-2 border-amber-500/30 p-6 md:p-8 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-mono uppercase tracking-wider text-amber-300 font-bold">
              Featured Statutory Provision • Bharatiya Nyaya Sanhita, 2023
            </span>
          </div>
          <Link
            to="/student/library"
            search={{ act: "bns-2023", section: "303" }}
            className="text-xs font-mono text-amber-400 hover:underline flex items-center gap-1"
          >
            <span>View Section in Library</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {/* BNS Statutory Text in Times New Roman */}
        <div
          className="p-6 rounded-2xl bg-[#09080c] border border-amber-500/20 text-base md:text-lg text-amber-50 leading-relaxed whitespace-pre-wrap select-text shadow-inner font-['Times_New_Roman',_Times,_serif]"
          style={{ fontFamily: "'Times New Roman', Times, serif" }}
        >
          "Section 303(2), Bharatiya Nyaya Sanhita, 2023: Whoever commits theft shall be punished with imprisonment of either description for a term which may extend to three years, or with fine, or with both; and in case of second or subsequent conviction, with rigorous imprisonment for a term which shall not be less than one year but which may extend to five years, and with fine."
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs font-mono text-neutral-400">
          <span className="text-neutral-300">
            Corresponding Colonial Provision: <strong className="text-purple-300 font-serif">Section 379, IPC 1860</strong>
          </span>
          <Link
            to="/student/converters"
            className="text-amber-400 hover:text-white flex items-center gap-1 font-mono text-xs"
          >
            <span>Compare IPC 379 ↔ BNS 303(2) in Converters</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          ACADEMIC METRICS TELEMETRY (CLEAN & BALANCED)
          ══════════════════════════════════════════════════════════════════ */}
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.2em] text-neutral-400 font-mono mb-4">
          {isIntern ? "Legal Intern & Litigation Telemetry" : "Academic & Legal Research Telemetry"}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Documents */}
          <div className="apple-glass-card p-6 flex flex-col justify-between group">
            <p className="text-[0.7rem] uppercase tracking-[0.15em] text-neutral-400 font-mono">
              Drafts Saved
            </p>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="font-display text-4xl font-semibold text-white">
                {savedDocsCount}
              </span>
              <span className="text-xs text-purple-400 font-mono">AI Assisted</span>
            </div>
            <p className="mt-3 text-[0.7rem] text-neutral-400 border-t border-white/[0.06] pt-2">
              {savedDocsCount > 0 ? `${savedDocsCount} saved in workspace repository` : "Moot memorials, writs & bail drafts"}
            </p>
          </div>

          {/* Card 2: Tracked Cases (for Interns) OR Research Papers (for Students) */}
          {isIntern ? (
            <div className="apple-glass-card p-6 flex flex-col justify-between group">
              <p className="text-[0.7rem] uppercase tracking-[0.15em] text-neutral-400 font-mono">
                Tracked Cases
              </p>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="font-display text-4xl font-semibold text-white">
                  {trackedCasesCount}
                </span>
                <span className="text-xs text-emerald-400 font-mono">Live eCourts</span>
              </div>
              <p className="mt-3 text-[0.7rem] text-neutral-400 border-t border-white/[0.06] pt-2">
                {trackedCasesCount > 0 ? `${trackedCasesCount} active litigation matters` : "High Court & Supreme Court listings"}
              </p>
            </div>
          ) : (
            <div className="apple-glass-card p-6 flex flex-col justify-between group">
              <p className="text-[0.7rem] uppercase tracking-[0.15em] text-neutral-400 font-mono">
                Research & Awards
              </p>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="font-display text-4xl font-semibold text-white">
                  {publicationsCount}
                </span>
                <span className="text-xs text-purple-400 font-mono">Peer Archive</span>
              </div>
              <p className="mt-3 text-[0.7rem] text-neutral-400 border-t border-white/[0.06] pt-2">
                Moot awards, research papers & articles
              </p>
            </div>
          )}

          {/* Card 3: Precedents */}
          <div className="apple-glass-card p-6 flex flex-col justify-between group">
            <p className="text-[0.7rem] uppercase tracking-[0.15em] text-neutral-400 font-mono">
              Statutory Corpus
            </p>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="font-display text-4xl font-semibold text-white">
                BNS/BNSS
              </span>
              <span className="text-xs text-amber-400 font-mono">2023 Codes</span>
            </div>
            <p className="mt-3 text-[0.7rem] text-neutral-400 border-t border-white/[0.06] pt-2">
              Comparative statutory citations & landmark ratios
            </p>
          </div>

          {/* Card 4: Network Connections */}
          <div className="apple-glass-card p-6 flex flex-col justify-between group">
            <p className="text-[0.7rem] uppercase tracking-[0.15em] text-neutral-400 font-mono">
              Verified Network
            </p>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="font-display text-4xl font-semibold text-white">
                {connectionsCount}
              </span>
              <span className="text-xs text-purple-400 font-mono">Connected</span>
            </div>
            <p className="mt-3 text-[0.7rem] text-neutral-400 border-t border-white/[0.06] pt-2">
              {connectionsCount > 0 ? `${connectionsCount} verified advocates & scholars` : "Connect with advocates & student scholars"}
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          RESEARCH & PROFESSIONAL WORK TOOLS (SPACIOUS 3-COL GRID)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <p className="text-[0.7rem] uppercase tracking-[0.2em] text-neutral-400 font-mono">
          {isIntern ? "Legal Intern Tool Suite" : "Law Student Tool Suite"}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            to="/student/drafter"
            className="group apple-glass-card p-6 md:p-7 flex flex-col justify-between hover:border-purple-500/40 transition-all shadow-xl hover:-translate-y-1"
          >
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
                <span>AI Drafter</span>
                <Sparkles className="h-4 w-4 text-purple-400 group-hover:scale-110 transition-transform" />
              </div>
              <h3 className="mt-3 font-serif text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                Draft Legal Pleadings
              </h3>
              <p className="mt-2 text-xs text-neutral-300 leading-relaxed font-light">
                Generate moot court memorials, anticipatory bail applications under Section 482 BNSS, and statutory demand notices.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-mono text-neutral-300 group-hover:text-white border-t border-white/[0.06] pt-3">
              <span>Open Drafter</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </Link>

          <Link
            to="/student/citations"
            className="group apple-glass-card p-6 md:p-7 flex flex-col justify-between hover:border-emerald-500/40 transition-all shadow-xl hover:-translate-y-1"
          >
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
                <span>Citation Finder</span>
                <Search className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
              <h3 className="mt-3 font-serif text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                Statutory Precedents
              </h3>
              <p className="mt-2 text-xs text-neutral-300 leading-relaxed font-light">
                Instant section mapping from IPC/CrPC to BNS/BNSS/BSA, accompanied by Supreme Court ratios and landmark principles.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-mono text-neutral-300 group-hover:text-white border-t border-white/[0.06] pt-3">
              <span>Search Citations</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </Link>

          {isIntern ? (
            <Link
              to="/student/cases"
              className="group apple-glass-card p-6 md:p-7 flex flex-col justify-between hover:border-amber-500/40 transition-all shadow-xl hover:-translate-y-1"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
                  <span>Case Tracker</span>
                  <Scale className="h-4 w-4 text-amber-400 group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="mt-3 font-serif text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                  Litigation Diary
                </h3>
                <p className="mt-2 text-xs text-neutral-300 leading-relaxed font-light">
                  Track pending matters before High Courts and District Courts via 16-digit eCourts CNR numbers with live listing updates.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-mono text-neutral-300 group-hover:text-white border-t border-white/[0.06] pt-3">
                <span>Track Matters</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          ) : (
            <Link
              to="/student/publications"
              className="group apple-glass-card p-6 md:p-7 flex flex-col justify-between hover:border-purple-500/40 transition-all shadow-xl hover:-translate-y-1"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
                  <span>Publications & Awards</span>
                  <Award className="h-4 w-4 text-purple-400 group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="mt-3 font-serif text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                  Research & Achievements
                </h3>
                <p className="mt-2 text-xs text-neutral-300 leading-relaxed font-light">
                  Publish research papers, moot awards, and commentary visible across student and advocate networks.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-mono text-neutral-300 group-hover:text-white border-t border-white/[0.06] pt-3">
                <span>Open Archive</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          DAILY INDIAN LEGAL NEWS DISPATCH
          ══════════════════════════════════════════════════════════════════ */}
      <div>
        <LegalNewsFeed className="rounded-3xl border-white/10 shadow-xl overflow-hidden" />
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          STATUTORY JURISDICTION & ACADEMIC NOTICE
          ══════════════════════════════════════════════════════════════════ */}
      <div className="apple-glass-card p-6 md:p-7 text-xs text-neutral-400 leading-relaxed flex items-start gap-4 rounded-3xl">
        <ShieldCheck className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="text-white font-medium block">
            Academic Research Notice • Section 29 Advocates Act, 1961
          </span>
          <p className="text-neutral-300 font-light">
            The TRANA Law Student Workspace is engineered strictly for legal scholarship, moot court competitions, trial advocacy simulations, and academic research. Client consultations and legal representation are legally restricted to verified advocates enrolled with the Bar Council of India.
          </p>
        </div>
      </div>
    </div>
  );
}

function ArrowRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
