import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { 
  Scale, Search, Calendar, Landmark, FileText, 
  Trash2, RefreshCw, CheckCircle2, AlertCircle, ArrowUpRight, GraduationCap
} from "lucide-react";
import { toast } from "sonner";
import { 
  validateCnr, 
  fetchCnrStatus, 
  getSavedCases, 
  saveTrackedCase, 
  removeTrackedCase, 
  ECourtCaseRecord 
} from "@/lib/ecourts-tracker";
import { useUserRole } from "@/lib/user-role";

export const Route = createFileRoute("/_authenticated/student/cases")({
  head: () => ({
    meta: [
      { title: "Academic Case Tracker — TRANA Student" },
      { name: "description", content: "Track eCourts litigation matters, cause lists, and court orders for legal research and moot preparation." },
      { property: "og:title", content: "Academic Case Tracker — TRANA Student" },
    ],
  }),
  component: StudentCaseTrackerPage,
});

function StudentCaseTrackerPage() {
  const { user } = Route.useRouteContext();
  const { studentProfile } = useUserRole(user?.id, user?.email);

  const [cnrInput, setCnrInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeCase, setActiveCase] = useState<ECourtCaseRecord | null>(null);
  const [trackedCases, setTrackedCases] = useState<ECourtCaseRecord[]>([]);

  useEffect(() => {
    if (user?.id) {
      const local = getSavedCases("student", user.id);
      setTrackedCases(local);
      if (local.length > 0) setActiveCase(local[0]);
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
        email: user?.email || "student@lawschool.edu",
        phone: "+91 (Student Account)",
        lawyerName: studentProfile?.university || "Law Student Researcher",
      });

      const updated = saveTrackedCase("student", user.id, record);
      setTrackedCases(updated);
      setActiveCase(record);
      toast.success(`Matter ${record.formattedCnr} synced and saved to research diary!`);
    } catch {
      toast.error("Failed to query eCourts server for this CNR.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleDeleteCase(cnr: string) {
    const updated = removeTrackedCase("student", user.id, cnr);
    setTrackedCases(updated);
    if (activeCase?.cnr === cnr) {
      setActiveCase(updated.length > 0 ? updated[0] : null);
    }
    toast.info("Matter removed from research tracker.");
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-[#222222] pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display text-3xl md:text-4xl font-medium text-white">
            eCourts Case Tracker
          </span>
          <span className="border border-purple-500/40 bg-purple-950/20 px-3 py-1 text-xs uppercase tracking-[0.15em] text-purple-300 font-mono">
            Clinical Research
          </span>
        </div>
        <p className="mt-2 text-xs md:text-sm text-[#999999]">
          Track court proceedings, orders, and cause list listings across High Courts and District Courts using official 16-character CNR numbers.
        </p>
      </div>

      {/* SEARCH CNR BOX */}
      <div className="bg-[#141414] border border-[#262626] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[#777777]" />
            <input
              type="text"
              value={cnrInput}
              onChange={(e) => setCnrInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleSearchCnr()}
              placeholder="Enter 16-character eCourts CNR number (e.g. DLHC010012342024)..."
              maxLength={16}
              className="w-full bg-[#181818] border border-[#333333] pl-10 pr-4 py-3 text-xs md:text-sm font-mono text-white placeholder-[#666666] tracking-wider focus:border-purple-400 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => handleSearchCnr()}
            disabled={isLoading || !cnrInput.trim()}
            className="bg-white text-black hover:bg-neutral-200 px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span>Track Case</span>
          </button>
        </div>

        {/* Quick Benchmark Registries */}
        <div className="pt-2 flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="text-[#888888] text-[0.7rem]">Benchmark litigation matters:</span>
          {[
            { label: "Delhi High Court (Bail)", cnr: "DLHC010012342024" },
            { label: "Delhi High Court (Writ)", cnr: "DLHC010056782023" },
            { label: "Supreme Court (SLP Crl)", cnr: "SCIN010004562024" },
            { label: "Mumbai City Civil (NI Act)", cnr: "MHCC020054322023" },
          ].map((s) => (
            <button
              key={s.cnr}
              type="button"
              onClick={() => {
                setCnrInput(s.cnr);
                handleSearchCnr(s.cnr);
              }}
              className="px-2.5 py-1 text-[0.7rem] border border-[#333333] bg-[#181818] text-[#CCCCCC] hover:border-purple-400 hover:text-white transition-colors"
            >
              {s.label}: <span className="text-amber-300 font-bold">{s.cnr}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TRACKED MATTERS LIST */}
      {trackedCases.length > 0 && (
        <div className="space-y-3 font-mono">
          <div className="text-xs text-[#888888] uppercase tracking-wider">
            Tracked Research Matters ({trackedCases.length})
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {trackedCases.map((tc) => (
              <div
                key={tc.cnr}
                onClick={() => setActiveCase(tc)}
                className={`cursor-pointer p-4 border transition-all text-xs ${
                  activeCase?.cnr === tc.cnr
                    ? "border-purple-400 bg-[#1E1E1E] shadow-lg"
                    : "border-[#262626] bg-[#141414] hover:border-white/50"
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
                  <span className="text-[#888888]">Next Hearing:</span>
                  <span className="text-emerald-400 font-semibold">{tc.nextHearingDate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ACTIVE CASE RECORD DETAIL */}
      {activeCase ? (
        <div className="bg-[#141414] border border-[#262626] p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#252525] pb-5">
            <div>
              <span className="text-xs font-mono text-amber-300 uppercase tracking-wider">
                CNR: {activeCase.formattedCnr}
              </span>
              <h2 className="mt-1 font-display text-2xl font-medium text-white">
                {activeCase.petitioner} v. {activeCase.respondent}
              </h2>
              <p className="mt-1 text-xs text-[#888888] font-mono">
                {activeCase.courtName} • {activeCase.courtRoom}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 text-xs font-mono uppercase bg-emerald-950/60 border border-emerald-500/40 text-emerald-300">
                Stage: {activeCase.currentStage}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            <div className="bg-[#111111] p-3 border border-[#222222]">
              <span className="text-[#777777] block text-[0.65rem] uppercase">Case Type & Number</span>
              <span className="text-white font-semibold mt-1 block">{activeCase.caseType} {activeCase.caseNumber}</span>
            </div>
            <div className="bg-[#111111] p-3 border border-[#222222]">
              <span className="text-[#777777] block text-[0.65rem] uppercase">Next Hearing Date</span>
              <span className="text-emerald-400 font-semibold mt-1 block">{activeCase.nextHearingDate}</span>
            </div>
            <div className="bg-[#111111] p-3 border border-[#222222]">
              <span className="text-[#777777] block text-[0.65rem] uppercase">Presiding Bench</span>
              <span className="text-white mt-1 block truncate">{activeCase.judge}</span>
            </div>
            <div className="bg-[#111111] p-3 border border-[#222222]">
              <span className="text-[#777777] block text-[0.65rem] uppercase">Hearing Purpose</span>
              <span className="text-white mt-1 block truncate">{activeCase.hearingPurpose}</span>
            </div>
          </div>

          {/* Orders History */}
          <div>
            <h3 className="text-xs uppercase tracking-wider text-[#888888] font-mono mb-3">
              Court Orders & Proceedings Record
            </h3>
            <div className="space-y-3">
              {activeCase.ordersHistory.length > 0 ? (
                activeCase.ordersHistory.map((ord, idx) => (
                  <div key={idx} className="bg-[#101010] border border-[#222222] p-4 text-xs">
                    <span className="text-amber-300 font-mono font-semibold block mb-1">
                      Order Date: {ord.date}
                    </span>
                    <p className="text-[#CCCCCC] leading-relaxed font-sans">{ord.orderText}</p>
                  </div>
                ))
              ) : (
                <div className="bg-[#101010] border border-[#222222] p-4 text-xs text-[#888888]">
                  {activeCase.lastOrderSummary}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#141414] border border-[#262626] p-12 text-center text-[#777777] font-mono text-xs space-y-2">
          <Scale className="h-8 w-8 mx-auto text-[#444444]" />
          <p>No litigation matter selected.</p>
          <p className="text-[0.7rem] text-[#555555]">Enter a 16-character CNR number above to track your first matter.</p>
        </div>
      )}
    </div>
  );
}

