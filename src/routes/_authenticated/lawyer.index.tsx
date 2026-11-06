import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  FileText, Search, Users, ArrowUpRight, CheckCircle2, 
  Clock, Calendar, User, Phone, MessageSquare, Shield,
  Sparkles, Filter, ChevronRight, X, ExternalLink, Copy, XCircle
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLawyerAuth } from "./lawyer";
import { formatCourtsHeader } from "@/lib/courts-data";
import { ConsultationChatModal } from "@/components/ConsultationChatModal";
import { CaseSummaryContent } from "@/components/CaseSummaryViewer";

export const Route = createFileRoute("/_authenticated/lawyer/")({
  head: () => ({
    meta: [
      { title: "Legal Professional Workspace — TRANA" },
      { name: "description", content: "Overview of your legal practice, referrals, and active matters on TRANA." },
      { property: "og:title", content: "Legal Professional Workspace — TRANA" },
    ],
  }),
  component: LawyerOverview,
});

type Referral = {
  id: string;
  date: string;
  client: string;
  phone: string;
  matterType: string;
  section: string;
  consultationType: "Call" | "Chat";
  status: "New Request" | "Confirmed" | "Denied" | "In Progress" | "Completed";
  summary: string;
  intakeBrief?: string;
  urgent: boolean;
};

