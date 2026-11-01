import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Scale, Search, Bell, Phone, Mail, ShieldAlert, CheckCircle2, 
  Clock, AlertCircle, ArrowUpRight, Calendar, Landmark, FileText, 
  Trash2, Send, ExternalLink, ShieldCheck, Lock
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  validateCnr, 
  fetchCnrStatus, 
  getSavedCases, 
  saveTrackedCase, 
  removeTrackedCase, 
  sendInstantHearingReminder,
  ECourtCaseRecord 
} from "@/lib/ecourts-tracker";

export const Route = createFileRoute("/_authenticated/dashboard/cases")({
  head: () => ({
    meta: [
      { title: "Citizens Dashboard — TRANA" },
      { name: "description", content: "Track eCourts case status and receive automated hearing reminders via SMS and Email." },
      { property: "og:title", content: "Citizens Dashboard — TRANA" },
    ],
  }),
  component: CitizenCaseTrackerPage,
});

function CitizenCaseTrackerPage() {
  const { user } = Route.useRouteContext();
  const [cnrInput, setCnrInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeCase, setActiveCase] = useState<ECourtCaseRecord | null>(null);
  const [trackedCases, setTrackedCases] = useState<ECourtCaseRecord[]>([]);

  // Notification input states
  const [smsPhone, setSmsPhone] = useState("+91 98110 42910");
  const [emailAlert, setEmailAlert] = useState(user.email || "citizen@trana.in");
  const [isSendingAlert, setIsSendingAlert] = useState(false);

  // Check if citizen is currently in contact with a TRANA lawyer
  const { data: consultations = [], isLoading: isCheckingConsults } = useQuery({
    queryKey: ["citizen-consultations-for-tracker", user.id],
    queryFn: async () => {
      try {
        const { data } = await supabase
          .from("consultations")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        return data || [];
      } catch (err) {
        console.warn("Could not fetch consultations:", err);
        return [];
      }
    },
  });

  const activeConsultation = consultations[0];
  const isInContactWithLawyer = consultations.length > 0;

  // Hydrate saved tracked cases
  useEffect(() => {
    if (user?.id) {
      const saved = getSavedCases("citizen", user.id);
      setTrackedCases(saved);
      if (saved.length > 0) {
        setActiveCase(saved[0]);
      }
    }
  }, [user?.id]);

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
        lawyerName: activeConsultation?.lawyer_name || "TRANA Advocate",
      });

      const updatedList = saveTrackedCase("citizen", user.id, record);
      setTrackedCases(updatedList);
      setActiveCase(record);
      setCnrInput(record.cnr);
      toast.success(`eCourts status retrieved for CNR ${record.formattedCnr}!`);
    } catch (error) {
      toast.error("Failed to connect to eCourts registry. Please verify the CNR number.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTriggerReminders() {
    if (!activeCase) return;
    if (!smsPhone.trim()) {
      toast.error("Please enter a mobile number for SMS reminders");
      return;
    }
    if (!emailAlert.trim() || !emailAlert.includes("@")) {
      toast.error("Please enter a valid email address for hearing notices");
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

      const updatedList = saveTrackedCase("citizen", user.id, updatedCase);
      setTrackedCases(updatedList);
      setActiveCase(updatedCase);

      toast.success(`Hearing reminder SMS sent to ${smsPhone} & official notice emailed to ${emailAlert}`);
    } catch {
      toast.error("Failed to dispatch reminders");
    } finally {
      setIsSendingAlert(false);
    }
  }

  function handleDeleteCase(cnr: string) {
    const updated = removeTrackedCase("citizen", user.id, cnr);
    setTrackedCases(updated);
    if (activeCase?.cnr === cnr) {
      setActiveCase(updated[0] || null);
    }
    toast.info("Case removed from tracker.");
  }

  // RESTRICTED STATE: Citizen is not currently in contact with a TRANA lawyer
  if (!isCheckingConsults && !isInContactWithLawyer) {
    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        <div className="border-b border-border pb-5">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 text-xs rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono mb-2">
            <Lock className="h-3 w-3" />
            <span>Advocate Consultation Required</span>
          </div>
          <h1 className="font-display text-4xl font-medium text-foreground">Case Tracker</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Live eCourts Case Status & Automated Hearing Reminders via SMS and Email.
          </p>
        </div>

        {/* Locked Access Notice */}
        <div className="border border-border bg-card p-8 md:p-10 space-y-6">
          <div className="h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldAlert className="h-6 w-6" />
          </div>

          <div>
            <h2 className="font-display text-2xl font-medium text-foreground">
              Connect with a TRANA Lawyer to Activate Case Tracker
            </h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Under TRANA platform policy, live eCourts CNR case tracking and automated SMS/Email court hearing reminders are exclusively activated for citizens currently in consultation with a verified TRANA advocate.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="border border-border bg-background p-4 rounded space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground font-mono">
                <Landmark className="h-4 w-4 text-sky-400" />
                <span>16-Digit CNR Sync</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Direct integration with National Judicial Data Grid (NJDG) for High Courts and District Courts across India.
              </p>
            </div>

            <div className="border border-border bg-background p-4 rounded space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground font-mono">
                <Phone className="h-4 w-4 text-emerald-400" />
                <span>SMS Hearing Alerts</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Automated SMS alerts sent to your mobile phone 24 hours prior to listing and on the morning of court call.
              </p>
            </div>

            <div className="border border-border bg-background p-4 rounded space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground font-mono">
                <Mail className="h-4 w-4 text-purple-400" />
                <span>Email Cause List Notices</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Calendar invites, court room number, judicial officer details, and latest interim orders delivered to your inbox.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-muted-foreground font-mono">
              Have a court case? Connect with counsel in your jurisdiction to initiate tracking.
            </div>
            <Link
              to="/dashboard/lawyers"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-foreground text-background font-semibold text-xs uppercase tracking-wider hover:opacity-90 transition-opacity"
            >
              <span>Connect with a TRANA Lawyer</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE UNLOCKED STATE: Citizen is in contact with a TRANA lawyer
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="border-b border-border pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 text-xs rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono mb-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Advocate Representation Active: {activeConsultation?.lawyer_name || "TRANA Advocate"}</span>
          </div>
          <h1 className="font-display text-4xl font-medium text-foreground">Case Tracker</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track your eCourts proceedings via CNR Number and receive automated hearing reminders via SMS and Email.
          </p>
        </div>

        <Link
          to="/dashboard/consultations"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border bg-card text-foreground hover:bg-neutral-800 transition-colors self-start sm:self-auto font-mono"
        >
          <span>View Consultations</span>
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {/* CNR Search Card */}
      <div className="border border-border bg-card p-6 md:p-8 space-y-4">
        <div>
          <label className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-mono block mb-2">
            Enter 16-Character CNR Number (Case Record Number)
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={cnrInput}
                onChange={(e) => setCnrInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchCnr()}
                placeholder="e.g. DLHC010012342024 or MHCC020054322023"
                maxLength={20}
                className="w-full border border-border bg-background py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-neutral-500 focus:border-foreground focus:outline-none font-mono uppercase"
              />
            </div>
            <button
              type="button"
              onClick={() => handleSearchCnr()}
              disabled={isLoading}
              className="px-6 py-3 bg-foreground text-background font-semibold text-xs uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {isLoading ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  <span>Syncing eCourts...</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  <span>Fetch Case Status</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sample CNR Chips */}
        <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground font-mono text-[0.7rem]">Try sample CNRs:</span>
          {[
            { label: "Delhi High Court (Bail)", cnr: "DLHC010012342024" },
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
              className="px-2.5 py-1 text-[0.7rem] font-mono border border-border bg-background text-neutral-300 hover:border-foreground hover:text-foreground transition-colors"
            >
              {s.label}: <span className="text-amber-300">{s.cnr}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TRACKED MATTERS LIST (if multiple) */}
      {trackedCases.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground uppercase tracking-wider">
            <span>Your Tracked Matters ({trackedCases.length})</span>
            <span>Automated Hearing Reminders Active</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {trackedCases.map((tc) => (
              <div
                key={tc.cnr}
                onClick={() => setActiveCase(tc)}
                className={`cursor-pointer p-4 border transition-all text-xs font-mono ${
                  activeCase?.cnr === tc.cnr
                    ? "border-foreground bg-card ring-1 ring-foreground/20"
                    : "border-border bg-card/60 hover:border-border/80"
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
                    className="text-neutral-500 hover:text-red-400 p-0.5"
                    title="Remove from tracker"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 text-foreground font-sans font-medium line-clamp-1">{tc.petitioner}</div>
                <div className="mt-1 text-[0.7rem] text-muted-foreground line-clamp-1">{tc.courtName}</div>
                <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-[0.7rem]">
                  <span className="text-muted-foreground">Hearing:</span>
                  <span className="text-emerald-400 font-semibold">{tc.nextHearingDate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DETAILED CASE STATUS & REMINDER CONFIGURATION */}
      {activeCase && (
        <div className="space-y-6">
          {/* Main Status Display */}
          <div className="border border-border bg-card p-6 md:p-8 space-y-6 shadow-xl">
            {/* Header info */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-border pb-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 text-xs font-mono bg-neutral-900 border border-border text-amber-300 font-bold">
                    {activeCase.formattedCnr}
                  </span>
                  <span className="px-2 py-0.5 text-[0.7rem] uppercase tracking-wider rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-mono">
                    {activeCase.caseStatus}
                  </span>
                </div>
                <h2 className="mt-2 font-display text-2xl md:text-3xl font-medium text-foreground">
                  {activeCase.petitioner} <span className="text-muted-foreground text-lg">vs</span> {activeCase.respondent}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground font-mono">
                  {activeCase.caseType} No. {activeCase.caseNumber} • Filing Date: {activeCase.filingDate}
                </p>
              </div>

              {/* Next Hearing Highlight */}
              <div className="bg-background border border-emerald-500/40 p-4 rounded min-w-[220px]">
                <span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground font-mono block">
                  Next Listing Date (eCourts)
                </span>
                <div className="mt-1 text-2xl font-bold text-emerald-400 font-mono">
                  {activeCase.nextHearingDate}
                </div>
                <span className="mt-1 text-[0.7rem] text-neutral-400 block line-clamp-1">
                  Purpose: {activeCase.hearingPurpose}
                </span>
              </div>
            </div>

            {/* Grid Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-3">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-mono">
                  Court & Bench Details
                </h3>
                <div className="bg-background border border-border p-4 space-y-2 rounded font-mono">
                  <div>
                    <span className="text-neutral-500 block text-[0.7rem]">Court Complex:</span>
                    <span className="text-foreground">{activeCase.courtName}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[0.7rem]">Court Room:</span>
                    <span className="text-foreground">{activeCase.courtRoom}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[0.7rem]">Judicial Officer / Judge:</span>
                    <span className="text-foreground">{activeCase.judge}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-mono">
                  Pleadings & Advocates
                </h3>
                <div className="bg-background border border-border p-4 space-y-2 rounded font-mono">
                  <div>
                    <span className="text-neutral-500 block text-[0.7rem]">Current Stage:</span>
                    <span className="text-amber-300 font-semibold">{activeCase.currentStage}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[0.7rem]">Petitioner Counsel:</span>
                    <span className="text-foreground">{activeCase.petitionerAdvocate}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[0.7rem]">Opposite Counsel:</span>
                    <span className="text-foreground">{activeCase.respondentAdvocate}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Latest Order Summary */}
            <div className="border border-border bg-background p-4 rounded space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-muted-foreground uppercase tracking-wider">
                  Latest Judicial Order (Passed on {activeCase.lastOrderDate})
                </span>
                <span className="text-emerald-400 font-mono text-[0.7rem]">eCourts CIS Verified</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed font-sans">
                "{activeCase.lastOrderSummary}"
              </p>
            </div>
          </div>

          {/* AUTOMATED HEARING REMINDERS (SMS & EMAIL) CARD */}
          <div className="border border-emerald-500/40 bg-card p-6 md:p-8 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-emerald-400" />
                  <h3 className="font-display text-xl font-medium text-foreground">
                    Automated Hearing Reminders (SMS & Email)
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Alerts are automatically triggered 24 hours prior to listing and at 8:00 AM on the morning of hearing.
                </p>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-mono text-xs">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Reminders Active</span>
              </div>
            </div>

            {/* Notification Configuration Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-border bg-background p-4 rounded space-y-2">
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-emerald-400" />
                  <span>SMS Alert Mobile Number</span>
                </label>
                <input
                  type="tel"
                  value={smsPhone}
                  onChange={(e) => setSmsPhone(e.target.value)}
                  placeholder="+91 98110 42910"
                  className="w-full border border-border bg-card p-2.5 text-xs text-foreground font-mono focus:border-foreground focus:outline-none"
                />
                <p className="text-[0.7rem] text-muted-foreground">
                  Instant SMS dispatched with court room number, bench name, and listing order.
                </p>
              </div>

              <div className="border border-border bg-background p-4 rounded space-y-2">
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-sky-400" />
                  <span>Email Notice & Calendar Invite</span>
                </label>
                <input
                  type="email"
                  value={emailAlert}
                  onChange={(e) => setEmailAlert(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full border border-border bg-card p-2.5 text-xs text-foreground font-mono focus:border-foreground focus:outline-none"
                />
                <p className="text-[0.7rem] text-muted-foreground">
                  Includes cause list excerpt, last order summary, and Google Calendar schedule.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <span className="text-xs text-muted-foreground font-mono">
                Linked Advocate: <span className="text-foreground font-medium">{activeCase.petitionerAdvocate}</span>
              </span>

              <button
                type="button"
                onClick={handleTriggerReminders}
                disabled={isSendingAlert}
                className="px-5 py-2.5 bg-foreground text-background font-semibold text-xs uppercase tracking-wider hover:opacity-90 transition-opacity flex items-center gap-2 font-mono disabled:opacity-50"
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
              <div className="border-t border-border pt-4 space-y-3">
                <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground font-mono block">
                  Dispatched Reminders & Alerts History
                </span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {activeCase.notificationLog.map((log, idx) => (
                    <div
                      key={idx}
                      className="border border-border bg-background p-3 rounded text-xs font-mono flex items-start justify-between gap-3"
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
                          <span className="text-neutral-400 text-[0.7rem]">To: {log.recipient}</span>
                        </div>
                        <p className="text-neutral-300 font-sans text-xs">{log.message}</p>
                      </div>
                      <span className="text-[0.65rem] text-neutral-500 shrink-0">{log.timestamp}</span>
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

