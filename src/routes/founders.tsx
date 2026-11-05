import { createFileRoute, Link, Outlet, useLocation, useNavigate, redirect } from "@tanstack/react-router";
import { useState, useEffect, createContext, useContext } from "react";
import { 
  BarChart3, Users, Scale, Settings, Menu, X, ShieldCheck, MessageSquare, ShieldAlert, LogOut 
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

export const Route = createFileRoute("/founders")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const user = await getAuthenticatedUser();
    // 1. Require login: general public is immediately redirected to auth
    if (!user) {
      throw redirect({
        to: "/auth",
        search: { redirect: location.pathname },
      });
    }

    // 2. Require admin: if not admin, bounce any subroute back to /founders so Access Denied screen renders
    const isAdmin = await checkIsAdminAsync(user.email);
    if (!isAdmin && location.pathname !== "/founders" && location.pathname !== "/founders/") {
      throw redirect({
        to: "/founders",
      });
    }

    return { user, isAdmin };
  },
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

const navItems = [
  { to: "/founders", label: "Overview", icon: BarChart3, exact: true },
  { to: "/founders/users", label: "Users", icon: Users },
  { to: "/founders/lawyers", label: "Lawyers", icon: Scale },
  { to: "/founders/chats", label: "Client Lawyer Chat", icon: MessageSquare },
  { to: "/founders/admin", label: "API Keys & Admin", icon: ShieldCheck },
  { to: "/founders/settings", label: "Settings", icon: Settings },
] as const;

function FoundersLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; name?: string } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    document.title = "Founders Dashboard — TRANA";
  }, [location.pathname]);

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
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white font-mono gap-3 p-4">
        <div className="w-6 h-6 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs uppercase tracking-widest text-[#888888]">
          Verifying Founder Access...
        </span>
      </div>
    );
  }

  // 2. Unauthenticated user -> redirect to auth
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white font-mono gap-4 p-4 text-center">
        <p className="text-sm text-[#888888]">Authentication required to access the Founders Console.</p>
        <Link
          to="/auth"
          search={{ redirect: location.pathname }}
          className="bg-white text-black px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded hover:bg-neutral-200 transition-colors"
        >
          Sign In to TRANA →
        </Link>
      </div>
    );
  }

  // 3. Authenticated user who is NOT an admin -> Access Denied Screen
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F0F0F0] flex flex-col items-center justify-center p-6 font-mono selection:bg-white selection:text-black">
        <Toaster />
        <div className="max-w-md w-full border border-red-500/30 bg-[#121212] p-8 rounded-xl space-y-6 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600" />
          <div className="w-14 h-14 mx-auto rounded-full bg-red-950/40 border border-red-500/40 flex items-center justify-center text-red-400">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-widest text-red-400 border border-red-500/30 px-2 py-0.5 rounded">
              403 · Access Restricted
            </span>
            <h1 className="font-display text-2xl font-medium text-white mt-3">
              Founders Only Area
            </h1>
            <p className="text-xs text-[#888888] mt-2 leading-relaxed">
              This console is restricted strictly to TRANA founders and platform administrators. General public and non-admin accounts do not have access.
            </p>
          </div>

          <div className="bg-[#181818] border border-[#282828] p-3.5 rounded text-left text-xs space-y-1">
            <span className="text-[#666666] block text-[10px] uppercase tracking-wider">Signed in as:</span>
            <span className="text-white font-medium break-all">{currentUser.email}</span>
            <span className="text-[10px] text-amber-200/70 block mt-1">Role: Citizen / Standard User (Non-Admin)</span>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Link
              to="/dashboard"
              className="w-full bg-white text-black py-2.5 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-200 transition-colors text-center rounded"
            >
              Return to Citizen Dashboard →
            </Link>
            <button
              onClick={logout}
              className="w-full border border-[#333333] hover:border-white text-neutral-300 hover:text-white py-2.5 text-xs uppercase tracking-wider transition-colors text-center rounded flex items-center justify-center gap-2"
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

  const sidebar = (
    <div className="flex h-full flex-col text-[#F0F0F0] relative overflow-hidden select-none">
      {/* Ambient soft glow at top corner of sidebar */}
      <div className="absolute -top-12 -left-12 w-36 h-36 rounded-full bg-amber-400/[0.07] blur-2xl pointer-events-none" />

      {/* Brand Header */}
      <div className="p-6 border-b border-white/[0.08] relative">
        <div className="flex items-center justify-between">
          <Link to="/" className="font-display text-2xl font-semibold tracking-[0.2em] text-[#F0F0F0] hover:text-white transition-colors block">
            TRANA
          </Link>
          <span className="apple-glass-pill px-2 py-0.5 text-[9px] font-mono tracking-widest text-amber-300 font-medium">
            EXECUTIVE
          </span>
        </div>
        <span className="text-[11px] text-neutral-400 font-mono tracking-wider mt-1.5 block">
          Founders Console
        </span>
      </div>

      {/* Navigation: Overview, Users, Lawyers, Client Lawyer Chat, API Keys & Admin, Settings */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 font-mono text-xs">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? location.pathname === item.to || location.pathname === `${item.to}/`
            : location.pathname.startsWith(item.to);

          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileMenuOpen(false)}
              className={`group apple-nav-item flex items-center justify-between px-3.5 py-2.5 text-xs ${
                isActive ? "active font-medium" : "text-neutral-400"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-4 w-4 transition-colors ${isActive ? "text-amber-200" : "text-neutral-400 group-hover:text-white"}`} />
                <span className="tracking-wide">{item.label}</span>
              </div>
              {isActive && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.8)] animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer & Admin User Profile */}
      <div className="p-3.5 border-t border-white/[0.08] bg-black/20 backdrop-blur-xl">
        <div className="relative overflow-hidden rounded-xl bg-white/[0.04] border border-white/[0.08] p-3 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.18)] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono tracking-wider text-amber-300/90 font-medium">Founder Access</span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              VERIFIED
            </span>
          </div>
          <p className="text-white truncate text-[11px] font-sans font-medium tracking-tight" title={founderEmail}>
            {founderEmail}
          </p>
          <div className="flex items-center justify-between pt-1 border-t border-white/[0.06] text-[11px] font-mono">
            <Link to="/" className="text-neutral-400 hover:text-white transition-colors flex items-center gap-1">
              <span>← Main Site</span>
            </Link>
            <button
              onClick={logout}
              className="hover:text-red-300 text-neutral-400 transition-colors inline-flex items-center gap-1 hover:bg-red-500/10 px-1.5 py-0.5 rounded"
              title="Sign out of founder session"
            >
              <LogOut className="h-3 w-3" />
              <span>Sign Out</span>
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

        {/* Ambient background refraction orbs */}
        <div className="fixed top-[-80px] left-[220px] w-[500px] h-[500px] rounded-full bg-amber-500/[0.05] blur-[140px] pointer-events-none -z-10" />
        <div className="fixed top-[20%] right-[-100px] w-[650px] h-[650px] rounded-full bg-indigo-600/[0.05] blur-[160px] pointer-events-none -z-10" />
        <div className="fixed bottom-[-100px] left-[320px] w-[450px] h-[450px] rounded-full bg-emerald-500/[0.03] blur-[140px] pointer-events-none -z-10" />

        {/* Desktop Left Sidebar (Apple Glassmorphism) */}
        <aside className="fixed inset-y-0 left-0 hidden w-[260px] apple-glass-sidebar md:block z-30">
          {sidebar}
        </aside>

        {/* Mobile Header */}
        <header className="flex items-center justify-between border-b border-white/[0.08] bg-[#0c0c10]/80 backdrop-blur-2xl px-4 py-3 md:hidden sticky top-0 z-40 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg tracking-[0.2em] text-[#F0F0F0]">TRANA</span>
            <span className="apple-glass-pill text-[9px] px-1.5 py-0.5 text-neutral-300 font-mono">FOUNDERS</span>
          </div>
          <button
            aria-label="Open navigation menu"
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 apple-glass-pill text-[#F0F0F0]"
          >
            <Menu className="h-4 w-4" />
          </button>
        </header>

        {/* Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md md:hidden">
            <div className="fixed inset-y-0 left-0 w-[270px] apple-glass-sidebar shadow-2xl">
              <button
                aria-label="Close menu"
                className="absolute right-3 top-3 p-1.5 text-neutral-300 hover:text-white apple-glass-pill z-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
              {sidebar}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="md:ml-[260px] min-h-screen text-[#F0F0F0]">
          <div className="p-4 md:p-8 space-y-6 max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </FounderContext.Provider>
  );
}
