import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Settings, Users, Megaphone, Flag, Download, 
  Trash2, Plus, Save, Check, AlertTriangle, ShieldCheck 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/csv-export";

export const Route = createFileRoute("/founders/settings")({
  head: () => ({
    meta: [
      { title: "Founders Settings & Flags TRANA" },
      { name: "description", content: "Access control, site-wide announcement banners, feature flags, and waitlist management." },
    ],
  }),
  component: FoundersSettingsPage,
});

type FeatureFlags = {
  firAnalyser: boolean;
  lawyerDirectory: boolean;
  aiDrafter: boolean;
  legalResearch: boolean;
};

type WaitlistEntry = {
  id: string;
  email: string;
  date: string;
};

const initialWaitlist: WaitlistEntry[] = [
  { id: "wt-01", email: "kavita.deshmukh@lawchambers.co.in", date: "24 Oct 2026" },
  { id: "wt-02", email: "rajiv.bansal@supremecourt.bar", date: "24 Oct 2026" },
  { id: "wt-03", email: "meera.iyengar@nludelhi.ac.in", date: "23 Oct 2026" },
  { id: "wt-04", email: "tarun.sachdeva@advocate.in", date: "23 Oct 2026" },
  { id: "wt-05", email: "shashank.m@khaitanco.com", date: "22 Oct 2026" },
  { id: "wt-06", email: "adv.ananya.s@cyberlaw.org", date: "21 Oct 2026" },
  { id: "wt-07", email: "vivek.malik@delhibar.in", date: "20 Oct 2026" },
];

