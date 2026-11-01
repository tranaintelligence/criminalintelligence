import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { 
  Scale, Search, Bell, Phone, Mail, CheckCircle2, 
  Clock, AlertCircle, ArrowUpRight, Calendar, Landmark, FileText, 
  Trash2, Send, ExternalLink, BookmarkPlus, Plus, Sparkles, RefreshCw, ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { useLawyerAuth } from "./lawyer";
import { API_URL } from "@/lib/trana-backend";
import { 
  validateCnr, 
  fetchCnrStatus, 
  getSavedCases, 
  saveTrackedCase, 
  removeTrackedCase, 
  sendInstantHearingReminder,
  ECourtCaseRecord 
} from "@/lib/ecourts-tracker";

export const Route = createFileRoute("/_authenticated/lawyer/cases")({
  head: () => ({
    meta: [
      { title: "Legal Professional Workspace — TRANA" },
      { name: "description", content: "Track litigation matters via official eCourts CNR numbers with live CIS & NJDG sync and automated hearing reminders." },
      { property: "og:title", content: "Legal Professional Workspace — TRANA" },
    ],
  }),
  component: LawyerCaseTrackerPage,
});

function LawyerCaseTrackerPage() {
  const { user } = Route.useRouteContext();
  const { data: lawyer } = useLawyerAuth();
  
  const [cnrInput, setCnrInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeCase, setActiveCase] = useState<ECourtCaseRecord | null>(null);
  const [trackedCases, setTrackedCases] = useState<ECourtCaseRecord[]>([]);

  // Chamber alert inputs
  const [smsPhone, setSmsPhone] = useState("+91 98110 42910");
  const [emailAlert, setEmailAlert] = useState(user.email || "chambers@delhibar.org");
  const [isSendingAlert, setIsSendingAlert] = useState(false);

  // Load lawyer's chamber tracked cases from server + local storage
  useEffect(() => {
    let isMounted = true;

    async function loadMatters() {
      // 1. Initial immediate hydration from local storage
      const local = getSavedCases("lawyer", user.id);
      if (local.length > 0 && isMounted) {
        setTrackedCases(local);
        setActiveCase(local[0]);
      }

      // 2. Fetch from backend API /api/cases/tracked
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("trana_session_token") : null;
        if (token) {
          const res = await fetch(`${API_URL}/api/cases/tracked`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const serverCases: ECourtCaseRecord[] = await res.json();
            if (Array.isArray(serverCases) && serverCases.length > 0 && isMounted) {
              setTrackedCases(serverCases);
              setActiveCase(serverCases[0]);
              return;
            }
          }
        }
      } catch (err) {
        console.warn("Could not retrieve tracked cases from backend, using local cache:", err);
      }

      // 3. If no matters exist at all, pre-load benchmark case
      if (local.length === 0 && isMounted) {
        fetchCnrStatus("DLHC010012342024", {
          email: user.email || "counsel@delhibar.org",
          phone: "+91 98110 42910",
          lawyerName: lawyer?.full_name || "Senior Advocate",
        }).then((initial) => {
          if (isMounted) {
            const seeded = saveTrackedCase("lawyer", user.id, initial);
            setTrackedCases(seeded);
            setActiveCase(initial);
          }
        });
      }
    }

    if (user?.id) {
      loadMatters();
    }

    return () => {
      isMounted = false;
    };
  }, [user?.id, lawyer?.full_name, user?.email]);

  async function handleSearchCnr(cnrToLookup?: string) {
    const targetCnr = (cnrToLookup || cnrInput).trim();
    const validation = validateCnr(targetCnr);

    if (!validation.valid) {
      toast.error(validation.error || "Please enter a valid 16-character CNR number");
      return;
    }

    setIsLoading(true);
    try {
      const record = await fetchCnrStatus(validation.cleanCnr, {
        email: emailAlert,
        phone: smsPhone,
        lawyerName: lawyer?.full_name || "Advocate on Record",
      });

      const updatedList = saveTrackedCase("lawyer", user.id, record);
      setTrackedCases(updatedList);
      setActiveCase(record);
      setCnrInput(record.cnr);
      toast.success(`eCourts status synced for CNR ${record.formattedCnr}!`);
    } catch {
      toast.error("Failed to fetch eCourts status. Please verify the CNR number.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRefreshActiveCase() {
    if (!activeCase) return;
    setIsRefreshing(true);
    try {
      const refreshed = await fetchCnrStatus(activeCase.cnr, {
        email: emailAlert,
        phone: smsPhone,
        lawyerName: lawyer?.full_name || "Advocate on Record",
      });
      const updatedList = saveTrackedCase("lawyer", user.id, refreshed);
      setTrackedCases(updatedList);
      setActiveCase(refreshed);
      toast.success(`Case ${refreshed.formattedCnr} refreshed from live registry!`);
    } catch {
      toast.error("Failed to refresh case from court registry.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleTriggerReminders() {
    if (!activeCase) return;
    if (!smsPhone.trim()) {
      toast.error("Please enter a mobile phone number for hearing SMS");
      return;
    }
    if (!emailAlert.trim() || !emailAlert.includes("@")) {
      toast.error("Please enter a valid chamber email address");
      return;
    }

    setIsSendingAlert(true);
    try {
      const newLogs = await sendInstantHearingReminder(activeCase, smsPhone, emailAlert);
      
      const updatedCase: ECourtCaseRecord = {
        ...activeCase,
        smsNumber: smsPhone,
        emailAddress: emailAlert,
        smsEnabled: true,
        emailEnabled: true,
        reminderStatus: "Active",
        lastNotificationDispatched: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        notificationLog: [...newLogs, ...activeCase.notificationLog],
      };

      const updatedList = saveTrackedCase("lawyer", user.id, updatedCase);
      setTrackedCases(updatedList);
      setActiveCase(updatedCase);

      toast.success(`Hearing reminder SMS scheduled for ${smsPhone} & advisory emailed to ${emailAlert}`);
    } catch {
      toast.error("Failed to dispatch reminders");
    } finally {
      setIsSendingAlert(false);
    }
  }

  function handleDeleteCase(cnr: string) {
    const updated = removeTrackedCase("lawyer", user.id, cnr);
    setTrackedCases(updated);
    if (activeCase?.cnr === cnr) {
      setActiveCase(updated[0] || null);
    }
    toast.info("Matter removed from chamber diary.");
  }

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="border-b border-[#222222] pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[0.65rem] text-[#888888] uppercase tracking-widest block">
              ECOURTS CIS & NJDG CAUSE LIST AUTOMATION
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE REGISTRY SYNC</span>
            </span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-medium text-white">
            Case Tracker
          </h1>
          <p className="mt-2 text-sm text-[#999999] font-sans max-w-3xl">
            Synchronize live case status, hearing dates, and judicial orders directly from the National Judicial Data Grid (NJDG) and High Court CIS using 16-character CNR numbers.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="border border-white/20 bg-[#1A1A1A] px-4 py-2.5 text-xs font-mono text-white flex items-center gap-2 rounded">
            <Calendar className="h-4 w-4 text-emerald-400" />
            <span>Matters Tracked: <strong className="text-white">{trackedCases.length}</strong></span>
          </div>
        </div>
      </div>

      {/* CNR Search Form */}
      <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-6 md:p-8 space-y-4 rounded-lg shadow-xl">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs uppercase tracking-[0.15em] text-[#888888] font-mono block">
              Enter 16-Character CNR Number (eCourts Unique Identifier)
            </label>
            <span className="text-[11px] font-mono text-neutral-400 hidden sm:inline">
              Format: State(2) + Court(2) + Estab(2) + Number(6) + Year(4)
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#777777]" />
              <input
                type="text"
                value={cnrInput}
                onChange={(e) => setCnrInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchCnr()}
                placeholder="e.g. DLHC010012342024 or MHCC020054322023"
                maxLength={20}
                className="w-full border border-[#333333] bg-[#111111] py-3 pl-10 pr-4 text-sm text-white placeholder:text-[#555555] focus:border-white focus:outline-none font-mono uppercase rounded"
              />
            </div>
            <button
              type="button"
              onClick={() => handleSearchCnr()}
              disabled={isLoading}
              className="px-6 py-3 bg-white text-black font-semibold text-xs uppercase tracking-wider hover:bg-neutral-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 font-mono whitespace-nowrap rounded"
            >
              {isLoading ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  <span>Connecting to eCourts...</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  <span>Track CNR Case</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Sample CNR Buttons */}
        <div className="pt-2 flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="text-[#888888] text-[0.7rem]">Chamber benchmark registries:</span>
          {[
            { label: "Delhi High Court (Bail)", cnr: "DLHC010012342024" },
            { label: "Delhi High Court (Writ)", cnr: "DLHC010056782023" },
            { label: "Supreme Court (SLP Crl)", cnr: "SCIN010004562024" },
            { label: "Mumbai City Civil (NI Act)", cnr: "MHCC020054322023" },
            { label: "Bengaluru District (Cyber)", cnr: "KA01000123452024" },
          ].map((s) => (
            <button
              key={s.cnr}
              type="button"
              onClick={() => {
                setCnrInput(s.cnr);
                handleSearchCnr(s.cnr);
              }}
              className="px-2.5 py-1 text-[0.7rem] border border-[#333333] bg-[#111111] text-[#CCCCCC] hover:border-white hover:text-white transition-colors rounded"
            >
              {s.label}: <span className="text-amber-300 font-bold">{s.cnr}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TRACKED MATTERS DIARY */}
      {trackedCases.length > 0 && (
        <div className="space-y-3 font-mono">
          <div className="flex items-center justify-between text-xs text-[#888888] uppercase tracking-wider">
            <span>Chamber Litigation Matters ({trackedCases.length})</span>
            <span>SMS & Email Hearing Alerts Active</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {trackedCases.map((tc) => (
              <div
                key={tc.cnr}
                onClick={() => setActiveCase(tc)}
                className={`cursor-pointer p-4 border transition-all text-xs rounded ${
                  activeCase?.cnr === tc.cnr
                    ? "border-white bg-[#222222] shadow-lg"
                    : "border-[#2E2E2E] bg-[#161616] hover:border-white/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-amber-300 font-bold">{tc.formattedCnr}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCase(tc.cnr);
                    }}
                    className="text-[#666666] hover:text-red-400 p-0.5"
                    title="Remove matter"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 text-white font-sans font-medium line-clamp-1">{tc.petitioner}</div>
                <div className="mt-1 text-[0.7rem] text-[#888888] line-clamp-1">{tc.courtName}</div>
                <div className="mt-3 pt-2 border-t border-[#262626] flex items-center justify-between text-[0.7rem]">
                  <span className="text-[#888888]">Next Listing:</span>
                  <span className="text-emerald-400 font-semibold">{tc.nextHearingDate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DETAILED CASE RECORD & NOTIFICATION DISPATCH */}
      {activeCase && (
        <div className="space-y-6">
          {/* Main Case Summary */}
          <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-6 md:p-8 space-y-6 shadow-xl rounded-lg">
            {/* Source Telemetry Banner */}
            <div className="bg-[#121212] border border-[#262626] px-4 py-2.5 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-xs">
              <div className="flex items-center gap-2 text-neutral-300">
                {activeCase.is_live_sync !== false ? (
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                )}
                <span>
                  Source: <strong className="text-white">{activeCase.source || "National Judicial Data Grid & eCourts Services (Live CIS Sync)"}</strong>
                </span>
                {activeCase.is_live_sync !== false ? (
                  <span className="text-[10px] bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 px-1.5 py-0.5 rounded ml-1">
                    VERIFIED
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-950/80 border border-amber-500/40 text-amber-300 px-1.5 py-0.5 rounded ml-1">
                    DECODER MODE
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleRefreshActiveCase}
                disabled={isRefreshing}
                className="text-[11px] text-amber-300 hover:text-amber-200 inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
                <span>{isRefreshing ? "Syncing..." : "Sync Fresh Status"}</span>
              </button>
            </div>

            {/* Live API Notice Banner if API Key is not configured */}
            {(activeCase.api_key_required || activeCase.is_live_sync === false) && (
              <div className="bg-amber-950/30 border border-amber-500/40 p-4 rounded text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200 font-sans">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>Decoder Mode:</strong> Live court docket data for un-benchmarked cases requires an eCourts API key (Surepass, eCourtsIndia, or Indian Kanoon). Configure in Founders Console to fetch live dates & orders directly from court servers.
                  </span>
                </div>
                <Link
                  to="/founders/admin"
                  className="shrink-0 inline-flex items-center gap-1 font-mono text-[11px] text-amber-300 hover:text-white underline whitespace-nowrap"
                >
                  <span>Configure Court API Key →</span>
                </Link>
              </div>
            )}

            {/* Header info */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-[#2E2E2E] pb-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 text-xs font-mono bg-[#111111] border border-[#333333] text-amber-300 font-bold rounded">
                    {activeCase.formattedCnr}
                  </span>
                  <span className="px-2 py-0.5 text-[0.7rem] uppercase tracking-wider rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-mono">
                    {activeCase.caseStatus}
                  </span>
                </div>
                <h2 className="mt-2 font-display text-2xl md:text-3xl font-medium text-white">
                  {activeCase.petitioner} <span className="text-[#888888] text-lg">vs</span> {activeCase.respondent}
                </h2>
                <p className="mt-1 text-xs text-[#888888] font-mono">
                  {activeCase.caseType} No. {activeCase.caseNumber} • Filing Date: {activeCase.filingDate} • Reg: {activeCase.registrationNumber}
                </p>
              </div>

              {/* Next Hearing Highlight */}
              <div className="bg-[#111111] border border-emerald-500/40 p-4 min-w-[240px] font-mono rounded">
                <span className="text-[0.65rem] uppercase tracking-wider text-[#888888] block">
                  Next Listing Date (eCourts)
                </span>
                <div className="mt-1 text-2xl font-bold text-emerald-400">
                  {activeCase.nextHearingDate}
                </div>
                <span className="mt-1 text-[0.7rem] text-[#CCCCCC] block font-sans line-clamp-1">
                  Purpose: {activeCase.hearingPurpose}
                </span>
              </div>
            </div>

            {/* Grid Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono">
              <div className="space-y-3">
                <h3 className="text-xs uppercase tracking-wider text-[#888888]">
                  Court Complex & Presiding Bench
                </h3>
                <div className="bg-[#111111] border border-[#2E2E2E] p-4 space-y-2 rounded">
                  <div>
                    <span className="text-[#666666] block text-[0.7rem]">Court Complex:</span>
                    <span className="text-white font-medium">{activeCase.courtName}</span>
                  </div>
                  <div>
                    <span className="text-[#666666] block text-[0.7rem]">Court Room:</span>
                    <span className="text-white">{activeCase.courtRoom}</span>
                  </div>
                  <div>
                    <span className="text-[#666666] block text-[0.7rem]">Presiding Judicial Officer:</span>
                    <span className="text-white">{activeCase.judge}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs uppercase tracking-wider text-[#888888]">
                  Matter Stage & Counsel on Record
                </h3>
                <div className="bg-[#111111] border border-[#2E2E2E] p-4 space-y-2 rounded">
                  <div>
                    <span className="text-[#666666] block text-[0.7rem]">Stage of Proceeding:</span>
                    <span className="text-amber-300 font-semibold">{activeCase.currentStage}</span>
                  </div>
                  <div>
                    <span className="text-[#666666] block text-[0.7rem]">Petitioner Counsel:</span>
                    <span className="text-white">{activeCase.petitionerAdvocate}</span>
                  </div>
                  <div>
                    <span className="text-[#666666] block text-[0.7rem]">Opposite Counsel:</span>
                    <span className="text-white">{activeCase.respondentAdvocate}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Latest Order Summary */}
            <div className="border border-[#2E2E2E] bg-[#111111] p-4 space-y-2 rounded">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#888888] uppercase tracking-wider">
                  Latest Judicial Order (Passed on {activeCase.lastOrderDate})
                </span>
                <span className="text-emerald-400 text-[0.7rem]">Certified Copy Available</span>
              </div>
              <p className="text-xs text-[#CCCCCC] leading-relaxed font-sans">
                "{activeCase.lastOrderSummary}"
              </p>
            </div>

            {/* Orders History (if available) */}
            {activeCase.ordersHistory && activeCase.ordersHistory.length > 0 && (
              <div className="border border-[#2E2E2E] bg-[#111111] p-4 space-y-3 rounded font-mono">
                <span className="text-[0.7rem] uppercase tracking-wider text-[#888888] block">
                  Judicial Proceeding Log & Interim Orders
                </span>
                <div className="space-y-2">
                  {activeCase.ordersHistory.map((oh, idx) => (
                    <div key={idx} className="border-l-2 border-amber-400/50 pl-3 py-1 text-xs">
                      <span className="text-amber-300 font-semibold block text-[11px]">{oh.date}</span>
                      <p className="text-neutral-300 font-sans mt-0.5 text-xs">{oh.orderText}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AUTOMATED HEARING REMINDERS (SMS & EMAIL) CARD */}
          <div className="bg-[#1A1A1A] border border-emerald-500/40 p-6 md:p-8 space-y-6 shadow-xl rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2E2E2E] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-emerald-400" />
                  <h3 className="font-display text-xl font-medium text-white">
                    Automated Hearing Reminders (SMS & Email)
                  </h3>
                </div>
                <p className="text-xs text-[#888888] mt-1 font-mono">
                  Schedules automatic SMS alerts to counsel/clerk and official email advisories 24 hours prior to listing.
                </p>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-mono text-xs">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Reminders Active</span>
              </div>
            </div>

            {/* Notification Configuration Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-[#2E2E2E] bg-[#111111] p-4 space-y-2 rounded">
                <label className="text-xs font-mono uppercase tracking-wider text-[#888888] flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Advocate / Chamber Mobile Number (SMS)</span>
                </label>
                <input
                  type="tel"
                  value={smsPhone}
                  onChange={(e) => setSmsPhone(e.target.value)}
                  placeholder="+91 98110 42910"
                  className="w-full border border-[#333333] bg-[#161616] p-2.5 text-xs text-white font-mono focus:border-white focus:outline-none rounded"
                />
                <p className="text-[0.7rem] text-[#777777] font-mono">
                  Dispatched via national telecom gateway with court room, item number, and purpose.
                </p>
              </div>

              <div className="border border-[#2E2E2E] bg-[#111111] p-4 space-y-2 rounded">
                <label className="text-xs font-mono uppercase tracking-wider text-[#888888] flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-sky-400" />
                  <span>Chamber Email Address (Calendar & Cause List)</span>
                </label>
                <input
                  type="email"
                  value={emailAlert}
                  onChange={(e) => setEmailAlert(e.target.value)}
                  placeholder="chambers@delhibar.org"
                  className="w-full border border-[#333333] bg-[#161616] p-2.5 text-xs text-white font-mono focus:border-white focus:outline-none rounded"
                />
                <p className="text-[0.7rem] text-[#777777] font-mono">
                  Includes cause list excerpt, last judicial directions, and ICS calendar invitation.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2">
                <Link
                  to="/lawyer/drafter"
                  className="px-3 py-2 border border-[#333333] text-xs uppercase tracking-wider text-[#CCCCCC] hover:border-white hover:text-white transition-colors flex items-center gap-1.5 font-mono rounded"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  <span>Draft Next Application</span>
                </Link>
              </div>

              <button
                type="button"
                onClick={handleTriggerReminders}
                disabled={isSendingAlert}
                className="px-5 py-2.5 bg-white text-black font-semibold text-xs uppercase tracking-wider hover:bg-neutral-200 transition-colors flex items-center gap-2 font-mono disabled:opacity-50 rounded"
              >
                {isSendingAlert ? (
                  <>
                    <Clock className="h-3.5 w-3.5 animate-spin" />
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Send Test SMS & Email Reminder</span>
                  </>
                )}
              </button>
            </div>

            {/* Notification Delivery Audit Log */}
            {activeCase.notificationLog && activeCase.notificationLog.length > 0 && (
              <div className="border-t border-[#262626] pt-4 space-y-3 font-mono">
                <span className="text-[0.7rem] uppercase tracking-wider text-[#888888] block">
                  Dispatched Reminders & Alerts History
                </span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {activeCase.notificationLog.map((log, idx) => (
                    <div
                      key={idx}
                      className="border border-[#262626] bg-[#111111] p-3 text-xs flex items-start justify-between gap-3 rounded"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 text-[0.65rem] uppercase rounded ${
                              log.channel === "SMS"
                                ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30"
                                : "bg-sky-950/60 text-sky-400 border border-sky-500/30"
                            }`}
                          >
                            {log.channel}
                          </span>
                          <span className="text-[#888888] text-[0.7rem]">To: {log.recipient}</span>
                        </div>
                        <p className="text-[#D0D0D0] font-sans text-xs">{log.message}</p>
                      </div>
                      <span className="text-[0.65rem] text-[#666666] shrink-0">{log.timestamp}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
