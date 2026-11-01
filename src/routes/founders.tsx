import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useState, useEffect, createContext, useContext } from "react";
import { 
  BarChart3, Users, Scale, Settings, Menu, X, ShieldCheck, MessageSquare 
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/founders")({
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
  logout: () => void;
};

const FounderContext = createContext<FounderContextType | null>(null);

export function useFounderAuth() {
  const ctx = useContext(FounderContext);
  if (!ctx) {
    return {
      founderEmail: "founder@trana.in",
      isLoggedIn: true,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.title = "Founders Dashboard — TRANA";
  }, [location.pathname]);

  const sidebar = (
    <div className="flex h-full flex-col bg-[#111111] text-[#F0F0F0]">
      {/* Brand Header */}
      <div className="p-6 border-b border-[#222222]">
        <Link to="/" className="font-display text-2xl font-semibold tracking-[0.2em] text-[#F0F0F0] block">
          TRANA
        </Link>
        <span className="text-xs text-[#888888] font-mono tracking-wider mt-1 block">
          Founders Dashboard
        </span>
      </div>

      {/* Navigation: Overview, Users, Lawyers, Settings */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 font-mono text-xs">
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
              className={`group flex items-center justify-between px-3 py-2.5 text-xs transition-colors border-l-2 ${
                isActive
                  ? "border-white bg-[#1A1A1A] text-[#F0F0F0] font-medium"
                  : "border-transparent text-[#999999] hover:text-[#F0F0F0] hover:bg-[#161616]"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-[#777777] group-hover:text-white"}`} />
                <span>{item.label}</span>
              </div>
              {isActive && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[#222222] bg-[#0E0E0E] font-mono text-[0.75rem] text-[#888888] flex items-center justify-between">
        <Link to="/" className="hover:text-[#F0F0F0] transition-colors">
          ← Main Site
        </Link>
        <span className="text-[0.65rem] border border-white/20 px-1.5 py-0.5 text-emerald-400">
          ONLINE
        </span>
      </div>
    </div>
  );

  return (
    <FounderContext.Provider value={{ founderEmail: "founder@trana.in", isLoggedIn: true, logout: () => {} }}>
      <div className="min-h-screen bg-[#0A0A0A] text-[#F0F0F0] selection:bg-white selection:text-black">
        <Toaster />

        {/* Desktop Left Sidebar (#111111) */}
        <aside className="fixed inset-y-0 left-0 hidden w-[250px] border-r border-[#222222] bg-[#111111] md:block z-30">
          {sidebar}
        </aside>

        {/* Mobile Header */}
        <header className="flex items-center justify-between border-b border-[#222222] bg-[#111111] px-4 py-3 md:hidden sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg tracking-[0.2em] text-[#F0F0F0]">TRANA</span>
            <span className="text-[0.65rem] border border-white/20 px-1 py-0.5 text-[#999999] font-mono">FOUNDERS</span>
          </div>
          <button
            aria-label="Open navigation menu"
            onClick={() => setMobileMenuOpen(true)}
            className="p-1 border border-[#333333] text-[#F0F0F0]"
          >
            <Menu className="h-4 w-4" />
          </button>
        </header>

        {/* Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm md:hidden">
            <div className="fixed inset-y-0 left-0 w-[260px] bg-[#111111] shadow-2xl">
              <button
                aria-label="Close menu"
                className="absolute right-3 top-3 p-1 text-[#F0F0F0] border border-[#333333]"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
              {sidebar}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="md:ml-[250px] min-h-screen bg-[#0A0A0A] text-[#F0F0F0]">
          <div className="p-4 md:p-8 space-y-6 max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </FounderContext.Provider>
  );
}
