import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Scale, FileText, PhoneCall, RefreshCw, MessageSquare, MessagesSquare, Shield, ArrowUpRight, CheckSquare, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTranaCredential } from "@/lib/trana-auth";
import { getAdminOverviewStats } from "@/lib/trana-admin-api";

export const Route = createFileRoute("/founders/")({
  head: () => ({
    meta: [
      { title: "Founders Dashboard — TRANA" },
      { name: "description", content: "Executive operational overview and key platform metrics for TRANA." },
      { property: "og:title", content: "Founders Dashboard — TRANA" },
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

  // Deduplicate so each user account appears only ONCE in the founders dashboard
  const uniqueDisclaimerLogs = useMemo(() => {
    const seen = new Set<string>();
    const list: typeof disclaimerLogs = [];
    for (const log of disclaimerLogs) {
      const key =
        (log.user_id && log.user_id.trim()) ||
        (log.user_email && log.user_email.trim().toLowerCase()) ||
        log.id;
      if (!seen.has(key)) {
        seen.add(key);
        list.push(log);
      }
    }
    return list;
  }, [disclaimerLogs]);

  const filteredDisclaimers = useMemo(() => {
    return uniqueDisclaimerLogs.filter((log) => {
      if (!disclaimerSearch.trim()) return true;
      const q = disclaimerSearch.toLowerCase();
      const nameMatch = (log.user_name || "").toLowerCase().includes(q);
      const emailMatch = (log.user_email || "").toLowerCase().includes(q);
      return nameMatch || emailMatch;
    });
  }, [uniqueDisclaimerLogs, disclaimerSearch]);

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
          <span className="text-neutral-400 font-mono">Updated: {lastRefreshed}</span>
          <button
            onClick={() => {
              refetch();
              refetchDisclaimers();
              setLastRefreshed(new Date().toLocaleTimeString());
            }}
            disabled={isFetching || isFetchingDisclaimers}
            className="apple-glass-pill px-3 py-1.5 text-neutral-200 hover:text-white transition-all flex items-center gap-1.5 rounded-lg disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching || isFetchingDisclaimers ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (Real Data) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
        {/* Card 1: Total Platform Users */}
        <div className="apple-glass-card p-6 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
              Total Users
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="my-4">
            <span className="font-display text-4xl font-semibold text-white tracking-tight">
              {(metrics?.totalUsers ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-[0.7rem] border-t border-white/[0.06] pt-3">
            <span className="text-emerald-400 font-medium flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {metrics?.activeUsers30d ?? 0} active in last 30d
            </span>
            <Link to="/founders/users" className="text-neutral-400 hover:text-white flex items-center gap-1 transition-colors">
              <span>View list</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Card 2: Legal Chat Sessions */}
        <div className="apple-glass-card p-6 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
              Legal Chat Sessions
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-400/10 border border-sky-400/20 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
          <div className="my-4">
            <span className="font-display text-4xl font-semibold text-white tracking-tight">
              {(metrics?.totalChats ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="text-[0.7rem] text-neutral-400 border-t border-white/[0.06] pt-3">
            Database-backed inquiry sessions
          </div>
        </div>

        {/* Card 3: Messages Processed */}
        <div className="apple-glass-card p-6 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
              Total Messages
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-400/10 border border-purple-400/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <MessagesSquare className="h-4 w-4" />
            </div>
          </div>
          <div className="my-4">
            <span className="font-display text-4xl font-semibold text-white tracking-tight">
              {(metrics?.totalMessages ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="text-[0.7rem] text-neutral-400 border-t border-white/[0.06] pt-3">
            User queries + statutory AI replies
          </div>
        </div>

        {/* Card 4: Active Lawyers */}
        <div className="apple-glass-card p-6 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
              Verified Lawyers
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
              <Scale className="h-4 w-4" />
            </div>
          </div>
          <div className="my-4">
            <span className="font-display text-4xl font-semibold text-white tracking-tight">
              {(metrics?.activeLawyers ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-[0.7rem] border-t border-white/[0.06] pt-3">
            <span className="text-neutral-400">Verified on platform</span>
            <Link to="/founders/lawyers" className="text-neutral-400 hover:text-white flex items-center gap-1 transition-colors">
              <span>Directory</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Card 5: FIR Analyses */}
        <div className="apple-glass-card p-6 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
              FIR Analyses
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="my-4">
            <span className="font-display text-4xl font-semibold text-white tracking-tight">
              {(metrics?.analysesRun ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="text-[0.7rem] text-neutral-400 border-t border-white/[0.06] pt-3">
            Statutory AI classification logs
          </div>
        </div>

        {/* Card 6: Consultations Arranged */}
        <div className="apple-glass-card p-6 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
              Consultations Arranged
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-400/10 border border-rose-400/20 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
              <PhoneCall className="h-4 w-4" />
            </div>
          </div>
          <div className="my-4">
            <span className="font-display text-4xl font-semibold text-white tracking-tight">
              {(metrics?.consultationsArranged ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="text-[0.7rem] text-neutral-400 border-t border-white/[0.06] pt-3">
            Client-advocate direct sessions
          </div>
        </div>
      </div>

      {/* Advocate Disclaimer Acknowledgements Section */}
      <div className="apple-glass-card p-6 font-mono">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-neutral-300 font-medium">
                STATUTORY COMPLIANCE · AUDIT TRAIL
              </span>
              <span className="apple-glass-pill px-2.5 py-0.5 text-[0.68rem] text-emerald-400 font-semibold border-emerald-500/30">
                {uniqueDisclaimerLogs.length} Checked
              </span>
            </div>
            <h2 className="font-display text-2xl font-medium text-white mt-1.5 flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-white" />
              <span>Advocate Notice Acknowledgements</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
              Users who checked &ldquo;I have read and understood this notice and voluntarily elect to view advocate details.&rdquo; before accessing the advocate directory.
            </p>
          </div>

          <div className="w-full sm:w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search user or email..."
                value={disclaimerSearch}
                onChange={(e) => setDisclaimerSearch(e.target.value)}
                className="apple-glass-input w-full pl-9 pr-3 py-2 text-xs text-white placeholder:text-neutral-500"
              />
            </div>
          </div>
        </div>

        {filteredDisclaimers.length === 0 ? (
          <div className="py-12 text-center text-neutral-500 text-xs">
            {uniqueDisclaimerLogs.length === 0
              ? "No acknowledgements recorded yet. When citizens click 'Find a Lawyer' and check the notice box, their verified records will appear here."
              : "No acknowledgements match your search query."}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-neutral-400 uppercase tracking-wider text-[0.7rem]">
                  <th className="py-3 px-3">Citizen Name</th>
                  <th className="py-3 px-3">Email Address</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Date & Time (IST)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filteredDisclaimers.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.04] transition-colors">
                    <td className="py-3 px-3 text-white font-medium">
                      {log.user_name || "Citizen Account"}
                    </td>
                    <td className="py-3 px-3 text-neutral-300">
                      {log.user_email || "—"}
                    </td>
                    <td className="py-3 px-3">
                      <span className="apple-glass-pill inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[0.68rem] text-emerald-400 border-emerald-500/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                        Checked & Agreed
                      </span>
                    </td>
                    <td className="py-3 px-3 text-neutral-400 whitespace-nowrap">
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <Link
          to="/founders/users"
          className="apple-glass-card p-5 flex items-center justify-between font-mono group"
        >
          <div>
            <span className="text-xs uppercase tracking-wider text-amber-300 font-semibold block group-hover:text-amber-200 transition-colors">
              User Telemetry & Chat History
            </span>
            <p className="text-xs text-neutral-400 mt-1">
              Inspect real registered users, search activity, and browse read-only chat logs.
            </p>
          </div>
          <span className="text-sm text-neutral-300 ml-4 font-bold group-hover:translate-x-1 transition-transform">→</span>
        </Link>

        <Link
          to="/founders/admin"
          className="apple-glass-card p-5 flex items-center justify-between font-mono group"
        >
          <div>
            <span className="text-xs uppercase tracking-wider text-amber-300 font-semibold block group-hover:text-amber-200 transition-colors">
              Security & Provider Keys
            </span>
            <p className="text-xs text-neutral-400 mt-1">
              Configure allowed IP whitelists and manage LLM rotation keys.
            </p>
          </div>
          <span className="text-sm text-neutral-300 ml-4 font-bold group-hover:translate-x-1 transition-transform">→</span>
        </Link>
      </div>
    </div>
  );
}
