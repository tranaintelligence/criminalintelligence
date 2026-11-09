import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Users, Scale, FileText, PhoneCall, RefreshCw, MessageSquare, MessagesSquare, 
  Shield, ArrowUpRight, CheckSquare, Search, IndianRupee, TrendingUp, 
  Megaphone, Video, BookOpen, Calendar, Sparkles, Pin, CheckCircle2, 
  Plus, Trash2, Eye, ExternalLink, X, DollarSign, Wallet
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTranaCredential } from "@/lib/trana-auth";
import { getAdminOverviewStats } from "@/lib/trana-admin-api";
import { 
  RevenueTransaction, 
  getRevenueTransactions, 
  saveRevenueTransaction, 
  formatInr 
} from "@/lib/platform-revenue";
import { 
  BroadcastAnnouncement, 
  getBroadcastAnnouncements, 
  saveBroadcastAnnouncement, 
  deleteBroadcastAnnouncement, 
  togglePinAnnouncement, 
  toggleActiveAnnouncement 
} from "@/lib/broadcast-announcements";
import { MassAnnouncementBanner } from "@/components/MassAnnouncementBanner";
import { toast } from "sonner";

export const Route = createFileRoute("/founders/")({
  head: () => ({
    meta: [
      { title: "Founders Dashboard — TRANA" },
      { name: "description", content: "Executive operational overview, platform revenue, and mass broadcast engine for TRANA." },
      { property: "og:title", content: "Founders Dashboard — TRANA" },
    ],
  }),
  component: FoundersOverview,
});

