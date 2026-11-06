import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, FileText, Scale, ArrowUpRight, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./dashboard";
import { useTranaCredential, authFetch } from "@/lib/trana-auth";
import { API_URL } from "@/lib/trana-backend";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({
    meta: [
      { title: "Dashboard — TRANA" },
      { name: "description", content: "TRANA Citizen Dashboard: Legal AI First Aid, FIR Analysis, and Lawyer consultations." },
      { property: "og:title", content: "Dashboard — TRANA" },
    ],
  }),
  component: Home,
});

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function formatActivityTime(isoString?: string) {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

const cards = [
  {
    title: "Legal AI Advisor",
    badge: "Interactive Chat",
    body: "Chat with TRANA AI for instant guidance on Indian statutory provisions, offenses, bail eligibility, and your legal rights.",
    cta: "Start Legal Chat",
    to: "/dashboard/chat",
  },
  {
    title: "Complaint Analyser",
    badge: "Document & Case",
    body: "Describe what happened or upload the FIR/complaint. Get a plain-language explanation of your rights and next steps.",
    cta: "Get Started",
    to: "/dashboard/analyse",
  },
  {
    title: "Find a Legal Professional",
    badge: "Verified Advocates",
    body: "Connect with verified lawyers and legal experts. Arrange a consultation by call or chat.",
    cta: "Find a Professional",
    to: "/dashboard/lawyers",
  },
] as const;

interface ActivityItem {
  id: string;
  kind: string;
  category?: "chat" | "document" | "analysis" | "consultation" | "search";
  title?: string;
  text?: string;
  at: string;
  link?: string;
  session_id?: string | null;
  message_count?: number;
}

function Home() {
  const { data: profile } = useProfile();
  const { credential } = useTranaCredential();

  const {
    data: activity = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery<ActivityItem[]>({
    queryKey: ["citizen-activity", credential],
    queryFn: async () => {
      // 1. Try to fetch unified chronological activity from TRANA Backend
      if (credential) {
        try {
          const resp = await authFetch(`${API_URL}/api/citizen/activity`, credential);
          if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data.activities) && data.activities.length > 0) {
              return data.activities;
            }
          }
        } catch (err) {
          console.warn("Could not fetch backend activity feed, falling back to Supabase:", err);
        }
      }

      // 2. Fallback to Supabase analyses & searches
      try {
        const [a, s] = await Promise.all([
          supabase.from("analyses").select("id, situation, created_at").order("created_at", { ascending: false }).limit(5),
          supabase.from("searches").select("id, query, created_at").order("created_at", { ascending: false }).limit(5),
        ]);

        return [
          ...(a.data ?? []).map((r) => ({
            id: `analysis-${r.id}`,
            kind: "Situation Analysis",
            category: "analysis" as const,
            title: "FIR Situation Analysis",
            text: r.situation,
            at: r.created_at,
            link: "/dashboard/analyse",
            message_count: 0,
          })),
          ...(s.data ?? []).map((r) => ({
            id: `search-${r.id}`,
            kind: "Legal Research",
            category: "search" as const,
            title: "Case Law Search",
            text: r.query,
            at: r.created_at,
            link: "/student",
            message_count: 0,
          })),
        ].sort((x, y) => (y.at || "").localeCompare(x.at || "")).slice(0, 8);
      } catch {
        return [];
      }
    },
    staleTime: 20000,
  });

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-display text-4xl leading-tight md:text-5xl text-white">
          {greeting()}, {profile?.name || "Citizen"}.<br />How can TRANA help you today?
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-neutral-400">
          Remember TRANA provides legal information and first aid. For legal advice, always speak to a qualified lawyer.
        </p>
      </div>

      {/* Feature Navigation Cards (3 Columns) */}
      <div className="grid gap-5 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.title} className="apple-glass-card p-7 flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-2xl text-white group-hover:text-emerald-300 transition-colors">{c.title}</h2>
                <span className="apple-glass-pill text-[10px] font-mono uppercase tracking-wider text-neutral-300 px-2 py-0.5 shrink-0">
                  {c.badge}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-neutral-300">{c.body}</p>
            </div>
            <Link
              to={c.to}
              className="mt-8 self-start bg-white text-black hover:bg-neutral-200 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all shadow-md flex items-center gap-2 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              <span>{c.cta}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ))}
      </div>

      {/* Recent Activity Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.25em] text-neutral-400 font-mono">Recent activity</h2>
          {activity.length > 0 && (
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="apple-glass-pill px-3 py-1 text-xs font-mono text-neutral-300 hover:text-white inline-flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              title="Refresh recent activity"
            >
              <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin text-white" : ""}`} />
              <span>Refresh</span>
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="apple-glass-card p-8 text-center text-sm text-neutral-400 flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-white" />
            <span>Loading recent activity...</span>
          </div>
        ) : activity.length === 0 ? (
          <div className="apple-glass-card p-6 text-sm text-neutral-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-medium text-white">You haven't initiated any inquiries yet.</p>
              <p className="text-xs mt-1 text-neutral-400">
                Start a legal chat or analyze an FIR to get instant guidance on Indian statutory provisions.
              </p>
            </div>
            <Link
              to="/dashboard/chat"
              className="bg-white text-black hover:bg-neutral-200 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider self-start sm:self-auto shrink-0 transition-colors shadow-sm"
            >
              Start Legal Chat →
            </Link>
          </div>
        ) : (
          <div className="apple-glass-card overflow-hidden">
            <ul className="divide-y divide-white/[0.08]">
              {activity.map((a) => {
                const Icon =
                  a.category === "chat"
                    ? MessageSquare
                    : a.category === "document"
                    ? FileText
                    : a.category === "consultation"
                    ? Scale
                    : FileText;

                return (
                  <li key={a.id} className="group hover:bg-white/[0.04] transition-colors">
                    <Link
                      to={a.link || "/dashboard/chat"}
                      className="flex items-start justify-between gap-4 p-5"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="mt-0.5 rounded-xl border border-white/20 bg-white/[0.08] p-2 text-neutral-300 group-hover:text-white group-hover:border-white/40 transition-colors shrink-0 shadow-sm">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
                              {a.kind}
                            </span>
                            {Boolean(a.message_count && a.message_count > 0) && (
                              <span className="apple-glass-pill text-[9px] font-mono text-neutral-200 px-1.5 py-0.2">
                                {a.message_count} {a.message_count === 1 ? "msg" : "msgs"}
                              </span>
                            )}
                          </div>
                          <h3 className="font-medium text-sm text-white mt-1 group-hover:text-emerald-300 transition-colors truncate">
                            {a.title || a.text}
                          </h3>
                          {Boolean(a.text && a.title !== a.text) && (
                            <p className="mt-0.5 text-xs text-neutral-400 line-clamp-1">
                              {a.text}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 pt-0.5">
                        <span className="text-xs font-mono text-neutral-400">
                          {formatActivityTime(a.at)}
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-neutral-400 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
