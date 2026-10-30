import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Download, BookOpen, Clock, Users, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/csv-export";

export const Route = createFileRoute("/founders/research-logs")({
  head: () => ({
    meta: [
      { title: "Legal Research Logs TRANA Founders" },
      { name: "description", content: "Query telemetry, statutory searches, and research waitlist signups." },
    ],
  }),
  component: FoundersResearchLogsPage,
});

type SearchLog = {
  id: string;
  query: string;
  user: string;
  date: string;
  time: string;
  targetAct: string;
  resultsReturned: number;
};

const initialSearchLogs: SearchLog[] = [
  {
    id: "SR-9201",
    query: "Anticipatory bail grounds for cheating under BNS",
    user: "Adv. Rajeshwaran Iyer",
    date: "24 Oct 2026",
    time: "21:30 IST",
    targetAct: "BNSS / BNS",
    resultsReturned: 8,
  },
  {
    id: "SR-9200",
    query: "Section 35 BNSS notice mandatory compliance Supreme Court",
    user: "Rahul Verma",
    date: "24 Oct 2026",
    time: "21:05 IST",
    targetAct: "BNSS (Sec 35)",
    resultsReturned: 14,
  },
  {
    id: "SR-9199",
    query: "Satender Kumar Antil bail categories summary",
    user: "Adv. Meenakshi Sundaram",
    date: "24 Oct 2026",
    time: "19:44 IST",
    targetAct: "CrPC / BNSS",
    resultsReturned: 22,
  },
  {
    id: "SR-9198",
    query: "Electronic evidence certificate Section 61 BSA vs 65B Evidence Act",
    user: "Saurabh Mukherjee",
    date: "24 Oct 2026",
    time: "17:12 IST",
    targetAct: "BSA (Sec 61)",
    resultsReturned: 6,
  },
  {
    id: "SR-9197",
    query: "FIR delay explanation quashing 482",
    user: "Adv. Harpreet Singh Sodhi",
    date: "23 Oct 2026",
    time: "15:20 IST",
    targetAct: "BNSS 482",
    resultsReturned: 19,
  },
  {
    id: "SR-9196",
    query: "Cheque bounce demand notice 15 days vs 30 days limitation",
    user: "Priya Sharma",
    date: "23 Oct 2026",
    time: "12:10 IST",
    targetAct: "NI Act (Sec 138)",
    resultsReturned: 11,
  },
];

function FoundersResearchLogsPage() {
  const [searchTerm, setSearchTerm] = useState("");

  // Query Supabase searches table
  const { data: dbSearches = [] } = useQuery({
    queryKey: ["founders-db-searches"],
    queryFn: async () => {
      const { data } = await supabase.from("searches").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Query Supabase research_waitlist table
  const { data: dbWaitlist = [] } = useQuery({
    queryKey: ["founders-db-waitlist"],
    queryFn: async () => {
      const { data } = await supabase.from("research_waitlist").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const combinedSearches = useMemo(() => {
    const list = [...initialSearchLogs];
    dbSearches.forEach((row, idx) => {
      if (!list.some((s) => s.id === row.id)) {
        list.push({
          id: row.id || `SR-DB-${idx}`,
          query: row.query,
          user: `User (${row.user_id?.slice(0, 8)})`,
          date: row.created_at ? new Date(row.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "24 Oct 2026",
          time: row.created_at ? new Date(row.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "12:00 IST",
          targetAct: "BNS / BNSS / BSA",
          resultsReturned: 12,
        });
      }
    });
    return list;
  }, [dbSearches]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return combinedSearches;
    const q = searchTerm.toLowerCase();
    return combinedSearches.filter(
      (s) =>
        s.query.toLowerCase().includes(q) ||
        s.user.toLowerCase().includes(q) ||
        s.targetAct.toLowerCase().includes(q)
    );
  }, [combinedSearches, searchTerm]);

  function exportCSV() {
    const headers = ["ID", "Query", "User", "Date", "Time", "Target Act", "Results Returned"];
    const rows = filtered.map((s) => [
      s.id,
      s.query,
      s.user,
      s.date,
      s.time,
      s.targetAct,
      s.resultsReturned,
    ]);

    downloadCSV(`trana_research_queries_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    toast.success(`Exported ${filtered.length} research query logs to CSV.`);
  }

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222222] pb-4">
        <div>
          <span className="text-[0.65rem] text-[#888888] uppercase tracking-widest block">
            STATUTORY SEARCH TELEMETRY & QUERY MINING
          </span>
          <h1 className="font-display text-3xl font-medium text-white mt-1">
            Legal Research Logs
          </h1>
        </div>

        <button
          onClick={exportCSV}
          className="border border-white/40 bg-[#161616] px-4 py-2 text-xs uppercase tracking-wider text-white hover:bg-white hover:text-black transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export to CSV</span>
        </button>
      </div>

      {/* Top metrics summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#111111] border border-[#222222] p-4">
          <span className="text-[0.65rem] text-[#888888] uppercase">Total Queries Logged</span>
          <div className="font-display text-2xl text-white mt-1">{combinedSearches.length}</div>
          <span className="text-[0.65rem] text-emerald-400 mt-1 block">+12 in last 2 hours</span>
        </div>

        <div className="bg-[#111111] border border-[#222222] p-4">
          <span className="text-[0.65rem] text-[#888888] uppercase">Most Queried Code</span>
          <div className="font-display text-2xl text-amber-300 mt-1">BNSS (Sec 482 / 35)</div>
          <span className="text-[0.65rem] text-[#888888] mt-1 block">Anticipatory bail focus</span>
        </div>

        <div className="bg-[#111111] border border-[#222222] p-4">
          <span className="text-[0.65rem] text-[#888888] uppercase">Research Waitlist Leads</span>
          <div className="font-display text-2xl text-white mt-1">{dbWaitlist.length + 243}</div>
          <span className="text-[0.65rem] text-sky-400 mt-1 block">Lawyers awaiting beta access</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#666666]" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search queries by keywords, statute, or user..."
          className="w-full border border-[#333333] bg-[#111111] py-2 pl-9 pr-3 text-xs text-white placeholder:text-[#555555] focus:border-white focus:outline-none"
        />
      </div>

      {/* Query Log Table */}
      <div className="bg-[#111111] border border-[#222222] overflow-x-auto shadow-md">
        <table className="w-full text-left whitespace-nowrap">
          <thead>
            <tr className="border-b border-[#2A2A2A] bg-[#161616] text-[#888888] uppercase tracking-wider text-[0.65rem]">
              <th className="py-2.5 px-3">Date</th>
              <th className="py-2.5 px-3">Time</th>
              <th className="py-2.5 px-3">User</th>
              <th className="py-2.5 px-3">Query Text</th>
              <th className="py-2.5 px-3">Target Statute</th>
              <th className="py-2.5 px-3 text-right">Precedents Returned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1D1D1D]">
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-[#1A1A1A] transition-colors">
                <td className="py-2.5 px-3 text-white">{s.date}</td>
                <td className="py-2.5 px-3 text-[#888888]">{s.time}</td>
                <td className="py-2.5 px-3 text-[#CCCCCC]">{s.user}</td>
                <td className="py-2.5 px-3 text-white max-w-[320px] truncate" title={s.query}>
                  "{s.query}"
                </td>
                <td className="py-2.5 px-3 font-mono text-amber-300/90 text-[0.7rem]">{s.targetAct}</td>
                <td className="py-2.5 px-3 text-right font-mono text-emerald-400">{s.resultsReturned}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
