import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./dashboard";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: Home,
});

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const cards = [
  { title: "FIR Analyser", body: "Describe what happened or upload a legal document. Get a plain-language explanation of your rights and next steps.", cta: "Get Started", to: "/dashboard/analyse" },
  { title: "Find a Legal Professional", body: "Connect with verified lawyers and legal experts. Arrange a consultation by call or chat.", cta: "Find a Lawyer", to: "/dashboard/lawyers" },
  { title: "Case Tracker", body: "Enter your 16-character CNR number to track eCourts status and schedule automated SMS and Email hearing reminders.", cta: "Track My Case", to: "/dashboard/cases" },
] as const;

function Home() {
  const { data: profile } = useProfile();
  const { data: activity = [] } = useQuery({
    queryKey: ["activity"],
    queryFn: async () => {
      const [a, s] = await Promise.all([
        supabase.from("analyses").select("id, situation, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("searches").select("id, query, created_at").order("created_at", { ascending: false }).limit(5),
      ]);
      return [
        ...(a.data ?? []).map((r) => ({ id: r.id, kind: "Situation analysis", text: r.situation, at: r.created_at })),
        ...(s.data ?? []).map((r) => ({ id: r.id, kind: "Research search", text: r.query, at: r.created_at })),
      ].sort((x, y) => y.at.localeCompare(x.at)).slice(0, 6);
    },
  });

  return (
    <div>
      <h1 className="font-display text-4xl leading-tight md:text-5xl">
        {greeting()}, {profile?.name}.<br />How can TRANA help you today?
      </h1>
      <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
        Remember TRANA provides legal information and first aid. For legal advice, always speak to a qualified lawyer.
      </p>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.title} className="flex flex-col border border-foreground/80 bg-card p-7">
            <h2 className="font-display text-2xl">{c.title}</h2>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
            <Link to={c.to} className="btn-solid mt-8 self-start">{c.cta}</Link>
          </div>
        ))}
      </div>

      <section className="mt-16">
        <h2 className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Recent activity</h2>
        {activity.length === 0 ? (
          <p className="mt-5 border border-border bg-card p-6 text-sm text-muted-foreground">
            You haven't used TRANA yet. Start by describing your legal situation.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-border border border-border bg-card">
            {activity.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-6 p-5">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{a.kind}</p>
                  <p className="mt-1 truncate text-sm">{a.text}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{new Date(a.at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
