import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { 
  GraduationCap, BookOpen, Scale, Search, FileText, 
  Sparkles, Users, ArrowUpRight, LogOut, ChevronRight, Menu, X, Landmark, ShieldCheck
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole, StudentProfile } from "@/lib/user-role";

export const Route = createFileRoute("/_authenticated/student")({
  component: StudentLayout,
});

const studentNav = [
  { to: "/student", label: "Overview", icon: BookOpen, exact: true },
  { to: "/student/drafter", label: "AI Drafter", icon: Sparkles },
  { to: "/student/cases", label: "Case Tracker", icon: Scale },
  { to: "/student/citations", label: "Citation Finder", icon: Search },
  { to: "/student/research", label: "Case Research", icon: Landmark },
  { to: "/student/documents", label: "My Documents", icon: FileText },
  { to: "/student/network", label: "Professional Network", icon: Users },
];

function StudentLayout() {
  const { user } = Route.useRouteContext();
  const { role, studentProfile, enrollAsStudent, isStudent, isLawyer, isFounder } = useUserRole(
    user?.id,
    user?.email
  );
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Student Enrollment Form states
  const [fullName, setFullName] = useState(user?.name || user?.user_metadata?.full_name || "");
  const [university, setUniversity] = useState("National Law University, Delhi");
  const [degree, setDegree] = useState("5-Year B.A. LL.B. (Hons)");
  const [yearOfStudy, setYearOfStudy] = useState("3rd Year Scholar");
  const [city, setCity] = useState("New Delhi");
  const [studentId, setStudentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Law Student Workspace — TRANA";
  }, [location.pathname]);

  const hasStudentAccess = isStudent || isLawyer || isFounder;

  async function handleEnrollSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!university.trim()) {
      toast.error("Please enter your law university or college name.");
      return;
    }

    setIsSubmitting(true);
    try {
      const profile: StudentProfile = {
        university: university.trim(),
        degree: degree.trim(),
        yearOfStudy: yearOfStudy.trim(),
        studentIdNumber: studentId.trim() || undefined,
        city: city.trim() || "New Delhi",
      };

      await enrollAsStudent(profile);

      // Register student in central directory for networking
      try {
        const stored = JSON.parse(localStorage.getItem("trana_all_registered_students") || "[]");
        const entry = {
          id: user.id,
          name: fullName.trim() || "Law Student",
          role: "student",
          roleLabel: `Law Student (${degree})`,
          affiliation: university.trim(),
          city: city.trim(),
          experienceOrYear: yearOfStudy.trim(),
          specialisationOrInterests: "Constitutional Law, Criminal Procedure & Statutory AI Research",
          isVerified: true,
          email: user.email,
        };
        const updated = stored.filter((s: any) => s.id !== user.id);
        updated.push(entry);
        localStorage.setItem("trana_all_registered_students", JSON.stringify(updated));
      } catch {}

      toast.success("Welcome to TRANA Student Workspace!");
    } catch (err: any) {
      toast.error(err.message || "Failed to complete student enrollment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("trana_session_token");
      localStorage.removeItem("trana_user");
    }
    await supabase.auth.signOut().catch(() => {});
    navigate({ to: "/auth", replace: true });
  }

  // Student Enrollment Gate for pure citizens
  if (!hasStudentAccess) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F0F0F0] py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <Toaster />
        <div className="w-full max-w-2xl bg-[#141414] border border-[#2D2D2D] p-8 md:p-10 shadow-2xl relative">
          <div className="flex items-center justify-between border-b border-[#252525] pb-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded bg-[#1F1F1F] border border-[#333333] flex items-center justify-center text-purple-400">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <span className="font-display text-2xl font-semibold tracking-[0.15em] text-white">TRANA</span>
                <p className="text-[0.7rem] text-[#888888] tracking-widest uppercase">Student Workspace Onboarding</p>
              </div>
            </div>
            <div className="border border-purple-500/30 bg-purple-950/30 px-3 py-1 text-xs text-purple-300 font-mono flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Academic Edition</span>
            </div>
          </div>

          <div className="mt-6">
            <h1 className="font-display text-2xl md:text-3xl font-medium text-white">
              Law Student & Academic Scholar Enrollment
            </h1>
            <p className="mt-2 text-xs md:text-sm text-[#AAAAAA] leading-relaxed">
              Unlock access to TRANA's research suite — AI Drafter for moot court memorials, eCourts Case Tracker, Statutory Precedent Search, and the Student Professional Network.
            </p>
          </div>

          <form onSubmit={handleEnrollSubmit} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[0.7rem] uppercase tracking-wider text-[#888888] font-mono mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  className="w-full bg-[#181818] border border-[#333333] px-3.5 py-2.5 text-xs text-white placeholder-[#555555] focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[0.7rem] uppercase tracking-wider text-[#888888] font-mono mb-1.5">
                  City / Campus Location
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. New Delhi"
                  className="w-full bg-[#181818] border border-[#333333] px-3.5 py-2.5 text-xs text-white placeholder-[#555555] focus:border-purple-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[0.7rem] uppercase tracking-wider text-[#888888] font-mono mb-1.5">
                Law University / College / Faculty of Law
              </label>
              <input
                type="text"
                required
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                placeholder="e.g. National Law University Delhi, NALSAR, Faculty of Law DU"
                className="w-full bg-[#181818] border border-[#333333] px-3.5 py-2.5 text-xs text-white placeholder-[#555555] focus:border-purple-400 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[0.7rem] uppercase tracking-wider text-[#888888] font-mono mb-1.5">
                  Degree Program
                </label>
                <select
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                  className="w-full bg-[#181818] border border-[#333333] px-3 py-2.5 text-xs text-white focus:border-purple-400 focus:outline-none"
                >
                  <option value="5-Year B.A. LL.B. (Hons)">5-Year B.A. LL.B. (Hons)</option>
                  <option value="5-Year B.B.A. LL.B. (Hons)">5-Year B.B.A. LL.B. (Hons)</option>
                  <option value="3-Year LL.B. Degree">3-Year LL.B. Degree</option>
                  <option value="LL.M. Postgraduate Scholar">LL.M. Postgraduate Scholar</option>
                  <option value="Ph.D. Legal Scholar">Ph.D. Legal Scholar</option>
                </select>
              </div>

              <div>
                <label className="block text-[0.7rem] uppercase tracking-wider text-[#888888] font-mono mb-1.5">
                  Year of Study
                </label>
                <select
                  value={yearOfStudy}
                  onChange={(e) => setYearOfStudy(e.target.value)}
                  className="w-full bg-[#181818] border border-[#333333] px-3 py-2.5 text-xs text-white focus:border-purple-400 focus:outline-none"
                >
                  <option value="1st Year Undergrad">1st Year Undergrad</option>
                  <option value="2nd Year Undergrad">2nd Year Undergrad</option>
                  <option value="3rd Year Scholar">3rd Year Scholar</option>
                  <option value="4th Year Pre-Final">4th Year Pre-Final</option>
                  <option value="5th Year Finalist">5th Year Finalist</option>
                  <option value="Postgraduate LL.M.">Postgraduate LL.M.</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[0.7rem] uppercase tracking-wider text-[#888888] font-mono mb-1.5">
                Student ID / Roll No. (Optional)
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. NLU-D-2023-042"
                className="w-full bg-[#181818] border border-[#333333] px-3.5 py-2.5 text-xs text-white placeholder-[#555555] focus:border-purple-400 focus:outline-none"
              />
            </div>

            <div className="pt-4 flex items-center justify-between gap-4 border-t border-[#252525]">
              <Link
                to="/dashboard"
                className="text-xs uppercase tracking-wider text-[#888888] hover:text-white transition-colors"
              >
                ← Return to Citizen Dashboard
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-white text-black hover:bg-neutral-200 px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] transition-colors flex items-center gap-2"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{isSubmitting ? "Enrolling..." : "Launch Student Workspace"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const studentDisplayName = fullName || user?.name || user?.email?.split("@")[0] || "Law Student";
  const studentCollege = studentProfile?.university || "National Law University";

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-6">
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between">
            <span className="font-display text-2xl font-bold tracking-[0.2em] text-white">TRANA</span>
            <span className="text-[0.65rem] px-2 py-0.5 rounded bg-purple-950/60 border border-purple-500/40 text-purple-300 font-mono uppercase">
              Student Edition
            </span>
          </div>
          <p className="mt-1 text-[0.7rem] text-[#888888] tracking-widest uppercase">
            Law Student Workspace
          </p>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {studentNav.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 text-xs font-mono transition-colors border-l-2 ${
                  isActive
                    ? "bg-[#181818] border-white text-white font-medium"
                    : "border-transparent text-[#888888] hover:text-white hover:bg-[#141414]"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-purple-300" : "text-[#777777]"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / User Badge */}
      <div className="pt-6 border-t border-[#222222] space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-[#1F1F1F] border border-[#333333] flex items-center justify-center font-display text-white text-xs">
            {studentDisplayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-medium text-white truncate">{studentDisplayName}</p>
            <p className="text-[0.65rem] text-[#888888] font-mono truncate">{studentCollege}</p>
          </div>
        </div>

        <div className="pt-2 flex flex-col gap-1.5 text-xs font-mono">
          <Link
            to="/dashboard"
            className="flex items-center justify-between text-[#888888] hover:text-white text-[0.7rem] py-1"
          >
            <span>Citizen Dashboard</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center justify-between text-left text-[#777777] hover:text-red-400 text-[0.7rem] py-1"
          >
            <span>Sign Out</span>
            <LogOut className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-[#ECECEC]">
      <Toaster />

      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between border-b border-[#222222] bg-[#111111] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="font-display text-xl font-bold tracking-[0.2em] text-white">TRANA</span>
          <span className="text-[0.65rem] font-mono px-2 py-0.5 rounded bg-purple-950/60 border border-purple-500/40 text-purple-300">
            Student
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1.5 text-[#AAAAAA] hover:text-white"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile Sidebar Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 md:hidden">
          <div className="w-72 h-full bg-[#111111] border-r border-[#262626]">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop Fixed Left Sidebar */}
      <aside className="hidden md:block fixed inset-y-0 left-0 w-64 bg-[#111111] border-r border-[#202020] z-20">
        {sidebarContent}
      </aside>

      {/* Main Content Area */}
      <main className="md:ml-64 p-6 md:p-10 max-w-7xl">
        <Outlet />
      </main>
    </div>
  );
}

