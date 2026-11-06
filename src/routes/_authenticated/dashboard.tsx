import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Menu, X, Scale, GraduationCap, ArrowUpRight, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/lib/user-role";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Citizens Dashboard — TRANA" },
      { name: "description", content: "Your TRANA legal first-aid dashboard." },
      { property: "og:title", content: "Citizens Dashboard — TRANA" },
      { property: "og:description", content: "Understand your situation and connect with a lawyer." },
    ],
  }),
  component: DashboardLayout,
});

const nav = [
  { to: "/dashboard", label: "Home", exact: true },
  { to: "/dashboard/chat", label: "Legal First Aid" },
  { to: "/dashboard/analyse", label: "Complaint Analyser" },
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
  const { role, isLawyer, isStudent, isFounder, studentProfile } = useUserRole(user?.id, user?.email);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [showLawyerModal, setShowLawyerModal] = useState(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);

  useEffect(() => {
    document.title = "Citizens Dashboard — TRANA";
  }, [location.pathname]);

  // Check if current logged-in user has already accepted the advocate notice
  const { data: hasAcknowledged } = useQuery({
    queryKey: ["advocate-disclaimer-acknowledged", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem(`trana_disclaimer_accepted_${user.id}`);
        if (cached === "true" || localStorage.getItem("trana_statutory_disclaimer_accepted") === "true") return true;
      }
      try {
        const { data } = await supabase
          .from("advocate_disclaimers")
          .select("id")
          .or(`user_id.eq.${user.id},user_email.eq.${user.email || ""}`)
          .limit(1)
          .maybeSingle();

        if (data) {
          if (typeof window !== "undefined") {
            localStorage.setItem(`trana_disclaimer_accepted_${user.id}`, "true");
          }
          return true;
        }
      } catch (err) {
        console.warn("Could not check advocate disclaimer status:", err);
      }
      return false;
    },
    staleTime: Infinity,
    enabled: Boolean(user?.id),
  });

  function handleFindLawyerClick(e?: React.MouseEvent) {
    if (e) e.preventDefault();
    setOpen(false);

    // If logged in and already acknowledged, go directly without prompting again
    const isCached =
      (user?.id && typeof window !== "undefined" && localStorage.getItem(`trana_disclaimer_accepted_${user.id}`) === "true") ||
      (typeof window !== "undefined" && localStorage.getItem("trana_statutory_disclaimer_accepted") === "true");
    if (hasAcknowledged || isCached) {
      navigate({ to: "/dashboard/lawyers" });
      return;
    }

    setDisclaimerChecked(false);
    setShowLawyerModal(true);
  }

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
    <div className="flex h-full flex-col text-[#F0F0F0] relative overflow-hidden select-none">
      {/* Brand Header */}
      <div className="p-4 pb-3 flex items-center justify-between relative border-b border-white/[0.08]">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            className="w-9 h-9 rounded-2xl bg-white/[0.12] hover:bg-white/[0.18] border border-white/25 flex items-center justify-center shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.6),0_4px_16px_rgba(0,0,0,0.4),0_0_12px_rgba(255,255,255,0.08)] text-white font-bold font-display text-lg shrink-0 hover:scale-105 transition-all"
            title="TRANA Home"
          >
            T
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Link
                to="/"
                className="font-display font-bold text-base text-white tracking-wide hover:text-neutral-200 transition-colors truncate"
              >
                TRANA
              </Link>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-white/10 text-neutral-300 border border-white/20">
                CITIZEN
              </span>
            </div>
            <div className="text-[11px] text-neutral-400 font-sans truncate leading-none mt-0.5">
              Legal First-Aid Portal
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Area */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3">
        <nav className="space-y-1">
          {nav.map((n) => {
            const isActive =
              n.to === "/dashboard"
                ? location.pathname === "/dashboard" || location.pathname === "/dashboard/"
                : location.pathname.startsWith(n.to);

            if (n.to === "/dashboard/lawyers") {
              return (
                <button
                  key={n.to}
                  type="button"
                  onClick={handleFindLawyerClick}
                  className={`w-full text-left apple-nav-item flex items-center justify-between px-3.5 py-2 my-0.5 rounded-full text-xs font-sans font-medium transition-colors relative z-10 cursor-pointer ${
                    isActive ? "text-white bg-white/[0.14] border border-white/25 shadow-sm" : "text-neutral-300 hover:text-white hover:bg-white/[0.08]"
                  }`}
                >
                  <span className="tracking-normal truncate">{n.label}</span>
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />}
                </button>
              );
            }

            return (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: "exact" in n }}
                onClick={() => setOpen(false)}
                className={`apple-nav-item flex items-center justify-between px-3.5 py-2 my-0.5 rounded-full text-xs font-sans font-medium transition-colors relative z-10 ${
                  isActive ? "text-white bg-white/[0.14] border border-white/25 shadow-sm" : "text-neutral-300 hover:text-white hover:bg-white/[0.08]"
                }`}
              >
                <span className="tracking-normal truncate">{n.label}</span>
                {isActive && <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Floating User Profile Capsule at Bottom */}
      <div className="p-3 border-t border-white/[0.08] bg-black/25 backdrop-blur-xl mt-auto space-y-2">
        <div className="relative overflow-hidden rounded-2xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/15 p-2 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.3),0_8px_20px_rgba(0,0,0,0.35)] transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-white/25 via-white/50 to-white/20 p-[1px] shadow-sm">
                  <div className="w-full h-full rounded-full bg-[#121216] flex items-center justify-center text-xs font-semibold text-white">
                    {profile?.name?.[0]?.toUpperCase() || "C"}
                  </div>
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-white truncate leading-tight">
                  {profile?.name || "Citizen"}
                </div>
                <div className="text-[10px] text-neutral-400 truncate leading-tight mt-0.5 font-mono">
                  {profile?.email}
                </div>
              </div>
            </div>

            {isFounder ? (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                Founder
              </span>
            ) : isLawyer ? (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                <Scale className="h-2.5 w-2.5" />
                Advocate
              </span>
            ) : isStudent ? (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1 shrink-0">
                <GraduationCap className="h-2.5 w-2.5" />
                Student
              </span>
            ) : (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-white/10 text-neutral-300 border border-white/20 shrink-0">
                Citizen
              </span>
            )}
          </div>
        </div>

        {/* Portal Switcher Buttons */}
        <div className="flex flex-col gap-1 pt-1 text-[11px] font-mono">
          {(isLawyer || isFounder) && (
            <Link
              to="/lawyer"
              className="flex items-center justify-between text-neutral-300 hover:text-white px-2 py-1 rounded-lg hover:bg-white/[0.06] transition-colors"
            >
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Scale className="h-3 w-3" />
                <span>Advocate Portal</span>
              </span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}

          {(isStudent || isLawyer || isFounder) && (
            <Link
              to="/student"
              className="flex items-center justify-between text-neutral-300 hover:text-white px-2 py-1 rounded-lg hover:bg-white/[0.06] transition-colors"
            >
              <span className="flex items-center gap-1.5 text-purple-300">
                <GraduationCap className="h-3 w-3" />
                <span>Student Workspace</span>
              </span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}

          {isFounder && (
            <Link
              to="/founders"
              className="flex items-center justify-between text-neutral-300 hover:text-white px-2 py-1 rounded-lg hover:bg-white/[0.06] transition-colors"
            >
              <span className="flex items-center gap-1.5 text-amber-300">
                <ShieldCheck className="h-3 w-3" />
                <span>Founders Admin</span>
              </span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}

          {!isLawyer && !isStudent && !isFounder && (
            <div className="flex flex-col gap-0.5">
              <Link
                to="/student"
                className="text-purple-400 hover:text-purple-300 flex items-center justify-between px-2 py-1 rounded-lg hover:bg-purple-950/30 transition-colors"
              >
                <span>Law Student Portal →</span>
              </Link>
              <Link
                to="/lawyer"
                className="text-neutral-300 hover:text-white flex items-center justify-between px-2 py-1 rounded-lg hover:bg-white/[0.06] transition-colors"
              >
                <span>Advocate Portal →</span>
              </Link>
            </div>
          )}

          <button
            onClick={signOut}
            className="w-full mt-1 text-center py-1.5 text-[10px] uppercase tracking-wider text-neutral-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="founders-canvas apple-glass-canvas relative min-h-screen text-[#F0F0F0] selection:bg-white selection:text-black">
      {/* Ambient background subtle monochrome white glow */}
      <div className="fixed top-[-80px] left-[5%] w-[550px] h-[550px] rounded-full bg-white/[0.025] blur-[140px] pointer-events-none -z-10" />
      <div className="fixed top-[30%] right-[-80px] w-[550px] h-[550px] rounded-full bg-white/[0.02] blur-[150px] pointer-events-none -z-10" />

      {/* Desktop Left Sidebar: Fixed Floating Apple Glass */}
      <aside className="hidden md:flex flex-col fixed top-0 left-0 bottom-0 w-[275px] p-3 lg:p-4 z-40 select-none">
        <div className="apple-floating-sidebar w-full h-full flex flex-col relative overflow-hidden">
          {sidebar}
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="flex items-center justify-between border-b border-white/10 bg-[#0d0b14]/80 backdrop-blur-2xl px-4 py-3 md:hidden sticky top-0 z-40 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-white/[0.12] border border-white/25 flex items-center justify-center shadow-md text-white font-bold font-display text-sm">
            T
          </div>
          <span className="font-display text-base tracking-[0.15em] text-[#F0F0F0]">TRANA</span>
          <span className="apple-glass-pill text-[9px] px-1.5 py-0.5 text-neutral-300 font-mono">CITIZEN</span>
        </div>
        <button
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="p-1.5 apple-glass-pill text-[#F0F0F0] cursor-pointer"
        >
          <Menu className="h-4 w-4" />
        </button>
      </header>

      {/* Mobile Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md md:hidden flex p-3">
          <div className="apple-floating-sidebar w-[275px] h-full flex flex-col relative overflow-hidden shadow-2xl">
            <button
              aria-label="Close menu"
              className="absolute right-3.5 top-3.5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/25 text-neutral-300 hover:text-white z-50 transition-all cursor-pointer"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main
        className="md:ml-[275px] min-h-screen text-[#F0F0F0] p-4 md:p-6 lg:p-8 relative z-10"
        onClickCapture={(e) => {
          const target = (e.target as HTMLElement).closest('a[href="/dashboard/lawyers"]');
          if (target) {
            const isCached = user?.id && typeof window !== "undefined" && localStorage.getItem(`trana_disclaimer_accepted_${user.id}`) === "true";
            if (!hasAcknowledged && !isCached) {
              e.preventDefault();
              setDisclaimerChecked(false);
              setShowLawyerModal(true);
            }
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
                    // Check if already in DB before inserting to prevent duplicate records
                    const { data: existing } = await supabase
                      .from("advocate_disclaimers")
                      .select("id")
                      .or(`user_id.eq.${user?.id || ""},user_email.eq.${user?.email || profile?.email || ""}`)
                      .limit(1)
                      .maybeSingle();

                    if (!existing) {
                      await supabase.from("advocate_disclaimers").insert({
                        user_id: user?.id || null,
                        user_email: user?.email || profile?.email || null,
                        user_name: profile?.name || (user as any)?.user_metadata?.full_name || "Citizen Account",
                        notice_text: "I have read and understood this notice and voluntarily elect to view advocate details.",
                      });
                    }
                  } catch (err) {
                    console.warn("Could not log advocate disclaimer acceptance:", err);
                  }
                  if (user?.id && typeof window !== "undefined") {
                    localStorage.setItem(`trana_disclaimer_accepted_${user.id}`, "true");
                  }
                  qc.setQueryData(["advocate-disclaimer-acknowledged", user?.id], true);
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
