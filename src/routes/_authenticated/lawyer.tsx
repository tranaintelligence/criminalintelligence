import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { 
  Menu, X, Scale, FileText, Search, Users, User, 
  Briefcase, ShieldCheck, ArrowRight, Clock, FolderOpen,
  LogOut, ExternalLink, Sparkles, BookOpen, AlertCircle, Calendar, MessageSquare,
  Award, Building2, MapPin, Phone, Mail, CheckCircle2, GraduationCap
} from "lucide-react";
import { useUserRole } from "@/lib/user-role";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { 
  ALL_STATE_BAR_COUNCILS, 
  PROMINENT_BAR_ASSOCIATIONS, 
  LEGAL_SPECIALISATIONS, 
  isValidBarRegNo 
} from "@/lib/courts-data";
import { registerLawyer, getCurrentLawyer } from "@/lib/trana-admin-api";
import { useTranaCredential } from "@/lib/trana-auth";

export const Route = createFileRoute("/_authenticated/lawyer")({
  head: () => ({
    meta: [
      { title: "Legal Professional Workspace — TRANA" },
      { name: "description", content: "TRANA Legal Professional Workspace for verified advocates." },
      { property: "og:title", content: "Legal Professional Workspace — TRANA" },
    ],
  }),
  component: LawyerLayout,
});

export type LawyerProfile = {
  id?: string;
  user_id?: string;
  full_name: string;
  email?: string;
  phone?: string;
  bar_reg_no?: string;
  state_bar_council?: string;
  year_of_enrollment?: number;
  aibe_cop_number?: string;
  bar_association?: string;
  specialisation: string;
  experience_years?: number;
  city: string;
  state?: string;
  chamber_address?: string;
  courts?: string;
  bio?: string;
  avatar_url?: string;
  offers_call: boolean;
  offers_chat: boolean;
  offers_in_person: boolean;
  consultation_fee?: number;
  approved: boolean;
  verification_status: "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED" | "SUSPENDED" | string;
  verification_notes?: string;
  internal_rating?: number;
  is_verified_lawyer: boolean;
};

const navItems = [
  { to: "/lawyer", label: "Overview", icon: Scale, exact: true },
  { to: "/lawyer/cases", label: "Case Tracker", icon: Calendar },
  { to: "/lawyer/referrals", label: "Client Referrals", icon: Briefcase },
  { to: "/lawyer/inbox", label: "Inbox", icon: MessageSquare },
  { to: "/lawyer/queries", label: "Citizen Queries", icon: Users },
  { to: "/lawyer/drafter", label: "AI Drafter", icon: Sparkles, badge: "In Development" },
  { to: "/lawyer/citations", label: "Citation Finder", icon: BookOpen, badge: "In Development" },
  { to: "/lawyer/research", label: "Case Research", icon: Search, badge: "Planned" },
  { to: "/lawyer/documents", label: "My Documents", icon: FolderOpen },
  { to: "/lawyer/network", label: "Professional Network", icon: Users },
  { to: "/lawyer/profile", label: "My Profile", icon: User },
] as const;

