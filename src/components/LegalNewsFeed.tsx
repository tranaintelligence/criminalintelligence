/**
 * LegalNewsFeed.tsx
 * Vibrant Indian legal news widget for Lawyer, Student & Intern workspaces.
 * Displays live RSS (via allorigins proxy) or daily-rotated static headlines.
 */
import { useState, useEffect } from "react";
import { RefreshCw, ExternalLink, Newspaper, Scale, Loader2, Sparkles, BookOpen } from "lucide-react";
import { fetchIndianLegalNews, invalidateNewsCache, type LegalNewsItem } from "@/lib/legal-news";

interface LegalNewsFeedProps {
  /** Max headlines to show */
  limit?: number;
  /** Compact variant: smaller font, no source badges */
  compact?: boolean;
  className?: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const SOURCE_COLORS: Record<string, string> = {
  "LiveLaw": "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.15)]",
  "Bar & Bench": "bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-[0_0_10px_rgba(14,165,233,0.15)]",
  "NALSA": "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.15)]",
};

function getCategoryBadge(cat?: string) {
  if (!cat) return null;
  const c = cat.toLowerCase();
  if (c.includes("supreme") || c.includes("constitutional")) {
    return "bg-purple-500/20 text-purple-300 border-purple-500/30";
  }
  if (c.includes("criminal") || c.includes("bail")) {
    return "bg-rose-500/20 text-rose-300 border-rose-500/30";
  }
  if (c.includes("family") || c.includes("divorce") || c.includes("matrimonial")) {
    return "bg-pink-500/20 text-pink-300 border-pink-500/30";
  }
  if (c.includes("cyber") || c.includes("tech") || c.includes("court technology")) {
    return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
  }
  if (c.includes("bar council") || c.includes("legal aid")) {
    return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  }
  return "bg-white/10 text-neutral-200 border-white/15";
}

export function LegalNewsFeed({ limit = 6, compact = false, className = "" }: LegalNewsFeedProps) {
  const [news, setNews] = useState<LegalNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  async function loadNews(forceRefresh = false) {
    setLoading(true);
    if (forceRefresh) invalidateNewsCache();
    try {
      const items = await fetchIndianLegalNews(limit);
      setNews(items);
      setLastFetched(new Date());
    } catch {
      // Silently fail — static fallback handled inside fetchIndianLegalNews
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNews();
    // Refresh every hour
    const interval = setInterval(() => loadNews(), 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [limit]);

  return (
    <div className={`rounded-2xl border border-white/15 bg-gradient-to-b from-[#181822] via-[#121218] to-[#0c0c10] shadow-xl overflow-hidden backdrop-blur-xl ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-amber-500/10 via-purple-500/5 to-emerald-500/10 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 shadow-md">
            <Newspaper className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold tracking-wide text-white">
                Daily Indian Legal Intelligence
              </h3>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-mono font-medium uppercase tracking-wider text-emerald-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                </span>
                Live Updates
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 font-mono">
              Supreme Court &middot; High Courts &middot; Bar Council of India
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastFetched && !loading && (
            <span className="hidden font-mono text-[11px] text-neutral-400 sm:block">
              Updated {timeAgo(lastFetched.toISOString())}
            </span>
          )}
          <button
            onClick={() => loadNews(true)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-neutral-200 transition-all hover:bg-white/10 hover:border-emerald-400/50 hover:text-emerald-300 disabled:opacity-40 cursor-pointer shadow-sm active:scale-95"
            aria-label="Refresh legal news"
          >
            <RefreshCw className={`h-3 w-3 text-emerald-400 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="divide-y divide-white/[0.06]">
        {loading && news.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin text-amber-300" />
            <span className="font-mono text-xs text-neutral-300">Fetching live Indian legal news...</span>
          </div>
        ) : news.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-neutral-400">
            <Scale className="h-4 w-4 text-neutral-500" />
            <span className="font-mono text-xs">No news available. Try refreshing.</span>
          </div>
        ) : (
          news.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`Read full article on ${item.source}`}
              className="group flex items-start gap-3.5 px-5 py-3.5 transition-all hover:bg-white/[0.04] border-l-2 border-l-transparent hover:border-l-amber-400"
            >
              <div className="mt-1 flex-shrink-0">
                <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-amber-300 group-hover:scale-105 group-hover:bg-amber-400/10 group-hover:border-amber-400/30 transition-all">
                  <Scale className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-neutral-100 font-medium leading-snug group-hover:text-amber-100 transition-colors line-clamp-2 ${compact ? "text-xs" : "text-sm"}`}>
                  {item.title}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${SOURCE_COLORS[item.source] || "bg-white/10 text-neutral-300 border-white/20"}`}>
                    {item.source}
                  </span>
                  {!compact && item.category && (
                    <span className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-medium tracking-wide ${getCategoryBadge(item.category)}`}>
                      {item.category}
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-neutral-400">
                    &bull; {timeAgo(item.publishedAt)}
                  </span>
                </div>
              </div>
              <div className="mt-1.5 flex-shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-sky-400">
                <ExternalLink className="h-4 w-4" />
              </div>
            </a>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.08] bg-black/30 px-5 py-2.5 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
          Sources: LiveLaw &middot; Bar &amp; Bench &middot; NALSA
        </p>
        <span className="font-mono text-[10px] text-emerald-400/90 font-medium">
          Automated hourly sync
        </span>
      </div>
    </div>
  );
}