function FoundersSettingsPage() {
  // 1. Founder access management
  const [founderEmails, setFounderEmails] = useState<string[]>([
    "founder@trana.in",
    "admin@trana.in",
    "team@trana.in",
  ]);
  const [newFounderEmail, setNewFounderEmail] = useState("");

  // 2. Platform announcement banner
  const [bannerEnabled, setBannerEnabled] = useState(false);
  const [bannerText, setBannerText] = useState(
    "TRANA System Notice: Updated Indian Criminal Laws (BNS, BNSS, BSA) citation cross-reference engine is now live."
  );

  // 3. Feature flags
  const [flags, setFlags] = useState<FeatureFlags>({
    firAnalyser: true,
    lawyerDirectory: true,
    aiDrafter: true,
    legalResearch: true,
  });

  // 4. Waitlist management
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>(initialWaitlist);
  const [waitlistSearch, setWaitlistSearch] = useState("");

  // Query Supabase research_waitlist
  const { data: dbWaitlist = [] } = useQuery({
    queryKey: ["founders-settings-waitlist"],
    queryFn: async () => {
      const { data } = await supabase.from("research_waitlist").select("*");
      return data || [];
    },
  });

  // Load saved settings from localStorage
  useEffect(() => {
    try {
      // Founders
      const storedFounders = localStorage.getItem("trana_authorized_founders");
      if (storedFounders) setFounderEmails(JSON.parse(storedFounders));

      // Announcement banner
      const storedBanner = localStorage.getItem("trana_announcement_banner");
      if (storedBanner) {
        const parsed = JSON.parse(storedBanner);
        setBannerEnabled(parsed.enabled ?? false);
        setBannerText(parsed.text ?? bannerText);
      }

      // Feature flags
      const storedFlags = localStorage.getItem("trana_feature_flags");
      if (storedFlags) setFlags(JSON.parse(storedFlags));
    } catch {
      // ignore
    }
  }, []);

  // Combine waitlist
  useEffect(() => {
    if (dbWaitlist.length > 0) {
      const dbEntries: WaitlistEntry[] = dbWaitlist.map((row, idx) => ({
        id: row.id || `wt-db-${idx}`,
        email: row.email,
        date: row.created_at ? new Date(row.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "24 Oct 2026",
      }));
      setWaitlist((prev) => {
        const set = new Set(prev.map((e) => e.email.toLowerCase()));
        const additions = dbEntries.filter((e) => !set.has(e.email.toLowerCase()));
        return [...additions, ...prev];
      });
    }
  }, [dbWaitlist]);

  // Handler: Add founder
  function addFounderEmail(e: React.FormEvent) {
    e.preventDefault();
    const email = newFounderEmail.trim().toLowerCase();
    if (!email || founderEmails.includes(email)) return;
    const updated = [...founderEmails, email];
    setFounderEmails(updated);
    setNewFounderEmail("");
    localStorage.setItem("trana_authorized_founders", JSON.stringify(updated));
    toast.success(`Authorized founder added: ${email}`);
  }

  // Handler: Remove founder
  function removeFounderEmail(email: string) {
    if (founderEmails.length <= 1) {
      toast.error("At least one founder email must remain registered.");
      return;
    }
    const updated = founderEmails.filter((e) => e !== email);
    setFounderEmails(updated);
    localStorage.setItem("trana_authorized_founders", JSON.stringify(updated));
    toast.info(`Removed founder access for: ${email}`);
  }

  // Handler: Save banner
  function saveBannerSettings() {
    const bannerData = { enabled: bannerEnabled, text: bannerText };
    localStorage.setItem("trana_announcement_banner", JSON.stringify(bannerData));
    window.dispatchEvent(new Event("trana-announcement-change"));
    toast.success(
      bannerEnabled
        ? "Announcement banner is now LIVE across the entire website!"
        : "Announcement banner disabled."
    );
  }

  // Handler: Toggle flag
  function toggleFlag(key: keyof FeatureFlags) {
    const updated = { ...flags, [key]: !flags[key] };
    setFlags(updated);
    localStorage.setItem("trana_feature_flags", JSON.stringify(updated));
    toast.info(`Feature flag updated: ${key} = ${updated[key] ? "ON" : "OFF"}`);
  }

  // Handler: Export waitlist
  function exportWaitlistCSV() {
    const headers = ["ID", "Email", "Date Registered"];
    const rows = waitlist.map((w) => [w.id, w.email, w.date]);

    downloadCSV(`trana_waitlist_leads_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    toast.success(`Exported ${waitlist.length} waitlist emails to CSV.`);
  }

  const filteredWaitlist = waitlist.filter((w) =>
    w.email.toLowerCase().includes(waitlistSearch.toLowerCase())
  );

  return (
    <div className="space-y-8 font-mono text-xs max-w-5xl">
      {/* Header */}
      <div className="border-b border-[#222222] pb-4">
        <span className="text-[0.65rem] text-[#888888] uppercase tracking-widest block">
          OPERATIONAL CONTROLS & PLATFORM CONFIGURATION
        </span>
        <h1 className="font-display text-3xl font-medium text-white mt-1">
          Founders Settings
        </h1>
      </div>

      {/* SECTION 1: FOUNDER ACCESS MANAGEMENT */}
      <div className="bg-[#111111] border border-[#222222] p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-[#222222] pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-white" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
              Founder Access Management
            </h2>
          </div>
          <span className="text-[0.65rem] text-[#888888]">
            {founderEmails.length} Authorized Founders
          </span>
        </div>

        <p className="text-[#999999] text-[0.7rem] leading-relaxed">
          Emails authorized to bypass citizen gates and access the confidential /founders terminal.
        </p>

        {/* Existing Founders List */}
        <div className="divide-y divide-[#1F1F1F] border border-[#222222] bg-[#0A0A0A]">
          {founderEmails.map((email) => (
            <div key={email} className="p-2.5 flex items-center justify-between">
              <span className="text-white font-mono">{email}</span>
              <button
                onClick={() => removeFounderEmail(email)}
                className="text-red-400 hover:text-red-300 p-1 border border-red-500/20 hover:border-red-500/50"
                title="Revoke founder access"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Add Founder Email Form */}
        <form onSubmit={addFounderEmail} className="flex gap-2 pt-1">
          <input
            type="email"
            required
            value={newFounderEmail}
            onChange={(e) => setNewFounderEmail(e.target.value)}
            placeholder="Add new partner: partner@trana.in"
            className="flex-1 border border-[#333333] bg-[#0A0A0A] px-3 py-2 text-xs text-white placeholder:text-[#555555] focus:border-white focus:outline-none"
          />
          <button
            type="submit"
            className="border border-white/40 bg-white text-black px-4 py-2 text-xs uppercase tracking-wider font-semibold hover:bg-neutral-200 transition-colors flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Founder</span>
          </button>
        </form>
      </div>

      {/* SECTION 2: PLATFORM ANNOUNCEMENT BANNER */}
      <div className="bg-[#111111] border border-[#222222] p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-[#222222] pb-3">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-white" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
              Platform Announcement Banner
            </h2>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-[0.65rem] text-[#888888] uppercase">
              {bannerEnabled ? "ACTIVE (BROADCASTING)" : "OFFLINE"}
            </span>
            <input
              type="checkbox"
              checked={bannerEnabled}
              onChange={(e) => setBannerEnabled(e.target.checked)}
              className="h-4 w-4 accent-white cursor-pointer"
            />
          </label>
        </div>

        <p className="text-[#999999] text-[0.7rem] leading-relaxed">
          Displays a persistent announcement strip at the very top of every page on TRANA for urgent notices, server downtime, or new feature rollouts.
        </p>

        <div>
          <label className="block text-[0.65rem] uppercase tracking-wider text-[#888888] mb-1.5">
            Banner Announcement Text
          </label>
          <input
            type="text"
            value={bannerText}
            onChange={(e) => setBannerText(e.target.value)}
            placeholder="e.g. Scheduled platform maintenance Sunday 2:00 AM IST..."
            className="w-full border border-[#333333] bg-[#0A0A0A] p-3 text-xs text-white placeholder:text-[#555555] focus:border-white focus:outline-none"
          />
        </div>

        {/* Live Preview */}
        {bannerEnabled && (
          <div className="border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-300 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Live Preview: {bannerText}</span>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            onClick={saveBannerSettings}
            className="border border-white/40 bg-white text-black px-5 py-2 text-xs uppercase tracking-wider font-semibold hover:bg-neutral-200 transition-colors flex items-center gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save & Apply Banner</span>
          </button>
        </div>
      </div>

      {/* SECTION 3: FEATURE FLAGS */}
      <div className="bg-[#111111] border border-[#222222] p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-[#222222] pb-3">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-white" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
              Dynamic Feature Flags
            </h2>
          </div>
          <span className="text-[0.65rem] text-[#888888]">4 Runtime Knobs</span>
        </div>

        <p className="text-[#999999] text-[0.7rem] leading-relaxed">
          Instantly kill or enable platform modules in case of upstream API failure, regulatory reviews, or staging tests.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* Toggle: FIR Analyser */}
          <div
            onClick={() => toggleFlag("firAnalyser")}
            className={`border p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
              flags.firAnalyser ? "border-white/50 bg-[#1A1A1A]" : "border-[#222222] bg-[#0A0A0A]"
            }`}
          >
            <div>
              <span className="font-semibold text-white block">FIR Analyser</span>
              <span className="text-[0.65rem] text-[#777777]">AI statutory situation decoding</span>
            </div>
            <span
              className={`px-2 py-0.5 text-[0.65rem] border ${
                flags.firAnalyser ? "border-emerald-500/40 text-emerald-400 bg-emerald-950/20" : "border-red-500/40 text-red-400 bg-red-950/20"
              }`}
            >
              {flags.firAnalyser ? "ENABLED" : "OFFLINE"}
            </span>
          </div>

          {/* Toggle: Lawyer Directory */}
          <div
            onClick={() => toggleFlag("lawyerDirectory")}
            className={`border p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
              flags.lawyerDirectory ? "border-white/50 bg-[#1A1A1A]" : "border-[#222222] bg-[#0A0A0A]"
            }`}
          >
            <div>
              <span className="font-semibold text-white block">Lawyer Directory</span>
              <span className="text-[0.65rem] text-[#777777]">Public advocate listings & booking</span>
            </div>
            <span
              className={`px-2 py-0.5 text-[0.65rem] border ${
                flags.lawyerDirectory ? "border-emerald-500/40 text-emerald-400 bg-emerald-950/20" : "border-red-500/40 text-red-400 bg-red-950/20"
              }`}
            >
              {flags.lawyerDirectory ? "ENABLED" : "OFFLINE"}
            </span>
          </div>

          {/* Toggle: AI Drafter for Lawyers */}
          <div
            onClick={() => toggleFlag("aiDrafter")}
            className={`border p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
              flags.aiDrafter ? "border-white/50 bg-[#1A1A1A]" : "border-[#222222] bg-[#0A0A0A]"
            }`}
          >
            <div>
              <span className="font-semibold text-white block">AI Drafter for Lawyers</span>
              <span className="text-[0.65rem] text-[#777777]">Pleadings & bail synthesis engine</span>
            </div>
            <span
              className={`px-2 py-0.5 text-[0.65rem] border ${
                flags.aiDrafter ? "border-emerald-500/40 text-emerald-400 bg-emerald-950/20" : "border-red-500/40 text-red-400 bg-red-950/20"
              }`}
            >
              {flags.aiDrafter ? "ENABLED" : "OFFLINE"}
            </span>
          </div>

          {/* Toggle: Legal Research */}
          <div
            onClick={() => toggleFlag("legalResearch")}
            className={`border p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
              flags.legalResearch ? "border-white/50 bg-[#1A1A1A]" : "border-[#222222] bg-[#0A0A0A]"
            }`}
          >
            <div>
              <span className="font-semibold text-white block">Legal Research</span>
              <span className="text-[0.65rem] text-[#777777]">Precedent search & citation index</span>
            </div>
            <span
              className={`px-2 py-0.5 text-[0.65rem] border ${
                flags.legalResearch ? "border-emerald-500/40 text-emerald-400 bg-emerald-950/20" : "border-red-500/40 text-red-400 bg-red-950/20"
              }`}
            >
              {flags.legalResearch ? "ENABLED" : "OFFLINE"}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 4: WAITLIST MANAGEMENT */}
      <div className="bg-[#111111] border border-[#222222] p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222222] pb-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
              Research Waitlist Management
            </h2>
            <span className="text-[0.65rem] text-[#888888]">
              {waitlist.length} Legal Professionals Awaiting Beta
            </span>
          </div>

          {/* Export Waitlist CSV Button */}
          <button
            onClick={exportWaitlistCSV}
            className="border border-white/40 bg-[#161616] px-3.5 py-1.5 text-xs uppercase tracking-wider text-white hover:bg-white hover:text-black transition-colors flex items-center gap-1.5"
          >
            <Download className="h-3 w-3" />
            <span>Export Waitlist CSV</span>
          </button>
        </div>

        <div className="relative max-w-sm">
          <input
            type="text"
            value={waitlistSearch}
            onChange={(e) => setWaitlistSearch(e.target.value)}
            placeholder="Search waitlist emails..."
            className="w-full border border-[#333333] bg-[#0A0A0A] px-3 py-1.5 text-xs text-white placeholder:text-[#555555] focus:border-white focus:outline-none"
          />
        </div>

        <div className="border border-[#222222] bg-[#0A0A0A] max-h-52 overflow-y-auto divide-y divide-[#1F1F1F]">
          {filteredWaitlist.map((w) => (
            <div key={w.id} className="p-2.5 flex items-center justify-between text-xs">
              <span className="text-white font-mono">{w.email}</span>
              <span className="text-[#777777] font-mono text-[0.7rem]">{w.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