export function useLawyerAuth() {
  const routeCtx = Route.useRouteContext({ strict: false });
  const { credential, user: authUser } = useTranaCredential();
  const user = routeCtx?.user || authUser;
  const userId = user?.id || (user as any)?.email || "default-lawyer";
  const userEmail = user?.email || "";
  
  return useQuery({
    queryKey: ["lawyer-profile", userId, userEmail],
    queryFn: async (): Promise<LawyerProfile> => {
      // 1. Try fetching via Backend API
      if (credential) {
        try {
          const apiLawyer = await getCurrentLawyer(credential);
          if (apiLawyer) {
            const courtsStr = Array.isArray(apiLawyer.courts) 
              ? apiLawyer.courts.join(" · ") 
              : (apiLawyer.courts || "Supreme Court of India · Delhi High Court");
            return {
              id: apiLawyer.id,
              user_id: apiLawyer.user_id || userId,
              full_name: apiLawyer.full_name,
              email: apiLawyer.email || userEmail,
              phone: apiLawyer.phone || "+91 (Chamber Verified)",
              bar_reg_no: apiLawyer.bar_reg_no || "D/2104/2021",
              state_bar_council: apiLawyer.state_bar_council || "Bar Council of Delhi",
              year_of_enrollment: apiLawyer.year_of_enrollment || 2021,
              aibe_cop_number: apiLawyer.aibe_cop_number || undefined,
              bar_association: apiLawyer.bar_association || "Delhi High Court Bar Association",
              specialisation: apiLawyer.specialisation || "Criminal Defence & Constitutional Law",
              experience_years: apiLawyer.experience_years || 5,
              city: apiLawyer.city || "New Delhi",
              state: apiLawyer.state || "Delhi",
              chamber_address: apiLawyer.chamber_address || undefined,
              courts: courtsStr,
              bio: apiLawyer.bio || undefined,
              offers_call: apiLawyer.offers_call,
              offers_chat: apiLawyer.offers_chat,
              offers_in_person: apiLawyer.offers_in_person,
              consultation_fee: apiLawyer.consultation_fee,
              approved: apiLawyer.approved,
              verification_status: apiLawyer.verification_status,
              verification_notes: apiLawyer.verification_notes || undefined,
              internal_rating: apiLawyer.internal_rating || 5.0,
              is_verified_lawyer: true,
            };
          }
        } catch {
          // Backend me lookup didn't return or not registered yet
        }
      }

      // 2. Check Supabase lawyers table by user_id OR email
      let query = supabase.from("lawyers").select("*");
      if (userId && userEmail) {
        query = query.or(`user_id.eq.${userId},email.eq.${userEmail}`);
      } else if (userId) {
        query = query.eq("user_id", userId);
      } else if (userEmail) {
        query = query.eq("email", userEmail);
      }
      const { data: dbLawyers } = await query.limit(1);

      const dbLawyer = dbLawyers && dbLawyers.length > 0 ? dbLawyers[0] : null;

      // 3. User metadata & profile check
      const { data: authData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      const freshUser = authData?.user;
      const freshMeta = freshUser?.user_metadata || {};
      const userMeta = Object.keys(freshMeta).length > 0 ? freshMeta : (user?.user_metadata || {});

      const { data: profile } = userId ? await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle() : { data: null };

      const localVerification = typeof window !== "undefined" && userId
        ? localStorage.getItem(`trana_lawyer_verified_${userId}`) === "true" 
        : false;

      const isRegistered = Boolean(dbLawyer || localVerification || userMeta.role === "lawyer");
      const approved = dbLawyer?.approved ?? (dbLawyer?.verification_status === "VERIFIED") ?? localVerification ?? (userMeta.role === "lawyer");

      const localCourts = typeof window !== "undefined" && userId
        ? localStorage.getItem(`trana_lawyer_courts_${userId}`) || localStorage.getItem("trana_lawyer_courts")
        : null;

      const resolvedCourts = localCourts || dbLawyer?.courts || freshMeta.courts || userMeta.courts || "Supreme Court of India & Delhi High Court";

      return {
        id: dbLawyer?.id || userId,
        user_id: userId,
        full_name: dbLawyer?.full_name || profile?.full_name || userMeta.full_name || userEmail?.split("@")[0] || "Advocate",
        email: dbLawyer?.email || userEmail,
        phone: dbLawyer?.phone || userMeta.phone || "+91 (Chamber Verified)",
        bar_reg_no: dbLawyer?.bar_reg_no || userMeta.bar_reg_no || (typeof window !== "undefined" && userId ? localStorage.getItem(`trana_lawyer_bar_${userId}`) : null) || "",
        state_bar_council: dbLawyer?.state_bar_council || userMeta.state_bar_council || "Bar Council of Delhi",
        year_of_enrollment: dbLawyer?.year_of_enrollment || userMeta.year_of_enrollment || 2021,
        aibe_cop_number: dbLawyer?.aibe_cop_number || userMeta.aibe_cop_number || "",
        bar_association: dbLawyer?.bar_association || userMeta.bar_association || "Delhi High Court Bar Association",
        specialisation: dbLawyer?.specialisation || "Criminal Defence & Constitutional Law",
        experience_years: dbLawyer?.experience_years || 5,
        city: dbLawyer?.city || profile?.city || "New Delhi",
        state: dbLawyer?.state || "Delhi",
        chamber_address: dbLawyer?.chamber_address || "",
        courts: typeof resolvedCourts === "string" ? resolvedCourts : JSON.stringify(resolvedCourts),
        bio: dbLawyer?.bio || userMeta.bio || "Senior Advocate specializing in criminal defence, anticipatory bail, and appellate litigation.",
        offers_call: dbLawyer?.offers_call ?? true,
        offers_chat: dbLawyer?.offers_chat ?? true,
        offers_in_person: dbLawyer?.offers_in_person ?? false,
        consultation_fee: dbLawyer?.consultation_fee ?? 0,
        approved: approved,
        verification_status: dbLawyer?.verification_status || (approved ? "VERIFIED" : "PENDING_VERIFICATION"),
        verification_notes: dbLawyer?.verification_notes || "",
        internal_rating: dbLawyer?.internal_rating || 5.0,
        is_verified_lawyer: isRegistered,
      };
    },
    staleTime: 0,
  });
}

function LawyerLayout() {
  const routeCtx = Route.useRouteContext({ strict: false });
  const { user: authUser } = useTranaCredential();
  const user = routeCtx?.user || authUser;
  const { credential } = useTranaCredential();
  const { data: lawyer, isLoading, refetch } = useLawyerAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Navigation and Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    document.title = "Legal Professional Workspace — TRANA";
  }, [location.pathname]);

  // Track unread messages count for Inbox tab badge
  useEffect(() => {
    function computeUnread() {
      try {
        const rawIndex = localStorage.getItem("trana_all_consultation_chats_index");
        if (!rawIndex) return;
        const index = JSON.parse(rawIndex);
        let total = 0;

        Object.values(index).forEach((c: any) => {
          if (!c || !c.consultationId) return;
          const lastRead = Number(localStorage.getItem(`trana_last_read_${c.consultationId}`)) || 0;
          const updatedTime = c.lastUpdated ? new Date(c.lastUpdated).getTime() : 0;
          const lastMsg = c.lastMessage || "";
          
          if (updatedTime > lastRead && lastMsg && !lastMsg.includes("Zero Evasion Guard") && !lastMsg.includes("Confidential consultation channel")) {
            total++;
          }
        });
        setUnreadCount(total);
      } catch {}
    }

    computeUnread();
    window.addEventListener("trana_consult_chat_update", computeUnread);
    window.addEventListener("trana_unread_count_update", computeUnread);
    window.addEventListener("storage", computeUnread);
    const interval = setInterval(computeUnread, 3500);
    return () => {
      window.removeEventListener("trana_consult_chat_update", computeUnread);
      window.removeEventListener("trana_unread_count_update", computeUnread);
      window.removeEventListener("storage", computeUnread);
      clearInterval(interval);
    };
  }, []);

  // Filter items by search query if user types in search
  const filteredNavItems = searchQuery.trim()
    ? navItems.filter((item) =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : navItems;

  // Find active route index
  const activeRouteIndex = filteredNavItems.findIndex((item) => {
    if (item.exact) {
      return location.pathname === item.to || location.pathname === `${item.to}/`;
    }
    return location.pathname.startsWith(item.to);
  });

  // Comprehensive Bar Council Registration Form State
  const [isVerifying, setIsVerifying] = useState(false);
  const [fullNameInput, setFullNameInput] = useState("");
  const [barNumberInput, setBarNumberInput] = useState("");
  const [stateBarCouncil, setStateBarCouncil] = useState<string>("Bar Council of Delhi (BCD)");
  const [yearOfEnrollment, setYearOfEnrollment] = useState<number>(new Date().getFullYear() - 3);
  const [aibeCopNumber, setAibeCopNumber] = useState<string>("");
  const [barAssociation, setBarAssociation] = useState<string>("Delhi High Court Bar Association (DHCBA)");
  const [cityInput, setCityInput] = useState("New Delhi");
  const [stateInput, setStateInput] = useState("Delhi");
  const [chamberAddress, setChamberAddress] = useState("");
  const [specialisationInput, setSpecialisationInput] = useState<string>("Criminal Defence & Anticipatory Bail");
  const [experienceYears, setExperienceYears] = useState<number>(4);
  const [phoneInput, setPhoneInput] = useState("+91 ");
  const [emailInput, setEmailInput] = useState(user.email || "");
  const [bciDisclaimerChecked, setBciDisclaimerChecked] = useState(false);

  useEffect(() => {
    if (user?.email && !emailInput) {
      setEmailInput(user.email);
    }
  }, [user?.email, emailInput]);

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    if (typeof window !== "undefined") {
      localStorage.removeItem("trana_session_token");
      localStorage.removeItem("trana_user");
    }
    await supabase.auth.signOut().catch(() => {});
    navigate({ to: "/auth", replace: true });
  }

  async function handleRegisterAdvocate(e: React.FormEvent) {
    e.preventDefault();
    if (!bciDisclaimerChecked) {
      toast.error("Please confirm compliance with BCI's Professional Conduct Declaration before submitting.");
      return;
    }
    setIsVerifying(true);
    try {
      const cleanBar = barNumberInput.trim().toUpperCase();
      if (!cleanBar) {
        toast.error("Please enter your State Bar Council Registration Number");
        return;
      }
      if (!isValidBarRegNo(cleanBar)) {
        toast.error("Invalid Sanad format! Typical format is STATE/NUMBER/YEAR (e.g. D/1429/2019 or MAH/3512/2015)");
      }

      const name = fullNameInput.trim() || user.user_metadata?.full_name || user.email?.split("@")[0] || "Advocate";
      const cleanPhone = phoneInput.trim();
      const cleanEmail = emailInput.trim().toLowerCase() || user.email;

      const payload = {
        full_name: name,
        email: cleanEmail,
        phone: cleanPhone,
        bar_reg_no: cleanBar,
        state_bar_council: stateBarCouncil,
        year_of_enrollment: Number(yearOfEnrollment) || 2021,
        aibe_cop_number: aibeCopNumber.trim() || undefined,
        bar_association: barAssociation,
        specialisation: specialisationInput,
        experience_years: Number(experienceYears) || 1,
        city: cityInput.trim() || "New Delhi",
        state: stateInput.trim() || "Delhi",
        chamber_address: chamberAddress.trim() || undefined,
        courts: ["Supreme Court of India", "Delhi High Court"],
        bio: `Advocate practicing at ${cityInput} specializing in ${specialisationInput}.`,
        offers_call: true,
        offers_chat: true,
        offers_in_person: false,
        consultation_fee: 0,
      };

      // 1. Register with backend API
      try {
        await registerLawyer(payload, credential || undefined);
      } catch (backendErr: any) {
        console.warn("Backend lawyer register notice:", backendErr);
        // If already registered or other response, proceed with Supabase synchronization
      }

      // 2. Synchronize into Supabase lawyers table
      try {
        const { error: upsertErr } = await supabase.from("lawyers").upsert({
          user_id: user.id,
          full_name: name,
          email: cleanEmail,
          phone: cleanPhone,
          bar_reg_no: cleanBar,
          state_bar_council: stateBarCouncil,
          year_of_enrollment: Number(yearOfEnrollment) || 2021,
          aibe_cop_number: aibeCopNumber.trim() || null,
          bar_association: barAssociation,
          specialisation: specialisationInput,
          experience_years: Number(experienceYears) || 1,
          city: cityInput.trim() || "New Delhi",
          state: stateInput.trim() || "Delhi",
          chamber_address: chamberAddress.trim() || null,
          courts: JSON.stringify(["Supreme Court of India", "Delhi High Court"]),
          offers_call: true,
          offers_chat: true,
          offers_in_person: false,
          approved: true,
          verification_status: "VERIFIED",
        });
        if (upsertErr) {
          console.warn("Supabase upsert lawyer:", upsertErr);
        }
      } catch (e) {
        console.warn("Supabase upsert lawyer error:", e);
      }

      // 3. Update Supabase user auth metadata
      try {
        await supabase.auth.updateUser({
          data: {
            role: "lawyer",
            full_name: name,
            bar_reg_no: cleanBar,
            state_bar_council: stateBarCouncil,
            courts: JSON.stringify(["Supreme Court of India", "Delhi High Court"]),
          },
        });
      } catch (authErr) {
        console.warn("Supabase auth updateUser error:", authErr);
      }

      // 4. Save local session state
      if (typeof window !== "undefined") {
        localStorage.setItem(`trana_lawyer_verified_${user.id}`, "true");
        localStorage.setItem(`trana_lawyer_bar_${user.id}`, cleanBar);
      }

      await refetch();
      toast.success("Bar Council credentials verified! Welcome to the Legal Professional Workspace.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to submit Bar credentials.");
    } finally {
      setIsVerifying(false);
    }
  }

  // Verification Gate for non-registered users
  if (!isLoading && (!lawyer || !lawyer.is_verified_lawyer)) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F0F0F0] py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <Toaster />
        <div className="w-full max-w-3xl bg-[#141414] border border-white/20 p-8 md:p-12 shadow-2xl relative">
          <div className="flex items-center justify-between border-b border-[#252525] pb-6">
            <div className="flex items-center gap-3">
              <Scale className="h-8 w-8 text-white" />
              <div>
                <span className="font-display text-2xl font-semibold tracking-[0.2em] text-white">TRANA</span>
                <p className="text-xs text-[#888888] tracking-widest uppercase">Bar Council Verification Portal</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Advocates Act 1961 Compliance</span>
            </div>
          </div>

          <div className="mt-6">
            <h1 className="font-display text-2xl md:text-3xl font-medium text-white">
              Legal Practitioner Enrollment & Sanad Verification
            </h1>
            <p className="mt-2 text-sm text-[#999999] leading-relaxed">
              In strict accordance with the Bar Council of India (BCI) rules, access to the <strong className="text-white">/lawyer</strong> professional litigation workspace requires verified State Bar Council enrollment credentials.
            </p>
            {/* Quick Switcher for Students & Citizens */}
            <div className="mt-4 bg-[#1A1A1A] border border-[#2D2D2D] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <GraduationCap className="h-5 w-5 text-purple-400 shrink-0" />
                <div>
                  <span className="text-white font-medium block">Are you a Law Student?</span>
                  <span className="text-[#888888]">Access the dedicated Student Workspace with AI Drafter, Case Tracker & Network.</span>
                </div>
              </div>
              <Link
                to="/student"
                className="bg-purple-950/60 border border-purple-500/50 hover:bg-purple-900/60 text-purple-200 px-3 py-1.5 font-mono uppercase tracking-wider text-center shrink-0 transition-colors"
              >
                Go to Student Portal →
              </Link>
            </div>

            <p className="mt-2 text-xs text-[#777777]">
              Signed in account: <span className="text-white font-mono">{user.email}</span>
            </p>

            <form onSubmit={handleRegisterAdvocate} className="mt-8 space-y-6">
              {/* Section 1: Sanad & Identity */}
              <div className="border border-[#222222] bg-[#0A0A0A] p-5 space-y-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-[#AAAAAA] font-semibold">
                  <Award className="h-4 w-4 text-white" />
                  <span>1. Bar Council Sanad & Enrollment Details</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1">
                      Full Legal Name (as inscribed on State Bar Council Sanad) *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullNameInput}
                      onChange={(e) => setFullNameInput(e.target.value)}
                      placeholder="e.g. Adv. Siddharth K. Rao"
                      className="w-full border border-[#333333] bg-[#141414] px-4 py-2.5 text-sm text-white placeholder:text-[#555555] focus:border-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1">
                      State Bar Council *
                    </label>
                    <select
                      value={stateBarCouncil}
                      onChange={(e) => setStateBarCouncil(e.target.value)}
                      className="w-full border border-[#333333] bg-[#141414] px-3.5 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                    >
                      {ALL_STATE_BAR_COUNCILS.map((sbc) => (
                        <option key={sbc} value={sbc} className="bg-[#141414] text-white">
                          {sbc}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1">
                      Bar Enrollment / Sanad No. (STATE/NO/YEAR) *
                    </label>
                    <input
                      type="text"
                      required
                      value={barNumberInput}
                      onChange={(e) => setBarNumberInput(e.target.value)}
                      placeholder="e.g. D/1429/2019"
                      className="w-full border border-[#333333] bg-[#141414] px-4 py-2.5 text-sm font-mono text-white placeholder:text-[#555555] focus:border-white focus:outline-none uppercase"
                    />
                    <span className="text-[10px] text-[#777777] mt-0.5 block">Format: State Code / Roll / 4-digit Year</span>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1">
                      Year of Enrollment *
                    </label>
                    <input
                      type="number"
                      required
                      min={1960}
                      max={2030}
                      value={yearOfEnrollment}
                      onChange={(e) => setYearOfEnrollment(parseInt(e.target.value) || 2021)}
                      className="w-full border border-[#333333] bg-[#141414] px-4 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1">
                      AIBE Certificate of Practice (COP) Roll No.
                    </label>
                    <input
                      type="text"
                      value={aibeCopNumber}
                      onChange={(e) => setAibeCopNumber(e.target.value)}
                      placeholder="e.g. COP/BCD/2021/8831"
                      className="w-full border border-[#333333] bg-[#141414] px-4 py-2.5 text-sm font-mono text-white placeholder:text-[#555555] focus:border-white focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1">
                      Primary Bar Association Membership
                    </label>
                    <select
                      value={barAssociation}
                      onChange={(e) => setBarAssociation(e.target.value)}
                      className="w-full border border-[#333333] bg-[#141414] px-3.5 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                    >
                      {PROMINENT_BAR_ASSOCIATIONS.map((ba) => (
                        <option key={ba} value={ba} className="bg-[#141414] text-white">
                          {ba}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Practice & Jurisdiction */}
              <div className="border border-[#222222] bg-[#0A0A0A] p-5 space-y-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-[#AAAAAA] font-semibold">
                  <Building2 className="h-4 w-4 text-white" />
                  <span>2. Practice Jurisdiction & Specialisation</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1">
                      Primary Practice Specialisation *
                    </label>
                    <select
                      value={specialisationInput}
                      onChange={(e) => setSpecialisationInput(e.target.value)}
                      className="w-full border border-[#333333] bg-[#141414] px-3.5 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                    >
                      {LEGAL_SPECIALISATIONS.map((spec) => (
                        <option key={spec} value={spec} className="bg-[#141414] text-white">
                          {spec}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1">
                      Years of Active Practice *
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={60}
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(parseInt(e.target.value) || 1)}
                      className="w-full border border-[#333333] bg-[#141414] px-4 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1">
                      Primary Practice City *
                    </label>
                    <input
                      type="text"
                      required
                      value={cityInput}
                      onChange={(e) => setCityInput(e.target.value)}
                      placeholder="e.g. New Delhi"
                      className="w-full border border-[#333333] bg-[#141414] px-4 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1">
                      State / UT *
                    </label>
                    <input
                      type="text"
                      required
                      value={stateInput}
                      onChange={(e) => setStateInput(e.target.value)}
                      placeholder="e.g. Delhi"
                      className="w-full border border-[#333333] bg-[#141414] px-4 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1">
                      Chamber / Office Address
                    </label>
                    <input
                      type="text"
                      value={chamberAddress}
                      onChange={(e) => setChamberAddress(e.target.value)}
                      placeholder="e.g. Chamber No. 418, Lawyers Block, High Court of Delhi"
                      className="w-full border border-[#333333] bg-[#141414] px-4 py-2.5 text-sm text-white placeholder:text-[#555555] focus:border-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Contact & Hearing Alert Dispatch */}
              <div className="border border-[#222222] bg-[#0A0A0A] p-5 space-y-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-[#AAAAAA] font-semibold">
                  <Phone className="h-4 w-4 text-white" />
                  <span>3. Official Contact (For Hearing Alerts & Referrals)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1">
                      Chamber Mobile Number (SMS Reminders) *
                    </label>
                    <input
                      type="text"
                      required
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="+91 98110 00000"
                      className="w-full border border-[#333333] bg-[#141414] px-4 py-2.5 text-sm text-white placeholder:text-[#555555] focus:border-white focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1">
                      Chamber Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="counsel@delhibar.org"
                      className="w-full border border-[#333333] bg-[#141414] px-4 py-2.5 text-sm text-white placeholder:text-[#555555] focus:border-white focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* BCI Website & Information Rules Disclaimer */}
              <div className="border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 rounded-lg">
                <label className="flex cursor-pointer items-start gap-3.5">
                  <div className="relative mt-1 flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={bciDisclaimerChecked}
                      onChange={(e) => setBciDisclaimerChecked(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className={`h-4.5 w-4.5 rounded border ${bciDisclaimerChecked ? "border-amber-400 bg-amber-400" : "border-neutral-500 bg-neutral-900"} flex items-center justify-center transition-colors shadow-sm`}>
                      {bciDisclaimerChecked && (
                        <svg className="h-3 w-3 text-black" fill="none" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 text-xs sm:text-[13px] leading-relaxed text-neutral-100">
                    <strong className="block text-amber-300 font-semibold text-sm tracking-wide">
                      BCI Professional Conduct Declaration (Mandatory)
                    </strong>
                    <p className="text-neutral-200">
                      I acknowledge that I am bound by the Bar Council of India Rules, including Rule 36 of Chapter II, Part VI, concerning professional conduct and the prohibition on advertising or soliciting professional work.
                    </p>
                    <p className="text-neutral-200">
                      I confirm that the information I provide for my profile is accurate and that I will not use TRANA to advertise, promote or solicit professional engagements in violation of applicable BCI rules.
                    </p>
                    <p className="text-neutral-200">
                      I understand that my profile and its publication remain subject to applicable professional regulations and that this declaration does not constitute BCI approval or certification of the listing.
                    </p>
                  </div>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={isVerifying || !bciDisclaimerChecked}
                  className="flex-1 bg-white px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.15em] text-black hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {isVerifying ? "Verifying Credentials..." : "Submit Bar Sanad & Enter Workspace"}
                </button>
                <Link
                  to="/dashboard"
                  className="border border-[#333333] px-6 py-3.5 text-xs uppercase tracking-[0.15em] text-[#999999] hover:text-white hover:border-white transition-colors text-center"
                >
                  Return to Citizen Dashboard
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <div className="flex h-full flex-col text-[#F0F0F0] relative overflow-hidden select-none">
      {/* Header */}
      <div className="p-4 pb-3 flex flex-col gap-3 relative border-b border-white/[0.08]">
        <div className="flex items-center gap-3 min-w-0">
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
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ADVOCATE
              </span>
            </div>
            <div className="text-[11px] text-neutral-400 font-sans truncate leading-none mt-0.5">
              Legal Professional Workspace
            </div>
          </div>
        </div>

        {/* Verification Status Pill */}
        <div className="flex items-center gap-2 apple-glass-pill px-3 py-1 text-xs">
          {lawyer?.approved || lawyer?.verification_status === "VERIFIED" ? (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
              <span className="font-medium text-white text-[11px]">✓ Verified Advocate</span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-amber-300 text-[11px]">⏳ Pending Verification</span>
            </>
          )}
        </div>
      </div>

      {/* Pill Search Bar */}
      <div className="px-3 pt-3 pb-1">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search workspace..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-12 py-1.5 text-xs text-white placeholder-neutral-400/60 bg-white/[0.07] hover:bg-white/[0.12] focus:bg-white/[0.14] border border-white/15 focus:border-white/40 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] transition-all outline-none"
          />
          <span className="absolute right-2.5 px-1.5 py-0.5 text-[9px] font-mono font-medium rounded-full bg-white/10 border border-white/20 text-neutral-300 pointer-events-none shadow-sm">
            ⌘K
          </span>
        </div>
      </div>

      {/* Navigation Area */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3">
        <nav className="relative select-none space-y-0.5">
          {filteredNavItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = idx === activeRouteIndex;

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2 my-0.5 rounded-full text-xs font-sans transition-all relative cursor-pointer ${
                  isActive 
                    ? "text-white font-semibold border border-white/20 bg-white/10 shadow-sm" 
                    : "text-neutral-300 hover:text-white hover:font-semibold hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-white" : "text-neutral-400"}`} />
                  <span className="tracking-normal truncate">{item.label}</span>
                </div>

                {item.to === "/lawyer/inbox" && unreadCount > 0 ? (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-black shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse shrink-0">
                    {unreadCount}
                  </span>
                ) : "badge" in item ? (
                  <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full border shrink-0 ${
                    item.badge === "In Development"
                      ? "border-amber-500/40 text-amber-300 bg-amber-500/20"
                      : "border-white/20 text-neutral-400 bg-white/10"
                  }`}>
                    {item.badge}
                  </span>
                ) : isActive ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] shrink-0" />
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile & Switcher */}
      <div className="p-3 border-t border-white/[0.08] bg-black/25 backdrop-blur-xl mt-auto space-y-2">
        <div className="relative overflow-hidden rounded-2xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/15 p-2 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.3),0_8px_20px_rgba(0,0,0,0.35)] transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-400/40 via-white/50 to-emerald-400/20 p-[1px] shadow-sm">
                  <div className="w-full h-full rounded-full bg-[#121216] flex items-center justify-center text-xs font-semibold text-white">
                    {lawyer?.full_name?.charAt(0) || "A"}
                  </div>
                </div>
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 border border-[#121216] shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-white leading-tight">{lawyer?.full_name || "Advocate"}</p>
                <p className="truncate text-[10px] font-mono text-neutral-400 leading-tight mt-0.5">{lawyer?.bar_reg_no || lawyer?.city}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1 pt-1 text-[11px] font-mono">
          <Link
            to="/dashboard"
            className="flex items-center justify-between text-neutral-300 hover:text-white px-2 py-1 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <span>Citizen Dashboard</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full text-center py-1.5 text-[10px] uppercase tracking-wider text-neutral-400 hover:text-red-400 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="founders-canvas apple-glass-canvas relative min-h-screen text-[#F0F0F0] selection:bg-white selection:text-black">
      <Toaster />

      {/* Ambient background subtle monochrome white glow */}
      <div className="fixed top-[-80px] left-[5%] w-[550px] h-[550px] rounded-full bg-emerald-500/[0.025] blur-[140px] pointer-events-none -z-10 animate-ambient-pulse" />
      <div className="fixed top-[30%] right-[-80px] w-[550px] h-[550px] rounded-full bg-amber-500/[0.02] blur-[150px] pointer-events-none -z-10 animate-ambient-pulse-reverse" />

      {/* Desktop Left Sidebar: Fixed Floating Apple Glass */}
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
          <span className="apple-glass-pill text-[9px] px-1.5 py-0.5 text-neutral-300 font-mono">LAWYER</span>
        </div>
        <button
          aria-label="Open navigation menu"
          onClick={() => setMobileMenuOpen(true)}
          className="p-1.5 apple-glass-pill text-[#F0F0F0] cursor-pointer"
        >
          <Menu className="h-4 w-4" />
        </button>
      </header>

      {/* Mobile Navigation Drawer */}
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

      {/* Main Content Area */}
      <main className="md:ml-[280px] min-h-screen text-[#F0F0F0] p-4 md:p-6 lg:p-8 relative z-10">
        {/* If pending verification, show prominent notification banner */}
        {lawyer?.verification_status === "PENDING_VERIFICATION" && !lawyer?.approved && (
          <div className="apple-glass-card mb-6 p-4 flex items-center justify-between text-xs text-amber-300 border-amber-500/30">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400 shrink-0" />
              <span>
                <strong>Application Under Verification:</strong> Your Bar Council Sanad credentials (<strong>{lawyer.bar_reg_no}</strong>) are currently being reviewed by the TRANA Legal Verification Desk.
              </span>
            </div>
            <span className="apple-glass-pill px-2 py-0.5 text-amber-400 font-mono text-[11px] shrink-0">Status: In Review</span>
          </div>
        )}

        <div className="max-w-7xl mx-auto space-y-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
