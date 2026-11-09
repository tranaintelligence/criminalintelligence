/**
 * LegalNewsFeed.tsx
 * Indian legal news widget for Lawyer, Student & Intern workspaces.
 * Displays live RSS (via allorigins proxy) or daily-rotated static headlines.
 */
import { useState, useEffect } from "react";
import { RefreshCw, ExternalLink, Newspaper, Scale, Loader2 } from "lucide-react";
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
  "LiveLaw": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Bar & Bench": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "NALSA": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

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
    <div className={`border border-[#222222] bg-[#0A0A0A] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1A1A1A] px-4 py-3">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-[#AAAAAA]" />
          <span className="font-mono text-xs uppercase tracking-[0.15em] text-[#AAAAAA]">
            Indian Legal News
          </span>
          <span className="ml-1 rounded-sm border border-[#2A2A2A] bg-[#111111] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[#555555]">
            Live
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastFetched && !loading && (
            <span className="hidden font-mono text-[10px] text-[#444444] sm:block">
              Updated {timeAgo(lastFetched.toISOString())}
            </span>
          )}
          <button
            onClick={() => loadNews(true)}
            disabled={loading}
            className="flex items-center gap-1 rounded border border-[#2A2A2A] bg-[#111111] px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-[#666666] transition-colors hover:border-[#444444] hover:text-[#AAAAAA] disabled:opacity-40"
            aria-label="Refresh legal news"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="divide-y divide-[#111111]">
        {loading && news.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-[#555555]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="font-mono text-xs">Fetching today's legal updates...</span>
          </div>
        ) : news.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-[#555555]">
            <Scale className="h-4 w-4" />
            <span className="font-mono text-xs">No news available. Try refreshing.</span>
          </div>
        ) : (
          news.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[#111111]"
            >
              <div className="mt-0.5 flex-shrink-0">
                <Scale className="h-3.5 w-3.5 text-[#444444] group-hover:text-[#888888] transition-colors" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-white leading-snug group-hover:text-neutral-200 transition-colors line-clamp-2 ${compact ? "text-xs" : "text-sm"}`}>
                  {item.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {!compact && item.category && (
                    <span className="rounded-sm border border-[#2A2A2A] bg-[#111111] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[#555555]">
                      {item.category}
                    </span>
                  )}
                  <span className={`rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${SOURCE_COLORS[item.source] || "bg-[#111111] text-[#555555] border-[#2A2A2A]"}`}>
                    {item.source}
                  </span>
                  <span className="font-mono text-[10px] text-[#444444]">
                    {timeAgo(item.publishedAt)}
                  </span>
                </div>
              </div>
              <ExternalLink className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-[#333333] group-hover:text-[#666666] transition-colors" />
            </a>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[#1A1A1A] px-4 py-2">
        <p className="font-mono text-[9px] uppercase tracking-widest text-[#333333]">
          Sources: LiveLaw · Bar &amp; Bench · NALSA — Updated hourly
        </p>
      </div>
    </div>
  );
}

