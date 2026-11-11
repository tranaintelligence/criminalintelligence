import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { 
  GraduationCap, Sparkles, Scale, Search, Landmark, FileText, 
  Users, ArrowUpRight, BookOpen, ShieldCheck, Clock, CheckCircle2, Award 
} from "lucide-react";
import { useUserRole } from "@/lib/user-role";
import { getLocalConnections } from "@/lib/network-connections";
import { LegalNewsFeed } from "@/components/LegalNewsFeed";
import { MassAnnouncementBanner } from "@/components/MassAnnouncementBanner";

export const Route = createFileRoute("/_authenticated/student/")({
  head: () => ({
    meta: [
      { title: "Law Student Workspace — TRANA" },
      { name: "description", content: "Academic legal research, AI drafting, case tracking, and professional networking for law scholars." },
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
    <div className="space-y-8 md:space-y-10">
      {/* Live Procedural Webinars & Mass Announcements (Overview Only) */}
      <MassAnnouncementBanner currentDashboard="students" className="mb-6" />

      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-neutral-400 font-mono">
            <span>Academic Portal</span>
            <span>•</span>
            <span className="text-purple-400 font-semibold">{degree}</span>
          </div>
          <h1 className="mt-2 font-display text-3xl md:text-5xl font-medium text-white">
            Welcome back, {studentName}
          </h1>
          <p className="mt-2 text-xs md:text-sm text-neutral-400 flex flex-wrap items-center gap-2">
            <span>{university}</span>
            <span>•</span>
            <span className="text-white/80">{yearOfStudy}</span>
            {rollNo && (
              <>
                <span>•</span>
                <span className="apple-glass-pill px-2 py-0.5 text-[11px] font-mono text-purple-300">
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

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/student/publications"
            className="bg-white text-black px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:bg-neutral-200 transition-all flex items-center gap-2 shadow-md hover:shadow-[0_0_20px_rgba(255,255,255,0.25)]"
          >
            <Award className="h-3.5 w-3.5" />
            <span>Research & Awards</span>
          </Link>
          <Link
            to="/student/drafter"
            className="apple-glass-pill px-4 py-2.5 text-xs font-mono uppercase tracking-[0.1em] text-neutral-300 hover:text-white transition-all flex items-center gap-2 shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Drafter</span>
          </Link>
          <Link
            to="/student/network"
            className="apple-glass-pill px-4 py-2.5 text-xs font-mono uppercase tracking-[0.1em] text-neutral-300 hover:text-white transition-all flex items-center gap-2 shadow-sm"
          >
            <Users className="h-3.5 w-3.5" />
            <span>Network</span>
          </Link>
          <Link
            to="/student/profile"
            className="apple-glass-pill px-4 py-2.5 text-xs font-mono uppercase tracking-[0.1em] text-neutral-300 hover:text-white transition-all shadow-sm"
          >
            Edit Profile
          </Link>
        </div>
      </div>

      {/* ACADEMIC METRICS CARDS */}
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
              {savedDocsCount > 0 ? `${savedDocsCount} saved in workspace repository` : "Moot court memorials, writs & notices"}
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
                {trackedCasesCount > 0 ? `${trackedCasesCount} active litigation matters` : "Track High Court & Supreme Court listings"}
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
                Moot court awards, research papers & articles
              </p>
            </div>
          )}

          {/* Card 3: Precedents */}
          <div className="apple-glass-card p-6 flex flex-col justify-between group">
            <p className="text-[0.7rem] uppercase tracking-[0.15em] text-neutral-400 font-mono">
              Precedents Researched
            </p>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="font-display text-4xl font-semibold text-white">
                BNS/BNSS
              </span>
              <span className="text-xs text-sky-400 font-mono">2023 Sanhitas</span>
            </div>
            <p className="mt-3 text-[0.7rem] text-neutral-400 border-t border-white/[0.06] pt-2">
              Comparative statutory citations & landmark ratios
            </p>
          </div>

          {/* Card 4: Network Connections */}
          <div className="apple-glass-card p-6 flex flex-col justify-between group">
            <p className="text-[0.7rem] uppercase tracking-[0.15em] text-neutral-400 font-mono">
              Network Connections
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

      {/* QUICK ACTIONS GRID */}
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.2em] text-neutral-400 font-mono mb-4">
          {isIntern ? "Legal Intern Tool Suite" : "Law Student Tool Suite"}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            to="/student/drafter"
            className="group apple-glass-card p-6 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
                <span>AI Drafter</span>
                <Sparkles className="h-4 w-4 text-purple-400 group-hover:scale-110 transition-transform" />
              </div>
              <h3 className="mt-3 font-display text-xl text-white group-hover:text-purple-300 transition-colors">
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
            className="group apple-glass-card p-6 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
                <span>Citation Finder</span>
                <Search className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
              <h3 className="mt-3 font-display text-xl text-white group-hover:text-emerald-300 transition-colors">
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
              className="group apple-glass-card p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
                  <span>Case Tracker</span>
                  <Scale className="h-4 w-4 text-amber-400 group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="mt-3 font-display text-xl text-white group-hover:text-amber-300 transition-colors">
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
              className="group apple-glass-card p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
                  <span>Publications & Awards</span>
                  <Award className="h-4 w-4 text-purple-400 group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="mt-3 font-display text-xl text-white group-hover:text-purple-300 transition-colors">
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

      {/* DAILY INDIAN LEGAL NEWS */}
      <div>
        <LegalNewsFeed className="rounded-2xl border-white/10 shadow-xl overflow-hidden" />
      </div>

      {/* STATUTORY JURISDICTION & ACADEMIC NOTICE */}
      <div className="apple-glass-card p-6 text-xs text-neutral-400 leading-relaxed flex items-start gap-4">
        <ShieldCheck className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
        <div>
          <span className="text-white font-medium block">Academic Research Notice • Section 29 Advocates Act 1961</span>
          <p className="mt-1 text-neutral-300">
            The TRANA Law Student Workspace is engineered strictly for legal scholarship, moot court competitions, trial advocacy simulations, and academic research. Client consultations and legal representation are legally restricted to verified advocates enrolled with the Bar Council of India.
          </p>
        </div>
      </div>
    </div>
  );
}

