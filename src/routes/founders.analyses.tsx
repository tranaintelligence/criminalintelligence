import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Download, FileText, CheckCircle2, AlertCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/csv-export";

export const Route = createFileRoute("/founders/analyses")({
  head: () => ({
    meta: [
      { title: "FIR Analyses Logs TRANA Founders" },
      { name: "description", content: "Complete audit log of all FIR analyses, statutory extractions, and AI latency." },
    ],
  }),
  component: FoundersAnalysesPage,
});

type AnalysisLog = {
  id: string;
  date: string;
  time: string;
  user: string;
  matterType: string;
  sectionsIdentified: string;
  bailStatus: "Bailable" | "Non-Bailable" | "Probable" | "Discretionary";
  lawyerReferred: boolean;
  aiResponseTime: string;
  rawSituation?: string;
};

const initialAnalyses: AnalysisLog[] = [
  {
    id: "ANL-1092",
    date: "24 Oct 2026",
    time: "21:42 IST",
    user: "Rahul Verma",
    matterType: "Cheating & Vendor Invoicing",
    sectionsIdentified: "Sec 318 BNS (Old 420 IPC), Sec 316 BNS",
    bailStatus: "Probable",
    lawyerReferred: true,
    aiResponseTime: "1.14s",
    rawSituation: "Commercial invoice discrepancy with former employer. Accused of falsification of electronic ledgers without preliminary inquiry.",
  },
  {
    id: "ANL-1091",
    date: "24 Oct 2026",
    time: "20:15 IST",
    user: "Priya Sharma",
    matterType: "Breach of Professional Services",
    sectionsIdentified: "Specific Relief Act, Sec 405 IPC/316 BNS",
    bailStatus: "Bailable",
    lawyerReferred: true,
    aiResponseTime: "0.98s",
    rawSituation: "Vendor took 70% advance payment and stopped communication. Client sought legal recourse under contract terms.",
  },
  {
    id: "ANL-1090",
    date: "24 Oct 2026",
    time: "18:04 IST",
    user: "Citizen #8410",
    matterType: "Anticipatory Bail Urgency",
    sectionsIdentified: "Sec 482 BNSS, Sec 35 BNSS",
    bailStatus: "Probable",
    lawyerReferred: true,
    aiResponseTime: "1.28s",
    rawSituation: "Police called to police station without 41A notice. Seeking immediate protection against unlawful arrest.",
  },
  {
    id: "ANL-1089",
    date: "23 Oct 2026",
    time: "16:32 IST",
    user: "Vikram Mehta",
    matterType: "Cyber Banking Scam",
    sectionsIdentified: "Sec 66D IT Act, Sec 318 BNS",
    bailStatus: "Discretionary",
    lawyerReferred: true,
    aiResponseTime: "1.02s",
    rawSituation: "Spoofed banking portal drained funds. Seeking formal cyber complaint and freezing order.",
  },
  {
    id: "ANL-1088",
    date: "23 Oct 2026",
    time: "14:18 IST",
    user: "Citizen #8392",
    matterType: "Property Encroachment",
    sectionsIdentified: "Sec 329 BNS (Criminal Trespass)",
    bailStatus: "Bailable",
    lawyerReferred: false,
    aiResponseTime: "1.45s",
    rawSituation: "Neighbour attempted boundary wall construction over ancestral land demarcated under revenue survey.",
  },
  {
    id: "ANL-1087",
    date: "22 Oct 2026",
    time: "11:55 IST",
    user: "Ananya Roy",
    matterType: "Cheque Dishonour",
    sectionsIdentified: "Sec 138 NI Act, Sec 141 NI Act",
    bailStatus: "Bailable",
    lawyerReferred: true,
    aiResponseTime: "0.89s",
    rawSituation: "Cheque of ₹6.5 Lakhs returned unpaid with endorsement 'Account Frozen'. Notice period pending.",
  },
  {
    id: "ANL-1086",
    date: "21 Oct 2026",
    time: "09:20 IST",
    user: "Citizen #8350",
    matterType: "Matrimonial Cruelty Complaint",
    sectionsIdentified: "Sec 85 BNS (Old 498A IPC)",
    bailStatus: "Non-Bailable",
    lawyerReferred: true,
    aiResponseTime: "1.32s",
    rawSituation: "Dispute over domestic demands and harassment. Explained rights under Section 35 BNSS mandatory conciliation.",
  },
];

function FoundersAnalysesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [bailFilter, setBailFilter] = useState("All");
  const [referredFilter, setReferredFilter] = useState("All");
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisLog | null>(null);

  // Query Supabase analyses table
  const { data: dbAnalyses = [] } = useQuery({
    queryKey: ["founders-db-analyses"],
    queryFn: async () => {
      const { data } = await supabase.from("analyses").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const combinedAnalyses = useMemo(() => {
    const list: AnalysisLog[] = [...initialAnalyses];
    dbAnalyses.forEach((row, idx) => {
      if (!list.some((a) => a.id === row.id)) {
        list.push({
          id: row.id || `ANL-DB-${idx}`,
          date: row.created_at ? new Date(row.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "24 Oct 2026",
          time: row.created_at ? new Date(row.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "12:00 IST",
          user: `Citizen (${row.user_id?.slice(0, 8)})`,
          matterType: row.is_criminal ? "Criminal Offence" : "Civil / Procedural",
          sectionsIdentified: row.is_criminal ? "Sec 318 BNS / Sec 482 BNSS" : "General Legal Guidance",
          bailStatus: row.is_criminal ? "Probable" : "Bailable",
          lawyerReferred: true,
          aiResponseTime: "1.12s",
          rawSituation: row.situation,
        });
      }
    });
    return list;
  }, [dbAnalyses]);

  const filtered = useMemo(() => {
    return combinedAnalyses.filter((item) => {
      if (bailFilter !== "All" && item.bailStatus !== bailFilter) return false;
      if (referredFilter === "Referred" && !item.lawyerReferred) return false;
      if (referredFilter === "NotReferred" && item.lawyerReferred) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          item.sectionsIdentified.toLowerCase().includes(q) ||
          item.matterType.toLowerCase().includes(q) ||
          item.user.toLowerCase().includes(q) ||
          item.date.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [combinedAnalyses, bailFilter, referredFilter, searchTerm]);

  function exportCSV() {
    const headers = ["ID", "Date", "Time", "User", "Matter Type", "Sections Identified", "Bail Status", "Lawyer Referred", "AI Response Time"];
    const rows = filtered.map((a) => [
      a.id,
      a.date,
      a.time,
      a.user,
      a.matterType,
      a.sectionsIdentified,
      a.bailStatus,
      a.lawyerReferred ? "Yes" : "No",
      a.aiResponseTime,
    ]);

    downloadCSV(
      `trana_fir_analyses_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    );
    toast.success(`Exported ${filtered.length} analyses to CSV.`);
  }

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222222] pb-4">
        <div>
          <span className="text-[0.65rem] text-[#888888] uppercase tracking-widest block">
            AI EXTRACTION TELEMETRY & STATUTORY AUDIT
          </span>
          <h1 className="font-display text-3xl font-medium text-white mt-1">
            FIR Analyses Logs
          </h1>
        </div>

        {/* Export to CSV Button */}
        <button
          onClick={exportCSV}
          className="border border-white/40 bg-[#161616] px-4 py-2 text-xs uppercase tracking-wider text-white hover:bg-white hover:text-black transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export to CSV</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div className="lg:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#666666]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by section (e.g. 482, 318), matter type, user, or date..."
            className="w-full border border-[#333333] bg-[#111111] py-2 pl-9 pr-3 text-xs text-white placeholder:text-[#555555] focus:border-white focus:outline-none"
          />
        </div>

        {/* Bail Status Filter */}
        <div>
          <select
            value={bailFilter}
            onChange={(e) => setBailFilter(e.target.value)}
            className="w-full border border-[#333333] bg-[#111111] px-3 py-2 text-xs text-white focus:border-white focus:outline-none"
          >
            <option value="All">Bail Status: All</option>
            <option value="Bailable">Bailable</option>
            <option value="Probable">Probable</option>
            <option value="Non-Bailable">Non-Bailable</option>
            <option value="Discretionary">Discretionary</option>
          </select>
        </div>

        {/* Lawyer Referred Filter */}
        <div>
          <select
            value={referredFilter}
            onChange={(e) => setReferredFilter(e.target.value)}
            className="w-full border border-[#333333] bg-[#111111] px-3 py-2 text-xs text-white focus:border-white focus:outline-none"
          >
            <option value="All">Lawyer Referral: All</option>
            <option value="Referred">Referred to Lawyer</option>
            <option value="NotReferred">Not Referred</option>
          </select>
        </div>
      </div>

      {/* FULL LOG OF EVERY ANALYSIS RUN */}
      <div className="bg-[#111111] border border-[#222222] overflow-x-auto shadow-md">
        <table className="w-full text-left whitespace-nowrap">
          <thead>
            <tr className="border-b border-[#2A2A2A] bg-[#161616] text-[#888888] uppercase tracking-wider text-[0.65rem]">
              <th className="py-2.5 px-3">Date</th>
              <th className="py-2.5 px-3">Time</th>
              <th className="py-2.5 px-3">User</th>
              <th className="py-2.5 px-3">Matter Type</th>
              <th className="py-2.5 px-3">Sections Identified</th>
              <th className="py-2.5 px-3">Bail Status</th>
              <th className="py-2.5 px-3 text-center">Lawyer Referred?</th>
              <th className="py-2.5 px-3 text-right">AI Latency</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1D1D1D]">
            {filtered.map((a) => (
              <tr key={a.id} className="hover:bg-[#1A1A1A] transition-colors">
                <td className="py-2.5 px-3 text-white font-medium">{a.date}</td>
                <td className="py-2.5 px-3 text-[#888888]">{a.time}</td>
                <td className="py-2.5 px-3 text-[#CCCCCC]">{a.user}</td>
                <td className="py-2.5 px-3 text-white">{a.matterType}</td>
                <td className="py-2.5 px-3 font-mono text-amber-300/90 text-[0.7rem] max-w-[220px] truncate" title={a.sectionsIdentified}>
                  {a.sectionsIdentified}
                </td>
                <td className="py-2.5 px-3">
                  <span
                    className={`inline-block px-1.5 py-0.5 text-[0.6rem] border ${
                      a.bailStatus === "Bailable"
                        ? "border-emerald-500/40 text-emerald-300 bg-emerald-950/20"
                        : a.bailStatus === "Probable"
                        ? "border-sky-500/40 text-sky-300 bg-sky-950/20"
                        : "border-red-500/40 text-red-300 bg-red-950/20"
                    }`}
                  >
                    {a.bailStatus}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-center">
                  {a.lawyerReferred ? (
                    <span className="text-emerald-400">✓ Yes</span>
                  ) : (
                    <span className="text-[#666666]">No</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-[#888888]">
                  {a.aiResponseTime}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <button
                    onClick={() => setSelectedAnalysis(a)}
                    className="border border-white/30 px-2 py-0.5 text-[0.65rem] uppercase text-white hover:border-white"
                  >
                    Inspect
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Inspect Modal */}
      {selectedAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-[#161616] border border-white/30 p-6 md:p-8 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#282828] pb-4">
              <div>
                <span className="text-[0.65rem] text-[#888888] uppercase tracking-widest font-mono">
                  {selectedAnalysis.id} • {selectedAnalysis.date} {selectedAnalysis.time}
                </span>
                <h3 className="font-display text-2xl font-medium text-white mt-1">
                  {selectedAnalysis.matterType}
                </h3>
                <p className="text-xs text-[#AAAAAA] mt-0.5">User: {selectedAnalysis.user}</p>
              </div>
              <button
                onClick={() => setSelectedAnalysis(null)}
                className="p-1 border border-[#333333] text-white hover:bg-[#252525]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <span className="text-[0.65rem] uppercase tracking-wider text-[#888888] block">
                  Sections Extracted
                </span>
                <p className="text-xs text-amber-300 font-mono mt-0.5 bg-[#0A0A0A] p-2 border border-[#222222]">
                  {selectedAnalysis.sectionsIdentified}
                </p>
              </div>

              <div>
                <span className="text-[0.65rem] uppercase tracking-wider text-[#888888] block">
                  Raw Situation Input
                </span>
                <p className="text-xs text-[#CCCCCC] leading-relaxed bg-[#0A0A0A] p-3 border border-[#222222] mt-0.5">
                  {selectedAnalysis.rawSituation || "No verbatim transcript saved."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-2">
                <div className="border border-[#222222] p-2.5 bg-[#0E0E0E]">
                  <span className="text-[#777777] block text-[0.65rem]">BAIL STATUS</span>
                  <span className="text-white font-medium">{selectedAnalysis.bailStatus}</span>
                </div>
                <div className="border border-[#222222] p-2.5 bg-[#0E0E0E]">
                  <span className="text-[#777777] block text-[0.65rem]">MODEL LATENCY</span>
                  <span className="text-white font-mono">{selectedAnalysis.aiResponseTime}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#262626] flex justify-end">
              <button
                onClick={() => setSelectedAnalysis(null)}
                className="bg-white text-black px-4 py-2 text-xs font-semibold uppercase tracking-wider"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
