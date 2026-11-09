/**
 * legal-news.ts
 * Indian legal news feed utility.
 * Fetches RSS from LiveLaw and BarAndBench. Falls back to curated static headlines
 * if the fetch fails (CORS / network issue in browser).
 *
 * Sources:
 *  - LiveLaw.in  : https://www.livelaw.in/rss/feed
 *  - Bar & Bench : https://www.barandbench.com/rss
 */

export type LegalNewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string; // ISO string
  category?: string;
};

/** Static fallback headlines — rotated daily by modulo of day-of-year */
const STATIC_HEADLINES: LegalNewsItem[] = [
  {
    id: "s1",
    title: "Supreme Court reaffirms right to speedy trial as fundamental right under Article 21",
    url: "https://www.livelaw.in",
    source: "LiveLaw",
    publishedAt: new Date().toISOString(),
    category: "Supreme Court",
  },
  {
    id: "s2",
    title: "BCI clarifies rules on advocate advertising and social media presence",
    url: "https://www.barandbench.com",
    source: "Bar & Bench",
    publishedAt: new Date().toISOString(),
    category: "Bar Council",
  },
  {
    id: "s3",
    title: "High Courts direct expeditious disposal of domestic violence cases under Section 12 DV Act",
    url: "https://www.livelaw.in",
    source: "LiveLaw",
    publishedAt: new Date().toISOString(),
    category: "Family Law",
  },
  {
    id: "s4",
    title: "Delhi HC issues guidelines on recording of statements of rape survivors",
    url: "https://www.barandbench.com",
    source: "Bar & Bench",
    publishedAt: new Date().toISOString(),
    category: "Criminal Law",
  },
  {
    id: "s5",
    title: "Supreme Court: Anticipatory bail cannot be curtailed on grounds of severity of offence alone",
    url: "https://www.livelaw.in",
    source: "LiveLaw",
    publishedAt: new Date().toISOString(),
    category: "Criminal Law",
  },
  {
    id: "s6",
    title: "NALSA launches new legal aid scheme for unorganised sector workers",
    url: "https://nalsa.gov.in",
    source: "NALSA",
    publishedAt: new Date().toISOString(),
    category: "Legal Aid",
  },
  {
    id: "s7",
    title: "SC directs all States to operationalise eCourts Phase III by end of financial year",
    url: "https://www.livelaw.in",
    source: "LiveLaw",
    publishedAt: new Date().toISOString(),
    category: "Court Technology",
  },
  {
    id: "s8",
    title: "Madras HC: Mediation mandatory in matrimonial disputes before granting divorce",
    url: "https://www.barandbench.com",
    source: "Bar & Bench",
    publishedAt: new Date().toISOString(),
    category: "Family Law",
  },
  {
    id: "s9",
    title: "CCI fines tech firm for abuse of dominant position in app-store billing",
    url: "https://www.livelaw.in",
    source: "LiveLaw",
    publishedAt: new Date().toISOString(),
    category: "Competition Law",
  },
  {
    id: "s10",
    title: "IT (Amendment) Rules 2023: High Court examines validity of content moderation mandates",
    url: "https://www.barandbench.com",
    source: "Bar & Bench",
    publishedAt: new Date().toISOString(),
    category: "Cyber Law",
  },
  {
    id: "s11",
    title: "SC: Section 498A IPC — strict scrutiny of arrest required; personal liberty paramount",
    url: "https://www.livelaw.in",
    source: "LiveLaw",
    publishedAt: new Date().toISOString(),
    category: "Criminal Law",
  },
  {
    id: "s12",
    title: "Law Commission recommends uniform civil code framework; public feedback invited",
    url: "https://www.barandbench.com",
    source: "Bar & Bench",
    publishedAt: new Date().toISOString(),
    category: "Legislative",
  },
];

/** Rotate the static list so it feels fresh each day */
function getDailyStaticNews(count = 6): LegalNewsItem[] {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000
  );
  const offset = dayOfYear % STATIC_HEADLINES.length;
  const rotated = [
    ...STATIC_HEADLINES.slice(offset),
    ...STATIC_HEADLINES.slice(0, offset),
  ];
  return rotated.slice(0, count);
}

/**
 * Attempt to parse an RSS XML string into LegalNewsItem[].
 * Uses DOMParser — works in browsers, not in SSR (returns [] on failure).
 */
function parseRss(xml: string, sourceName: string, limit = 5): LegalNewsItem[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    const items = Array.from(doc.querySelectorAll("item")).slice(0, limit);
    return items.map((item, idx) => ({
      id: `${sourceName}-${idx}`,
      title: item.querySelector("title")?.textContent?.trim() || "Legal Update",
      url: item.querySelector("link")?.textContent?.trim() || "https://www.livelaw.in",
      source: sourceName,
      publishedAt: item.querySelector("pubDate")?.textContent?.trim()
        ? new Date(item.querySelector("pubDate")!.textContent!.trim()).toISOString()
        : new Date().toISOString(),
      category: item.querySelector("category")?.textContent?.trim(),
    }));
  } catch {
    return [];
  }
}

const RSS_FEEDS = [
  { url: "https://api.allorigins.win/raw?url=https://www.livelaw.in/rss/feed", source: "LiveLaw" },
  { url: "https://api.allorigins.win/raw?url=https://www.barandbench.com/rss", source: "Bar & Bench" },
];

let _cache: { items: LegalNewsItem[]; ts: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetch Indian legal news.
 * Returns live RSS items if reachable, otherwise the daily-rotated static set.
 */
export async function fetchIndianLegalNews(limit = 8): Promise<LegalNewsItem[]> {
  // Return cache if fresh
  if (_cache && Date.now() - _cache.ts < CACHE_TTL) {
    return _cache.items.slice(0, limit);
  }

  const results: LegalNewsItem[] = [];

  await Promise.allSettled(
    RSS_FEEDS.map(async ({ url, source }) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const text = await res.text();
          const parsed = parseRss(text, source, Math.ceil(limit / 2));
          results.push(...parsed);
        }
      } catch {
        // Network failure — will use static below
      }
    })
  );

  if (results.length === 0) {
    const staticItems = getDailyStaticNews(limit);
    _cache = { items: staticItems, ts: Date.now() };
    return staticItems;
  }

  // Sort by most recent first
  results.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  _cache = { items: results, ts: Date.now() };
  return results.slice(0, limit);
}

/** Invalidate the news cache (e.g. on manual refresh) */
export function invalidateNewsCache() {
  _cache = null;
}

