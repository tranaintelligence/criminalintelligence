import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Briefcase, Search, Phone, MessageSquare, Users, 
  ChevronRight, Calendar, Filter, Sparkles, CheckCircle2,
  FileText, Copy, X
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLawyerAuth } from "./lawyer";

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
  consultationType: "Call" | "Chat" | "In-person";
  status: "New Request" | "Confirmed" | "In Progress" | "Completed";
  summary: string;
  intakeBrief?: string;
  scheduledTime?: string;
};

const initialList: Referral[] = [
  {
    id: "REF-2026-089",
    date: "24 Oct 2026",
    client: "Rahul Verma",
    phone: "+91 98110 42910",
    matterType: "Anticipatory Bail Application",
    section: "Section 482 BNSS (Old 438 CrPC)",
    consultationType: "Call",
    status: "New Request",
    summary: "Apprehending arrest under Section 318 BNS (Cheating) arising out of commercial invoice dispute. Needs urgent interim protection before Sessions Court.",
    intakeBrief: `### CLIENT INTAKE BRIEF (TRANA AI FIRST-AID)
**Matter**: Anticipatory Bail Application — Cheating Allegation
**Client**: Rahul Verma • Phone: +91 98110 42910 • New Delhi
**Target Counsel**: Senior Advocate • Mode: Telephonic Consultation
**Applicable Statutes**: Section 482 BNSS (Old 438 CrPC) & Section 318 BNS (Old 420 IPC)
**Bail / Jeopardy Position**: Non-Bailable Cognizable Offence • Police summons threatened under Sec 35 BNSS.

#### 1. Factual Summary (Citizen's Statement to AI)
Client Rahul Verma is the managing director of a registered logistics firm. A commercial supplier has lodged a criminal complaint with the local police station alleging cheating and criminal breach of trust regarding unpaid invoices totaling ₹18.5 Lakhs. The dispute arose strictly due to damaged consignments and disputed quality reconciliation, with no dishonest inducement at the inception of the contract. Investigating officer has issued an informal verbal threat of arrest.

#### 2. AI Statutory Assessment
• Offence under Section 318 BNS (Cheating) requires fraudulent or dishonest intention from the very beginning; a commercial breach of contract or delay in settlement does not constitute criminal cheating per Supreme Court ratio in Hridaya Ranjan Pd. Verma v. State of Bihar and Dalip Kaur v. Jagnar Singh.
• A reasonable and genuine apprehension of arrest exists, fulfilling jurisdictional criteria for an urgent Anticipatory Bail Application under Section 482 BNSS before the Court of Session.

#### 3. Key Rights Identified
• Protection against arbitrary arrest: Section 35(3) BNSS mandates formal notice of appearance prior to arrest for offences carrying punishment up to 7 years.
• Right to legal counsel and immediate copies of written complaints.

#### 4. Recommended Urgent Actions
• Move urgent Anticipatory Bail Application under Section 482 BNSS before the Principal District & Sessions Judge.
• Compile commercial invoices, inspection notices, and WhatsApp/Email correspondence showing bona fide commercial dispute.
• Seek interim protection against coercive custodial measures pending regular notice.`,
    scheduledTime: "Today at 4:30 PM",
  },
  {
    id: "REF-2026-084",
    date: "23 Oct 2026",
    client: "Priya Sharma",
    phone: "+91 98201 55320",
    matterType: "Commercial Contract Breach Notice",
    section: "Specific Relief Act & Indian Contract Act",
    consultationType: "Chat",
    status: "Confirmed",
    summary: "Vendor defaulted on service delivery after 70% advance payment. Seeking formal legal demand notice under 15-day cure period.",
    intakeBrief: `### CLIENT INTAKE BRIEF (TRANA AI FIRST-AID)
**Matter**: Commercial Contract Breach & Statutory Demand Notice
**Client**: Priya Sharma • Phone: +91 98201 55320 • Mumbai
**Applicable Statutes**: Section 73 Indian Contract Act, 1872 & Specific Relief Act
**Bail / Jeopardy Position**: Civil Recovery & Commercial Action

#### 1. Factual Summary (Citizen's Statement to AI)
Client contracted an enterprise software developer and paid ₹7.2 Lakhs (70% advance). Developer ceased communication after missed project milestones and has failed to deliver source code or respond to informal reminders.

#### 2. AI Statutory Assessment
• Material breach of contract established under Section 39 of the Contract Act.
• Client is entitled to damages and specific restitution under Section 73 of the Contract Act, 1872.

#### 3. Recommended Actions
• Issue formal 15-day statutory demand notice seeking cure or full refund with 18% p.a. commercial interest.
• Initiate pre-institution mediation under Commercial Courts Act if unresolved.`,
    scheduledTime: "Tomorrow at 11:00 AM",
  },
  {
    id: "REF-2026-078",
    date: "21 Oct 2026",
    client: "Vikram Mehta",
    phone: "+91 97118 90312",
    matterType: "Cyber Financial Fraud Complaint",
    section: "Section 66D IT Act & Sec 318 BNS",
    consultationType: "In-person",
    status: "In Progress",
    summary: "Unauthorized debit of ₹8.4 Lakhs via spoofed payment gateway. Seeking formal complaint to Cyber Cell and National Cyber Crime Portal.",
    scheduledTime: "26 Oct 2026, 2:00 PM at Chambers",
  },
  {
    id: "REF-2026-071",
    date: "19 Oct 2026",
    client: "Ananya Roy",
    phone: "+91 99302 78104",
    matterType: "Cheque Dishonour Notice",
    section: "Section 138 Negotiable Instruments Act",
    consultationType: "Call",
    status: "Completed",
    summary: "Cheque dishonoured with endorsement 'Funds Insufficient'. Statutory 30-day demand notice drafted and dispatched via registered post.",
  },
  {
    id: "REF-2026-065",
    date: "17 Oct 2026",
    client: "Rajesh Gupta",
    phone: "+91 98450 12099",
    matterType: "Ancestral Property Partition",
    section: "Hindu Succession Act / Partition Act",
    consultationType: "In-person",
    status: "Completed",
    summary: "Preliminary legal opinion provided on share entitlement in Delhi NCR ancestral estate. Next step: filing civil partition suit.",
  },
];

