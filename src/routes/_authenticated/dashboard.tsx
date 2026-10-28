import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard TRANA" },
      { name: "description", content: "Your TRANA legal first-aid dashboard." },
      { property: "og:title", content: "Dashboard TRANA" },
      { property: "og:description", content: "Understand your situation and connect with a lawyer." },
    ],
  }),
  component: DashboardLayout,
});

const nav = [
  { to: "/dashboard", label: "Home", exact: true },
  { to: "/dashboard/chat", label: "Legal Chat" },
  { to: "/dashboard/analyse", label: "Analyse My Situation" },
  { to: "/dashboard/research", label: "Legal Research" },
  { to: "/dashboard/lawyers", label: "Find a Lawyer" },
  { to: "/dashboard/consultations", label: "My Consultations" },
  { to: "/dashboard/help", label: "Help & Support" },
] as const;

export function useProfile() {
  const { user } = Route.useRouteContext();
  return useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      return { name: data?.full_name || user.email?.split("@")[0] || "there", email: user.email ?? "" };
    },
  });
}

function DashboardLayout() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link to="/" className="font-display text-3xl font-semibold tracking-[0.25em] text-foreground">TRANA</Link>
      <p className="mt-1 text-xs text-muted-foreground">त्राणा — Protection.</p>
      <nav className="mt-12 flex flex-col gap-1">
        {nav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: "exact" in n }}
            onClick={() => setOpen(false)}
            className="border-l-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "!border-foreground !text-foreground" }}
          >
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto border-t border-border pt-5">
        <p className="truncate text-sm text-foreground">{profile?.name}</p>
        <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
        <Link to="/lawyer" className="mt-3 flex items-center justify-between text-xs text-foreground/80 hover:text-foreground border border-border px-2.5 py-1.5 transition-colors">
          <span>Advocate Workspace</span>
          <span className="font-mono text-[0.65rem] text-amber-400">/lawyer →</span>
        </Link>
        <button onClick={signOut} className="mt-3 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">Log out</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-[260px] border-r border-border bg-secondary p-7 md:block">{sidebar}</aside>
      <header className="flex items-center justify-between border-b border-border px-5 py-4 md:hidden">
        <span className="font-display text-2xl tracking-[0.25em]">TRANA</span>
        <button aria-label="Open menu" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 bg-secondary p-7 md:hidden">
          <button aria-label="Close menu" className="absolute right-5 top-5" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
          {sidebar}
        </div>
      )}
      <main className="md:ml-[260px]">
        <div className="mx-auto max-w-5xl px-6 py-10 md:px-12 md:py-14">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
