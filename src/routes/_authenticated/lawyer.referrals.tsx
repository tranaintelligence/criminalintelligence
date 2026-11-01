import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Briefcase, Search, Phone, MessageSquare, 
  ChevronRight, Calendar, Filter, Sparkles, CheckCircle2,
  FileText, Copy, X, XCircle, ShieldAlert
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
    intakeBrief: `CASE SUMMARY (TRANA LEGAL INTELLIGENCE)
Matter: Anticipatory Bail Application — Pre-Arrest Protection
Client: Rahul Verma • Verified Account (Managing Director, Logistics Enterprise)
Target Counsel: Advocate Counsel
Date: 24 Oct 2026
Mode: Telephonic Consultation Relay
Applicable Statutes: Section 482 Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS) & Section 318 Bharatiya Nyaya Sanhita, 2023 (BNS)
Bail / Custody Outlook: Non-Bailable Cognizable Allegation; Urgent pre-arrest protective orders required prior to police custody.

1. Factual Matrix & Procedural Background
Client Rahul Verma is the Managing Director of a registered logistics corporation operating in the National Capital Region. A commercial trade supplier has filed a criminal complaint at the local police station alleging cheating and criminal breach of trust regarding invoices totaling ₹18.5 Lakhs. The dispute strictly concerns damaged transit consignments and ongoing contractual quality reconciliation. There was zero fraudulent inducement at the inception of the commercial contract. The Investigating Officer has issued verbal summons and threatened imminent arrest without issuing statutory Section 35(3) BNSS notice.

2. Statutory Provisions & Offence Breakdown
• Section 318 BNS (Cheating): The sine qua non of cheating requires dishonest intention existing at the very inception of the transaction. The Supreme Court of India in landmark precedents (Hridaya Ranjan Prasad Verma v. State of Bihar and Dalip Kaur v. Jagnar Singh) has definitively ruled that a mere failure to keep a promise, breach of contract, or delay in settlement does not constitute criminal cheating.
• Section 316 BNS (Criminal Breach of Trust): Commercial credit disputes do not satisfy entrustment of dominion over property in a fiduciary capacity.
• Apprehension of Arrest: The informal threats by the IO satisfy the jurisdictional threshold of reasonable belief of imminent arrest required under Section 482 BNSS.

3. Custodial Assessment & Bail Jurisprudence
• Custodial interrogation is legally uncalled for as the transaction is thoroughly documented through GST invoices, bilties, e-way bills, and bank transfers.
• Landmark Supreme Court guidelines in Satender Kumar Antil v. CBI and Arnesh Kumar v. State of Bihar mandate that police officers must not routinely effect arrests in disputes of a commercial nature or offences punishable with imprisonment of seven years or less.
• Client has clean antecedent records, deep roots in society, and zero flight risk.

4. Constitutional & Procedural Safeguards
• Section 35(3) BNSS mandates issuance of formal notice of appearance in all cases where arrest is not immediately necessary.
• Article 20(3) and 21 of the Constitution protect the client against coerced confessions and deprivation of personal liberty without procedure established by law.
• Section 41D / Section 37 BNSS guarantees right of accused to consult counsel during interrogation.

5. Strategic Legal Action Plan
• File urgent Anticipatory Bail Application under Section 482 BNSS before the Principal District & Sessions Judge.
• Annex all purchase orders, inspection rejection notes, and WhatsApp/Email reconciliation exchanges demonstrating bona fide civil dispute.
• Seek ad-interim protection against coercive police action pending formal notice to the Public Prosecutor.
• Submit formal representation to the Deputy Commissioner of Police highlighting civil nature of the transaction.`,
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
    intakeBrief: `CASE SUMMARY (TRANA LEGAL INTELLIGENCE)
Matter: Commercial Software Breach & Statutory Restitution Notice
Client: Priya Sharma • Mumbai (Enterprise Commercial Principal)
Target Counsel: Advocate Counsel
Date: 23 Oct 2026
Mode: Secure In-App Chat
Applicable Statutes: Sections 39, 73 & 74 Indian Contract Act, 1872; Section 12A Commercial Courts Act, 2015
Bail / Custody Outlook: Civil Commercial Proceeding; Zero custodial risk.

1. Factual Matrix & Background
Client contracted a commercial software enterprise developer under a Master Services Agreement (MSA) for proprietary logistics management software, paying ₹7.2 Lakhs as an advance deposit (70% of total contract value). The vendor missed multiple milestone deadlines, failed to deploy beta builds, refused access to the source code repository, and abruptly ceased communication after receipt of informal default notices.

2. Statutory Assessment & Legal Framework
• Section 39 Contract Act: Vendor's refusal or disabling of performance constitutes repudiatory breach, entitling client to terminate and claim restitution.
• Section 73 Contract Act: Entitlement to compensation for direct loss naturally arising in the usual course of things from the breach.
• Section 74 Contract Act: Enforcement of pre-estimated liquidated damages stipulated under Clause 14 of the executed MSA.

3. Strategic Legal Action Plan
• Issue formal 15-day statutory legal notice demanding immediate refund of ₹7.2 Lakhs along with 18% p.a. commercial interest and compensation for business disruption.
• Initiate pre-institution mediation proceedings under Section 12A of the Commercial Courts Act, 2015 before the District Legal Services Authority (DLSA).
• Preserve all timestamped git commits, Slack communications, and bank transfer receipts for commercial suit filing upon non-compliance.`,
    scheduledTime: "Tomorrow at 11:00 AM",
  },
  {
    id: "REF-2026-078",
    date: "21 Oct 2026",
    client: "Vikram Mehta",
    phone: "+91 97118 90312",
    matterType: "Cyber Financial Fraud Complaint",
    section: "Section 66D IT Act & Sec 318 BNS",
    consultationType: "Call",
    status: "In Progress",
    summary: "Unauthorized debit of ₹8.4 Lakhs via spoofed payment gateway. Seeking formal complaint to Cyber Cell and National Cyber Crime Portal.",
    intakeBrief: `CASE SUMMARY (TRANA LEGAL INTELLIGENCE)
Matter: Cyber Financial Fraud & Unauthorized Payment Gateway Interception
Client: Vikram Mehta • New Delhi
Target Counsel: Advocate Counsel
Date: 21 Oct 2026
Mode: Telephonic Consultation Relay
Applicable Statutes: Section 66D Information Technology Act, 2000; Section 318 & 319 Bharatiya Nyaya Sanhita, 2023
Bail / Custody Outlook: Complainant Victim Representation; Criminal prosecution against cyber fraudsters.

1. Factual Matrix & Background
Client suffered an unauthorized debit of ₹8.4 Lakhs through a fraudulent payment gateway spoofing an official merchant terminal. The fraudulent diversion occurred via multi-hop UPI transfers to intermediary mule accounts within a 15-minute window.

2. Statutory Assessment & Offence Breakdown
• Section 66D IT Act: Cheating by personation by using computer resource (punishable up to 3 years imprisonment).
• Section 318(4) BNS: Cheating and dishonestly inducing delivery of property.
• Reserve Bank of India Master Circular on Customer Protection: Limits customer liability to zero when fraud is reported within 3 days of occurrence in third-party breaches.

3. Strategic Legal Action Plan
• File formal complaint on the National Cyber Crime Reporting Portal (1930) to freeze recipient beneficiary mule accounts.
• Submit statutory representation to the nodal grievance officer of the beneficiary bank and nodal cyber cell.
• Move application under Section 497 BNSS before the jurisdictional Magistrate for defreezing and restitution of seized funds.`,
    scheduledTime: "26 Oct 2026, 2:00 PM",
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
    intakeBrief: `CASE SUMMARY (TRANA LEGAL INTELLIGENCE)
Matter: Cheque Dishonour Statutory Notice & Criminal Complaint
Client: Ananya Roy • Mumbai
Target Counsel: Advocate Counsel
Date: 19 Oct 2026
Mode: Telephonic Consultation Relay
Applicable Statutes: Section 138, 141 & 142 Negotiable Instruments Act, 1881; Section 223 BNSS
Bail / Custody Outlook: Complainant Representation; Bailable statutory offence.

1. Factual Matrix & Background
Client received a cheque bearing No. 491028 for ₹12.5 Lakhs drawn on HDFC Bank against repayment of friendly loan/commercial supply. Cheque returned dishonoured with bank return memo stating "Funds Insufficient". Return memo received on 15 Oct 2026.

2. Statutory Assessment & Legal Ingredients
• Cheque drawn for discharge, in whole or in part, of a legally enforceable debt or other liability.
• Presentation within statutory validity period (3 months).
• Receipt of bank dishonour memo triggers 30-day statutory window to issue demand notice under Section 138(b) NI Act.

3. Strategic Legal Action Plan
• Issue statutory demand notice under Section 138 NI Act within 30 days of receiving the return memo via speed post and email.
• Give drawee 15 days from notice receipt to pay the amount.
• If payment not made within 15 days, file formal criminal complaint under Section 142 NI Act before the Judicial Magistrate within 30 days thereafter.`,
  },
  {
    id: "REF-2026-065",
    date: "17 Oct 2026",
    client: "Rajesh Gupta",
    phone: "+91 98450 12099",
    matterType: "Ancestral Property Partition",
    section: "Hindu Succession Act / Partition Act",
    consultationType: "Chat",
    status: "Completed",
    summary: "Preliminary legal opinion provided on share entitlement in Delhi NCR ancestral estate. Next step: filing civil partition suit.",
  },
];

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
    dbConsults.forEach((row, idx) => {
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

    // 3. Append benchmark matters
    initialList.forEach((r) => {
      if (!list.some((existing) => existing.id === r.id)) {
        list.push(r);
      }
    });

    return list;
  }, [dbConsults]);

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
                      <span>Case Inbox</span>
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
        ))}
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
