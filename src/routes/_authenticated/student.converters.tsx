import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  ArrowLeftRight,
  Search,
  BookOpen,
  Scale,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
  Info,
  Filter,
  X,
  AlertTriangle,
  Gavel,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  SectionMapping,
  fetchLawConverterMappings,
} from "@/lib/student-legal-library";

export const Route = createFileRoute("/_authenticated/student/converters")({
  head: () => ({
    meta: [
      { title: "Law Converters — TRANA Student" },
      {
        name: "description",
        content:
          "Bidirectional statutory transition concordance between IPC↔BNS, CrPC↔BNSS, and IEA↔BSA with side-by-side comparative analysis.",
      },
    ],
  }),
  component: StudentConvertersPage,
});

type ConverterPair = "IPC_BNS" | "CRPC_BNSS" | "IEA_BSA";

const QUICK_JUMP_PILLS: Record<ConverterPair, Array<{ label: string; query: string }>> = {
  IPC_BNS: [
    { label: "Murder (302 ➔ 103)", query: "302" },
    { label: "Theft (378 ➔ 303)", query: "378" },
    { label: "Cheating (420 ➔ 318)", query: "420" },
    { label: "Conspiracy (120B ➔ 61)", query: "120B" },
    { label: "Dowry Death (304B ➔ 80)", query: "304B" },
    { label: "Sedition (124A ➔ 152)", query: "124A" },
  ],
  CRPC_BNSS: [
    { label: "Undertrial Bail (436A ➔ 479)", query: "436A" },
    { label: "Notice of Arrest (41A ➔ 35)", query: "41A" },
    { label: "Zero FIR (154 ➔ 173)", query: "154" },
    { label: "Remand (167 ➔ 187)", query: "167" },
  ],
  IEA_BSA: [
    { label: "Electronic Certificate (65B ➔ 63)", query: "65B" },
    { label: "Primary Digital Records (62 ➔ 57)", query: "62" },
    { label: "Confessions to Police (24-27 ➔ 22-24)", query: "24" },
  ],
};

