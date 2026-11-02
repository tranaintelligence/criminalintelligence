import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Settings, Users, Megaphone, Flag, Download, 
  Trash2, Plus, Save, Check, AlertTriangle, ShieldCheck, LockKeyhole 
} from "lucide-react";
import { useTranaCredential } from "@/lib/trana-auth";
import { 
  getFounderEmails, 
  addFounderEmail as apiAddFounderEmail, 
  deleteFounderEmail, 
  FounderRecord 
} from "@/lib/trana-admin-api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/csv-export";

export const Route = createFileRoute("/founders/settings")({
  head: () => ({
    meta: [
      { title: "Founders Dashboard — TRANA" },
      { name: "description", content: "Access control, site-wide announcement banners, feature flags, and waitlist management." },
      { property: "og:title", content: "Founders Dashboard — TRANA" },
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
  const { credential } = useTranaCredential();
  const [newFounderEmail, setNewFounderEmail] = useState("");
  const [newFounderLabel, setNewFounderLabel] = useState("Co-Founder");
  const [isAddingFounder, setIsAddingFounder] = useState(false);

  // Load authorized founders from encrypted backend table
  const {
    data: dbFounders = [],
    isLoading: foundersLoading,
    refetch: refetchFounders,
  } = useQuery<FounderRecord[]>({
    queryKey: ["founders-settings-authorized-list", credential],
    queryFn: async () => {
      if (!credential) {
        return [{
          id: "primary-01",
          email: "ckhraiushh1@gmail.com",
          label: "Primary Founder",
          added_by: "System Genesis",
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }];
      }
      try {
        const res = await getFounderEmails(credential);
        if (Array.isArray(res) && res.length > 0) {
          try {
            localStorage.setItem("trana_authorized_founders", JSON.stringify(res.map((r) => r.email)));
          } catch {}
          return res;
        }
      } catch (err) {
        console.warn("Could not fetch founders from encrypted store:", err);
      }
      return [{
        id: "primary-01",
        email: "ckhraiushh1@gmail.com",
        label: "Primary Founder",
        added_by: "System Genesis",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }];
    },
  });

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
      // Founders loaded from encrypted API table

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#222222] pb-3 gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-300" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
              Encrypted Founder Access Management
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-600/40 flex items-center gap-1">
              <LockKeyhole size={11} />
              Fernet AES Encrypted
            </span>
            <span className="text-[0.65rem] text-[#888888] font-mono">
              {dbFounders.length} {dbFounders.length === 1 ? "Authorized Founder" : "Authorized Founders"}
            </span>
          </div>
        </div>

        <p className="text-[#999999] text-[0.7rem] leading-relaxed">
          Authorized executive Google accounts permitted to access the confidential /founders executive terminal. Founder emails are stored encrypted in the backend database.
        </p>

        {/* Existing Founders List */}
        <div className="divide-y divide-[#1F1F1F] border border-[#222222] bg-[#0A0A0A]">
          {foundersLoading ? (
            <div className="p-4 text-center text-[#777777]">Loading authorized founders...</div>
          ) : dbFounders.length === 0 ? (
            <div className="p-4 text-center text-[#777777]">No founders found.</div>
          ) : (
            dbFounders.map((founder) => {
              const isPrimary = founder.email.toLowerCase() === "ckhraiushh1@gmail.com";
              return (
                <div key={founder.id || founder.email} className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded bg-[#161616] border border-[#262626] flex items-center justify-center text-amber-300 shrink-0">
                      <ShieldCheck size={14} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono text-xs">{founder.email}</span>
                        {isPrimary && (
                          <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-600/40">
                            Primary Founder
                          </span>
                        )}
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-[#181818] text-neutral-400 border border-[#2a2a2a]">
                          {founder.label || "Founder"}
                        </span>
                      </div>
                      <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                        Status: Active {founder.added_by ? `• added by ${founder.added_by}` : ""}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveFounder(founder)}
                    disabled={isPrimary && dbFounders.length <= 1}
                    className="text-red-400 hover:text-red-300 p-1.5 border border-red-500/20 hover:border-red-500/50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title={isPrimary && dbFounders.length <= 1 ? "Cannot delete sole primary founder" : "Revoke founder access"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Add Founder Email Form */}
        <form onSubmit={handleAddFounder} className="flex flex-col sm:flex-row gap-2 pt-1 font-mono">
          <input
            type="email"
            required
            value={newFounderEmail}
            onChange={(e) => setNewFounderEmail(e.target.value)}
            placeholder="Add partner email: cofounder@gmail.com"
            className="flex-1 border border-[#333333] bg-[#0A0A0A] px-3 py-2 text-xs text-white placeholder:text-[#555555] focus:border-white focus:outline-none"
          />
          <input
            type="text"
            value={newFounderLabel}
            onChange={(e) => setNewFounderLabel(e.target.value)}
            placeholder="Role (e.g. Co-Founder)"
            className="w-full sm:w-44 border border-[#333333] bg-[#0A0A0A] px-3 py-2 text-xs text-white placeholder:text-[#555555] focus:border-white focus:outline-none"
          />
          <button
            type="submit"
            disabled={isAddingFounder || !newFounderEmail.trim()}
            className="border border-white/40 bg-white text-black px-4 py-2 text-xs uppercase tracking-wider font-semibold hover:bg-neutral-200 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isAddingFounder ? "Encrypting..." : "Add Founder"}</span>
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
