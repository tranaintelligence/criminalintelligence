import { createServerFn } from "@tanstack/react-start";
import type { LegalNewsItem } from "./legal-news";

function cleanTitle(raw: string): string {
  let t = raw
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  t = t.replace(/\s*-\s*(Live\s*Law|Bar\s*(and|&)\s*Bench|SCC\s*Online|LawBeat|The\s*Hindu|The\s*Indian\s*Express|NDTV|Hindustan\s*Times)\s*$/i, "");
  return t;
}

function detectCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("supreme court") || t.includes("sc:") || t.includes("sc ")) return "Supreme Court";
  if (t.includes("high court") || t.includes(" hc") || t.includes("hc:")) return "High Court";
  if (t.includes("bail") || t.includes("arrest") || t.includes("fir") || t.includes("bns") || t.includes("criminal")) return "Criminal Law";
  if (t.includes("divorce") || t.includes("matrimon") || t.includes("maintenance") || t.includes("custody") || t.includes("family")) return "Family Law";
  if (t.includes("cyber") || t.includes("data") || t.includes("privacy") || t.includes("tech")) return "Cyber Law";
  if (t.includes("bar council") || t.includes("advocate") || t.includes("lawyer")) return "Bar Council";
  if (t.includes("tribunal") || t.includes("arbitrat") || t.includes("insolvency") || t.includes("commercial")) return "Commercial";
  return "Legal Update";
}

function detectSource(sourceName: string, title: string): string {
  const s = (sourceName || "").toLowerCase();
  const t = title.toLowerCase();
  if (s.includes("live law") || s.includes("livelaw") || t.includes("live law")) return "LiveLaw";
  if (s.includes("bar and bench") || s.includes("bar & bench") || t.includes("bar and bench") || t.includes("bar & bench")) return "Bar & Bench";
  if (s.includes("scc") || t.includes("scc online")) return "SCC Online";
  if (s.includes("lawbeat") || t.includes("lawbeat")) return "LawBeat";
  if (sourceName && sourceName.trim()) return sourceName.trim();
  return "Legal Intelligence";
}

export const getLiveLegalNews = createServerFn({ method: "GET" })
  .validator((input?: { limit?: number }) => ({ limit: input?.limit ?? 8 }))
  .handler(async ({ data }): Promise<LegalNewsItem[]> => {
    const limit = data.limit ?? 8;
    const query = "site:livelaw.in OR site:barandbench.com when:3d";
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch RSS: ${res.statusText}`);
    }

    const text = await res.text();
    const items: LegalNewsItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(text)) !== null && items.length < limit * 2) {
      const xml = match[1];
      const rawTitle = xml.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "";
      const link = xml.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "";
      const pubDate = xml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "";
      const sourceEl = xml.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || "";

      const title = cleanTitle(rawTitle);
      if (!title || !link || title.toLowerCase().includes("google news")) continue;

      const source = detectSource(sourceEl, rawTitle);
      const category = detectCategory(title);

      items.push({
        id: `live-${Math.random().toString(36).substring(2, 9)}`,
        title,
        url: link,
        source,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        category,
      });
    }

    // Sort newest first
    items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    return items.slice(0, limit);
  });
