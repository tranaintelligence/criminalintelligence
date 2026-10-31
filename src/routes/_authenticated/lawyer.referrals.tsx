import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { 
  Briefcase, Search, Phone, MessageSquare, Users, 
  ChevronRight, Calendar, Filter, Sparkles, CheckCircle2 
} from "lucide-react";
import { toast } from "sonner";

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
  const [list, setList] = useState<Referral[]>(initialList);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = list.filter((r) => {
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
            Direct inquiries and matter briefs from clients seeking representation in your jurisdictions.
          </p>
        </div>

        <div className="border border-white/20 bg-[#1A1A1A] px-4 py-2 text-xs font-mono text-white">
          Active Inquiries: {list.filter((r) => r.status !== "Completed").length}
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
                </div>
                <div className="mt-1 text-xs text-[#888888] font-mono">
                  {r.id} • Registered: {r.date} • Phone: {r.phone}
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

            <div className="flex justify-end gap-3 pt-2">
              <Link
                to="/lawyer/drafter"
                className="border border-white/30 px-3 py-1.5 text-xs uppercase tracking-[0.1em] text-white hover:border-white transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="h-3 w-3" />
                <span>Open in AI Drafter</span>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