function StudentConvertersPage() {
  const [activePair, setActivePair] = useState<ConverterPair>("IPC_BNS");
  const [searchQuery, setSearchQuery] = useState("");
  const [classificationFilter, setClassificationFilter] = useState<string>("all");
  const [mappings, setMappings] = useState<SectionMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedMapping, setSelectedMapping] = useState<SectionMapping | null>(null);

  // Determine source code based on active pair
  const sourceCode = useMemo(() => {
    switch (activePair) {
      case "IPC_BNS":
        return "IPC";
      case "CRPC_BNSS":
        return "CRPC";
      case "IEA_BSA":
        return "IEA";
    }
  }, [activePair]);

  useEffect(() => {
    let isCancelled = false;
    async function loadData() {
      setLoading(true);
      try {
        const data = await fetchLawConverterMappings(sourceCode, searchQuery);
        if (!isCancelled) {
          setMappings(data);
          setLoading(false);
        }
      } catch {
        if (!isCancelled) setLoading(false);
      }
    }

    const timer = setTimeout(loadData, searchQuery ? 200 : 0);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [sourceCode, searchQuery]);

  // Filter mappings by classification
  const filteredMappings = useMemo(() => {
    if (classificationFilter === "all") return mappings;
    return mappings.filter(
      (m) => m.mapping_type.toLowerCase() === classificationFilter.toLowerCase()
    );
  }, [mappings, classificationFilter]);

  function handleCopyMapping(item: SectionMapping, index?: number) {
    const text = `${item.src_act} Section ${item.src_sec} ➔ ${item.tgt_act} Section ${item.tgt_sec} (${item.title})\n\nChanges Summary: ${item.changes_summary || "Corresponding enactment under 2023 Sanhitas."}\nTransitional Rule: ${item.transitional_note || "Section 358 BNS / 531 BNSS savings clause applies."}`;
    navigator.clipboard.writeText(text);
    if (typeof index === "number") setCopiedIndex(index);
    toast.success("Comparative statutory citation copied to clipboard!");
    if (typeof index === "number") {
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <ArrowLeftRight className="h-4 w-4" />
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-semibold text-white tracking-wide">
              Law Converters
            </h1>
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider font-semibold">
              Statutory Concordance
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
            Bidirectional concordance between colonial statutes and 2023 criminal enactments. Analyze changes in legal ingredients, punishments, procedural shifts, and transitional applicability safeguards.
          </p>
        </div>

        <Link
          to="/student/library"
          className="apple-glass-pill px-3.5 py-2 text-xs text-neutral-200 hover:text-white flex items-center gap-2 self-start sm:self-auto shrink-0 shadow-lg"
        >
          <BookOpen className="h-3.5 w-3.5 text-purple-400" />
          <span>Open Full Legal Library</span>
        </Link>
      </div>

      {/* Converter Pair Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <button
          onClick={() => {
            setActivePair("IPC_BNS");
            setSearchQuery("");
            setClassificationFilter("all");
          }}
          className={`p-5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            activePair === "IPC_BNS"
              ? "bg-gradient-to-br from-[#2a1245]/90 via-[#190a2b]/95 to-[#0d0517]/98 border-purple-400/80 shadow-[0_0_28px_rgba(168,85,247,0.25)]"
              : "apple-glass-card hover:bg-white/[0.04] border-white/10"
          }`}
        >
          {activePair === "IPC_BNS" && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-fuchsia-400 to-indigo-500" />
          )}
          <div className="flex items-center justify-between">
            <span className={`text-xs font-mono font-bold ${activePair === "IPC_BNS" ? "text-purple-200" : "text-purple-400"}`}>
              Penal Code
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/25 text-purple-200 border border-purple-400/40 font-bold">
              Substantive
            </span>
          </div>
          <h3 className="text-base font-semibold text-white mt-2">IPC 1860 ↔ BNS 2023</h3>
          <p className="text-[11px] text-neutral-300 mt-1 line-clamp-2 font-light">
            Offences, definitions, general exceptions, mob lynching & community service punishments
          </p>
        </button>

        <button
          onClick={() => {
            setActivePair("CRPC_BNSS");
            setSearchQuery("");
            setClassificationFilter("all");
          }}
          className={`p-5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            activePair === "CRPC_BNSS"
              ? "bg-gradient-to-br from-[#0c2448]/90 via-[#071730]/95 to-[#030b18]/98 border-sky-400/80 shadow-[0_0_28px_rgba(14,165,233,0.25)]"
              : "apple-glass-card hover:bg-white/[0.04] border-white/10"
          }`}
        >
          {activePair === "CRPC_BNSS" && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 via-cyan-300 to-blue-500" />
          )}
          <div className="flex items-center justify-between">
            <span className={`text-xs font-mono font-bold ${activePair === "CRPC_BNSS" ? "text-sky-200" : "text-sky-400"}`}>
              Criminal Procedure
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/25 text-sky-200 border border-sky-400/40 font-bold">
              Procedural
            </span>
          </div>
          <h3 className="text-base font-semibold text-white mt-2">CrPC 1973 ↔ BNSS 2023</h3>
          <p className="text-[11px] text-neutral-300 mt-1 line-clamp-2 font-light">
            Arrests, Zero FIR, investigation, undertrial bail (Sec 479), & electronic summons
          </p>
        </button>

        <button
          onClick={() => {
            setActivePair("IEA_BSA");
            setSearchQuery("");
            setClassificationFilter("all");
          }}
          className={`p-5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            activePair === "IEA_BSA"
              ? "bg-gradient-to-br from-[#092d24]/90 via-[#051e18]/95 to-[#020e0b]/98 border-emerald-400/80 shadow-[0_0_28px_rgba(16,185,129,0.25)]"
              : "apple-glass-card hover:bg-white/[0.04] border-white/10"
          }`}
        >
          {activePair === "IEA_BSA" && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-400 via-emerald-300 to-emerald-500" />
          )}
          <div className="flex items-center justify-between">
            <span className={`text-xs font-mono font-bold ${activePair === "IEA_BSA" ? "text-emerald-200" : "text-emerald-400"}`}>
              Evidence Law
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-200 border border-emerald-400/40 font-bold">
              Evidentiary
            </span>
          </div>
          <h3 className="text-base font-semibold text-white mt-2">IEA 1872 ↔ BSA 2023</h3>
          <p className="text-[11px] text-neutral-300 mt-1 line-clamp-2 font-light">
            Electronic records admissibility, certificates (Sec 63), confessions & burden of proof
          </p>
        </button>
      </div>

      {/* Quick Jump Section Pills */}
      <div className="space-y-2">
        <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-purple-400" />
          <span>High-Frequency Concordance Sections:</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {QUICK_JUMP_PILLS[activePair].map((pill, idx) => (
            <button
              key={idx}
              onClick={() => setSearchQuery(pill.query)}
              className={`apple-glass-pill px-3 py-1 text-xs transition-all cursor-pointer ${
                searchQuery === pill.query
                  ? "bg-purple-500/30 border-purple-400 text-white"
                  : "text-neutral-300 hover:text-white hover:bg-white/10"
              }`}
            >
              {pill.label}
            </button>
          ))}
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="apple-glass-pill px-2.5 py-1 text-xs text-rose-300 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <X className="h-3 w-3" />
              <span>Reset Search</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            placeholder={`Search section number or concept in both directions (e.g. '302', '103', 'murder', '436A', '479', '65B', '63')...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-24 py-3 text-xs md:text-sm text-white placeholder-neutral-500 bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.08] border border-white/15 focus:border-purple-400/50 rounded-2xl shadow-lg transition-all outline-none font-sans"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-neutral-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Classification Filter Dropdown / Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-white/[0.03] border border-white/10 rounded-2xl overflow-x-auto shrink-0 text-xs">
          {[
            { id: "all", label: "All Mappings" },
            { id: "exact equivalent", label: "Exact Equivalent" },
            { id: "substantially similar", label: "Substantially Similar" },
            { id: "modified provision", label: "Modified Provision" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setClassificationFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all cursor-pointer ${
                classificationFilter === tab.id
                  ? "bg-purple-600/40 text-purple-200 border border-purple-500/40"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Concordance Results List */}
      <div className="apple-glass-card border-white/15 p-6 md:p-8 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-white">
              Statutory Transition Matrix ({filteredMappings.length} provisions)
            </h3>
          </div>
          <span className="text-xs font-mono text-neutral-400">
            Click any provision to open Side-by-Side Comparative Analysis
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-xs text-neutral-400 font-mono">
            Searching statutory concordance matrix...
          </div>
        ) : filteredMappings.length === 0 ? (
          <div className="text-center py-12 text-xs text-neutral-400 space-y-2">
            <p className="text-sm text-neutral-300">No concordance provisions found for your criteria.</p>
            <p className="text-[11px] text-neutral-500">
              Try searching with just the section number (e.g., "302" or "420") or clear the classification filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {filteredMappings.map((item, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedMapping(item)}
                className="p-5 rounded-2xl bg-gradient-to-r from-white/[0.04] via-white/[0.02] to-white/[0.04] hover:from-purple-950/20 hover:via-purple-900/10 hover:to-indigo-950/20 border border-white/10 hover:border-purple-400/60 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group cursor-pointer shadow-sm hover:shadow-[0_10px_25px_rgba(168,85,247,0.15)]"
              >
                {/* Left: Former Colonial Law */}
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700 font-bold">
                      {item.src_act}
                    </span>
                    <span className="text-xs font-bold text-neutral-200">
                      Section {item.src_sec}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 line-clamp-1 font-light">
                    {item.src_wording || "Historical colonial provision"}
                  </p>
                </div>

                {/* Center: Transition Indicator */}
                <div className="flex items-center gap-2.5 shrink-0 justify-center">
                  <div
                    className={`h-9 w-9 rounded-full border flex items-center justify-center transition-all group-hover:scale-110 ${
                      activePair === "IPC_BNS"
                        ? "bg-purple-500/20 border-purple-400/50 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.3)]"
                        : activePair === "CRPC_BNSS"
                        ? "bg-sky-500/20 border-sky-400/50 text-sky-200 shadow-[0_0_12px_rgba(14,165,233,0.3)]"
                        : "bg-emerald-500/20 border-emerald-400/50 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                    }`}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </div>
                  <div className="text-center">
                    <span
                      className={`text-[10px] font-mono px-2.5 py-1 rounded-full border block font-bold tracking-wide ${
                        item.mapping_type.toLowerCase().includes("exact")
                          ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                          : item.mapping_type.toLowerCase().includes("modified")
                          ? "bg-amber-500/20 text-amber-200 border-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                          : "bg-purple-500/20 text-purple-200 border-purple-400/50 shadow-[0_0_12px_rgba(168,85,247,0.25)]"
                      }`}
                    >
                      {item.mapping_type}
                    </span>
                  </div>
                </div>

                {/* Right: Enacted 2023 Law */}
                <div className="flex-1 space-y-1.5 md:text-right">
                  <div className="flex items-center gap-2 md:justify-end">
                    <span
                      className="text-xs md:text-sm font-bold text-white group-hover:text-purple-300 transition-colors font-['Times_New_Roman',_Times,_serif]"
                      style={{ fontFamily: "'Times New Roman', Times, serif" }}
                    >
                      Section {item.tgt_sec}
                    </span>
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-purple-500/25 text-purple-200 border border-purple-400/50 font-bold shadow-sm">
                      {item.tgt_act}
                    </span>
                  </div>
                  <p
                    className="text-xs md:text-sm font-medium text-neutral-100 truncate max-w-sm md:ml-auto font-['Times_New_Roman',_Times,_serif]"
                    style={{ fontFamily: "'Times New Roman', Times, serif" }}
                  >
                    {item.title}
                  </p>
                </div>

                {/* Actions */}
                <div
                  className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-white/10 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleCopyMapping(item, idx)}
                    className="apple-glass-pill px-3 py-1.5 text-xs text-neutral-300 hover:text-white flex items-center gap-1.5 cursor-pointer hover:border-white/30"
                    title="Copy Citation"
                  >
                    {copiedIndex === idx ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    <span>{copiedIndex === idx ? "Copied" : "Copy"}</span>
                  </button>

                  <button
                    onClick={() => setSelectedMapping(item)}
                    className="apple-glass-pill px-3.5 py-1.5 text-xs text-purple-200 hover:text-white flex items-center gap-1.5 cursor-pointer bg-purple-500/20 border-purple-400/50 hover:bg-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.2)] font-semibold"
                  >
                    <span>Compare</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Side-by-Side Deep Dive Comparison Modal */}
      {selectedMapping && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-6 overflow-y-auto">
          <div className="apple-glass-card border-purple-500/30 bg-[#0e0c15]/95 max-w-4xl w-full rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative border max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                    {selectedMapping.mapping_type}
                  </span>
                  <span className="text-xs text-neutral-400 font-mono">
                    Concordance Comparative Analysis
                  </span>
                </div>
                <h2
                  className="text-lg md:text-xl font-bold text-white font-['Times_New_Roman',_Times,_serif]"
                  style={{ fontFamily: "'Times New Roman', Times, serif" }}
                >
                  {selectedMapping.src_act} Section {selectedMapping.src_sec} ➔ {selectedMapping.tgt_act} Section {selectedMapping.tgt_sec}
                </h2>
                <p
                  className="text-sm text-neutral-300 font-['Times_New_Roman',_Times,_serif]"
                  style={{ fontFamily: "'Times New Roman', Times, serif" }}
                >
                  {selectedMapping.title}
                </p>
              </div>

              <button
                onClick={() => setSelectedMapping(null)}
                className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mandatory Transitional Applicability Alert */}
            <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs leading-relaxed flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-amber-300 block font-mono text-[11px] uppercase tracking-wider">
                  Mandatory Legal Safeguard: Repeal & Savings (Section 358 BNS / Section 531 BNSS)
                </span>
                <p>
                  {selectedMapping.transitional_note ||
                    "Conduct or procedural stages that occurred prior to 1 July 2024 remain governed by the older statutes. Do not mechanically replace sections without verifying the date of commission."}
                </p>
              </div>
            </div>

            {/* Side-by-Side Bare Act Statutory Text */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Former Colonial Law */}
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-mono text-neutral-400 font-bold">
                    {selectedMapping.src_act} • Section {selectedMapping.src_sec}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
                    Former Law
                  </span>
                </div>
                <div
                  className="text-xs md:text-sm text-neutral-200 leading-relaxed max-h-56 overflow-y-auto pr-2 font-['Times_New_Roman',_Times,_serif]"
                  style={{ fontFamily: "'Times New Roman', Times, serif" }}
                >
                  {selectedMapping.src_wording || "Statutory text recorded in former code."}
                </div>
              </div>

              {/* Enacted 2023 Law */}
              <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-3">
                <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                  <span className="text-xs font-mono text-purple-300 font-bold">
                    {selectedMapping.tgt_act} • Section {selectedMapping.tgt_sec}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                    Enacted 2023 Sanhita
                  </span>
                </div>
                <div
                  className="text-xs md:text-sm text-neutral-100 leading-relaxed max-h-56 overflow-y-auto pr-2 font-['Times_New_Roman',_Times,_serif]"
                  style={{ fontFamily: "'Times New Roman', Times, serif" }}
                >
                  {selectedMapping.tgt_wording || "Official statutory text as notified in the Gazette of India."}
                </div>
              </div>
            </div>

            {/* Legal Changes & Punishment Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="flex items-center gap-1.5 text-purple-300 text-xs font-semibold">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Substantive Ingredients & Changes:</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  {selectedMapping.changes_summary || "Statutory alignment for the 2023 Sanhita framework."}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="flex items-center gap-1.5 text-amber-300 text-xs font-semibold">
                  <Gavel className="h-3.5 w-3.5" />
                  <span>Punishment & Procedural Shifts:</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  {selectedMapping.punishment_comparison || "Punishment and procedure calibrated under the new Sanhita framework."}
                </p>
                {selectedMapping.procedural_shift && (
                  <p className="text-[11px] text-neutral-400 mt-1">
                    <strong className="text-neutral-300">Procedure:</strong> {selectedMapping.procedural_shift}
                  </p>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => handleCopyMapping(selectedMapping)}
                className="apple-glass-pill px-4 py-2 text-xs text-neutral-200 hover:text-white flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
              >
                <Copy className="h-3.5 w-3.5 text-purple-400" />
                <span>Copy Full Comparative Citation</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Link
                  to="/student/library"
                  search={{
                    act: selectedMapping.tgt_act.toLowerCase().includes("bnss")
                      ? "bnss-2023"
                      : selectedMapping.tgt_act.toLowerCase().includes("bsa")
                      ? "bsa-2023"
                      : "bns-2023",
                    section: selectedMapping.tgt_sec,
                  }}
                  className="bg-white text-black hover:bg-neutral-200 px-5 py-2 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-md flex-1 sm:flex-initial"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Open in Legal Library</span>
                </Link>

                <button
                  onClick={() => setSelectedMapping(null)}
                  className="apple-glass-pill px-4 py-2 text-xs text-neutral-400 hover:text-white cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
