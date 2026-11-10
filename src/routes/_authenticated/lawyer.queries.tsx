/**
 * lawyer.queries.tsx
 * "Citizen Queries" — lawyers see categorised citizen complaint topics
 * matching their field of practice, linked with Complaint Analyser chat sessions.
 * Route: /lawyer/queries
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
  chat_id?: string | null;
  applicable_laws?: { act?: string; code?: string; section?: string; explanation?: string }[];
  bail_status?: string | null;
  situation_meaning?: string | null;
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
  const [search, setSearch] = useState("");
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

      // 1. Check local Complaint Analyser pool
      try {
        const poolRaw = localStorage.getItem("trana_citizen_queries_pool");
        if (poolRaw) {
          const pool = JSON.parse(poolRaw);
          if (Array.isArray(pool)) {
            pool.forEach((item: any) => {
              if (item?.id && !seenIds.has(item.id)) {
                seenIds.add(item.id);
                mergedList.push(item);
              }
            });
          }
        }

        // Also check citizen past analyses from localStorage
        const pastRaw = localStorage.getItem("trana_citizen_past_analyses");
        if (pastRaw) {
          const past = JSON.parse(pastRaw);
          if (Array.isArray(past)) {
            past.forEach((p: any) => {
              const qId = `analysis-${p.id || p.createdAt}`;
              if (!seenIds.has(qId)) {
                seenIds.add(qId);
                const ana = p.result?.analysis;
                mergedList.push({
                  id: qId,
                  created_at: p.createdAt || new Date().toISOString(),
                  issue_summary: p.summaryTitle || p.originalQuery || "Citizen Complaint Analysis",
                  category: ana?.applicable_laws?.[0]?.act || "Statutory Matter",
                  status: "open",
                  chat_id: p.result?.chatId || null,
                  applicable_laws: ana?.applicable_laws || [],
                  bail_status: ana?.bail_status || null,
                  situation_meaning: ana?.situation_meaning || null,
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn("Could not read local citizen queries pool:", err);
      }

      // 2. Fetch from Supabase complaint_analyses
      try {
        const { data } = await supabase
          .from("complaint_analyses")
          .select("id, created_at, issue_summary, category, status, citizen_name, response, responded_at, responded_by")
          .order("created_at", { ascending: false })
          .limit(100);

        if (data && Array.isArray(data)) {
          data.forEach((row: any) => {
            if (row?.id && !seenIds.has(row.id)) {
              seenIds.add(row.id);
              mergedList.push(row);
            }
          });
        }
      } catch (err) {
        console.warn("Supabase complaint_analyses fetch note:", err);
      }

      // 3. Fallback mock queries if empty
      if (mergedList.length === 0) {
        return generateMockQueries(lawyer?.specialisation || "General Practice", 8);
      }

      return mergedList;
    },
    enabled: !!lawyer,
    staleTime: 60 * 1000,
  });

  // Filter queries matching lawyer's practice area
  const matchedQueries = useMemo(() => {
    return rawQueries.filter((q) => {
      const qText = (q.issue_summary + " " + q.category).toLowerCase();
      const matchesSpec = lawyerKeywords.some((kw) => qText.includes(kw.toLowerCase()));
      return matchesSpec || lawyerKeywords.includes("general practice");
    });
  }, [rawQueries, lawyerKeywords]);

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

  async function handleRespond() {
    if (!selectedQuery || !responseText.trim()) return;
    setSending(true);
    try {
      // 1. Try Supabase update
      await supabase
        .from("complaint_analyses")
        .update({
          response: responseText.trim(),
          responded_at: new Date().toISOString(),
          responded_by: lawyer?.full_name || "Advocate",
          status: "responded",
        })
        .eq("id", selectedQuery.id)
        .catch(() => {});

      // 2. Update local pool
      try {
        const poolRaw = localStorage.getItem("trana_citizen_queries_pool");
        if (poolRaw) {
          const pool = JSON.parse(poolRaw);
          const updated = pool.map((q: any) =>
            q.id === selectedQuery.id
              ? {
                  ...q,
                  response: responseText.trim(),
                  responded_at: new Date().toISOString(),
                  responded_by: lawyer?.full_name || "Advocate",
                  status: "responded",
                }
              : q
          );
          localStorage.setItem("trana_citizen_queries_pool", JSON.stringify(updated));
        }
      } catch {}

      toast.success("Response submitted and linked to citizen inquiry.");
      setSelectedQuery(null);
      setResponseText("");
      refetch();
    } catch {
      toast.error("Could not submit response. Please try again.");
    } finally {
      setSending(false);
    }
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

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inquiries or statutory sections..."
            className="w-full border border-white/10 bg-[#121216] pl-10 pr-4 py-2 text-xs rounded-xl text-white placeholder:text-neutral-500 focus:border-amber-400/60 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-neutral-500" />
          {(["all", "open", "responded"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider rounded-lg border transition-colors cursor-pointer ${
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
            className="border border-white/10 p-2 rounded-lg text-neutral-400 hover:border-white/30 hover:text-white transition-colors cursor-pointer"
            aria-label="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Matching Inquiries", value: matchedQueries.length, icon: MessageSquare },
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
              No queries match your practice area right now.
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
                <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">Citizen Inquiry</p>
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

              {/* Disclaimer */}
              <div className="border border-amber-500/20 bg-amber-500/5 p-3 rounded-xl">
                <p className="font-mono text-[10px] text-amber-300/90 leading-relaxed">
                  <AlertCircle className="inline h-3 w-3 mr-1" />
                  Your response provides general legal information. Per BCI Rules, do not solicit or guarantee legal outcomes.
                </p>
              </div>

              {/* Response Draft */}
              <div className="space-y-1.5">
                <label className="block font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                  Your Statutory Response
                </label>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  rows={5}
                  placeholder="Provide general information on the applicable legal provisions, rights, and procedure..."
                  className="w-full resize-none border border-white/10 bg-[#0e0e12] px-4 py-3 text-xs text-white rounded-xl placeholder:text-neutral-500 focus:border-emerald-400/60 focus:outline-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleRespond}
                  disabled={sending || !responseText.trim()}
                  className="flex flex-1 items-center justify-center gap-2 bg-emerald-500 text-black px-4 py-3 rounded-xl font-semibold text-xs uppercase tracking-wider transition-colors hover:bg-emerald-400 disabled:opacity-40 cursor-pointer shadow-md"
                >
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {sending ? "Submitting..." : "Submit Response"}
                </button>
                <button
                  onClick={() => setSelectedQuery(null)}
                  className="border border-white/15 px-4 py-3 rounded-xl font-mono text-xs uppercase tracking-wider text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
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
      { issue: "I need general legal advice about my situation and what steps I should take.", category: "General Legal Query" },
      { issue: "What are my rights in this matter and how should I proceed?", category: "Legal Rights" },
      { issue: "I received a legal notice and I don't know how to respond to it.", category: "Legal Notice" },
    ],
    criminal: [
      { issue: "I have been falsely accused in an FIR under BNS Section 303. What are my immediate bail rights?", category: "Criminal — FIR & Bail" },
      { issue: "My family member was arrested without notice under BNSS Section 35. How do I apply for bail?", category: "Criminal — Bail" },
      { issue: "I received a police notice under Section 160 CrPC/BNSS. Must I appear?", category: "Criminal — Police Notice" },
    ],
    family: [
      { issue: "My spouse is seeking divorce under Special Marriage Act. What are the grounds?", category: "Family — Divorce" },
      { issue: "How much maintenance am I entitled to under Section 144 BNSS / Section 125 CrPC?", category: "Family — Maintenance" },
    ],
  };

  const specLower = specialisation.toLowerCase();
  let key = "default";
  if (specLower.includes("criminal")) key = "criminal";
  else if (specLower.includes("family") || specLower.includes("matrimon")) key = "family";

  const pool = [...(templates[key] || templates.default), ...templates.default];
  const now = Date.now();

  return pool.slice(0, count).map((t, i) => ({
    id: `mock-${i}`,
    created_at: new Date(now - i * 3_600_000).toISOString(),
    issue_summary: t.issue,
    category: t.category,
    status: "open" as const,
    chat_id: null,
  }));
}
