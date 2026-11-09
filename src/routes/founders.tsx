import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, createContext, useContext } from "react";
import { 
  BarChart3, Users, Scale, Settings, Menu, X, ShieldCheck, MessageSquare, ShieldAlert, LogOut,
  Search, ChevronLeft, ChevronRight, Activity, Sparkles, LayoutDashboard, GraduationCap
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { API_URL } from "@/lib/trana-backend";

export const DEFAULT_ADMIN_EMAILS = [
  "ckhraiushh1@gmail.com", "swastik2007mishra@gmail.com", "tranaintelliegence@gmail.com", "tranaintelligence@gmail.com", "founder@trana.in", "admin@trana.in", "team@trana.in",
];

export function checkIsAdmin(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  // Primary founder instant check
  if (["ckhraiushh1@gmail.com", "swastik2007mishra@gmail.com", "tranaintelliegence@gmail.com", "tranaintelligence@gmail.com"].includes(normalized)) return true;

  // Check cached authorized founders from encrypted backend table
  try {
    const cached = localStorage.getItem("trana_authorized_founders");
    if (cached) {
      const list = JSON.parse(cached);
      if (Array.isArray(list) && list.map((e: string) => e.toLowerCase()).includes(normalized)) {
        return true;
      }
    }
  } catch {
    // ignore
  }

  const envAdmins = (typeof import.meta !== "undefined" && import.meta.env?.VITE_ADMIN_EMAILS ? String(import.meta.env.VITE_ADMIN_EMAILS) : "")
    .split(/[,;]/)
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);
  return envAdmins.includes(normalized);
}

