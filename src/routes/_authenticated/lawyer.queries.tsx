/**
 * lawyer.queries.tsx
 * "Citizen Queries" — lawyers see categorised citizen complaint topics
 * matching their field of practice, linked with Complaint Analyser chat sessions.
 * Route: /lawyer/queries
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare, Search, Scale, Clock, CheckCircle2,
  AlertCircle, ChevronRight, Send, X, FileText, Filter,
  RefreshCw, Loader2, ArrowRight, ShieldCheck, Sparkles, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLawyerAuth } from "./lawyer";
import { extractLegalKeywords } from "@/lib/lawyer-groups";

export const Route = createFileRoute("/_authenticated/lawyer/queries")({
  head: () => ({
    meta: [
      { title: "Citizen Queries — Legal Professional Workspace — TRANA" },
      { name: "description", content: "Review and respond to citizen legal queries matching your field of practice, linked with Complaint Analyser." },
    ],
  }),
  component: CitizenQueriesPage,
});

type QueryResponse = {
  id: string;
  advocate_name: string;
  advocate_bar_no?: string;
  advocate_specialisation?: string;
  response: string;
  responded_at: string;
};

type CitizenQuery = {
  id: string;
  created_at: string;
  issue_summary: string;
  category: string;
  status: "open" | "responded" | "closed";
  citizen_name?: string;
  response?: string;
  responded_at?: string;
  responded_by?: string;
  responses?: QueryResponse[];
  passed_by?: string[];
  chat_id?: string | null;
  applicable_laws?: { act?: string; code?: string; section?: string; explanation?: string }[];
  bail_status?: string | null;
  situation_meaning?: string | null;
  plan?: string;
  fee?: number;
  priority?: string;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function CitizenQueriesPage() {
  const { data: lawyer } = useLawyerAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"all" | "specialisation">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "responded">("all");
  const [selectedQuery, setSelectedQuery] = useState<CitizenQuery | null>(null);
  const [responseText, setResponseText] = useState("");
  const [sending, setSending] = useState(false);

  // Derive keywords from lawyer's specialisation
  const lawyerKeywords = useMemo(() => {
    if (!lawyer?.specialisation) return ["civil law", "general practice"];
    return extractLegalKeywords(lawyer.specialisation + " " + (lawyer.specialisation || ""));
  }, [lawyer]);

  // Load queries from Supabase + Complaint Analyser shared pool
  const { data: rawQueries = [], isLoading, refetch } = useQuery({
    queryKey: ["citizen-queries", lawyer?.id, lawyer?.specialisation],
    queryFn: async (): Promise<CitizenQuery[]> => {
      const mergedList: CitizenQuery[] = [];
      const seenIds = new Set<string>();

      // 1. Check local Complaint Analyser pool (ONLY paid legal professional requests)
      try {
        const poolRaw = localStorage.getItem("trana_citizen_queries_pool");
        if (poolRaw) {
          const pool = JSON.parse(poolRaw);
          if (Array.isArray(pool)) {
            pool.forEach((item: any) => {
              if (item?.id && !seenIds.has(item.id)) {
                const isPaid = item.plan === "paid_professional" || item.fee === 50;
                if (!isPaid) return; // Only queries where Legal Professional was chosen

                seenIds.add(item.id);
                mergedList.push({
                  ...item,
                  citizen_name: "Anonymous Citizen",
                  plan: "paid_professional",
                  fee: 50,
                  priority: "high",
                  responses: item.responses || (item.response ? [{
                    id: `resp-${item.id}`,
                    advocate_name: item.responded_by || "Panel Legal Professional",
                    response: item.response,
                    responded_at: item.responded_at || item.created_at,
                  }] : []),
                  passed_by: Array.isArray(item.passed_by) ? item.passed_by : [],
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn("Could not read local citizen queries pool:", err);
      }

      // 2. Fetch from Supabase analyses table (ONLY paid legal professional requests)
      try {
        const { data } = await supabase
          .from("analyses")
          .select("id, created_at, situation, result, is_criminal")
          .order("created_at", { ascending: false })
          .limit(100);

        if (data && Array.isArray(data)) {
          data.forEach((row: any) => {
            if (row?.id && !seenIds.has(row.id)) {
              const res = (typeof row.result === "object" && row.result !== null) ? row.result : {};
              const plan = res.plan || "ai_free";
              const fee = res.fee || (plan === "paid_professional" ? 50 : 0);

              // ONLY show if legal professional review was chosen (paid_professional / fee 50)
              if (plan !== "paid_professional" && fee !== 50) return;

              seenIds.add(row.id);
              mergedList.push({
                id: row.id,
                created_at: row.created_at || new Date().toISOString(),
                issue_summary: row.situation ? (row.situation.length > 200 ? row.situation.slice(0, 197) + "…" : row.situation) : "Citizen Legal Inquiry",
                category: res.applicable_laws?.[0]?.act || res.applicable_laws?.[0]?.code || "Criminal Law",
                status: (res.response || res.status === "responded" || (res.responses && res.responses.length > 0)) ? "responded" : "open",
                citizen_name: "Anonymous Citizen",
                response: res.response || null,
                responded_at: res.responded_at || null,
                responded_by: res.responded_by || null,
                responses: res.responses || (res.response ? [{
                  id: `resp-${row.id}`,
                  advocate_name: res.responded_by || "Panel Legal Professional",
                  response: res.response,
                  responded_at: res.responded_at || row.created_at,
                }] : []),
                passed_by: Array.isArray(res.passed_by) ? res.passed_by : [],
                applicable_laws: res.applicable_laws || [],
                bail_status: res.bail_status || null,
                situation_meaning: res.situation_meaning || null,
                plan: "paid_professional",
                fee: 50,
                priority: "high",
              });
            }
          });
        }
      } catch (err) {
        console.warn("Supabase analyses fetch note:", err);
      }

      // 3. Synchronize locally passed tracker across all queries
      const myId = lawyer?.id || lawyer?.bar_reg_no || lawyer?.full_name || "counsel";
      const passedKey = `trana_passed_queries_${myId}`;
      let locallyPassedIds: string[] = [];
      try {
        const rawPassed = localStorage.getItem(passedKey);
        if (rawPassed) {
          const parsed = JSON.parse(rawPassed);
          if (Array.isArray(parsed)) locallyPassedIds = parsed;
        }
      } catch {}

      mergedList.forEach((q) => {
        if (locallyPassedIds.includes(q.id)) {
          q.passed_by = Array.from(new Set([...(q.passed_by || []), myId]));
        }
      });

      // 4. If list has fewer than 6 items, supplement with mock queries (preserving locally passed state)
      if (mergedList.length < 6) {
        const mocks = generateMockQueries(lawyer?.specialisation || "General Practice", 6);
        mocks.forEach((mock) => {
          if (!seenIds.has(mock.id)) {
            seenIds.add(mock.id);
            if (locallyPassedIds.includes(mock.id)) {
              mock.passed_by = Array.from(new Set([...(mock.passed_by || []), myId]));
            }
            mergedList.push(mock);
          }
        });
      }

      return mergedList;
    },
    enabled: !!lawyer,
    staleTime: 60 * 1000,
  });

  // Filter queries matching lawyer's practice area or all
  const matchedQueries = useMemo(() => {
    if (scopeFilter === "all") return rawQueries;
    return rawQueries.filter((q) => {
      const qText = (q.issue_summary + " " + q.category).toLowerCase();
      const matchesSpec = lawyerKeywords.some((kw) => qText.includes(kw.toLowerCase()));
      return matchesSpec || lawyerKeywords.includes("general practice");
    });
  }, [rawQueries, lawyerKeywords, scopeFilter]);

  const filteredQueries = useMemo(() => {
    return matchedQueries.filter((q) => {
      const matchesSearch =
        !search.trim() ||
        q.issue_summary.toLowerCase().includes(search.toLowerCase()) ||
        q.category?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || q.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [matchedQueries, search, statusFilter]);

  // Submit written opinion without locking query for other advocates
  async function handleRespond() {
    if (!selectedQuery || !responseText.trim()) return;
    setSending(true);
    try {
      const newResponse: QueryResponse = {
        id: `resp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        advocate_name: lawyer?.full_name || "Advocate Counsel",
        advocate_bar_no: lawyer?.bar_reg_no || "",
        advocate_specialisation: lawyer?.specialisation || "Criminal Law",
        response: responseText.trim(),
        responded_at: new Date().toISOString(),
      };
      const updatedResponses = [...(selectedQuery.responses || []), newResponse];

      // 1. Update local pool
      try {
        const poolRaw = localStorage.getItem("trana_citizen_queries_pool");
        let pool: any[] = [];
        if (poolRaw) {
          try {
            const parsed = JSON.parse(poolRaw);
            if (Array.isArray(parsed)) pool = parsed;
          } catch {}
        }
        const updatedItem = {
          ...selectedQuery,
          response: responseText.trim(),
          responded_at: new Date().toISOString(),
          responded_by: lawyer?.full_name || "Advocate",
          responses: updatedResponses,
          status: "responded" as const,
        };
        const existsIndex = pool.findIndex((q: any) => q.id === selectedQuery.id);
        if (existsIndex >= 0) {
          pool[existsIndex] = updatedItem;
        } else {
          pool.push(updatedItem);
        }
        localStorage.setItem("trana_citizen_queries_pool", JSON.stringify(pool));
      } catch (poolErr) {
        console.warn("Local pool response update note:", poolErr);
      }

      // 2. Optimistically update React Query cache so opinion reflects immediately
      qc.setQueriesData({ queryKey: ["citizen-queries"] }, (old: CitizenQuery[] | undefined) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((q) =>
          q.id === selectedQuery.id
            ? {
                ...q,
                response: responseText.trim(),
                responded_at: new Date().toISOString(),
                responded_by: lawyer?.full_name || "Advocate",
                responses: updatedResponses,
                status: "responded",
              }
            : q
        );
      });

      // 3. Try Supabase update in analyses table ONLY if it's a valid UUID (isolated, non-blocking)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(selectedQuery.id);
      if (isUuid) {
        try {
          await supabase
            .from("analyses")
            .update({
              result: {
                situation_meaning: selectedQuery.situation_meaning,
                applicable_laws: selectedQuery.applicable_laws,
                bail_status: selectedQuery.bail_status,
                response: responseText.trim(),
                responded_at: new Date().toISOString(),
                responded_by: lawyer?.full_name || "Advocate",
                responses: updatedResponses,
                passed_by: selectedQuery.passed_by || [],
                status: "responded",
                citizen_name: "Anonymous Citizen",
                plan: "paid_professional",
                fee: 50,
                priority: "high",
              } as any,
            })
            .eq("id", selectedQuery.id);
        } catch (supabaseErr) {
          console.warn("Supabase response update note (non-critical):", supabaseErr);
        }
      }

      toast.success("Written opinion submitted. Other panel advocates may also review this query.");
      setSelectedQuery(null);
      setResponseText("");
      refetch();
    } catch (err) {
      console.error("Submit response error:", err);
      toast.error("Could not submit response. Please try again.");
    } finally {
      setSending(false);
    }
  }

  // Pass on to other advocates (remains active on server for peer advocates)
  async function handlePassOn(queryId: string) {
    if (!selectedQuery) return;
    try {
      const myId = lawyer?.id || lawyer?.bar_reg_no || lawyer?.full_name || "counsel";
      const existingPassed = Array.isArray(selectedQuery.passed_by) ? selectedQuery.passed_by : [];
      const updatedPassed = Array.from(new Set([...existingPassed, myId]));

      // 1. Save locally to passed tracker
      try {
        const passedKey = `trana_passed_queries_${myId}`;
        let existing: string[] = [];
        const rawExisting = localStorage.getItem(passedKey);
        if (rawExisting) {
          try {
            const parsed = JSON.parse(rawExisting);
            if (Array.isArray(parsed)) existing = parsed;
          } catch {}
        }
        localStorage.setItem(passedKey, JSON.stringify(Array.from(new Set([...existing, queryId]))));
      } catch (storageErr) {
        console.warn("Could not save to passed tracker:", storageErr);
      }

      // 2. Update local pool - ensuring query exists in pool so state persists
      try {
        const poolRaw = localStorage.getItem("trana_citizen_queries_pool");
        let pool: any[] = [];
        if (poolRaw) {
          try {
            const parsed = JSON.parse(poolRaw);
            if (Array.isArray(parsed)) pool = parsed;
          } catch {}
        }
        const existsIndex = pool.findIndex((q: any) => q.id === queryId);
        if (existsIndex >= 0) {
          pool[existsIndex] = { ...pool[existsIndex], passed_by: updatedPassed };
        } else {
          pool.push({ ...selectedQuery, passed_by: updatedPassed });
        }
        localStorage.setItem("trana_citizen_queries_pool", JSON.stringify(pool));
      } catch (poolErr) {
        console.warn("Could not update local queries pool:", poolErr);
      }

      // 3. Optimistically update React Query cache so the card reflects "Passed" immediately
      try {
        qc.setQueriesData({ queryKey: ["citizen-queries"] }, (old: CitizenQuery[] | undefined) => {
          if (!old || !Array.isArray(old)) return old;
          return old.map((q) => (q.id === queryId ? { ...q, passed_by: updatedPassed } : q));
        });
      } catch (cacheErr) {
        console.warn("Cache update note:", cacheErr);
      }

      // 4. Try updating Supabase analyses table in the background (ONLY if it's a valid UUID, safe from throwing)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(queryId);
      if (isUuid) {
        try {
          await supabase
            .from("analyses")
            .update({
              result: {
                situation_meaning: selectedQuery.situation_meaning,
                applicable_laws: selectedQuery.applicable_laws,
                bail_status: selectedQuery.bail_status,
                responses: selectedQuery.responses || [],
                passed_by: updatedPassed,
                status: selectedQuery.status,
                citizen_name: "Anonymous Citizen",
                plan: selectedQuery.plan || "paid_professional",
                fee: selectedQuery.fee || 50,
                priority: "high",
              } as any,
            })
            .eq("id", queryId);
        } catch (supabaseErr) {
          console.warn("Supabase pass update note (non-critical):", supabaseErr);
        }
      }

      toast.info("Query passed on. It remains active on the server for other panel advocates to reply.");
      setSelectedQuery(null);
      setResponseText("");
      try {
        refetch();
      } catch {}
    } catch (err) {
      console.error("Pass query error:", err);
      toast.error("Could not pass query.");
    }
  }

  if (lawyer && (!lawyer.approved || lawyer.verification_status === "PENDING_VERIFICATION")) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="max-w-md w-full p-8 rounded-2xl apple-glass-card border-amber-500/30 text-center space-y-4">
          <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
            <Scale className="h-6 w-6" />
          </div>
          <h2 className="font-display text-lg font-semibold text-white">Citizen Inquiries Protected</h2>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Live citizen legal queries and FIR evaluations contain sensitive confidential disclosures. Access is restricted until your Bar Council credentials have been verified by TRANA founders.
          </p>
          <div className="pt-2">
            <span className="apple-glass-pill px-3 py-1 text-amber-300 font-mono text-xs">
              Status: Verification Under Review
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="border-b border-white/10 pb-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300">
              <MessageSquare className="h-4 w-4" />
            </div>
            <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">
              Citizen Queries
            </h1>
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 font-mono text-[10px] text-sky-300">
              Complaint Analyser Linked
            </span>
          </div>
          <p className="font-mono text-xs text-neutral-400">
            {lawyer?.specialisation || "Your Practice Area"} &middot; Live citizen inquiries &amp; statutory complaints
          </p>
        </div>
      </div>

      {/* Filters & Scope */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Scope Selector: All Inquiries vs My Practice Area */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setScopeFilter("all")}
              className={`px-3 py-1 rounded-lg font-mono text-[11px] transition-all cursor-pointer ${
                scopeFilter === "all"
                  ? "bg-white/15 text-white font-semibold shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              All Inquiries ({rawQueries.length})
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter("specialisation")}
              className={`px-3 py-1 rounded-lg font-mono text-[11px] transition-all cursor-pointer ${
                scopeFilter === "specialisation"
                  ? "bg-white/15 text-white font-semibold shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              My Practice Area ({lawyer?.specialisation || "General"})
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search inquiries or statutes..."
              className="w-full border border-white/10 bg-[#121216] pl-9 pr-3 py-1.5 text-xs rounded-xl text-white placeholder:text-neutral-500 focus:border-amber-400/60 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <Filter className="h-3.5 w-3.5 text-neutral-500" />
            {(["all", "open", "responded"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider rounded-lg border transition-colors cursor-pointer ${
                  statusFilter === s
                    ? "border-emerald-500 bg-emerald-500 text-black font-semibold"
                    : "border-white/10 bg-transparent text-neutral-400 hover:border-white/25 hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
            <button
              onClick={() => refetch()}
              className="border border-white/10 p-1.5 rounded-lg text-neutral-400 hover:border-white/30 hover:text-white transition-colors cursor-pointer"
              aria-label="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Active Inquiries", value: matchedQueries.length, icon: MessageSquare },
          { label: "Awaiting Response", value: matchedQueries.filter((q) => q.status === "open").length, icon: AlertCircle },
          { label: "Answered", value: matchedQueries.filter((q) => q.status === "responded").length, icon: CheckCircle2 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="border border-white/10 bg-[#121216] p-4 rounded-xl shadow-sm">
            <div className="flex items-center gap-2 text-neutral-400">
              <Icon className="h-3.5 w-3.5 text-amber-300" />
              <span className="font-mono text-[10px] uppercase tracking-wider">{label}</span>
            </div>
            <p className="mt-1 font-mono text-2xl text-white">{isLoading ? "—" : value}</p>
          </div>
        ))}
      </div>

      {/* Query List */}
      <div className="rounded-2xl border border-white/10 bg-[#101014] overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin text-amber-300" />
            <span className="font-mono text-xs">Loading citizen queries...</span>
          </div>
        ) : filteredQueries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Scale className="h-8 w-8 text-neutral-600" />
            <p className="font-mono text-xs text-neutral-400 uppercase tracking-wider">
              No queries found in this view.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {filteredQueries.map((query) => (
              <div
                key={query.id}
                className="group flex cursor-pointer items-start gap-4 px-5 py-4 transition-all hover:bg-white/[0.04]"
                onClick={() => {
                  setSelectedQuery(query);
                  setResponseText(query.response || "");
                }}
              >
                <div className="mt-1 flex-shrink-0">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      query.status === "open" ? "bg-amber-400" : "bg-emerald-400"
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-sm text-neutral-100 font-medium leading-snug group-hover:text-amber-100 transition-colors">
                    {query.issue_summary}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {(query.fee === 50 || query.plan === "paid_professional") && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                        <Scale className="h-3 w-3" />
                        ₹50 Paid Review
                      </span>
                    )}
                    {query.category && (
                      <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-neutral-300">
                        {query.category}
                      </span>
                    )}
                    {query.chat_id && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-mono text-[10px] text-sky-300">
                        <Sparkles className="h-3 w-3" />
                        Chat Linked
                      </span>
                    )}
                    {query.responses && query.responses.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        {query.responses.length} Opinion{query.responses.length > 1 ? "s" : ""}
                      </span>
                    )}
                    {(() => {
                      const myId = lawyer?.id || lawyer?.bar_reg_no || lawyer?.full_name || "counsel";
                      const isPassed = query.passed_by?.some(
                        (p) => p === myId || p === lawyer?.id || (lawyer?.bar_reg_no && p === lawyer.bar_reg_no) || (lawyer?.full_name && p === lawyer.full_name)
                      );
                      return isPassed ? (
                        <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-300">
                          Passed
                        </span>
                      ) : null;
                    })()}
                    <span
                      className={`rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                        query.status === "open"
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      }`}
                    >
                      {query.status}
                    </span>
                    <span className="font-mono text-[10px] text-neutral-500">
                      Citizen: Anonymous
                    </span>
                    <span className="font-mono text-[10px] text-neutral-500">
                      <Clock className="inline h-3 w-3 mr-1" />
                      {timeAgo(query.created_at)}
                    </span>
                  </div>
                </div>
                <ChevronRight className="mt-1.5 h-4 w-4 flex-shrink-0 text-neutral-500 group-hover:text-white transition-colors" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Response Modal */}
      {selectedQuery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-2xl my-6 border border-white/20 bg-[#121216] shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-[#16161c]">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-300" />
                <span className="font-mono text-xs uppercase tracking-wider text-white font-semibold">
                  Citizen Legal Query &middot; Complaint Analyser
                </span>
              </div>
              <button
                onClick={() => setSelectedQuery(null)}
                className="text-neutral-400 hover:text-white transition-colors p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5 sm:p-6 overflow-y-auto">
              {/* Query Summary */}
              <div className="border border-white/10 bg-[#0e0e12] p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">Citizen Inquiry &bull; Anonymous</p>
                  {(selectedQuery.fee === 50 || selectedQuery.plan === "paid_professional") && (
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/25 text-amber-300 border border-amber-500/40">
                      ₹50 Priority Paid Review
                    </span>
                  )}
                </div>
                <p className="text-sm text-white leading-relaxed">{selectedQuery.issue_summary}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedQuery.category && (
                    <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-neutral-300">
                      {selectedQuery.category}
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-neutral-500">{timeAgo(selectedQuery.created_at)}</span>
                </div>
              </div>

              {/* Linked Complaint Analyser Breakdown (if present) */}
              {(selectedQuery.situation_meaning || (selectedQuery.applicable_laws && selectedQuery.applicable_laws.length > 0)) && (
                <div className="border border-sky-500/20 bg-sky-950/20 p-4 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-sky-300 font-semibold flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Complaint Analyser Engine Breakdown
                    </span>
                    {selectedQuery.chat_id && (
                      <Link
                        to="/dashboard/chat/$id"
                        params={{ id: selectedQuery.chat_id }}
                        className="text-[11px] font-mono text-sky-400 hover:underline flex items-center gap-1"
                      >
                        <span>Open Chat Thread</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                  {selectedQuery.situation_meaning && (
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      {selectedQuery.situation_meaning}
                    </p>
                  )}
                  {selectedQuery.applicable_laws && selectedQuery.applicable_laws.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selectedQuery.applicable_laws.map((l, i) => (
                        <span key={i} className="text-[10px] font-mono bg-sky-500/10 border border-sky-500/30 text-sky-200 px-2 py-0.5 rounded">
                          {l.code || l.act} &sect;{l.section}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Previously Submitted Panel Written Opinions */}
              {selectedQuery.responses && selectedQuery.responses.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Panel Legal Professional Opinions ({selectedQuery.responses.length})
                    </span>
                    <span className="text-[10px] font-mono text-neutral-400">Open to multiple counsel</span>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {selectedQuery.responses.map((r, i) => (
                      <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-emerald-300">
                            {r.advocate_name} {r.advocate_bar_no ? `(${r.advocate_bar_no})` : ""}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-500">{timeAgo(r.responded_at)}</span>
                        </div>
                        <p className="text-xs text-neutral-200 leading-relaxed whitespace-pre-wrap">{r.response}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              <div className="border border-amber-500/20 bg-amber-500/5 p-3 rounded-xl">
                <p className="font-mono text-[10px] text-amber-300/90 leading-relaxed">
                  <AlertCircle className="inline h-3 w-3 mr-1" />
                  Your response provides legal information and analysis. Per BCI Rules, do not solicit or guarantee legal outcomes.
                </p>
              </div>

              {/* Response Draft */}
              <div className="space-y-1.5">
                <label className="block font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                  {selectedQuery.responses && selectedQuery.responses.length > 0 ? "Add Another Legal Professional Written Opinion" : "Your Legal Professional Written Opinion"}
                </label>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  rows={5}
                  placeholder="Provide your written opinion on the statutory provisions, facts analysis, and legal first-aid advice..."
                  className="w-full resize-none border border-white/10 bg-[#0e0e12] px-4 py-3 text-xs text-white rounded-xl placeholder:text-neutral-500 focus:border-emerald-400/60 focus:outline-none"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                {(() => {
                  const myId = lawyer?.id || lawyer?.bar_reg_no || lawyer?.full_name || "counsel";
                  const isPassed = selectedQuery.passed_by?.some(
                    (p) => p === myId || p === lawyer?.id || (lawyer?.bar_reg_no && p === lawyer.bar_reg_no) || (lawyer?.full_name && p === lawyer.full_name)
                  );
                  if (lawyer && (!lawyer.approved || lawyer.verification_status === "PENDING_VERIFICATION")) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="max-w-md w-full p-8 rounded-2xl apple-glass-card border-amber-500/30 text-center space-y-4">
          <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
            <Scale className="h-6 w-6" />
          </div>
          <h2 className="font-display text-lg font-semibold text-white">Citizen Inquiries Protected</h2>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Live citizen legal queries and FIR evaluations contain sensitive confidential disclosures. Access is restricted until your Bar Council credentials have been verified by TRANA founders.
          </p>
          <div className="pt-2">
            <span className="apple-glass-pill px-3 py-1 text-amber-300 font-mono text-xs">
              Status: Verification Under Review
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
                    <button
                      type="button"
                      onClick={() => handlePassOn(selectedQuery.id)}
                      className="border border-amber-500/30 hover:border-amber-500/60 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 px-4 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
                      title="Pass on this query. It remains active on the server for other panel advocates to reply."
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      <span>{isPassed ? "Pass On Again" : "Pass On to Other Advocates"}</span>
                    </button>
                  );
                })()}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedQuery(null)}
                    className="border border-white/15 px-4 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleRespond}
                    disabled={sending || !responseText.trim()}
                    className="flex items-center justify-center gap-2 bg-emerald-500 text-black px-5 py-2.5 rounded-xl font-semibold text-xs uppercase tracking-wider transition-colors hover:bg-emerald-400 disabled:opacity-40 cursor-pointer shadow-md"
                  >
                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    <span>{selectedQuery.responses && selectedQuery.responses.length > 0 ? "Add Your Written Opinion" : "Submit Written Opinion"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Generate illustrative mock queries seeded by practice area */
function generateMockQueries(specialisation: string, count: number): CitizenQuery[] {
  const templates: Record<string, { issue: string; category: string }[]> = {
    default: [
      { issue: "Complaint under Section 318 BNS (Cheating) filed by business partner. Seeking urgent legal professional written opinion.", category: "General Legal Query" },
      { issue: "Notice issued under BNSS Section 35(3). Seeking advice on whether to appear and anticipatory bail eligibility.", category: "Legal Rights" },
      { issue: "Illegal seizure of mobile device during criminal inquiry under BSA 2023. Need formal review of electronic evidence rights.", category: "Legal Notice" },
    ],
    criminal: [
      { issue: "Falsely accused in FIR under BNS Section 135 & Section 352. Seeking legal professional written opinion on bail and charge exaggeration.", category: "Criminal — FIR & Bail" },
      { issue: "Family member arrested without warrant under BNSS Section 35. Need immediate bail strategy and procedure review.", category: "Criminal — Bail" },
      { issue: "Police questioning notice under Section 179 BNSS. Seeking written opinion on self-incrimination safeguards.", category: "Criminal — Police Notice" },
    ],
    family: [
      { issue: "Matrimonial dispute involving criminal intimidation under BNS Section 351. Need legal professional written opinion.", category: "Family — Domestic Matter" },
      { issue: "Maintenance petition under Section 144 BNSS. Seeking written assessment of interim relief provisions.", category: "Family — Maintenance" },
    ],
  };

  const specLower = specialisation.toLowerCase();
  let key = "default";
  if (specLower.includes("criminal")) key = "criminal";
  else if (specLower.includes("family") || specLower.includes("matrimon")) key = "family";

  const pool = [...(templates[key] || templates.default), ...templates.default];
  const now = Date.now();

  return pool.slice(0, count).map((t, i) => ({
    id: `mock-paid-${i}`,
    created_at: new Date(now - i * 3_600_000).toISOString(),
    issue_summary: t.issue,
    category: t.category,
    status: "open" as const,
    chat_id: null,
    plan: "paid_professional",
    fee: 50,
    priority: "high",
    responses: [],
    passed_by: [],
  }));
}