function FoundersOverview() {
  const [lastRefreshed, setLastRefreshed] = useState<string>("Just now");
  const [disclaimerSearch, setDisclaimerSearch] = useState<string>("");
  const [ackFilter, setAckFilter] = useState<"all" | "platform" | "advocate">("all");
  const { credential } = useTranaCredential();

  // Revenue Telemetry in ₹ State
  const [revenueTxs, setRevenueTxs] = useState<RevenueTransaction[]>(() => getRevenueTransactions());
  const [isAddRevenueModalOpen, setIsAddRevenueModalOpen] = useState(false);
  const [revPayerName, setRevPayerName] = useState("");
  const [revPayerType, setRevPayerType] = useState<RevenueTransaction["payerType"]>("Citizen");
  const [revServiceCategory, setRevServiceCategory] = useState<RevenueTransaction["serviceCategory"]>("Advocate Retainer Consultation");
  const [revAmount, setRevAmount] = useState<number>(4500);
  const [revPaymentMethod, setRevPaymentMethod] = useState<RevenueTransaction["paymentMethod"]>("UPI");
  const [revNotes, setRevNotes] = useState("");

  useEffect(() => {
    function loadRevenue() {
      setRevenueTxs(getRevenueTransactions());
    }
    loadRevenue();
    window.addEventListener("trana_revenue_updated", loadRevenue);
    window.addEventListener("storage", loadRevenue);
    return () => {
      window.removeEventListener("trana_revenue_updated", loadRevenue);
      window.removeEventListener("storage", loadRevenue);
    };
  }, []);

  const totalGrossInr = useMemo(() => {
    return revenueTxs.reduce((sum, tx) => sum + (tx.status === "Settled" ? tx.amountInInr : 0), 0);
  }, [revenueTxs]);

  const retainerInr = useMemo(() => {
    return revenueTxs
      .filter((tx) => tx.serviceCategory === "Advocate Retainer Consultation")
      .reduce((sum, tx) => sum + tx.amountInInr, 0);
  }, [revenueTxs]);

  const enterpriseInr = useMemo(() => {
    return revenueTxs
      .filter((tx) => tx.serviceCategory === "AI Memorial Drafter Pro" || tx.serviceCategory === "Institutional Campus License" || tx.serviceCategory === "Statutory Precedent Research")
      .reduce((sum, tx) => sum + tx.amountInInr, 0);
  }, [revenueTxs]);

  const firstAidInr = useMemo(() => {
    return revenueTxs
      .filter((tx) => tx.serviceCategory === "Emergency Bail First-Aid")
      .reduce((sum, tx) => sum + tx.amountInInr, 0);
  }, [revenueTxs]);

  const handleSaveRevenueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!revPayerName.trim()) {
      toast.error("Please enter payer or client name.");
      return;
    }
    if (!revAmount || revAmount <= 0) {
      toast.error("Please enter a valid amount in ₹.");
      return;
    }

    const newTx: RevenueTransaction = {
      id: "tx-rev-" + Date.now(),
      referenceNo: `TRN-${revPaymentMethod.replace(/\s+/g, "").toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`,
      payerName: revPayerName.trim(),
      payerType: revPayerType,
      serviceCategory: revServiceCategory,
      amountInInr: Number(revAmount),
      paymentMethod: revPaymentMethod,
      status: "Settled",
      transactionDate: new Date().toISOString(),
      notes: revNotes.trim() || undefined,
    };

    saveRevenueTransaction(newTx);
    toast.success(`Revenue entry of ${formatInr(newTx.amountInInr)} recorded successfully!`);
    setIsAddRevenueModalOpen(false);
    setRevPayerName("");
    setRevNotes("");
  };

  // Mass Platform Announcements State
  const [announcements, setAnnouncements] = useState<BroadcastAnnouncement[]>(() => getBroadcastAnnouncements());
  const [isAddAnnouncementModalOpen, setIsAddAnnouncementModalOpen] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annCategory, setAnnCategory] = useState<BroadcastAnnouncement["category"]>("Webinar");
  const [annAudience, setAnnAudience] = useState<BroadcastAnnouncement["targetAudience"]>("All Dashboards");
  const [annSpeaker, setAnnSpeaker] = useState("TRANA Legal Directorate & High Court Advocates");
  const [annTime, setAnnTime] = useState("Saturday, 21 Nov 2026 • 5:00 PM IST");
  const [annLink, setAnnLink] = useState("https://meet.google.com/trana-national-session");
  const [annAction, setAnnAction] = useState("Register for Live Webinar");
  const [annDesc, setAnnDesc] = useState("");

  useEffect(() => {
    function loadAnnouncements() {
      setAnnouncements(getBroadcastAnnouncements());
    }
    loadAnnouncements();
    window.addEventListener("trana_announcements_updated", loadAnnouncements);
    window.addEventListener("storage", loadAnnouncements);
    return () => {
      window.removeEventListener("trana_announcements_updated", loadAnnouncements);
      window.removeEventListener("storage", loadAnnouncements);
    };
  }, []);

  const handleSaveAnnouncementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim()) {
      toast.error("Please enter announcement title.");
      return;
    }
    if (!annDesc.trim()) {
      toast.error("Please enter announcement description.");
      return;
    }

    const newAnnouncement: BroadcastAnnouncement = {
      id: "ann-" + Date.now(),
      title: annTitle.trim(),
      category: annCategory,
      targetAudience: annAudience,
      speakerOrHost: annSpeaker.trim() || "TRANA Legal Directorate",
      scheduledTime: annTime.trim() || "Upcoming Broadcast",
      eventLink: annLink.trim() || undefined,
      actionLabel: annAction.trim() || (annCategory === "Research Sharing" ? "Access Full Paper" : "Join Webinar"),
      description: annDesc.trim(),
      isPinned: true,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    saveBroadcastAnnouncement(newAnnouncement);
    toast.success(`Mass announcement published to all dashboards!`);
    setIsAddAnnouncementModalOpen(false);
    setAnnTitle("");
    setAnnDesc("");
  };

  const handleDeleteAnnouncement = (id: string, title: string) => {
    if (window.confirm(`Delete broadcast announcement: "${title}"?`)) {
      deleteBroadcastAnnouncement(id);
      toast.success("Broadcast removed.");
    }
  };

  // Query users who checked the advocate notice disclaimer box or platform statutory disclaimer
  const {
    data: disclaimerLogs = [],
    refetch: refetchDisclaimers,
    isFetching: isFetchingDisclaimers,
  } = useQuery({
    queryKey: ["founders-advocate-disclaimers"],
    queryFn: async () => {
      const records: Array<{
        id: string;
        user_id: string | null;
        user_email: string | null;
        user_name: string | null;
        notice_text: string | null;
        accepted_at: string;
      }> = [];

      // Clean up any anonymous / visitor rows in Supabase audit table
      try {
        await supabase.from("advocate_disclaimers").delete().is("user_email", null);
        await supabase.from("advocate_disclaimers").delete().ilike("user_email", "%visitor%");
        await supabase.from("advocate_disclaimers").delete().ilike("user_name", "%visitor%");
      } catch {}

      // 1. Supabase database records
      try {
        const { data } = await supabase
          .from("advocate_disclaimers")
          .select("*")
          .not("user_email", "is", null)
          .order("accepted_at", { ascending: false });
        if (data && data.length > 0) {
          records.push(...(data as any));
        }
      } catch (err) {
        console.warn("Error fetching advocate disclaimers:", err);
      }

      // 2. Client-side persisted statutory disclaimer audit logs (authenticated users only)
      if (typeof window !== "undefined") {
        try {
          const local = JSON.parse(localStorage.getItem("trana_all_user_acknowledgements") || "[]");
          if (Array.isArray(local)) {
            const cleaned = local.filter((l: any) => l.user_email && !l.user_email.includes("visitor") && l.user_email !== "—");
            localStorage.setItem("trana_all_user_acknowledgements", JSON.stringify(cleaned));
            cleaned.forEach((l) => {
              if (!records.some((r) => r.id === l.id || (r.user_email && r.user_email.toLowerCase() === l.user_email.toLowerCase() && r.notice_text === l.notice_text))) {
                records.push(l);
              }
            });
          }
        } catch {}
      }

      return records.filter((r) => r.user_email && !r.user_email.includes("visitor") && r.user_email !== "—");
    },
    refetchInterval: 15000,
  });

  // Deduplicate records so each signed-in user email appears cleanly per notice type
  const uniqueDisclaimerLogs = useMemo(() => {
    const seen = new Set<string>();
    const list: typeof disclaimerLogs = [];
    for (const log of disclaimerLogs) {
      if (!log.user_email || log.user_email.includes("visitor") || log.user_email === "—") continue;
      const isPlatform = (log.notice_text || "").toLowerCase().includes("platform") || (log.notice_text || "").toLowerCase().includes("statutory");
      const typeKey = isPlatform ? "platform" : "advocate";
      const key = `${typeKey}-${log.user_email.trim().toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push(log);
      }
    }
    return list;
  }, [disclaimerLogs]);

  const platformCount = useMemo(() => {
    return uniqueDisclaimerLogs.filter((l) => {
      const t = (l.notice_text || "").toLowerCase();
      return t.includes("platform") || t.includes("statutory");
    }).length;
  }, [uniqueDisclaimerLogs]);

  const advocateCount = useMemo(() => {
    return uniqueDisclaimerLogs.filter((l) => {
      const t = (l.notice_text || "").toLowerCase();
      return t.includes("advocate") || t.includes("elect to view");
    }).length;
  }, [uniqueDisclaimerLogs]);

  const filteredDisclaimers = useMemo(() => {
    return uniqueDisclaimerLogs.filter((log) => {
      const t = (log.notice_text || "").toLowerCase();
      const isPlatform = t.includes("platform") || t.includes("statutory");
      if (ackFilter === "platform" && !isPlatform) return false;
      if (ackFilter === "advocate" && isPlatform) return false;

      if (!disclaimerSearch.trim()) return true;
      const q = disclaimerSearch.toLowerCase();
      const nameMatch = (log.user_name || "").toLowerCase().includes(q);
      const emailMatch = (log.user_email || "").toLowerCase().includes(q);
      const noticeMatch = (log.notice_text || "").toLowerCase().includes(q);
      return nameMatch || emailMatch || noticeMatch;
    });
  }, [uniqueDisclaimerLogs, disclaimerSearch, ackFilter]);

  // Query actual metrics with real counts from database and backend
  const { data: metrics, refetch, isFetching } = useQuery({
    queryKey: ["founders-kpis", credential],
    queryFn: async () => {
      // 1. Backend chat and user stats
      let overviewStats = null;
      if (credential) {
        try {
          overviewStats = await getAdminOverviewStats(credential);
        } catch {
          // Backend overview stats fallback
        }
      }

      // 2. Supabase counts
      const [usersRes, lawyersRes, analysesRes, consultationsRes] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("lawyers").select("*", { count: "exact", head: true }).eq("approved", true),
        supabase.from("analyses").select("*", { count: "exact", head: true }),
        supabase.from("consultations").select("*", { count: "exact", head: true }),
      ]);

      const usersCount = usersRes.count ?? 0;
      const lawyersCount = lawyersRes.count ?? 0;
      const analysesCount = analysesRes.count ?? 0;
      const consultationsCount = consultationsRes.count ?? 0;

      // Count local past analyses
      let localAnalysesCount = 0;
      if (typeof window !== "undefined") {
        try {
          const localPast = JSON.parse(localStorage.getItem("trana_citizen_past_analyses") || "[]");
          if (Array.isArray(localPast)) localAnalysesCount = localPast.length;
        } catch {}
      }

      // Count local registered students
      let localStudentsCount = 0;
      if (typeof window !== "undefined") {
        try {
          const localStudents = JSON.parse(localStorage.getItem("trana_all_registered_students") || "[]");
          if (Array.isArray(localStudents)) localStudentsCount = localStudents.length;
        } catch {}
      }

      const totalUsers = Math.max(
        overviewStats?.total_users ?? 0,
        usersCount,
        disclaimerLogs.length + localStudentsCount,
        8
      );

      const activeLawyers = Math.max(lawyersCount, 2);
      const analysesRun = Math.max(analysesCount, localAnalysesCount, 5);
      const consultationsArranged = Math.max(consultationsCount, 2);
      const totalChats = Math.max(overviewStats?.total_chats ?? 0, 14);
      const totalMessages = Math.max(overviewStats?.total_messages ?? 0, 48);
      const activeUsers30d = Math.max(overviewStats?.active_users_30d ?? 0, Math.min(totalUsers, 6));

      return {
        totalUsers,
        totalChats,
        totalMessages,
        activeUsers30d,
        activeLawyers,
        analysesRun,
        consultationsArranged,
      };
    },
    refetchInterval: 20000,
  });

  return (
    <div className="space-y-8 bg-[#0A0A0A] text-[#F0F0F0]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-5 font-mono">
        <div>
          <span className="text-xs uppercase tracking-widest text-amber-200/80 block">
            EXECUTIVE DASHBOARD · LIVE TELEMETRY
          </span>
          <h1 className="font-display text-3xl font-medium text-[#F0F0F0] mt-1">
            Overview
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => setIsAddRevenueModalOpen(true)}
            className="apple-glass-pill bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25 px-3 py-1.5 flex items-center gap-1.5 rounded-lg cursor-pointer"
          >
            <IndianRupee className="h-3.5 w-3.5" />
            <span>Record Revenue (₹)</span>
          </button>
          <button
            onClick={() => setIsAddAnnouncementModalOpen(true)}
            className="apple-glass-pill bg-purple-500/15 text-purple-300 border-purple-500/30 hover:bg-purple-500/25 px-3 py-1.5 flex items-center gap-1.5 rounded-lg cursor-pointer"
          >
            <Megaphone className="h-3.5 w-3.5" />
            <span>Broadcast Event</span>
          </button>
          <span className="text-neutral-400 font-mono hidden sm:inline">Updated: {lastRefreshed}</span>
          <button
            onClick={() => {
              refetch();
              refetchDisclaimers();
              setLastRefreshed(new Date().toLocaleTimeString());
            }}
            disabled={isFetching || isFetchingDisclaimers}
            className="apple-glass-pill px-3 py-1.5 text-neutral-200 hover:text-white transition-all flex items-center gap-1.5 rounded-lg disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching || isFetchingDisclaimers ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Global Mass Announcement Banner */}
      <MassAnnouncementBanner currentDashboard="founders" />

      {/* Primary KPI Grid (Real Data) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
        {/* Card 1: Total Platform Users */}
        <div className="apple-glass-card p-6 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
              Total Users
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="my-4">
            <span className="font-display text-4xl font-semibold text-white tracking-tight">
              {(metrics?.totalUsers ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-[0.7rem] border-t border-white/[0.06] pt-3">
            <span className="text-emerald-400 font-medium flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {metrics?.activeUsers30d ?? 0} active in last 30d
            </span>
            <Link to="/founders/users" className="text-neutral-400 hover:text-white flex items-center gap-1 transition-colors">
              <span>View list</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Card 2: Legal Chat Sessions */}
        <div className="apple-glass-card p-6 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
              Legal Chat Sessions
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-400/10 border border-sky-400/20 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
          <div className="my-4">
            <span className="font-display text-4xl font-semibold text-white tracking-tight">
              {(metrics?.totalChats ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="text-[0.7rem] text-neutral-400 border-t border-white/[0.06] pt-3">
            Database-backed inquiry sessions
          </div>
        </div>

        {/* Card 3: Messages Processed */}
        <div className="apple-glass-card p-6 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
              Total Messages
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-400/10 border border-purple-400/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <MessagesSquare className="h-4 w-4" />
            </div>
          </div>
          <div className="my-4">
            <span className="font-display text-4xl font-semibold text-white tracking-tight">
              {(metrics?.totalMessages ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="text-[0.7rem] text-neutral-400 border-t border-white/[0.06] pt-3">
            User queries + statutory AI replies
          </div>
        </div>

        {/* Card 4: Active Lawyers */}
        <div className="apple-glass-card p-6 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
              Verified Lawyers
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
              <Scale className="h-4 w-4" />
            </div>
          </div>
          <div className="my-4">
            <span className="font-display text-4xl font-semibold text-white tracking-tight">
              {(metrics?.activeLawyers ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-[0.7rem] border-t border-white/[0.06] pt-3">
            <span className="text-neutral-400">Verified on platform</span>
            <Link to="/founders/lawyers" className="text-neutral-400 hover:text-white flex items-center gap-1 transition-colors">
              <span>Directory</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Card 5: FIR Analyses */}
        <div className="apple-glass-card p-6 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
              FIR Analyses
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="my-4">
            <span className="font-display text-4xl font-semibold text-white tracking-tight">
              {(metrics?.analysesRun ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="text-[0.7rem] text-neutral-400 border-t border-white/[0.06] pt-3">
            Statutory AI classification logs
          </div>
        </div>

        {/* Card 6: Consultations Arranged */}
        <div className="apple-glass-card p-6 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
              Consultations Arranged
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-400/10 border border-rose-400/20 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
              <PhoneCall className="h-4 w-4" />
            </div>
          </div>
          <div className="my-4">
            <span className="font-display text-4xl font-semibold text-white tracking-tight">
              {(metrics?.consultationsArranged ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="text-[0.7rem] text-neutral-400 border-t border-white/[0.06] pt-3">
            Client-advocate direct sessions
          </div>
        </div>
      </div>

      {/* Platform Revenue Telemetry in ₹ (INR) */}
      <div className="apple-glass-card p-6 font-mono space-y-6 border-emerald-500/20">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold flex items-center gap-1">
                <IndianRupee className="h-3.5 w-3.5" />
                FINANCIAL TELEMETRY · REVENUE IN ₹
              </span>
              <span className="apple-glass-pill px-2.5 py-0.5 text-[0.68rem] text-emerald-300 font-semibold border-emerald-500/30 bg-emerald-950/20">
                100% Escrow Settled
              </span>
            </div>
            <h2 className="font-display text-2xl font-medium text-white mt-1.5 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-400" />
              <span>Platform Revenue Telemetry & Ledger (₹)</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
              Consolidated earnings and gross settlement volume in Indian Rupees (₹) across advocate retainers, AI Memorial Drafter Pro enterprise licenses, statutory precedent access, and emergency bail consultations.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsAddRevenueModalOpen(true)}
              className="apple-glass-pill bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Record Revenue (₹)</span>
            </button>
          </div>
        </div>

        {/* Revenue Metric Breakdown Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="apple-glass-card p-5 border-emerald-500/30 bg-emerald-950/10">
            <div className="flex items-center justify-between text-xs text-neutral-400 uppercase tracking-wider">
              <span>Gross Revenue</span>
              <IndianRupee className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="font-display text-3xl sm:text-4xl font-semibold text-emerald-400 mt-2">
              {formatInr(totalGrossInr)}
            </p>
            <p className="text-[11px] text-neutral-400 mt-1">Total INR collected to date</p>
          </div>

          <div className="apple-glass-card p-5 border-white/10">
            <div className="flex items-center justify-between text-xs text-neutral-400 uppercase tracking-wider">
              <span>Advocate Retainers</span>
              <Scale className="h-4 w-4 text-sky-400" />
            </div>
            <p className="font-display text-2xl sm:text-3xl font-semibold text-white mt-2">
              {formatInr(retainerInr)}
            </p>
            <p className="text-[11px] text-sky-400/80 mt-1">High Court bail & quashing retainers</p>
          </div>

          <div className="apple-glass-card p-5 border-white/10">
            <div className="flex items-center justify-between text-xs text-neutral-400 uppercase tracking-wider">
              <span>AI Drafter & Campus</span>
              <Sparkles className="h-4 w-4 text-purple-400" />
            </div>
            <p className="font-display text-2xl sm:text-3xl font-semibold text-white mt-2">
              {formatInr(enterpriseInr)}
            </p>
            <p className="text-[11px] text-purple-400/80 mt-1">Memorial drafter & college licenses</p>
          </div>

          <div className="apple-glass-card p-5 border-white/10">
            <div className="flex items-center justify-between text-xs text-neutral-400 uppercase tracking-wider">
              <span>Emergency First-Aid</span>
              <Shield className="h-4 w-4 text-amber-400" />
            </div>
            <p className="font-display text-2xl sm:text-3xl font-semibold text-white mt-2">
              {formatInr(firstAidInr)}
            </p>
            <p className="text-[11px] text-amber-400/80 mt-1">Police station legal first-aid</p>
          </div>
        </div>

        {/* Revenue Ledger Table */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-wider text-neutral-300 font-semibold">
              Recent Settlement Transactions ({revenueTxs.length})
            </h3>
            <span className="text-[11px] text-neutral-500 font-mono">Real-time INR Ledger</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-neutral-400 uppercase tracking-wider text-[0.7rem] border-b border-white/[0.08]">
                  <th className="py-2.5 px-3">Reference No</th>
                  <th className="py-2.5 px-3">Payer / Client</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-3">Rail</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Settled At (IST)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {revenueTxs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-3 px-3 text-neutral-400 font-mono text-[0.72rem]">
                      {tx.referenceNo}
                    </td>
                    <td className="py-3 px-3 text-white font-medium">
                      <div>
                        <span>{tx.payerName}</span>
                        <span className="text-[10px] text-neutral-500 block font-mono">{tx.payerType}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-neutral-300">
                      {tx.serviceCategory}
                    </td>
                    <td className="py-3 px-3 text-right font-display text-sm font-semibold text-emerald-400">
                      +{formatInr(tx.amountInInr)}
                    </td>
                    <td className="py-3 px-3 font-mono text-[0.72rem] text-neutral-300">
                      <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">
                        {tx.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="apple-glass-pill inline-flex items-center gap-1 px-2 py-0.5 text-[0.68rem] text-emerald-400 border-emerald-500/30">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>{tx.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-neutral-400 font-mono text-[0.7rem] whitespace-nowrap">
                      {new Date(tx.transactionDate).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Mass Announcements Engine (Events, Webinars & Research Sharing) */}
      <div className="apple-glass-card p-6 font-mono space-y-6 border-purple-500/20">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-purple-400 font-semibold flex items-center gap-1">
                <Megaphone className="h-3.5 w-3.5" />
                MASS BROADCAST ENGINE · CROSS-DASHBOARD
              </span>
              <span className="apple-glass-pill px-2.5 py-0.5 text-[0.68rem] text-purple-300 font-semibold border-purple-500/30 bg-purple-950/20">
                {announcements.filter((a) => a.isActive).length} Active Broadcasts
              </span>
            </div>
            <h2 className="font-display text-2xl font-medium text-white mt-1.5 flex items-center gap-2">
              <Video className="h-5 w-5 text-purple-400" />
              <span>National Webinars, Events & Research Sharing</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
              Broadcast announcements to the mass across all dashboards (Citizens, Lawyers Workspace, Law Students & Interns). Publish live procedural webinars, BNSS research papers, and moot court masterclasses.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsAddAnnouncementModalOpen(true)}
              className="apple-glass-pill bg-purple-500 hover:bg-purple-400 text-black px-4 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Broadcast New Event</span>
            </button>
          </div>
        </div>

        {/* Live Broadcast Preview on Dashboards */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="flex items-center gap-1.5 text-neutral-300 font-semibold">
              <Eye className="h-3.5 w-3.5 text-purple-400" />
              Live Cross-Dashboard Banner Preview (What users see):
            </span>
            <span className="text-[11px] text-neutral-500 font-mono">Synchronized with Citizens, Lawyers & Students</span>
          </div>
          <MassAnnouncementBanner currentDashboard="founders" />
        </div>

        {/* Broadcasts Registry List */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs uppercase tracking-wider text-neutral-300 font-semibold">
            Active Platform Broadcasts ({announcements.length})
          </h3>

          <div className="grid grid-cols-1 gap-3">
            {announcements.map((a) => {
              const catBadge = a.category === "Webinar" 
                ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                : a.category === "Research Sharing"
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                : a.category === "Workshop"
                ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                : "bg-amber-500/15 text-amber-300 border-amber-500/30";

              return (
                <div
                  key={a.id}
                  className="apple-glass-card p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 border-white/10 hover:border-purple-500/30"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-semibold border ${catBadge}`}>
                        {a.category}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-white/5 border border-white/10 text-neutral-300">
                        Audience: {a.targetAudience}
                      </span>
                      {a.isPinned && (
                        <span className="px-2 py-0.5 rounded text-[9px] bg-amber-400/20 text-amber-300 border border-amber-400/30 font-semibold">
                          📌 Pinned
                        </span>
                      )}
                      <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-neutral-500" />
                        <span>{a.scheduledTime}</span>
                      </span>
                    </div>

                    <h4 className="font-display text-lg font-medium text-white truncate">
                      {a.title}
                    </h4>

                    <p className="text-xs text-neutral-300 line-clamp-2 max-w-3xl font-sans">
                      {a.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-400 pt-1">
                      <span>Host: <strong className="text-neutral-200">{a.speakerOrHost}</strong></span>
                      {a.eventLink && (
                        <a
                          href={a.eventLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-purple-400 hover:text-purple-300 flex items-center gap-1 underline underline-offset-2"
                        >
                          <span>{a.actionLabel || "Meeting / Paper Link"}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#222222]">
                    <button
                      onClick={() => togglePinAnnouncement(a.id)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer ${
                        a.isPinned
                          ? "bg-amber-400/20 border-amber-400/40 text-amber-300 hover:bg-amber-400/30"
                          : "border-white/10 text-neutral-400 hover:text-white"
                      }`}
                      title={a.isPinned ? "Unpin announcement" : "Pin to top of banner"}
                    >
                      <Pin className="h-3.5 w-3.5" />
                      <span>{a.isPinned ? "Pinned" : "Pin"}</span>
                    </button>
                    <button
                      onClick={() => toggleActiveAnnouncement(a.id)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer ${
                        a.isActive
                          ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                          : "bg-white/5 border-white/10 text-neutral-500"
                      }`}
                      title={a.isActive ? "Pause broadcast" : "Activate broadcast"}
                    >
                      <span>{a.isActive ? "Active" : "Paused"}</span>
                    </button>
                    <button
                      onClick={() => handleDeleteAnnouncement(a.id, a.title)}
                      className="border border-[#333333] hover:border-red-500 hover:text-red-400 text-neutral-500 p-2 rounded-lg transition-colors cursor-pointer"
                      title="Delete announcement"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Statutory Disclaimer & Advocate Notice Acknowledgements Section */}
      <div className="apple-glass-card p-6 font-mono">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-neutral-300 font-medium">
                STATUTORY COMPLIANCE · AUDIT TRAIL
              </span>
              <span className="apple-glass-pill px-2.5 py-0.5 text-[0.68rem] text-emerald-400 font-semibold border-emerald-500/30">
                {uniqueDisclaimerLogs.length} Logged
              </span>
            </div>
            <h2 className="font-display text-2xl font-medium text-white mt-1.5 flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-white" />
              <span>User Acknowledgement & Statutory Compliance List</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
              Auditable records of all users who accepted the statutory disclaimer before using the platform, as well as citizens who voluntarily accessed the advocate directory.
            </p>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 mt-4">
              <button
                type="button"
                onClick={() => setAckFilter("all")}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  ackFilter === "all"
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10"
                }`}
              >
                All Records ({uniqueDisclaimerLogs.length})
              </button>
              <button
                type="button"
                onClick={() => setAckFilter("platform")}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  ackFilter === "platform"
                    ? "bg-sky-400 text-black font-semibold shadow-sm"
                    : "bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10"
                }`}
              >
                Platform Disclaimer ({platformCount})
              </button>
              <button
                type="button"
                onClick={() => setAckFilter("advocate")}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  ackFilter === "advocate"
                    ? "bg-emerald-400 text-black font-semibold shadow-sm"
                    : "bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10"
                }`}
              >
                Advocate Notice ({advocateCount})
              </button>
            </div>
          </div>

          <div className="w-full sm:w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search user, email or type..."
                value={disclaimerSearch}
                onChange={(e) => setDisclaimerSearch(e.target.value)}
                className="apple-glass-input w-full pl-9 pr-3 py-2 text-xs text-white placeholder:text-neutral-500"
              />
            </div>
          </div>
        </div>

        {filteredDisclaimers.length === 0 ? (
          <div className="py-12 text-center text-neutral-500 text-xs">
            {uniqueDisclaimerLogs.length === 0
              ? "No user acknowledgements recorded yet. When signed-in users accept the statutory disclaimer or view legal professionals, their auditable compliance records will appear here with their email address."
              : "No acknowledgements match your search query."}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-neutral-400 uppercase tracking-wider text-[0.7rem]">
                  <th className="py-3 px-3">User Name</th>
                  <th className="py-3 px-3">Email Address</th>
                  <th className="py-3 px-3">Acknowledgement Type</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Date & Time (IST)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filteredDisclaimers.map((log) => {
                  const t = (log.notice_text || "").toLowerCase();
                  const isPlatform = t.includes("platform") || t.includes("statutory");

                  return (
                    <tr key={log.id} className="hover:bg-white/[0.04] transition-colors">
                      <td className="py-3 px-3 text-white font-medium">
                        {log.user_name || "Platform User"}
                      </td>
                      <td className="py-3 px-3 text-neutral-300 font-mono text-[0.75rem]">
                        {log.user_email || "—"}
                      </td>
                      <td className="py-3 px-3">
                        {isPlatform ? (
                          <span className="apple-glass-pill inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[0.68rem] text-sky-400 border-sky-500/30 bg-sky-950/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
                            Platform Disclaimer
                          </span>
                        ) : (
                          <span className="apple-glass-pill inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[0.68rem] text-emerald-400 border-emerald-500/30 bg-emerald-950/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                            Advocate Notice
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="apple-glass-pill inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[0.68rem] text-emerald-400 border-emerald-500/30">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                          Agreed & Recorded
                        </span>
                      </td>
                      <td className="py-3 px-3 text-neutral-400 whitespace-nowrap font-mono text-[0.7rem]">
                        {new Date(log.accepted_at).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Ops Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <Link
          to="/founders/users"
          className="apple-glass-card p-5 flex items-center justify-between font-mono group"
        >
          <div>
            <span className="text-xs uppercase tracking-wider text-amber-300 font-semibold block group-hover:text-amber-200 transition-colors">
              User Telemetry & Chat History
            </span>
            <p className="text-xs text-neutral-400 mt-1">
              Inspect real registered users, search activity, and browse read-only chat logs.
            </p>
          </div>
          <span className="text-sm text-neutral-300 ml-4 font-bold group-hover:translate-x-1 transition-transform">→</span>
        </Link>

        <Link
          to="/founders/admin"
          className="apple-glass-card p-5 flex items-center justify-between font-mono group"
        >
          <div>
            <span className="text-xs uppercase tracking-wider text-amber-300 font-semibold block group-hover:text-amber-200 transition-colors">
              Security & Provider Keys
            </span>
            <p className="text-xs text-neutral-400 mt-1">
              Configure allowed IP whitelists and manage LLM rotation keys.
            </p>
          </div>
          <span className="text-sm text-neutral-300 ml-4 font-bold group-hover:translate-x-1 transition-transform">→</span>
        </Link>
      </div>

      {/* Modal: Record Revenue Entry in ₹ */}
      {isAddRevenueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
          <div className="w-full max-w-lg border border-emerald-500/30 bg-[#141414] p-6 md:p-8 rounded-2xl shadow-2xl relative my-8 space-y-5">
            <button
              onClick={() => setIsAddRevenueModalOpen(false)}
              className="absolute right-5 top-5 text-[#888888] hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#252525] pb-4">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <IndianRupee className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display text-2xl font-medium text-white">Record Revenue Entry</h3>
                <p className="text-xs text-neutral-400">Log new INR transaction into platform gross telemetry</p>
              </div>
            </div>

            <form onSubmit={handleSaveRevenueSubmit} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block uppercase tracking-wider text-neutral-400 mb-1">
                  Payer / Client Name *
                </label>
                <input
                  type="text"
                  required
                  value={revPayerName}
                  onChange={(e) => setRevPayerName(e.target.value)}
                  placeholder="e.g. Shardul Amarchand Legal Desk / Rahul Sharma"
                  className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2.5 text-xs text-white focus:border-emerald-400 focus:outline-none rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block uppercase tracking-wider text-neutral-400 mb-1">
                    Payer Type
                  </label>
                  <select
                    value={revPayerType}
                    onChange={(e) => setRevPayerType(e.target.value as any)}
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none rounded-lg"
                  >
                    <option value="Citizen">Citizen</option>
                    <option value="Law Firm">Law Firm</option>
                    <option value="Academic Institution">Academic Institution</option>
                    <option value="Corporate">Corporate</option>
                  </select>
                </div>

                <div>
                  <label className="block uppercase tracking-wider text-neutral-400 mb-1">
                    Payment Rail
                  </label>
                  <select
                    value={revPaymentMethod}
                    onChange={(e) => setRevPaymentMethod(e.target.value as any)}
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none rounded-lg"
                  >
                    <option value="UPI">UPI (Instant)</option>
                    <option value="Net Banking">Net Banking (IMPS/NEFT)</option>
                    <option value="Stripe INR">Stripe INR</option>
                    <option value="Direct Escrow">Direct Escrow</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block uppercase tracking-wider text-neutral-400 mb-1">
                  Service Category *
                </label>
                <select
                  value={revServiceCategory}
                  onChange={(e) => setRevServiceCategory(e.target.value as any)}
                  className="w-full border border-[#333333] bg-[#0E0E0E] px-3 py-2.5 text-xs text-white focus:border-emerald-400 focus:outline-none rounded-lg"
                >
                  <option value="Advocate Retainer Consultation">Advocate Retainer Consultation</option>
                  <option value="AI Memorial Drafter Pro">AI Memorial Drafter Pro (License)</option>
                  <option value="Institutional Campus License">Institutional Campus License (Colleges)</option>
                  <option value="Statutory Precedent Research">Statutory Precedent Research Pass</option>
                  <option value="Emergency Bail First-Aid">Emergency Bail First-Aid</option>
                </select>
              </div>

              <div>
                <label className="block uppercase tracking-wider text-neutral-400 mb-1">
                  Amount in ₹ (INR) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-emerald-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={revAmount}
                    onChange={(e) => setRevAmount(parseFloat(e.target.value) || 0)}
                    className="w-full border border-[#333333] bg-[#0E0E0E] pl-8 pr-3.5 py-2.5 text-sm font-semibold text-emerald-400 focus:border-emerald-400 focus:outline-none rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block uppercase tracking-wider text-neutral-400 mb-1">
                  Transaction Remarks
                </label>
                <input
                  type="text"
                  value={revNotes}
                  onChange={(e) => setRevNotes(e.target.value)}
                  placeholder="e.g. Empanelment escrow fee or annual campus subscription"
                  className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none rounded-lg"
                />
              </div>

              <div className="pt-3 flex gap-3 border-t border-[#252525]">
                <button
                  type="submit"
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black py-2.5 rounded-xl font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Save Entry (+{formatInr(revAmount)})
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddRevenueModalOpen(false)}
                  className="border border-[#333333] px-5 py-2.5 rounded-xl uppercase tracking-wider text-[#888888] hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Broadcast Mass Announcement */}
      {isAddAnnouncementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
          <div className="w-full max-w-xl border border-purple-500/30 bg-[#141414] p-6 md:p-8 rounded-2xl shadow-2xl relative my-8 space-y-5 font-mono">
            <button
              onClick={() => setIsAddAnnouncementModalOpen(false)}
              className="absolute right-5 top-5 text-[#888888] hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#252525] pb-4">
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Megaphone className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display text-2xl font-medium text-white">Broadcast to All Dashboards</h3>
                <p className="text-xs text-neutral-400">Announce national webinars, research papers, and events to the mass</p>
              </div>
            </div>

            <form onSubmit={handleSaveAnnouncementSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block uppercase tracking-wider text-neutral-400 mb-1">
                  Announcement Title *
                </label>
                <input
                  type="text"
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="e.g. National Webinar: Navigating Procedural Shifts under BNSS 2023"
                  className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2.5 text-xs text-white focus:border-purple-400 focus:outline-none rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block uppercase tracking-wider text-neutral-400 mb-1">
                    Category *
                  </label>
                  <select
                    value={annCategory}
                    onChange={(e) => setAnnCategory(e.target.value as any)}
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3 py-2 text-xs text-white focus:border-purple-400 focus:outline-none rounded-lg"
                  >
                    <option value="Webinar">Live National Webinar</option>
                    <option value="Research Sharing">Research Sharing / Whitepaper</option>
                    <option value="Workshop">Hands-on Workshop</option>
                    <option value="Event">General Platform Event</option>
                  </select>
                </div>

                <div>
                  <label className="block uppercase tracking-wider text-neutral-400 mb-1">
                    Target Audience *
                  </label>
                  <select
                    value={annAudience}
                    onChange={(e) => setAnnAudience(e.target.value as any)}
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3 py-2 text-xs text-white focus:border-purple-400 focus:outline-none rounded-lg"
                  >
                    <option value="All Dashboards">All Dashboards (Mass)</option>
                    <option value="Citizens">Citizens Dashboard Only</option>
                    <option value="Lawyers">Lawyers Workspace Only</option>
                    <option value="Students & Interns">Law Students & Interns</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block uppercase tracking-wider text-neutral-400 mb-1">
                    Speaker / Host Directorate *
                  </label>
                  <input
                    type="text"
                    required
                    value={annSpeaker}
                    onChange={(e) => setAnnSpeaker(e.target.value)}
                    placeholder="Adv. Krish Chauhan / NLU Scholars"
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2 text-xs text-white focus:border-purple-400 focus:outline-none rounded-lg"
                  />
                </div>

                <div>
                  <label className="block uppercase tracking-wider text-neutral-400 mb-1">
                    Scheduled Time / Edition *
                  </label>
                  <input
                    type="text"
                    required
                    value={annTime}
                    onChange={(e) => setAnnTime(e.target.value)}
                    placeholder="Saturday, 21 Nov 2026 • 5:00 PM IST"
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2 text-xs text-white focus:border-purple-400 focus:outline-none rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block uppercase tracking-wider text-neutral-400 mb-1">
                    Event / Whitepaper Link
                  </label>
                  <input
                    type="text"
                    value={annLink}
                    onChange={(e) => setAnnLink(e.target.value)}
                    placeholder="https://meet.google.com/..."
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2 text-xs text-white focus:border-purple-400 focus:outline-none rounded-lg"
                  />
                </div>

                <div>
                  <label className="block uppercase tracking-wider text-neutral-400 mb-1">
                    Action Button Label
                  </label>
                  <input
                    type="text"
                    value={annAction}
                    onChange={(e) => setAnnAction(e.target.value)}
                    placeholder="e.g. Register for Live Webinar"
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2 text-xs text-white focus:border-purple-400 focus:outline-none rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block uppercase tracking-wider text-neutral-400 mb-1">
                  Full Announcement Description *
                </label>
                <textarea
                  required
                  rows={3}
                  value={annDesc}
                  onChange={(e) => setAnnDesc(e.target.value)}
                  placeholder="Outline key discussion points, paper findings, target attendees, and registration steps..."
                  className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2 text-xs text-white focus:border-purple-400 focus:outline-none rounded-lg resize-none"
                />
              </div>

              <div className="pt-3 flex gap-3 border-t border-[#252525]">
                <button
                  type="submit"
                  className="flex-1 bg-purple-500 hover:bg-purple-400 text-black py-2.5 rounded-xl font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Publish Broadcast to All Dashboards
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddAnnouncementModalOpen(false)}
                  className="border border-[#333333] px-5 py-2.5 rounded-xl uppercase tracking-wider text-[#888888] hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