export async function checkIsAdminAsync(email?: string | null): Promise<boolean> {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();

  // 1. Instant check against cache or root founder
  if (checkIsAdmin(normalized)) return true;

  // 2. Query encrypted backend founder verification endpoint
  try {
    const res = await fetch(`${API_URL}/api/auth/founder-check?email=${encodeURIComponent(normalized)}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.is_founder) {
        // Cache in localStorage so subsequent checks are instant
        try {
          const cached = localStorage.getItem("trana_authorized_founders");
          const list: string[] = cached ? JSON.parse(cached) : [];
          if (!list.map((e) => e.toLowerCase()).includes(normalized)) {
            list.push(normalized);
            localStorage.setItem("trana_authorized_founders", JSON.stringify(list));
          }
        } catch {}
        return true;
      }
    }
  } catch (err) {
    console.warn("Error verifying founder access with backend:", err);
  }

  return false;
}


export async function getAuthenticatedUser(): Promise<{ id: string; email: string; name?: string } | null> {
  if (typeof window !== "undefined") {
    // 1. Direct TRANA session in localStorage
    try {
      const token = localStorage.getItem("trana_session_token");
      const userRaw = localStorage.getItem("trana_user");
      if (token && userRaw) {
        const userObj = JSON.parse(userRaw);
        if (userObj && (userObj.email || userObj.id)) {
          return {
            id: userObj.id || userObj.email,
            email: (userObj.email || "").trim().toLowerCase(),
            name: userObj.name || userObj.email?.split("@")[0] || "Founder",
          };
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Supabase auth session
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user && data.user.email) {
      return {
        id: data.user.id,
        email: data.user.email.trim().toLowerCase(),
        name: data.user.user_metadata?.full_name || data.user.email.split("@")[0] || "Founder",
      };
    }
  } catch {
    // ignore
  }

  return null;
}

function FoundersErrorFallback({ error, reset }: { error: unknown; reset: () => void }) {
  return (
    <div className="min-h-screen bg-[#08080a] text-[#F0F0F0] flex flex-col items-center justify-center p-6 font-mono">
      <div className="max-w-md w-full border border-amber-500/30 bg-[#121212]/90 backdrop-blur-2xl p-8 rounded-2xl space-y-5 text-center shadow-2xl">
        <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div>
          <span className="text-[10px] uppercase font-mono tracking-widest text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
            Founders Console Telemetry
          </span>
          <h2 className="font-display text-2xl font-medium text-white mt-3">
            Unable to Load Section
          </h2>
          <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
            A temporary issue occurred while rendering this console section. You can retry loading or return to the overview.
          </p>
          {error ? (
            <p className="mt-3 p-2.5 rounded-lg bg-black/40 border border-white/10 text-[10px] text-neutral-400 font-mono break-words text-left">
              {error instanceof Error ? error.message : String(error)}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2 justify-center pt-2">
          <button
            onClick={() => reset()}
            className="bg-white text-black px-5 py-2 text-xs font-semibold uppercase tracking-wider rounded-full hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            Retry
          </button>
          <a
            href="/founders"
            className="border border-white/20 hover:border-white text-neutral-300 hover:text-white px-5 py-2 text-xs uppercase tracking-wider rounded-full transition-colors"
          >
            Overview
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/founders")({
  ssr: false,
  errorComponent: FoundersErrorFallback,
  head: () => ({
    meta: [
      { title: "Founders Dashboard — TRANA" },
      { name: "description", content: "Executive operations, metrics and platform management for TRANA founding team." },
      { property: "og:title", content: "Founders Dashboard — TRANA" },
    ],
  }),
  component: FoundersLayout,
});

type FounderContextType = {
  founderEmail: string;
  isLoggedIn: boolean;
  isAdmin: boolean;
  logout: () => void;
};

const FounderContext = createContext<FounderContextType | null>(null);

export function useFounderAuth() {
  const ctx = useContext(FounderContext);
  if (!ctx) {
    return {
      founderEmail: "founder@trana.in",
      isLoggedIn: true,
      isAdmin: true,
      logout: () => {},
    };
  }
  return ctx;
}

type NavItemConfig = {
  to: string;
  label: string;
  icon: any;
  exact?: boolean;
  section: "MAIN" | "WORKSPACE";
  badge?: string;
};

const navItems: NavItemConfig[] = [
  { to: "/founders", label: "Dashboard", icon: BarChart3, exact: true, section: "MAIN" },
  { to: "/founders/users", label: "Users", icon: Users, section: "MAIN" },
  { to: "/founders/lawyers", label: "Lawyers", icon: Scale, section: "MAIN" },
  { to: "/founders/students", label: "Law Students & Interns", icon: GraduationCap, section: "MAIN" },
  { to: "/founders/chats", label: "Client Lawyer Chat", icon: MessageSquare, section: "WORKSPACE", badge: "3" },
  { to: "/founders/admin", label: "API Keys & Admin", icon: ShieldCheck, section: "WORKSPACE" },
  { to: "/founders/settings", label: "Settings", icon: Settings, section: "WORKSPACE" },
];

function FoundersLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; name?: string } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Founders Dashboard — TRANA";
  }, [location.pathname]);

  // Global ⌘K / Ctrl+K keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setCheckingAuth(true);
      const user = await getAuthenticatedUser();
      if (!active) return;
      setCurrentUser(user);

      if (!user || !user.email) {
        setIsAdmin(false);
        setCheckingAuth(false);
        return;
      }

      const adminAuthorized = await checkIsAdminAsync(user.email);
      if (active) {
        setIsAdmin(adminAuthorized);
        setCheckingAuth(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [location.pathname]);

  // Determine which navigation item is active based on current URL
  const activeRouteIndex = navItems.findIndex((item) =>
    item.exact
      ? location.pathname === item.to || location.pathname === `${item.to}/`
      : location.pathname.startsWith(item.to)
  );

  const logout = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("trana_session_token");
      localStorage.removeItem("trana_user");
    }
    try {
      await supabase.auth.signOut();
    } catch {}
    window.location.href = "/";
  };

  // 1. Loading verification state
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#08080a] flex flex-col items-center justify-center text-white font-mono gap-3 p-4">
        <div className="w-7 h-7 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs uppercase tracking-widest text-[#888888]">
          Verifying Founder Access...
        </span>
      </div>
    );
  }

  // 2. Unauthenticated user -> redirect to auth
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#08080a] flex flex-col items-center justify-center text-white font-mono gap-4 p-4 text-center">
        <p className="text-sm text-[#888888]">Authentication required to access the Founders Console.</p>
        <Link
          to="/auth"
          search={{ redirect: location.pathname }}
          className="bg-white text-black px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-full hover:bg-neutral-200 transition-colors shadow-lg"
        >
          Sign In to TRANA →
        </Link>
      </div>
    );
  }

  // 3. Authenticated user who is NOT an admin -> Access Denied Screen
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#08080a] text-[#F0F0F0] flex flex-col items-center justify-center p-6 font-mono selection:bg-white selection:text-black">
        <Toaster />
        <div className="max-w-md w-full border border-red-500/30 bg-[#121212]/90 backdrop-blur-2xl p-8 rounded-2xl space-y-6 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600" />
          <div className="w-14 h-14 mx-auto rounded-full bg-red-950/40 border border-red-500/40 flex items-center justify-center text-red-400">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-widest text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
              403 · Access Restricted
            </span>
            <h1 className="font-display text-2xl font-medium text-white mt-3">
              Founders Only Area
            </h1>
            <p className="text-xs text-[#888888] mt-2 leading-relaxed">
              This console is restricted strictly to TRANA founders and platform administrators. General public and non-admin accounts do not have access.
            </p>
          </div>

          <div className="bg-[#181818]/80 border border-[#282828] p-3.5 rounded-xl text-left text-xs space-y-1">
            <span className="text-[#666666] block text-[10px] uppercase tracking-wider">Signed in as:</span>
            <span className="text-white font-medium break-all">{currentUser.email}</span>
            <span className="text-[10px] text-neutral-400 block mt-1">Role: Citizen / Standard User (Non-Admin)</span>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Link
              to="/dashboard"
              className="w-full bg-white text-black py-2.5 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-200 transition-colors text-center rounded-full"
            >
              Return to Citizen Dashboard →
            </Link>
            <button
              onClick={logout}
              className="w-full border border-white/20 hover:border-white text-neutral-300 hover:text-white py-2.5 text-xs uppercase tracking-wider transition-colors text-center rounded-full flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out & Switch Account</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Authorized Founder Admin -> Render Management Console
  const founderEmail = currentUser.email;

  // Filter items by search query if user types in search
  const filteredNavItems = searchQuery.trim()
    ? navItems.filter((item) =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : navItems;

  const mainItems = filteredNavItems.filter((i) => i.section === "MAIN");
  const workspaceItems = filteredNavItems.filter((i) => i.section === "WORKSPACE");

  const sidebarContent = (
    <div className="flex h-full flex-col text-[#F0F0F0] relative overflow-hidden select-none">
      {/* Brand Header */}
      <div className="p-4 pb-3 flex items-center justify-between relative border-b border-white/[0.08]">
        <div className="flex items-center gap-3 min-w-0">
          {/* Subtle Frosted Squircle Brand Logo */}
          <Link
            to="/"
            className="w-9 h-9 rounded-xl bg-black border border-white/20 flex items-center justify-center shadow-md text-white font-bold font-serif text-lg shrink-0 hover:scale-105 hover:border-white/40 transition-all overflow-hidden"
            title="TRANA Home"
          >
            <img src="/favicon.svg" alt="TRANA" className="w-full h-full object-cover" />
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
                ADMIN
              </span>
            </div>
            <div className="text-[11px] text-neutral-400 font-sans truncate leading-none mt-0.5">
              Founders workspace
            </div>
          </div>
        </div>
      </div>

      {/* Pill Search Bar */}
      <div className="px-3 pt-3 pb-1">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search pages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-12 py-1.5 text-xs text-white placeholder-neutral-400/60 bg-white/[0.07] hover:bg-white/[0.12] focus:bg-white/[0.14] border border-white/15 focus:border-white/40 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] transition-all outline-none"
          />
          <span className="absolute right-2.5 px-1.5 py-0.5 text-[9px] font-mono font-medium rounded-full bg-white/10 border border-white/20 text-neutral-300 pointer-events-none shadow-sm">
            ⌘K
          </span>
        </div>
      </div>

      {/* Navigation Area with Apple Smooth Gliding Frosted Glass Pill */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3">
        <nav className="relative select-none">
          {/* MAIN SECTION */}
          {mainItems.length > 0 && (
            <div className="mb-3">
              <div className="px-3.5 pt-1 pb-1 text-[10px] font-mono font-semibold tracking-wider text-neutral-400/70 uppercase">
                MAIN
              </div>
              <div className="space-y-0.5">
                {mainItems.map((item) => {
                  const globalIdx = navItems.findIndex((n) => n.to === item.to);
                  const Icon = item.icon;
                  const isActive = globalIdx === activeRouteIndex;

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3.5 py-2 my-0.5 rounded-full text-xs font-sans transition-all relative cursor-pointer ${
                        isActive
                          ? "text-white font-semibold border border-amber-500/30 bg-amber-500/10 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                          : "text-neutral-300 hover:text-white hover:font-semibold hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            isActive ? "text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" : "text-neutral-400"
                          }`}
                        />
                        <span className="tracking-normal truncate">{item.label}</span>
                      </div>

                      {item.badge && (
                        <span className="px-2 py-0.2 text-[9px] font-mono font-medium rounded-full bg-white/10 text-neutral-200 border border-white/20">
                          {item.badge}
                        </span>
                      )}
                      {isActive && !item.badge && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* WORKSPACE SECTION */}
          {workspaceItems.length > 0 && (
            <div>
              <div className="px-3.5 pt-2 pb-1 text-[10px] font-mono font-semibold tracking-wider text-neutral-400/70 uppercase">
                WORKSPACE
              </div>
              <div className="space-y-0.5">
                {workspaceItems.map((item) => {
                  const globalIdx = navItems.findIndex((n) => n.to === item.to);
                  const Icon = item.icon;
                  const isActive = globalIdx === activeRouteIndex;

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3.5 py-2 my-0.5 rounded-full text-xs font-sans transition-all relative cursor-pointer ${
                        isActive
                          ? "text-white font-semibold border border-amber-500/30 bg-amber-500/10 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                          : "text-neutral-300 hover:text-white hover:font-semibold hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            isActive ? "text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" : "text-neutral-400"
                          }`}
                        />
                        <span className="tracking-normal truncate">{item.label}</span>
                      </div>

                      {item.badge && (
                        <span className="px-2 py-0.2 text-[10px] font-mono font-medium rounded-full bg-white/15 text-white border border-white/20 shadow-sm">
                          {item.badge}
                        </span>
                      )}
                      {isActive && !item.badge && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </nav>
      </div>

      {/* Floating User Profile Capsule at Bottom */}
      <div className="p-3 border-t border-white/[0.08] bg-black/25 backdrop-blur-xl mt-auto">
        <div className="relative overflow-hidden rounded-2xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/15 p-2 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.3),0_8px_20px_rgba(0,0,0,0.35)] transition-all flex items-center justify-between gap-2">
          {/* Avatar with Status Dot */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-white/25 via-white/50 to-white/20 p-[1px] shadow-sm">
                <div className="w-full h-full rounded-full bg-[#121216] flex items-center justify-center text-xs font-semibold text-white">
                  {founderEmail[0]?.toUpperCase() || "F"}
                </div>
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#121216] shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            </div>

            <div className="min-w-0">
              <div className="text-xs font-medium text-white truncate leading-tight">
                {currentUser.name || "Founder Admin"}
              </div>
              <div
                className="text-[10px] text-neutral-400 truncate leading-tight mt-0.5 font-mono"
                title={founderEmail}
              >
                {founderEmail}
              </div>
            </div>
          </div>

          {/* Quick Action Icons */}
          <div className="flex items-center gap-1 shrink-0">
            <Link
              to="/"
              className="w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/[0.2] border border-white/20 flex items-center justify-center text-neutral-300 hover:text-white transition-all cursor-pointer"
              title="Return to Main Site"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
            <button
              onClick={logout}
              className="w-7 h-7 rounded-full bg-white/[0.08] hover:bg-red-500/20 hover:border-red-400/40 border border-white/20 flex items-center justify-center text-neutral-300 hover:text-red-300 transition-all cursor-pointer"
              title="Sign out of founder session"
            >
              <LogOut className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <FounderContext.Provider value={{ founderEmail, isLoggedIn: true, isAdmin: true, logout }}>
      <div className="founders-canvas relative min-h-screen text-[#F0F0F0] selection:bg-white selection:text-black">
        <Toaster />

        {/* Ambient background subtle monochrome white glow */}
        <div
          className="fixed top-[-80px] left-[5%] w-[550px] h-[550px] rounded-full bg-white/[0.025] blur-[140px] pointer-events-none -z-10"
        />
        <div
          className="fixed top-[30%] right-[-80px] w-[550px] h-[550px] rounded-full bg-white/[0.02] blur-[150px] pointer-events-none -z-10"
        />

        {/* Desktop Left Sidebar: Completely FIXED to viewport — impossible to scroll away */}
        <aside className="hidden md:flex flex-col fixed top-0 left-0 bottom-0 w-[280px] p-3 lg:p-4 z-40 select-none">
          <div className="apple-floating-sidebar w-full h-full flex flex-col relative overflow-hidden">
            {sidebarContent}
          </div>
        </aside>

        {/* Mobile Header */}
        <header className="flex items-center justify-between border-b border-white/10 bg-[#0d0b14]/80 backdrop-blur-2xl px-4 py-3 md:hidden sticky top-0 z-40 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-black border border-white/20 flex items-center justify-center shadow-md overflow-hidden shrink-0">
              <img src="/favicon.svg" alt="TRANA" className="w-full h-full object-cover" />
            </div>
            <span className="font-display text-base tracking-[0.15em] text-[#F0F0F0]">TRANA</span>
            <span className="apple-glass-pill text-[9px] px-1.5 py-0.5 text-neutral-300 font-mono">FOUNDERS</span>
          </div>
          <button
            aria-label="Open navigation menu"
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 apple-glass-pill text-[#F0F0F0] cursor-pointer"
          >
            <Menu className="h-4 w-4" />
          </button>
        </header>

        {/* Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md md:hidden flex p-3">
            <div className="apple-floating-sidebar w-[280px] h-full flex flex-col relative overflow-hidden shadow-2xl">
              <button
                aria-label="Close menu"
                className="absolute right-3.5 top-3.5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/25 text-neutral-300 hover:text-white z-50 transition-all cursor-pointer"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
              {sidebarContent}
            </div>
          </div>
        )}

        {/* Main Content Area: Offset by sidebar width on desktop */}
        <main className="md:ml-[280px] min-h-screen text-[#F0F0F0] p-4 md:p-6 lg:p-8 relative z-10">
          <div className="max-w-7xl mx-auto space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </FounderContext.Provider>
  );
}
