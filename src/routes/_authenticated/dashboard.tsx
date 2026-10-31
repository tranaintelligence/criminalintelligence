import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
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
  { to: "/dashboard/lawyers", label: "Find a Lawyer" },
  { to: "/dashboard/consultations", label: "My Consultations" },
  { to: "/dashboard/help", label: "Help & Support" },
] as const;

export function useProfile() {
  const { user } = Route.useRouteContext();
  return useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      try {
        const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
        return {
          name: data?.full_name || (user as any).name || (user as any).user_metadata?.full_name || user.email?.split("@")[0] || "there",
          email: user.email ?? "",
        };
      } catch {
        return {
          name: (user as any).name || (user as any).user_metadata?.full_name || user.email?.split("@")[0] || "there",
          email: user.email ?? "",
        };
      }
    },
  });
}

function DashboardLayout() {
  const { user } = Route.useRouteContext();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [showLawyerModal, setShowLawyerModal] = useState(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    if (typeof window !== "undefined") {
      localStorage.removeItem("trana_session_token");
      localStorage.removeItem("trana_user");
    }
    await supabase.auth.signOut().catch(() => {});
    navigate({ to: "/auth", replace: true });
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link to="/" className="font-display text-3xl font-semibold tracking-[0.25em] text-foreground">TRANA</Link>
      <p className="mt-1 text-xs text-muted-foreground">त्राणा — Protection.</p>
      <nav className="mt-12 flex flex-col gap-1">
        {nav.map((n) => {
          if (n.to === "/dashboard/lawyers") {
            const isActive = location.pathname === "/dashboard/lawyers";
            return (
              <button
                key={n.to}
                type="button"
                onClick={() => {
                  setOpen(false);
                  setDisclaimerChecked(false);
                  setShowLawyerModal(true);
                }}
                className={`border-l-2 text-left px-3 py-2.5 text-sm transition-colors hover:text-foreground ${
                  isActive ? "!border-foreground !text-foreground" : "border-transparent text-muted-foreground"
                }`}
              >
                {n.label}
              </button>
            );
          }
          return (
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
          );
        })}
      </nav>
      <div className="mt-auto border-t border-border pt-5">
        <p className="truncate text-sm text-foreground">{profile?.name}</p>
        <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
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
      <main
        className="md:ml-[260px]"
        onClickCapture={(e) => {
          const target = (e.target as HTMLElement).closest('a[href="/dashboard/lawyers"]');
          if (target) {
            e.preventDefault();
            setDisclaimerChecked(false);
            setShowLawyerModal(true);
          }
        }}
      >
        <div className="mx-auto max-w-5xl px-6 py-10 md:px-12 md:py-14">
          <Outlet />
        </div>
      </main>

      {showLawyerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg border border-border bg-card p-6 md:p-8 shadow-2xl">
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                  Statutory & Bar Council Disclaimer
                </p>
                <h3 className="font-display text-2xl text-foreground mt-1">
                  Advocate Directory Notice
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowLawyerModal(false);
                  setDisclaimerChecked(false);
                }}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                TRANA is a legal information platform. It does not advertise, solicit, endorse or rank any advocate, and it receives no fee, commission or other consideration from any advocate in connection with this listing.
              </p>
              <p>
                The advocates shown have voluntarily elected to be listed and are solely responsible for the accuracy of the particulars they have furnished. These particulars are presented in alphabetical order, for information only.
              </p>
              <p>
                Access to this information is entirely at your own initiative. Nothing herein constitutes a recommendation, an endorsement or legal advice, and no advocate-client relationship arises from viewing it.
              </p>
            </div>

            <label className="mt-6 flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={disclaimerChecked}
                onChange={(e) => setDisclaimerChecked(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border bg-background text-foreground accent-foreground focus:ring-1 focus:ring-foreground"
              />
              <span className="text-xs text-foreground leading-normal">
                I have read and understood this notice and voluntarily elect to view advocate details.
              </span>
            </label>

            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowLawyerModal(false);
                  setDisclaimerChecked(false);
                }}
                className="border border-border px-5 py-2.5 text-xs uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!disclaimerChecked}
                onClick={async () => {
                  try {
                    await supabase.from("advocate_disclaimers").insert({
                      user_id: user?.id || null,
                      user_email: user?.email || profile?.email || null,
                      user_name: profile?.name || (user as any)?.user_metadata?.full_name || "Citizen Account",
                      notice_text: "I have read and understood this notice and voluntarily elect to view advocate details.",
                    });
                  } catch (err) {
                    console.warn("Could not log advocate disclaimer acceptance:", err);
                  }
                  setShowLawyerModal(false);
                  setDisclaimerChecked(false);
                  navigate({ to: "/dashboard/lawyers" });
                }}
                className="btn-solid text-xs py-2.5 px-6 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary disabled:hover:text-primary-foreground"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