function LawyerReferralsPage() {
  const { data: lawyer } = useLawyerAuth();
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

    // Add live citizen inquiries from consultations table
    dbConsults.forEach((row, idx) => {
      const briefText = row.intake_brief || row.note || "";
      let matter = "Legal Consultation Request";
      let sectionStr = "Applicable Statutes";
      if (briefText) {
        const matterMatch = briefText.match(/\*\*Matter\*\*:\s*([^\n]+)/);
        if (matterMatch) matter = matterMatch[1].trim();
        const sectionMatch = briefText.match(/\*\*Applicable Statutes\*\*:\s*([^\n]+)/) || briefText.match(/\*\*Sections Identified\*\*:\s*([^\n]+)/);
        if (sectionMatch) sectionStr = sectionMatch[1].trim();
      }

      const clientName = row.user_id ? `Citizen (${row.user_id.slice(0, 8)})` : "Citizen Client";
      const summaryText = briefText.length > 200 ? `${briefText.slice(0, 200)}...` : (briefText || "Client requested consultation with counsel.");

      list.push({
        id: `REF-${row.id.slice(0, 8).toUpperCase()}`,
        date: row.created_at ? new Date(row.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Today",
        client: clientName,
        phone: "+91 (Verified Account)",
        matterType: matter,
        section: sectionStr,
        consultationType: row.consult_type === "chat" ? "Chat" : "Call",
        status: row.status === "completed" ? "Completed" : "New Request",
        summary: summaryText,
        intakeBrief: briefText,
        scheduledTime: row.scheduled_for ? new Date(row.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
      });
    });

    // Append benchmark matters
    initialList.forEach((r) => {
      if (!list.some((existing) => existing.id === r.id)) {
        list.push(r);
      }
    });

    return list;
  }, [dbConsults]);

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
          Active Inquiries: {mergedList.filter((r) => r.status !== "Completed").length}
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

        <div className="flex items-center gap-2">
          {(["All", "New Request", "Confirmed", "In Progress", "Completed"] as const).map((st) => (
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
        {filtered.map((r) => (
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
                        ? "border-sky-400/50 bg-sky-500/10 text-sky-300"
                        : r.status === "In Progress"
                        ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-300"
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
                  {r.id} • Registered: {r.date} • Contact: {r.phone}
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="text-[#888888]">Type:</span>
                <span className="text-white font-medium flex items-center gap-1.5">
                  {r.consultationType === "Call" && <Phone className="h-3.5 w-3.5 text-sky-400" />}
                  {r.consultationType === "Chat" && <MessageSquare className="h-3.5 w-3.5 text-purple-400" />}
                  {r.consultationType === "In-person" && <Users className="h-3.5 w-3.5 text-emerald-400" />}
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
              <span className="text-xs font-mono text-amber-300">{r.section}</span>
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
                    <span>View Client Intake Brief (AI First-Aid)</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
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
        ))}
      </div>

      {/* Client Intake Brief Modal */}
      {selectedBrief && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#1A1A1A] border border-emerald-500/40 p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between border-b border-[#2E2E2E] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-emerald-400 font-mono">
                    Client Intake Brief
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 font-mono">
                    AI First-Aid
                  </span>
                </div>
                <h3 className="mt-1 font-display text-2xl md:text-3xl font-medium text-white">
                  {selectedBrief.client}
                </h3>
                <p className="text-xs text-[#AAAAAA] mt-1 font-mono">
                  {selectedBrief.id} • Registered: {selectedBrief.date} • Mode: {selectedBrief.consultationType}
                </p>
              </div>
              <button
                onClick={() => setSelectedBrief(null)}
                className="p-1.5 border border-[#333333] text-white hover:bg-[#252525] rounded transition-colors"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1 text-sm text-[#CCCCCC]">
              <div className="bg-[#111111] border border-[#2E2E2E] p-4 rounded whitespace-pre-wrap font-sans leading-relaxed text-xs md:text-sm">
                {selectedBrief.intakeBrief}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#2E2E2E] flex flex-wrap justify-between items-center gap-3">
              <Link
                to="/lawyer/drafter"
                className="inline-flex items-center gap-2 px-4 py-2 border border-white/40 text-xs uppercase tracking-[0.1em] text-white hover:bg-white hover:text-black transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Open in AI Drafter</span>
              </Link>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedBrief.intakeBrief) {
                      navigator.clipboard.writeText(selectedBrief.intakeBrief);
                      toast.success("Client intake brief copied to clipboard");
                    }
                  }}
                  className="px-4 py-2 border border-[#333333] text-xs uppercase tracking-[0.1em] text-[#AAAAAA] hover:text-white hover:border-white transition-colors flex items-center gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Brief</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBrief(null)}
                  className="bg-white px-5 py-2 text-xs uppercase tracking-[0.1em] text-black font-semibold hover:bg-neutral-200 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
