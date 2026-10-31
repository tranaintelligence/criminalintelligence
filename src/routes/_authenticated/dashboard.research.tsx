import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard/research")({
  head: () => ({
    meta: [
      { title: "Citizens Dashboard — TRANA" },
      { name: "description", content: "Search case law, statutes and legal information with citations and timelines." },
      { property: "og:title", content: "Citizens Dashboard — TRANA" },
      { property: "og:description", content: "Case law research with citations coming soon." },
    ],
  }),
  component: Research,
});

function Research() {
  const { user } = Route.useRouteContext();
  const [q, setQ] = useState("");
  const [email, setEmail] = useState(user.email ?? "");
  const [saved, setSaved] = useState(false);
  const [joined, setJoined] = useState(false);
  const sel = "border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-none";

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    await supabase.from("searches").insert({ user_id: user.id, query: q.trim() });
    setSaved(true);
  }
  async function join(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("research_waitlist").insert({ user_id: user.id, email });
    if (!error) setJoined(true);
  }

  return (
    <div>
      <h1 className="font-display text-4xl md:text-5xl">Legal Research</h1>
      <p className="mt-3 text-sm text-muted-foreground">Search case law, statutes and legal information with citations and timelines.</p>

      <form onSubmit={search} className="mt-10">
        <input value={q} onChange={(e) => { setQ(e.target.value); setSaved(false); }} placeholder="Search by topic, section, case name or keyword..." className="w-full border border-foreground/80 bg-background px-5 py-4 text-sm placeholder:text-muted-foreground focus:outline-none" />
        <div className="mt-3 flex flex-wrap gap-3">
          <select className={sel} aria-label="Court"><option>All courts</option><option>Supreme Court</option><option>High Court</option><option>Lower Court</option></select>
          <select className={sel} aria-label="Year range"><option>Any year</option><option>Last 5 years</option><option>Last 10 years</option><option>Before 2000</option></select>
          <select className={sel} aria-label="Area of law"><option>All areas</option><option>Criminal</option><option>Family</option><option>Property</option><option>Labour</option><option>Consumer</option></select>
        </div>
        {saved && <p className="mt-3 text-xs text-muted-foreground">Search saved. Results will be available when research launches.</p>}
      </form>

      <span className="mt-10 inline-block border border-foreground px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em]">Planned Feature Coming Soon</span>

      <div className="pointer-events-none mt-5 select-none border border-border bg-card p-7 opacity-40" aria-hidden>
        <p className="font-display text-2xl">Example Case Name v. State</p>
        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Supreme Court of India · Year</p>
        <p className="mt-4 text-sm text-muted-foreground">A short summary of the judgment and why it matters will appear here.</p>
        <p className="mt-3 text-xs text-muted-foreground">Sections cited:</p>
        <button disabled className="btn-line mt-5">View Full Judgment</button>
      </div>

      <div className="mt-10 border border-border bg-card p-7">
        <p className="text-sm">Full legal research with case citations and judgment timelines is coming soon. Join the waitlist to get early access.</p>
        {joined ? (
          <p className="mt-4 text-sm text-muted-foreground">You're on the list. We'll let you know.</p>
        ) : (
          <form onSubmit={join} className="mt-4 flex flex-wrap gap-3">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-0 flex-1 border border-border bg-background px-4 py-3 text-sm focus:border-foreground focus:outline-none" />
            <button className="btn-solid">Notify Me</button>
          </form>
        )}
      </div>
    </div>
  );
}
