import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PhoneCall, Search, Download, CheckCircle2, Clock, MessageSquare, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/csv-export";

export const Route = createFileRoute("/founders/consultations")({
  head: () => ({
    meta: [
      { title: "Founders Dashboard — TRANA" },
      { name: "description", content: "Audit log of all client-advocate consultations, call routing, and follow-up tracking." },
      { property: "og:title", content: "Founders Dashboard — TRANA" },
    ],
  }),
  component: FoundersConsultationsPage,
});

type ConsultationLog = {
  id: string;
  date: string;
  client: string;
  lawyer: string;
  consultationType: "Call" | "Chat" | "In-person" | "Peer";
  status: "Completed" | "Scheduled" | "Requested" | "Cancelled" | "Confirmed";
  duration: string;
  followUpNeeded: boolean;
};

function FoundersConsultationsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Query Supabase consultations table
  const { data: dbConsults = [], refetch } = useQuery({
    queryKey: ["founders-db-consultations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("consultations").select("*").order("created_at", { ascending: false });
      if (error) {
        console.warn("Founders consultations fetch error:", error);
        return [];
      }
      return data || [];
    },
    refetchInterval: 15000,
  });

  const combinedConsults = useMemo(() => {
    const list: ConsultationLog[] = [];

    // 1. Process Database records
    (dbConsults || []).forEach((row, idx) => {
      const briefText = row.intake_brief || "";
      const isPeer = row.consult_type === "peer" || briefText.includes("Peer Legal Collaboration") || briefText.includes("Client Referral from Advocate") || String(row.id).startsWith("PEER-");

      let clientLabel = `Citizen (${row.user_id?.slice(0, 8) || "Client"})`;
      if (isPeer) {
        if (briefText.includes("Client Referral from Advocate")) {
          const refClient = briefText.match(/\*\*Client Name \/ Matter\*\*:\s*([^\n]+)/);
          const refAdv = briefText.match(/\*\*Referring Advocate\*\*:\s*([^(•\n]+)/);
          clientLabel = refClient ? `${refClient[1].trim()} (Ref by ${refAdv ? refAdv[1].trim() : "Advocate"})` : "Client Referral";
        } else if (briefText.includes("Peer Legal Collaboration")) {
          const initMatch = briefText.match(/\*\*Initiating Advocate\*\*:\s*([^(•\n]+)/);
          clientLabel = initMatch ? initMatch[1].trim() : "Advocate Colleague";
        } else {
          clientLabel = "Advocate Colleague";
        }
      } else if (briefText) {
        const clientMatch = briefText.match(/\*\*Client\*\*:\s*([^(•\n]+)/);
        if (clientMatch && clientMatch[1].trim() && clientMatch[1].trim() !== "Citizen Client") {
          clientLabel = clientMatch[1].trim();
        }
      }

      const stLower = (row.status || "").toLowerCase();
      const statusLabel =
        stLower === "completed"
          ? "Completed"
          : stLower === "confirmed"
          ? "Confirmed"
          : stLower === "requested"
          ? "Requested"
          : stLower === "denied"
          ? "Cancelled"
          : "Scheduled";

      list.push({
        id: row.id || `CS-DB-${idx}`,
        date: row.created_at ? new Date(row.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Today",
        client: clientLabel,
        lawyer: row.lawyer_name || "Assigned Advocate",
        consultationType: isPeer ? "Peer" : row.consult_type === "chat" ? "Chat" : row.consult_type === "in-person" ? "In-person" : "Call",
        status: statusLabel,
        duration: row.status === "completed" ? "Completed" : "Active Relay",
        followUpNeeded: row.status === "requested",
      });
    });

    // 2. Browser local fallback merge for active local referral/peer chats
    if (typeof window !== "undefined") {
      try {
        const chatIndex = JSON.parse(localStorage.getItem("trana_all_consultation_chats_index") || "{}");
        Object.values(chatIndex || {}).forEach((item: any) => {
          if (!item || !item.consultationId) return;
          const cId = item.consultationId;
          if (list.some((existing) => existing.id === cId)) return;

          const isPeer = item.consultationType === "Peer" || String(cId).startsWith("PEER-");
          list.push({
            id: cId,
            date: item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Today",
            client: item.clientName || (isPeer ? "Advocate Colleague" : "Citizen"),
            lawyer: item.lawyerName || "Assigned Advocate",
            consultationType: isPeer ? "Peer" : item.consultationType === "Call" ? "Call" : "Chat",
            status: item.status === "Confirmed" ? "Confirmed" : "Scheduled",
            duration: "Active Relay",
            followUpNeeded: false,
          });
        });
      } catch {}
    }

    return list;
  }, [dbConsults]);

  const filtered = useMemo(() => {
    return combinedConsults.filter((item) => {
      if (typeFilter !== "All" && item.consultationType !== typeFilter) return false;
      if (statusFilter !== "All" && item.status !== statusFilter) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          item.client.toLowerCase().includes(q) ||
          item.lawyer.toLowerCase().includes(q) ||
          item.date.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [combinedConsults, typeFilter, statusFilter, searchTerm]);

  function exportCSV() {
    const headers = ["ID", "Date", "Client", "Lawyer", "Type", "Status", "Duration", "Follow-up Needed"];
    const rows = filtered.map((c) => [
      c.id,
      c.date,
      c.client,
      c.lawyer,
      c.consultationType,
      c.status,
      c.duration,
      c.followUpNeeded ? "Yes" : "No",
    ]);

    downloadCSV(`trana_consultations_export_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    toast.success(`Exported ${filtered.length} consultation records to CSV.`);
  }

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222222] pb-4">
        <div>
          <span className="text-[0.65rem] text-[#888888] uppercase tracking-widest block">
            TELEPHONY & CLIENT APPOINTMENTS
          </span>
          <h1 className="font-display text-3xl font-medium text-white mt-1">
            Consultations Log
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

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#666666]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by client, lawyer, or date..."
            className="w-full border border-[#333333] bg-[#111111] py-2 pl-9 pr-3 text-xs text-white placeholder:text-[#555555] focus:border-white focus:outline-none"
          />
        </div>

        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full border border-[#333333] bg-[#111111] px-3 py-2 text-xs text-white focus:border-white focus:outline-none"
          >
            <option value="All">Type: All Channels</option>
            <option value="Call">Call</option>
            <option value="Chat">Chat</option>
            <option value="Peer">Peer Collaboration</option>
            <option value="In-person">In-person</option>
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full border border-[#333333] bg-[#111111] px-3 py-2 text-xs text-white focus:border-white focus:outline-none"
          >
            <option value="All">Status: All</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Completed">Completed</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Requested">Requested</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* FULL LOG TABLE */}
      <div className="bg-[#111111] border border-[#222222] overflow-x-auto shadow-md">
        <table className="w-full text-left whitespace-nowrap">
          <thead>
            <tr className="border-b border-[#2A2A2A] bg-[#161616] text-[#888888] uppercase tracking-wider text-[0.65rem]">
              <th className="py-2.5 px-3">Date</th>
              <th className="py-2.5 px-3">Client / Initiator</th>
              <th className="py-2.5 px-3">Lawyer / Recipient</th>
              <th className="py-2.5 px-3">Consultation Type</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Duration</th>
              <th className="py-2.5 px-3 text-right">Follow-up Needed?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1D1D1D]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[#777777] font-mono">
                  No consultation records recorded in database.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-[#1A1A1A] transition-colors">
                  <td className="py-2.5 px-3 text-white font-medium">{c.date}</td>
                  <td className="py-2.5 px-3 text-[#CCCCCC]">{c.client}</td>
                  <td className="py-2.5 px-3 text-white font-medium">{c.lawyer}</td>
                  <td className="py-2.5 px-3 text-[#AAAAAA]">
                    <div className="inline-flex items-center gap-1.5">
                      {c.consultationType === "Call" && <PhoneCall className="h-3 w-3 text-sky-400" />}
                      {c.consultationType === "Chat" && <MessageSquare className="h-3 w-3 text-purple-400" />}
                      {c.consultationType === "Peer" && <Users className="h-3 w-3 text-sky-400" />}
                      {c.consultationType === "In-person" && <Users className="h-3 w-3 text-emerald-400" />}
                      <span>{c.consultationType === "Peer" ? "Peer Collaboration" : c.consultationType}</span>
                    </div>
                  </td>
                <td className="py-2.5 px-3">
                  <span
                    className={`inline-block px-2 py-0.5 text-[0.65rem] border ${
                      c.status === "Completed"
                        ? "border-emerald-500/40 text-emerald-400 bg-emerald-950/20"
                        : c.status === "Scheduled"
                        ? "border-sky-500/40 text-sky-300 bg-sky-950/20"
                        : c.status === "Requested"
                        ? "border-amber-500/40 text-amber-300 bg-amber-950/20"
                        : "border-red-500/40 text-red-400 bg-red-950/20"
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-[#888888] font-mono">{c.duration}</td>
                <td className="py-2.5 px-3 text-right font-mono">
                  {c.followUpNeeded ? (
                    <span className="text-amber-400 bg-amber-950/20 px-2 py-0.5 border border-amber-500/30">
                      Action Required
                    </span>
                  ) : (
                    <span className="text-[#666666]">None</span>
                  )}
                </td>
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
