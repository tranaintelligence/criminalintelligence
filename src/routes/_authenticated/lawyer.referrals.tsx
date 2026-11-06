import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Briefcase, Search, Phone, MessageSquare, 
  ChevronRight, Calendar, Filter, Sparkles, CheckCircle2,
  FileText, Copy, X, XCircle, ShieldAlert, Users
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLawyerAuth } from "./lawyer";
import { CaseSummaryModal } from "@/components/CaseSummaryViewer";

export const Route = createFileRoute("/_authenticated/lawyer/referrals")({
  head: () => ({
    meta: [
      { title: "Legal Professional Workspace — TRANA" },
      { name: "description", content: "Manage incoming client consultation requests, briefs, and scheduled sessions." },
      { property: "og:title", content: "Legal Professional Workspace — TRANA" },
    ],
  }),
  component: LawyerReferralsPage,
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
  scheduledTime?: string;
};

function LawyerReferralsPage() {
  const { data: lawyer } = useLawyerAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedBrief, setSelectedBrief] = useState<Referral | null>(null);

  // Fetch live consultations from citizens who connected with this lawyer
  const { data: dbConsults = [] } = useQuery({
    queryKey: ["lawyer-referrals-consultations", lawyer?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("consultations")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const mergedList: Referral[] = useMemo(() => {
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
          scheduledTime: r.scheduledTime,
        });
      }
    });

    // 2. Add live citizen inquiries from consultations table
    (dbConsults || []).forEach((row) => {
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
        scheduledTime: row.scheduled_for ? new Date(row.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
      });
    });

    return list;
  }, [dbConsults, lawyer]);

  async function handleConfirmCase(referralId: string, clientName: string) {
    const dbId = referralId.replace(/^REF-/, "");
    try {
      await supabase.from("consultations").update({ status: "confirmed" }).or(`id.eq.${dbId},id.ilike.${dbId}%`);
    } catch (e) {
      console.warn("Supabase update error:", e);
    }

    try {
      const local = JSON.parse(localStorage.getItem("trana_client_referrals") || "[]");
      const updated = local.map((r: any) => (r.id === referralId ? { ...r, status: "Confirmed" } : r));
      localStorage.setItem("trana_client_referrals", JSON.stringify(updated));
    } catch {
      // ignore
    }

    qc.invalidateQueries({ queryKey: ["lawyer-referrals-consultations"] });
    qc.invalidateQueries({ queryKey: ["consultations"] });
    qc.invalidateQueries({ queryKey: ["citizen-consultations-lock"] });
    toast.success(`Case for ${clientName} confirmed! Consultation session confirmed.`);
  }

  async function handleDenyCase(referralId: string, clientName: string) {
    const confirmed = window.confirm(
      `Are you sure you want to decline/deny the case for ${clientName}? This will unlock the client's consultation option so they may consult in the future.`
    );
    if (!confirmed) return;

    const dbId = referralId.replace(/^REF-/, "");
    try {
      await supabase.from("consultations").update({ status: "denied" }).or(`id.eq.${dbId},id.ilike.${dbId}%`);
    } catch (e) {
      console.warn("Supabase update error:", e);
    }

    try {
      const local = JSON.parse(localStorage.getItem("trana_client_referrals") || "[]");
      const updated = local.map((r: any) => (r.id === referralId ? { ...r, status: "Denied" } : r));
      localStorage.setItem("trana_client_referrals", JSON.stringify(updated));
    } catch {
      // ignore
    }

    qc.invalidateQueries({ queryKey: ["lawyer-referrals-consultations"] });
    qc.invalidateQueries({ queryKey: ["consultations"] });
    qc.invalidateQueries({ queryKey: ["citizen-consultations-lock"] });
    toast.error(`Case for ${clientName} declined. Box unlocked for future inquiries.`);
  }

  const filtered = mergedList.filter((r) => {
    if (statusFilter !== "All" && r.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.client.toLowerCase().includes(q) ||
        r.matterType.toLowerCase().includes(q) ||
        r.section.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-8">
      <div className="border-b border-[#222222] pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl md:text-5xl font-medium text-white">
            Client Referrals
          </h1>
          <p className="mt-2 text-sm text-[#999999]">
            Direct inquiries and structured AI matter briefs from citizens seeking representation.
          </p>
        </div>

        <div className="border border-white/20 bg-[#1A1A1A] px-4 py-2 text-xs font-mono text-white">
          Active Inquiries: {mergedList.filter((r) => r.status !== "Completed" && r.status !== "Denied").length}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#777777]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search referrals by client, matter, or statute..."
            className="w-full border border-[#333333] bg-[#1A1A1A] py-3 pl-11 pr-4 text-sm text-white placeholder:text-[#666666] focus:border-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(["All", "New Request", "Confirmed", "Denied", "In Progress", "Completed"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-2 text-xs uppercase tracking-[0.1em] border transition-colors ${
                statusFilter === st
                  ? "border-white bg-white text-black font-semibold"
                  : "border-[#333333] bg-[#111111] text-[#AAAAAA] hover:text-white hover:border-white"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Referrals Cards List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-12 text-center space-y-3">
            <Users className="h-8 w-8 text-[#555555] mx-auto" />
            <h3 className="text-white font-medium text-sm">No Client Inquiries Found</h3>
            <p className="text-xs text-[#888888] max-w-md mx-auto">
              {statusFilter === "All"
                ? "You currently have no incoming client referrals. When citizens request a consultation with you from the advocate directory, their inquiries and AI intake briefs will appear here."
                : `No referrals found with status "${statusFilter}".`}
            </p>
          </div>
        ) : (
          filtered.map((r) => (
          <div
            key={r.id}
            className="bg-[#1A1A1A] border border-[#2E2E2E] hover:border-white/50 transition-all p-6 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#262626] pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-2xl font-medium text-white">{r.client}</span>
                  <span
                    className={`px-2.5 py-0.5 text-[0.65rem] uppercase tracking-wider border ${
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
                  {r.intakeBrief && (
                    <span className="px-2 py-0.5 text-[0.65rem] uppercase tracking-wider rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-mono flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      AI Intake Brief
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-[#888888] font-mono">
                  {r.id} • Registered: {r.date}
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="text-[#888888]">Type:</span>
                <span className="text-white font-medium flex items-center gap-1.5">
                  {r.consultationType === "Call" && <Phone className="h-3.5 w-3.5 text-sky-400" />}
                  {r.consultationType === "Chat" && <MessageSquare className="h-3.5 w-3.5 text-purple-400" />}
                  {r.consultationType}
                </span>
                {r.scheduledTime && (
                  <span className="border border-white/20 bg-[#111111] px-2 py-0.5 text-white font-mono text-[0.7rem]">
                    {r.scheduledTime}
                  </span>
                )}
              </div>
            </div>

            <div>
              <span className="text-xs text-amber-300 font-medium">{r.section}</span>
              <h3 className="text-sm font-medium text-white mt-0.5">{r.matterType}</h3>
              <p className="mt-2 text-xs text-[#CCCCCC] leading-relaxed bg-[#111111] border border-[#242424] p-3">
                {r.summary}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div>
                {r.intakeBrief && (
                  <button
                    type="button"
                    onClick={() => setSelectedBrief(r)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-300 font-mono transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>View Case Summary</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {r.status === "New Request" && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleConfirmCase(r.id, r.client)}
                      className="border border-emerald-500/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-600 hover:text-black px-3 py-1.5 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Confirm Case</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDenyCase(r.id, r.client)}
                      className="border border-red-500/60 bg-red-950/40 text-red-300 hover:bg-red-600 hover:text-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Deny Case</span>
                    </button>
                  </>
                )}

                {r.status === "Confirmed" && (
                  <>
                    <span className="border border-emerald-500/50 bg-emerald-950/40 text-emerald-300 px-2.5 py-1.5 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Case Confirmed</span>
                    </span>
                    <Link
                      to="/lawyer/inbox"
                      className="border border-emerald-500/40 bg-emerald-950/20 hover:bg-emerald-900/40 text-emerald-300 px-3 py-1.5 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Inbox</span>
                    </Link>
                  </>
                )}

                <Link
                  to="/lawyer/drafter"
                  className="border border-white/30 px-3 py-1.5 text-xs uppercase tracking-[0.1em] text-white hover:border-white transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>Open in AI Drafter</span>
                </Link>
              </div>
            </div>
          </div>
        ))
        )}
      </div>

      {/* Case Summary Modal */}
      {selectedBrief && (
        <CaseSummaryModal
          isOpen={Boolean(selectedBrief)}
          onClose={() => setSelectedBrief(null)}
          clientName={selectedBrief.client}
          matterType={selectedBrief.matterType}
          consultationType={selectedBrief.consultationType}
          content={selectedBrief.intakeBrief || selectedBrief.summary}
        />
      )}
    </div>
  );
}
