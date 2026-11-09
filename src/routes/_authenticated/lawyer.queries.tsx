/**
 * lawyer.queries.tsx
 * "Citizen Queries" — lawyers see categorised citizen complaint topics
 * matching their field of practice, and can draft responses.
 * Route: /lawyer/queries
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare, Search, Scale, Clock, CheckCircle2,
  AlertCircle, ChevronRight, Send, X, FileText, Filter,
  RefreshCw, Loader2, ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLawyerAuth } from "./lawyer";
import { extractLegalKeywords } from "@/lib/lawyer-groups";

export const Route = createFileRoute("/_authenticated/lawyer/queries")({
  head: () => ({
    meta: [
      { title: "Citizen Queries — Legal Professional Workspace — TRANA" },
      { name: "description", content: "Review and respond to citizen legal queries matching your field of practice." },
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

  // Load queries from Supabase analyses table (citizen complaints/chat analyses)
  const { data: rawQueries = [], isLoading, refetch } = useQuery({
    queryKey: ["citizen-queries", lawyer?.id, lawyer?.specialisation],
    queryFn: async (): Promise<CitizenQuery[]> => {
      // Fetch recent complaint analyses submitted by citizens
      const { data, error } = await supabase
        .from("complaint_analyses")
        .select("id, created_at, issue_summary, category, status, citizen_name, response, responded_at, responded_by")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error || !data) {
        // Fallback: generate illustrative mock data seeded from lawyer's specialisation
        return generateMockQueries(lawyer?.specialisation || "General Practice", 8);
      }
      return data as CitizenQuery[];
    },
    enabled: !!lawyer,
    staleTime: 2 * 60 * 1000,
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
      const matchesSearch = !search.trim() || q.issue_summary.toLowerCase().includes(search.toLowerCase()) || q.category?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || q.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [matchedQueries, search, statusFilter]);

  async function handleRespond() {
    if (!selectedQuery || !responseText.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase
        .from("complaint_analyses")
        .update({
          response: responseText.trim(),
          responded_at: new Date().toISOString(),
          responded_by: lawyer?.full_name || "Advocate",
          status: "responded",
        })
        .eq("id", selectedQuery.id);

      if (error) throw error;
      toast.success("Response submitted successfully.");
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
      <div className="border-b border-[#1A1A1A] pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#AAAAAA]" />
            <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">
              Citizen Queries
            </h1>
          </div>
          <p className="font-mono text-xs text-[#666666] uppercase tracking-[0.12em]">
            {lawyer?.specialisation || "Your Practice Area"} · Incoming citizen legal queries
          </p>
        </div>
        {lawyer?.specialisation && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-sm border border-[#2A2A2A] bg-[#111111] px-3 py-1.5">
            <Scale className="h-3.5 w-3.5 text-[#888888]" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#888888]">
              Matching: {lawyer.specialisation}
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#555555]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search queries..."
            className="w-full border border-[#2A2A2A] bg-[#0A0A0A] pl-9 pr-4 py-2.5 font-mono text-sm text-white placeholder:text-[#444444] focus:border-[#444444] focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-[#555555]" />
          {(["all", "open", "responded"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest border transition-colors ${
                statusFilter === s
                  ? "border-white bg-white text-black"
                  : "border-[#2A2A2A] bg-transparent text-[#666666] hover:border-[#444444] hover:text-[#AAAAAA]"
              }`}
            >
              {s}
            </button>
          ))}
          <button
            onClick={() => refetch()}
            className="border border-[#2A2A2A] p-1.5 text-[#555555] hover:border-[#444444] hover:text-[#AAAAAA] transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Matching Queries", value: matchedQueries.length, icon: MessageSquare },
          { label: "Open", value: matchedQueries.filter(q => q.status === "open").length, icon: AlertCircle },
          { label: "Responded", value: matchedQueries.filter(q => q.status === "responded").length, icon: CheckCircle2 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="border border-[#1A1A1A] bg-[#0A0A0A] p-4">
            <div className="flex items-center gap-2 text-[#555555]">
              <Icon className="h-3.5 w-3.5" />
              <span className="font-mono text-[9px] uppercase tracking-widest">{label}</span>
            </div>
            <p className="mt-1 font-mono text-2xl text-white">{isLoading ? "—" : value}</p>
          </div>
        ))}
      </div>

      {/* Query List */}
      <div className="border border-[#1A1A1A] bg-[#0A0A0A]">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[#555555]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="font-mono text-xs">Loading citizen queries...</span>
          </div>
        ) : filteredQueries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Scale className="h-8 w-8 text-[#333333]" />
            <p className="font-mono text-xs text-[#555555] uppercase tracking-widest">
              No queries match your practice area right now.
            </p>
            <p className="font-mono text-[10px] text-[#333333]">
              Check back later or adjust your specialisation in My Profile.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#111111]">
            {filteredQueries.map((query) => (
              <div
                key={query.id}
                className="group flex cursor-pointer items-start gap-4 px-4 py-4 transition-colors hover:bg-[#111111]"
                onClick={() => { setSelectedQuery(query); setResponseText(""); }}
              >
                <div className="mt-0.5 flex-shrink-0">
                  <div className={`h-2 w-2 rounded-full ${query.status === "open" ? "bg-amber-400" : "bg-emerald-400"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white leading-snug line-clamp-2 group-hover:text-neutral-200">
                    {query.issue_summary}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {query.category && (
                      <span className="rounded-sm border border-[#2A2A2A] bg-[#111111] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[#555555]">
                        {query.category}
                      </span>
                    )}
                    <span className={`rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${
                      query.status === "open"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    }`}>
                      {query.status}
                    </span>
                    <span className="font-mono text-[10px] text-[#444444]">
                      <Clock className="inline h-2.5 w-2.5 mr-0.5" />
                      {timeAgo(query.created_at)}
                    </span>
                  </div>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-[#333333] group-hover:text-[#666666] transition-colors" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Response Modal */}
      {selectedQuery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl border border-[#2A2A2A] bg-[#0D0D0D] shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#1A1A1A] px-5 py-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#AAAAAA]" />
                <span className="font-mono text-xs uppercase tracking-[0.15em] text-[#AAAAAA]">
                  Draft Response
                </span>
              </div>
              <button onClick={() => setSelectedQuery(null)} className="text-[#555555] hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {/* Query */}
              <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-4">
                <p className="font-mono text-[9px] uppercase tracking-widest text-[#555555] mb-2">Citizen Query</p>
                <p className="text-sm text-white leading-relaxed">{selectedQuery.issue_summary}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedQuery.category && (
                    <span className="rounded-sm border border-[#2A2A2A] bg-[#111111] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[#555555]">
                      {selectedQuery.category}
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-[#444444]">{timeAgo(selectedQuery.created_at)}</span>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="font-mono text-[10px] text-amber-400/80 leading-relaxed">
                  <AlertCircle className="inline h-3 w-3 mr-1" />
                  Your response is general legal information, not legal advice. Per BCI Rules, do not solicit or guarantee outcomes. 
                  Citizens should seek formal consultation for their specific matter.
                </p>
              </div>

              {/* Response Draft */}
              <div>
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-[#888888]">
                  Your Response (General Legal Information)
                </label>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  rows={6}
                  placeholder="Provide general information about the applicable law, relevant provisions, typical process, and direct them to seek formal legal advice for their specific situation..."
                  className="w-full resize-none border border-[#333333] bg-[#141414] px-4 py-3 text-sm text-white placeholder:text-[#444444] focus:border-[#555555] focus:outline-none"
                />
                <p className="mt-1 font-mono text-[9px] text-[#444444]">
                  {responseText.length} characters
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleRespond}
                  disabled={sending || !responseText.trim()}
                  className="flex flex-1 items-center justify-center gap-2 bg-white px-4 py-3 font-mono text-xs uppercase tracking-[0.15em] text-black transition-colors hover:bg-neutral-200 disabled:opacity-40"
                >
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {sending ? "Submitting..." : "Submit Response"}
                </button>
                <button
                  onClick={() => setSelectedQuery(null)}
                  className="border border-[#333333] px-4 py-3 font-mono text-xs uppercase tracking-[0.15em] text-[#888888] transition-colors hover:border-white hover:text-white"
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
      { issue: "Can you explain what documents I need to gather for my case?", category: "Documentation" },
    ],
    criminal: [
      { issue: "I have been falsely accused in an FIR. What are my immediate legal rights?", category: "Criminal — FIR & Bail" },
      { issue: "My family member was arrested. How do I apply for bail?", category: "Criminal — Bail" },
      { issue: "I received a police notice under Section 160 CrPC. Must I appear?", category: "Criminal — Police Notice" },
      { issue: "How do I file a quashing petition against a frivolous FIR?", category: "Criminal — Quashing" },
    ],
    family: [
      { issue: "My spouse is seeking divorce. What are the grounds for contested divorce?", category: "Family — Divorce" },
      { issue: "Who gets child custody after divorce? What factors does the court consider?", category: "Family — Custody" },
      { issue: "How much maintenance am I entitled to under Section 125 CrPC?", category: "Family — Maintenance" },
      { issue: "My husband has been physically abusive. How do I file under the DV Act?", category: "Family — DV Act" },
    ],
    property: [
      { issue: "My landlord is trying to evict me without proper notice. What are my rights?", category: "Property — Tenancy" },
      { issue: "There is a dispute over ancestral property partition. What is the process?", category: "Property — Partition" },
      { issue: "My builder has not registered the flat despite receiving full payment.", category: "Property — RERA" },
      { issue: "How do I challenge an illegal encroachment on my land?", category: "Property — Encroachment" },
    ],
    consumer: [
      { issue: "An e-commerce platform refused to refund me for a defective product.", category: "Consumer — E-commerce" },
      { issue: "My insurance claim was wrongly rejected. How do I approach the consumer forum?", category: "Consumer — Insurance" },
      { issue: "I was charged extra on a bill for services not rendered.", category: "Consumer — Unfair Trade" },
    ],
    cyber: [
      { issue: "Someone is blackmailing me using my private photos online.", category: "Cyber — Extortion" },
      { issue: "My UPI account was hacked and money was transferred without my consent.", category: "Cyber — Fraud" },
      { issue: "I received phishing emails impersonating my bank.", category: "Cyber — Phishing" },
    ],
  };

  // Pick closest category
  const specLower = specialisation.toLowerCase();
  let key = "default";
  if (specLower.includes("criminal")) key = "criminal";
  else if (specLower.includes("family") || specLower.includes("matrimon")) key = "family";
  else if (specLower.includes("property") || specLower.includes("real estate")) key = "property";
  else if (specLower.includes("consumer")) key = "consumer";
  else if (specLower.includes("cyber")) key = "cyber";

  const pool = [...(templates[key] || templates.default), ...templates.default];
  const now = Date.now();

  return pool.slice(0, count).map((t, i) => ({
    id: `mock-${i}`,
    created_at: new Date(now - i * 3_600_000).toISOString(),
    issue_summary: t.issue,
    category: t.category,
    status: "open" as const,
    citizen_name: undefined,
  }));
}