function LawyerOverview() {
  const { data: lawyer } = useLawyerAuth();

  // Query live consultations from citizens
  const { data: dbConsults = [] } = useQuery({
    queryKey: ["lawyer-overview-consultations", lawyer?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("consultations")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const mergedReferrals = useMemo(() => {
    const list: Referral[] = [];

    const lawyerIdNorm = lawyer?.id?.toLowerCase().trim();
    const lawyerNameNorm = lawyer?.full_name?.toLowerCase().replace(/^adv\.?\s*/i, "").trim();

    // 1. Add live citizen inquiries from localStorage (instant sync from citizen request)
    let localReferrals: any[] = [];
    try {
      if (typeof window !== "undefined") {
        localReferrals = JSON.parse(localStorage.getItem("trana_client_referrals") || "[]");
      }
    } catch {
      // ignore
    }

    (localReferrals || []).forEach((r) => {
      if (r && r.id && !list.some((existing) => existing.id === r.id)) {
        if (lawyerIdNorm || lawyerNameNorm) {
          const rLawyerId = (r.lawyerId || r.lawyer_id || "").toLowerCase().trim();
          const rLawyerName = (r.lawyerName || r.lawyer_name || "").toLowerCase().replace(/^adv\.?\s*/i, "").trim();
          const matchesId = lawyerIdNorm && rLawyerId === lawyerIdNorm;
          const matchesName = lawyerNameNorm && rLawyerName.includes(lawyerNameNorm);
          if (rLawyerId || rLawyerName) {
            if (!matchesId && !matchesName) return;
          }
        }

        list.push({
          id: r.id,
          date: r.date || "Today",
          client: r.client || "Citizen Client",
          phone: "+91 (Verified Account)",
          matterType: r.matterType || "Legal Consultation Request",
          section: r.section || "Applicable Statutes",
          consultationType: r.consultationType === "Chat" ? "Chat" : "Call",
          status: r.status || "New Request",
          summary: r.summary || "Client requested consultation with counsel.",
          intakeBrief: r.intakeBrief,
          urgent: true,
        });
      }
    });

    // 2. Filter and add live consultations assigned to this lawyer
    (dbConsults || []).forEach((row) => {
      // Filter for this lawyer unless admin/blank
      if (lawyerIdNorm || lawyerNameNorm) {
        const rowLawyerId = (row.lawyer_id || "").toLowerCase().trim();
        const rowUserId = (row.user_id || "").toLowerCase().trim();
        const rowLawyerName = (row.lawyer_name || "").toLowerCase().replace(/^adv\.?\s*/i, "").trim();

        const matchesId = lawyerIdNorm && (rowLawyerId === lawyerIdNorm || rowUserId === lawyerIdNorm);
        const matchesName = lawyerNameNorm && rowLawyerName.includes(lawyerNameNorm);

        if (!matchesId && !matchesName) return;
      }

      const rowId = `REF-${row.id.slice(0, 8).toUpperCase()}`;
      if (list.some((existing) => existing.id === rowId)) return;

      const briefText = row.intake_brief || row.note || "";
      let matter = "Legal Consultation Request";
      let sectionStr = "Applicable Statutes";
      if (briefText) {
        const matterMatch = briefText.match(/\*\*Matter\*\*:\s*([^\n]+)/);
        if (matterMatch) matter = matterMatch[1].trim();
        const sectionMatch = briefText.match(/\*\*Applicable Statutes\*\*:\s*([^\n]+)/) || briefText.match(/\*\*Sections Identified\*\*:\s*([^\n]+)/);
        if (sectionMatch) sectionStr = sectionMatch[1].trim();
      }

      let clientName = "Citizen Client";
      const clientMatch = briefText.match(/\*\*Client\*\*:\s*([^(•\n]+)/);
      if (clientMatch && clientMatch[1].trim() && clientMatch[1].trim() !== "Citizen Client") {
        clientName = clientMatch[1].trim();
      } else if (row.user_id) {
        clientName = `Citizen (${row.user_id.slice(0, 8)})`;
      }

      const factsMatch = briefText.match(/#### 1\. Factual Summary[^\n]*\n([\s\S]*?)(?=#### 2|$)/);
      const summaryText = factsMatch && factsMatch[1].trim()
        ? (factsMatch[1].trim().length > 220 ? `${factsMatch[1].trim().slice(0, 220)}...` : factsMatch[1].trim())
        : (briefText.length > 200 ? `${briefText.slice(0, 200)}...` : (briefText || "Client requested consultation with counsel."));

      const stLower = (row.status || "").toLowerCase();
      const statusLabel =
        stLower === "completed"
          ? "Completed"
          : stLower === "confirmed"
          ? "Confirmed"
          : stLower === "denied"
          ? "Denied"
          : "New Request";

      list.push({
        id: rowId,
        date: row.created_at ? new Date(row.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Today",
        client: clientName,
        phone: "+91 (Verified Account)",
        matterType: matter,
        section: sectionStr,
        consultationType: row.consult_type === "chat" ? "Chat" : "Call",
        status: statusLabel,
        summary: summaryText,
        intakeBrief: briefText,
        urgent: true,
      });
    });

    return list;
  }, [dbConsults, lawyer]);

  const [referrals, setReferrals] = useState<Referral[]>([]);
  useEffect(() => {
    setReferrals(mergedReferrals);
  }, [mergedReferrals]);

  // Real Workspace Metrics
  const [savedDocsCount, setSavedDocsCount] = useState<number>(0);
  const [profileViewsCount, setProfileViewsCount] = useState<number>(0);

  useEffect(() => {
    try {
      const rawDocs = localStorage.getItem("trana_saved_documents");
      if (rawDocs) {
        const parsed = JSON.parse(rawDocs);
        if (Array.isArray(parsed)) setSavedDocsCount(parsed.length);
      }
    } catch {}

    try {
      const viewKey = `trana_profile_views_${lawyer?.id || lawyer?.bar_reg_no || "advocate"}`;
      const rawViews = localStorage.getItem(viewKey);
      if (rawViews) {
        setProfileViewsCount(parseInt(rawViews, 10));
      } else {
        setProfileViewsCount(0);
      }
    } catch {}
  }, [lawyer?.id, lawyer?.bar_reg_no]);

  // Calculate real analytics metrics
  const totalReferralsCount = referrals.length;
  const newRequestsCount = referrals.filter((r) => r.status === "New Request").length;
  const completedConsultationsCount = referrals.filter((r) => r.status === "Completed").length;
  const phoneCallsCount = referrals.filter((r) => r.consultationType === "Call").length;
  const secureChatsCount = referrals.filter((r) => r.consultationType === "Chat").length;

  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const qc = useQueryClient();
  const [activeChat, setActiveChat] = useState<{
    consultationId: string;
    clientName: string;
    lawyerName: string;
    consultType: string;
  } | null>(null);

  async function updateStatus(id: string, newStatus: Referral["status"]) {
    setReferrals((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );
    if (selectedReferral && selectedReferral.id === id) {
      setSelectedReferral((prev) => (prev ? { ...prev, status: newStatus } : null));
    }

    const dbId = id.replace(/^REF-/, "");
    const dbStatus = newStatus.toLowerCase().replace(/\s+/g, "");
    try {
      await supabase
        .from("consultations")
        .update({ status: dbStatus })
        .or(`id.eq.${dbId},id.ilike.${dbId}%`);
    } catch {
      // ignore
    }

    try {
      const local = JSON.parse(localStorage.getItem("trana_client_referrals") || "[]");
      const updated = local.map((r: any) => (r.id === id ? { ...r, status: newStatus } : r));
      localStorage.setItem("trana_client_referrals", JSON.stringify(updated));
    } catch {
      // ignore
    }

    qc.invalidateQueries({ queryKey: ["lawyer-overview-consultations"] });
    qc.invalidateQueries({ queryKey: ["lawyer-referrals-consultations"] });
    qc.invalidateQueries({ queryKey: ["consultations"] });
    qc.invalidateQueries({ queryKey: ["citizen-consultations-lock"] });

    toast.success(`Referral status updated to "${newStatus}"`);
  }

  const courtsHeaderLabel = formatCourtsHeader(lawyer?.courts);
  const advocateName = lawyer?.full_name?.trim();
  const welcomeHeading = advocateName ? `Welcome back, Counsel ${advocateName}` : "Welcome back, Counsel";

  return (
    <div className="space-y-8 md:space-y-10">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#222222] pb-5 md:pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#888888]">
            <span>Advocate Portal</span>
            <span>•</span>
            <span className="text-white">{courtsHeaderLabel}</span>
          </div>
          <h1
            className="mt-1 font-display font-normal text-white [text-wrap:balance]"
            style={{
              fontSize: "clamp(28px, 4vw, 48px)",
              fontWeight: 400,
              lineHeight: 1.15,
              textWrap: "balance",
            }}
          >
            {welcomeHeading}
          </h1>
          <p className="mt-1.5 text-sm text-[#999999]">
            Manage consultation requests, draft court pleadings with AI, and access statutory citations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/lawyer/cases"
            className="border border-emerald-500/40 bg-emerald-950/30 px-4 py-2.5 text-xs uppercase tracking-[0.15em] text-emerald-300 hover:bg-emerald-900/40 transition-colors flex items-center gap-2 font-mono"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Case Tracker</span>
          </Link>
          <Link
            to="/lawyer/drafter"
            className="bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-black hover:bg-neutral-200 transition-colors flex items-center gap-2"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>New Draft</span>
          </Link>
          <Link
            to="/lawyer/profile"
            className="border border-white/30 px-4 py-2.5 text-xs uppercase tracking-[0.15em] text-white hover:border-white transition-colors"
          >
            Edit Profile
          </Link>
        </div>
      </div>

      {/* TOP STATS ROW (4 cards, #1A1A1A, white border) */}
      <section>
        <h2 className="text-xs uppercase tracking-[0.2em] text-[#888888] mb-4">Practice Analytics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Stat 1 */}
          <div className="bg-[#1A1A1A] border border-white p-6 transition-all hover:translate-y-[-2px]">
            <p className="text-xs uppercase tracking-[0.15em] text-[#999999]">
              Referrals Received This Month
            </p>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="font-display text-4xl font-semibold text-white">
                {totalReferralsCount}
              </span>
              {newRequestsCount > 0 ? (
                <span className="text-xs text-emerald-400 font-mono flex items-center gap-0.5">
                  +{newRequestsCount} new <ArrowUpRight className="h-3 w-3" />
                </span>
              ) : (
                <span className="text-xs text-[#888888] font-mono">
                  Active Relay
                </span>
              )}
            </div>
            <p className="mt-3 text-[0.7rem] text-[#777777]">
              {newRequestsCount > 0 
                ? `${newRequestsCount} new incoming request${newRequestsCount === 1 ? "" : "s"} this week` 
                : "No pending requests this week"}
            </p>
          </div>

          {/* Stat 2 */}
          <div className="bg-[#1A1A1A] border border-white p-6 transition-all hover:translate-y-[-2px]">
            <p className="text-xs uppercase tracking-[0.15em] text-[#999999]">
              Consultations Completed
            </p>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="font-display text-4xl font-semibold text-white">
                {completedConsultationsCount}
              </span>
              <span className={`text-xs font-mono ${completedConsultationsCount > 0 ? "text-emerald-400" : "text-white/60"}`}>
                {completedConsultationsCount > 0 ? "100% verified" : "0% completed"}
              </span>
            </div>
            <p className="mt-3 text-[0.7rem] text-[#777777]">
              {completedConsultationsCount > 0
                ? `${phoneCallsCount} phone call${phoneCallsCount === 1 ? "" : "s"} • ${secureChatsCount} secure chat${secureChatsCount === 1 ? "" : "s"}`
                : totalReferralsCount > 0
                ? `${totalReferralsCount} active consultation channel${totalReferralsCount === 1 ? "" : "s"}`
                : "Awaiting client consultations"}
            </p>
          </div>

          {/* Stat 3 */}
          <div className="bg-[#1A1A1A] border border-white p-6 transition-all hover:translate-y-[-2px]">
            <p className="text-xs uppercase tracking-[0.15em] text-[#999999]">
              Documents Drafted
            </p>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="font-display text-4xl font-semibold text-white">
                {savedDocsCount}
              </span>
              <span className="text-xs text-white/80 font-mono">
                AI assisted
              </span>
            </div>
            <p className="mt-3 text-[0.7rem] text-[#777777]">
              {savedDocsCount > 0
                ? `${savedDocsCount} saved in workspace repository`
                : "Draft bail apps, notices & pleadings with AI"}
            </p>
          </div>

          {/* Stat 4 */}
          <div className="bg-[#1A1A1A] border border-white p-6 transition-all hover:translate-y-[-2px]">
            <p className="text-xs uppercase tracking-[0.15em] text-[#999999]">
              Profile Views
            </p>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="font-display text-4xl font-semibold text-white">
                {profileViewsCount}
              </span>
              <span className="text-xs text-emerald-400 font-mono flex items-center gap-0.5">
                {lawyer?.approved || lawyer?.verification_status === "VERIFIED" ? "Verified" : "Enrolled"}
              </span>
            </div>
            <p className="mt-3 text-[0.7rem] text-[#777777]">
              {profileViewsCount > 0 
                ? `${profileViewsCount} direct directory inquiries`
                : `Active listing in ${lawyer?.city || "Delhi NCR"} & verified courts`}
            </p>
          </div>
        </div>
      </section>

      {/* QUICK ACTIONS (3 cards, large) */}
      <section>
        <h2 className="text-xs uppercase tracking-[0.2em] text-[#888888] mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 (white background, black text) */}
          <div className="bg-white text-black p-8 flex flex-col justify-between border border-white shadow-xl transition-all hover:translate-y-[-2px]">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-block border border-black/80 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-black">
                  In Development
                </span>
                <Sparkles className="h-5 w-5 text-black" />
              </div>
              <h3 className="mt-6 font-display text-3xl font-semibold text-black">
                Draft a Document
              </h3>
              <p className="mt-3 text-sm text-neutral-700 leading-relaxed font-light">
                Generate bail applications, petitions, legal notices and more using AI.
              </p>
            </div>
            <div className="mt-8 pt-6 border-t border-black/10">
              <Link
                to="/lawyer/drafter"
                className="w-full bg-black text-white px-5 py-3 text-xs font-semibold uppercase tracking-[0.15em] hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
              >
                <span>Open AI Drafter</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 2 (#1A1A1A) */}
          <div className="bg-[#1A1A1A] text-white p-8 flex flex-col justify-between border border-[#2E2E2E] hover:border-white/50 transition-all hover:translate-y-[-2px]">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-block border border-white/30 px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-white/90">
                  In Development
                </span>
                <Search className="h-5 w-5 text-white/80" />
              </div>
              <h3 className="mt-6 font-display text-3xl font-medium text-white">
                Find Citations
              </h3>
              <p className="mt-3 text-sm text-[#999999] leading-relaxed font-light">
                Search BNS, BNSS, BSA and case law with exact citations and section references.
              </p>
            </div>
            <div className="mt-8 pt-6 border-t border-[#2A2A2A]">
              <Link
                to="/lawyer/citations"
                className="w-full border border-white/60 text-white px-5 py-3 text-xs uppercase tracking-[0.15em] hover:bg-white hover:text-black transition-colors flex items-center justify-center gap-2"
              >
                <span>Open Citation Finder</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 3 (#1A1A1A) */}
          <div className="bg-[#1A1A1A] text-white p-8 flex flex-col justify-between border border-[#2E2E2E] hover:border-white/50 transition-all hover:translate-y-[-2px]">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-block border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-emerald-400">
                  Active Network
                </span>
                <Users className="h-5 w-5 text-white/80" />
              </div>
              <h3 className="mt-6 font-display text-3xl font-medium text-white">
                Connect With Lawyers
              </h3>
              <p className="mt-3 text-sm text-[#999999] leading-relaxed font-light">
                TRANA's professional network collaborate, refer and connect with other legal professionals.
              </p>
            </div>
            <div className="mt-8 pt-6 border-t border-[#2A2A2A]">
              <Link
                to="/lawyer/network"
                className="w-full border border-white/60 text-white px-5 py-3 text-xs uppercase tracking-[0.15em] hover:bg-white hover:text-black transition-colors flex items-center justify-center gap-2"
              >
                <span>View Network</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* RECENT REFERRALS TABLE */}
      <section className="bg-[#1A1A1A] border border-[#2E2E2E] p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A2A2A] pb-6">
          <div>
            <h2 className="font-display text-2xl font-medium text-white">Recent Referrals</h2>
            <p className="mt-1 text-xs text-[#888888]">
              Clients directed to your profile matching your court jurisdictions and specialisation.
            </p>
          </div>
          <Link
            to="/lawyer/referrals"
            className="text-xs uppercase tracking-[0.15em] text-[#AAAAAA] hover:text-white transition-colors flex items-center gap-1.5"
          >
            <span>View All Referrals</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#2E2E2E] text-[0.7rem] uppercase tracking-[0.15em] text-[#888888]">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-4">Matter Type</th>
                <th className="py-3 px-4">Consultation Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#242424]">
              {referrals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#777777] font-mono text-xs">
                    No consultation referrals received yet. When clients request a consultation with you from the directory, their matter briefs will appear here.
                  </td>
                </tr>
              ) : (
                referrals.map((r) => (
                <tr key={r.id} className="hover:bg-[#202020] transition-colors group">
                  <td className="py-4 px-4 font-mono text-xs text-[#AAAAAA] whitespace-nowrap">
                    {r.date}
                  </td>
                  <td className="py-4 px-4 font-medium text-white whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-[#2A2A2A] border border-white/10 flex items-center justify-center text-[0.7rem] text-white">
                        {r.client.charAt(0)}
                      </div>
                      <span>{r.client}</span>
                      {r.urgent && (
                        <span className="text-[0.6rem] px-1.5 py-0.2 bg-red-950 border border-red-500/50 text-red-400 uppercase">
                          Urgent
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-[#D0D0D0]">
                    <div>{r.matterType}</div>
                    <div className="text-xs text-[#777777] font-mono">{r.section}</div>
                  </td>
                  <td className="py-4 px-4 text-[#AAAAAA] whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5 text-xs">
                      {r.consultationType === "Call" && <Phone className="h-3 w-3 text-sky-400" />}
                      {r.consultationType === "Chat" && <MessageSquare className="h-3 w-3 text-purple-400" />}
                      <span>{r.consultationType}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <span
                      className={`inline-block px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.1em] border ${
                        r.status === "New Request"
                          ? "border-amber-400/50 bg-amber-500/10 text-amber-300"
                          : r.status === "Confirmed"
                          ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-300"
                          : r.status === "Denied"
                          ? "border-red-500/50 bg-red-500/10 text-red-400"
                          : r.status === "In Progress"
                          ? "border-sky-400/50 bg-sky-500/10 text-sky-300"
                          : "border-neutral-700 bg-neutral-900 text-[#777777]"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right whitespace-nowrap space-x-2">
                    <button
                      onClick={() =>
                        setActiveChat({
                          consultationId: r.id,
                          clientName: r.client,
                          lawyerName: lawyer?.full_name || "Advocate Counsel",
                          consultType: r.consultationType,
                        })
                      }
                      className="border border-white/40 hover:border-white px-2.5 py-1.5 text-xs font-mono uppercase tracking-[0.1em] text-white hover:bg-white hover:text-black transition-colors"
                      title="Open Masked Chat"
                    >
                      Chat
                    </button>
                    <button
                      onClick={() => setSelectedReferral(r)}
                      className="border border-white/30 px-3 py-1.5 text-xs uppercase tracking-[0.1em] text-white hover:border-white hover:bg-white hover:text-black transition-colors"
                    >
                      Review Matter
                    </button>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Referral Review Modal */}
      {selectedReferral && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#1A1A1A] border border-white/30 p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-[#2E2E2E] pb-4">
              <div>
                <span className="text-xs uppercase tracking-[0.2em] text-[#888888] font-mono">
                  {selectedReferral.id} • {selectedReferral.date}
                </span>
                <h3 className="mt-1 font-display text-3xl font-medium text-white">
                  {selectedReferral.client}
                </h3>
                <p className="text-xs text-[#AAAAAA] mt-1">
                  Preferred: {selectedReferral.consultationType}
                </p>
              </div>
              <button
                onClick={() => setSelectedReferral(null)}
                className="p-1 border border-[#333333] text-white hover:bg-[#252525]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <span className="text-xs uppercase tracking-[0.15em] text-[#888888]">Legal Subject</span>
                <p className="mt-1 text-base text-white font-medium">{selectedReferral.matterType}</p>
                <p className="text-xs text-amber-300 font-medium">{selectedReferral.section}</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs uppercase tracking-[0.15em] text-[#888888]">
                    Case Summary (Structured Analysis)
                  </span>
                  {selectedReferral.intakeBrief && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-300">
                      Case Analysis
                    </span>
                  )}
                </div>
                <div className="mt-1 bg-[#111111] border border-[#2E2E2E] p-4 text-xs md:text-sm text-[#CCCCCC] leading-relaxed max-h-[360px] overflow-y-auto font-sans rounded">
                  <CaseSummaryContent content={selectedReferral.intakeBrief || selectedReferral.summary} />
                </div>
              </div>

              <div className="pt-2">
                <span className="text-xs uppercase tracking-[0.15em] text-[#888888] block mb-2">Update Status</span>
                <div className="flex flex-wrap gap-2">
                  {(["New Request", "Confirmed", "Denied", "In Progress", "Completed"] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => updateStatus(selectedReferral.id, st)}
                      className={`px-3 py-1.5 text-xs uppercase tracking-[0.1em] border transition-colors ${
                        selectedReferral.status === st
                          ? st === "Confirmed"
                            ? "border-emerald-500 bg-emerald-500 text-black font-semibold"
                            : st === "Denied"
                            ? "border-red-500 bg-red-500 text-white font-semibold"
                            : "border-white bg-white text-black font-semibold"
                          : "border-[#333333] text-[#AAAAAA] hover:text-white hover:border-white"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-[#2E2E2E] flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const r = selectedReferral;
                    setSelectedReferral(null);
                    setActiveChat({
                      consultationId: r.id,
                      clientName: r.client,
                      lawyerName: lawyer?.full_name || "Advocate Counsel",
                      consultType: r.consultationType,
                    });
                  }}
                  className="inline-flex items-center gap-1.5 border border-white/50 bg-[#161616] px-3 py-2 text-xs font-mono uppercase tracking-[0.1em] text-white hover:bg-white hover:text-black transition-colors"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Open Consultation Chat</span>
                </button>
                <Link
                  to="/lawyer/drafter"
                  className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-[#AAAAAA] hover:text-white"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Draft Pleading</span>
                </Link>
              </div>
              <div className="flex items-center gap-2">
                {selectedReferral.intakeBrief && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedReferral.intakeBrief!);
                      toast.success("Intake brief copied to clipboard");
                    }}
                    className="border border-[#333333] px-3 py-2 text-xs uppercase tracking-[0.1em] text-[#AAAAAA] hover:text-white hover:border-white transition-colors flex items-center gap-1.5"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Brief</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedReferral(null)}
                  className="bg-white px-5 py-2.5 text-xs uppercase tracking-[0.15em] text-black font-semibold hover:bg-neutral-200 transition-colors"
                >
                  Close Brief
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIDENTIAL CONSULTATION CHAT MODAL (LAWYER VIEW) */}
      {activeChat && (
        <ConsultationChatModal
          isOpen={Boolean(activeChat)}
          onClose={() => setActiveChat(null)}
          consultationId={activeChat.consultationId}
          consultationType={activeChat.consultType}
          currentParty="lawyer"
          clientName={activeChat.clientName}
          lawyerName={activeChat.lawyerName}
        />
      )}
    </div>
  );
}
