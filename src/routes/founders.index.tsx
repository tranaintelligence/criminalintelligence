import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Scale, FileText, PhoneCall, RefreshCw, MessageSquare, MessagesSquare, Shield, ArrowUpRight, CheckSquare, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTranaCredential } from "@/lib/trana-auth";
import { getAdminOverviewStats } from "@/lib/trana-admin-api";

export const Route = createFileRoute("/founders/")({
  head: () => ({
    meta: [
      { title: "Founders Overview TRANA" },
      { name: "description", content: "Executive operational overview and key platform metrics for TRANA." },
    ],
  }),
  component: FoundersOverview,
});

function FoundersOverview() {
  const [lastRefreshed, setLastRefreshed] = useState<string>("Just now");
  const [disclaimerSearch, setDisclaimerSearch] = useState<string>("");
  const { credential } = useTranaCredential();

  // Query users who checked the advocate notice disclaimer box
  const {
    data: disclaimerLogs = [],
    refetch: refetchDisclaimers,
    isFetching: isFetchingDisclaimers,
  } = useQuery({
    queryKey: ["founders-advocate-disclaimers"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("advocate_disclaimers")
          .select("*")
          .order("accepted_at", { ascending: false });
        if (error) {
          console.warn("Could not load advocate disclaimers:", error);
          return [];
        }
        return (data || []) as Array<{
          id: string;
          user_id: string | null;
          user_email: string | null;
          user_name: string | null;
          notice_text: string | null;
          accepted_at: string;
        }>;
      } catch (err) {
        console.warn("Error fetching advocate disclaimers:", err);
        return [];
      }
    },
    refetchInterval: 15000,
  });

  const filteredDisclaimers = disclaimerLogs.filter((log) => {
    if (!disclaimerSearch.trim()) return true;
    const q = disclaimerSearch.toLowerCase();
    const nameMatch = (log.user_name || "").toLowerCase().includes(q);
    const emailMatch = (log.user_email || "").toLowerCase().includes(q);
    return nameMatch || emailMatch;
  });

  // Query actual metrics with real counts from database and backend
  const { data: metrics, refetch, isFetching } = useQuery({
    queryKey: ["founders-kpis", credential],
    queryFn: async () => {
      // 1. Backend chat and user stats
      let overviewStats = null;
      if (credential) {
        try {
          overviewStats = await getAdminOverviewStats(credential);
        } catch {
          // Backend overview stats fallback
        }
      }

      // 2. Supabase counts
      const [usersRes, lawyersRes, analysesRes, consultationsRes] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("lawyers").select("*", { count: "exact", head: true }).eq("approved", true),
        supabase.from("analyses").select("*", { count: "exact", head: true }),
        supabase.from("consultations").select("*", { count: "exact", head: true }),
      ]);

      const usersCount = usersRes.count ?? 0;
      const lawyersCount = lawyersRes.count ?? 0;
      const analysesCount = analysesRes.count ?? 0;
      const consultationsCount = consultationsRes.count ?? 0;

      const totalUsers = Math.max(overviewStats?.total_users ?? 0, usersCount);

      return {
        totalUsers,
        totalChats: overviewStats?.total_chats ?? 0,
        totalMessages: overviewStats?.total_messages ?? 0,
        activeUsers30d: overviewStats?.active_users_30d ?? 0,
        activeLawyers: lawyersCount,
        analysesRun: analysesCount,
        consultationsArranged: consultationsCount,
      };
    },
    refetchInterval: 20000,
  });

  return (
    <div className="space-y-8 bg-[#0A0A0A] text-[#F0F0F0]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-5 font-mono">
        <div>
          <span className="text-xs uppercase tracking-widest text-amber-200/80 block">
            EXECUTIVE DASHBOARD · LIVE TELEMETRY
          </span>
          <h1 className="font-display text-3xl font-medium text-[#F0F0F0] mt-1">
            Overview
          </h1>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-[#666666]">Updated: {lastRefreshed}</span>
          <button
            onClick={() => {
              refetch();
              refetchDisclaimers();
              setLastRefreshed(new Date().toLocaleTimeString());
            }}
            disabled={isFetching || isFetchingDisclaimers}
            className="border border-[#333333] bg-[#161616] px-3 py-1.5 text-[#F0F0F0] hover:border-white transition-colors flex items-center gap-1.5 rounded"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching || isFetchingDisclaimers ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (Real Data) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
        {/* Card 1: Total Platform Users */}
        <div className="bg-[#141414] border border-[#262626] p-6 rounded-xl shadow-lg flex flex-col justify-between hover:border-[#383838] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-[#999999]">
              Total Users
            </span>
            <Users className="h-4 w-4 text-amber-300" />
          </div>
          <div className="my-4">
            <span className="font-display text-4xl font-semibold text-[#F0F0F0]">
              {(metrics?.totalUsers ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-[0.7rem]">
            <span className="text-emerald-400">
              {metrics?.activeUsers30d ?? 0} active in last 30d
            </span>
            <Link to="/founders/users" className="text-neutral-400 hover:text-white flex items-center gap-1">
              <span>View list</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Card 2: Legal Chat Sessions */}
        <div className="bg-[#141414] border border-[#262626] p-6 rounded-xl shadow-lg flex flex-col justify-between hover:border-[#383838] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-[#999999]">
              Legal Chat Sessions
            </span>
            <MessageSquare className="h-4 w-4 text-sky-400" />
          </div>
          <div className="my-4">
            <span className="font-display text-4xl font-semibold text-[#F0F0F0]">
              {(metrics?.totalChats ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="text-[0.7rem] text-[#888888]">
            Database-backed inquiry sessions
          </div>
        </div>

        {/* Card 3: Messages Processed */}
        <div className="bg-[#141414] border border-[#262626] p-6 rounded-xl shadow-lg flex flex-col justify-between hover:border-[#383838] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-[#999999]">
              Total Messages
            </span>
            <MessagesSquare className="h-4 w-4 text-purple-400" />
          </div>
          <div className="my-4">
            <span className="font-display text-4xl font-semibold text-[#F0F0F0]">
              {(metrics?.totalMessages ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="text-[0.7rem] text-[#888888]">
            User queries + statutory AI replies
          </div>
        </div>

        {/* Card 4: Active Lawyers */}
        <div className="bg-[#141414] border border-[#262626] p-6 rounded-xl shadow-lg flex flex-col justify-between hover:border-[#383838] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-[#999999]">
              Verified Lawyers
            </span>
            <Scale className="h-4 w-4 text-amber-300" />
          </div>
          <div className="my-4">
            <span className="font-display text-4xl font-semibold text-[#F0F0F0]">
              {(metrics?.activeLawyers ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-[0.7rem]">
            <span className="text-[#888888]">Verified on platform</span>
            <Link to="/founders/lawyers" className="text-neutral-400 hover:text-white flex items-center gap-1">
              <span>Directory</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Card 5: FIR Analyses */}
        <div className="bg-[#141414] border border-[#262626] p-6 rounded-xl shadow-lg flex flex-col justify-between hover:border-[#383838] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-[#999999]">
              FIR Analyses
            </span>
            <FileText className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="my-4">
            <span className="font-display text-4xl font-semibold text-[#F0F0F0]">
              {(metrics?.analysesRun ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="text-[0.7rem] text-[#888888]">
            Statutory AI classification logs
          </div>
        </div>

        {/* Card 6: Consultations Arranged */}
        <div className="bg-[#141414] border border-[#262626] p-6 rounded-xl shadow-lg flex flex-col justify-between hover:border-[#383838] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-[#999999]">
              Consultations Arranged
            </span>
            <PhoneCall className="h-4 w-4 text-rose-400" />
          </div>
          <div className="my-4">
            <span className="font-display text-4xl font-semibold text-[#F0F0F0]">
              {(metrics?.consultationsArranged ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="text-[0.7rem] text-[#888888]">
            Client-advocate direct sessions
          </div>
        </div>
      </div>

      {/* Advocate Disclaimer Acknowledgements Section */}
      <div className="bg-[#141414] border border-[#262626] rounded-xl p-6 shadow-lg font-mono">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#222222] pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-amber-200/80">
                STATUTORY COMPLIANCE · AUDIT TRAIL
              </span>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[0.68rem] text-emerald-400 font-semibold">
                {disclaimerLogs.length} Checked
              </span>
            </div>
            <h2 className="font-display text-2xl font-medium text-[#F0F0F0] mt-1.5 flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-amber-300" />
              <span>Advocate Notice Acknowledgements</span>
            </h2>
            <p className="text-xs text-[#888888] mt-1 max-w-2xl leading-relaxed">
              Users who checked &ldquo;I have read and understood this notice and voluntarily elect to view advocate details.&rdquo; before accessing the advocate directory.
            </p>
          </div>

          <div className="w-full sm:w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#666666]" />
              <input
                type="text"
                placeholder="Search user or email..."
                value={disclaimerSearch}
                onChange={(e) => setDisclaimerSearch(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#333333] pl-9 pr-3 py-1.5 text-xs text-[#F0F0F0] placeholder-[#666666] focus:border-white focus:outline-none rounded"
              />
            </div>
          </div>
        </div>

        {filteredDisclaimers.length === 0 ? (
          <div className="py-12 text-center text-[#777777] text-xs">
            {disclaimerLogs.length === 0
              ? "No acknowledgements recorded yet. When citizens click 'Find a Lawyer' and check the notice box, their verified records will appear here."
              : "No acknowledgements match your search query."}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#222222] text-[#888888] uppercase tracking-wider text-[0.7rem]">
                  <th className="py-3 px-3">Citizen Name</th>
                  <th className="py-3 px-3">Email Address</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Date & Time (IST)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F1F1F]">
                {filteredDisclaimers.map((log) => (
                  <tr key={log.id} className="hover:bg-[#1A1A1A] transition-colors">
                    <td className="py-3 px-3 text-[#F0F0F0] font-medium">
                      {log.user_name || "Citizen Account"}
                    </td>
                    <td className="py-3 px-3 text-[#AAAAAA]">
                      {log.user_email || "—"}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[0.68rem] text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Checked & Agreed
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#888888] whitespace-nowrap">
                      {new Date(log.accepted_at).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Ops Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
        <Link
          to="/founders/users"
          className="p-5 rounded-xl bg-[#121212] border border-[#242424] hover:border-white transition-colors flex items-center justify-between font-mono"
        >
          <div>
            <span className="text-xs uppercase tracking-wider text-amber-300 font-semibold block">
              User Telemetry & Chat History
            </span>
            <p className="text-xs text-neutral-400 mt-1">
              Inspect real registered users, search activity, and browse read-only chat logs.
            </p>
          </div>
          <span className="text-sm text-neutral-300 ml-4 font-bold">→</span>
        </Link>

        <Link
          to="/founders/admin"
          className="p-5 rounded-xl bg-[#121212] border border-[#242424] hover:border-white transition-colors flex items-center justify-between font-mono"
        >
          <div>
            <span className="text-xs uppercase tracking-wider text-amber-300 font-semibold block">
              Security & Provider Keys
            </span>
            <p className="text-xs text-neutral-400 mt-1">
              Configure allowed IP whitelists and manage LLM rotation keys.
            </p>
          </div>
          <span className="text-sm text-neutral-300 ml-4 font-bold">→</span>
        </Link>
      </div>
    </div>
  );
}
