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
          "Bidirectional statutory transition concordance between IPC↔BNS, CrPC↔BNSS, and IEA↔BSA.",
      },
    ],
  }),
  component: StudentConvertersPage,
});

type ConverterPair = "IPC_BNS" | "CRPC_BNSS" | "IEA_BSA";

function StudentConvertersPage() {
  const [activePair, setActivePair] = useState<ConverterPair>("IPC_BNS");
  const [searchQuery, setSearchQuery] = useState("");
  const [mappings, setMappings] = useState<SectionMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

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

  function handleCopyMapping(item: SectionMapping, index: number) {
    const text = `${item.src_act} Section ${item.src_sec} ➔ ${item.tgt_act} Section ${item.tgt_sec} (${item.title})`;
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success("Concordance citation copied!");
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
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
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
              Old ↔ New Concordance
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
            Identify exact corresponding provisions between former colonial-era criminal laws and the 2023 criminal enactments. Both-direction searching is supported.
          </p>
        </div>

        <Link
          to="/student/library"
          className="apple-glass-pill px-3.5 py-1.5 text-xs text-neutral-200 hover:text-white flex items-center gap-2 self-start sm:self-auto"
        >
          <BookOpen className="h-3.5 w-3.5 text-purple-400" />
          <span>Open Full Legal Library</span>
        </Link>
      </div>

      {/* Converter Pair Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => {
            setActivePair("IPC_BNS");
            setSearchQuery("");
          }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activePair === "IPC_BNS"
              ? "bg-purple-950/30 border-purple-400/60 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
              : "apple-glass-card hover:bg-white/[0.04]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-purple-300">Penal Code</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-neutral-300">Substantive</span>
          </div>
          <h3 className="text-sm font-semibold text-white mt-1">IPC 1860 ↔ BNS 2023</h3>
          <p className="text-[11px] text-neutral-400 mt-1">
            Offences, definitions, general exceptions & punishments
          </p>
        </button>

        <button
          onClick={() => {
            setActivePair("CRPC_BNSS");
            setSearchQuery("");
          }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activePair === "CRPC_BNSS"
              ? "bg-purple-950/30 border-purple-400/60 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
              : "apple-glass-card hover:bg-white/[0.04]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-purple-300">Criminal Procedure</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-neutral-300">Procedural</span>
          </div>
          <h3 className="text-sm font-semibold text-white mt-1">CrPC 1973 ↔ BNSS 2023</h3>
          <p className="text-[11px] text-neutral-400 mt-1">
            Arrests, FIR, investigation, bail, trial & custody timelines
          </p>
        </button>

        <button
          onClick={() => {
            setActivePair("IEA_BSA");
            setSearchQuery("");
          }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activePair === "IEA_BSA"
              ? "bg-purple-950/30 border-purple-400/60 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
              : "apple-glass-card hover:bg-white/[0.04]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-purple-300">Evidence Law</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-neutral-300">Evidentiary</span>
          </div>
          <h3 className="text-sm font-semibold text-white mt-1">IEA 1872 ↔ BSA 2023</h3>
          <p className="text-[11px] text-neutral-400 mt-1">
            Relevancy, electronic records, burden of proof & witness examination
          </p>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-4 h-4 w-4 text-neutral-400 pointer-events-none" />
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
              className="absolute right-4 text-xs font-mono text-neutral-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Concordance Results List */}
      <div className="apple-glass-card border-white/15 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-white">
              Statutory Transition Matrix ({mappings.length} provisions)
            </h3>
          </div>
          <span className="text-xs font-mono text-neutral-400">
            Source: BPRD & NCRB Official Concordance
          </span>
        </div>

        {loading ? (
          <div className="text-center py-10 text-xs text-neutral-400 font-mono">
            Searching statutory concordance matrix...
          </div>
        ) : mappings.length === 0 ? (
          <div className="text-center py-10 text-xs text-neutral-400 space-y-2">
            <p>No concordance provision found for "{searchQuery}".</p>
            <p className="text-[11px] text-neutral-500">
              Try searching with just the section number (e.g., "302" or "378") or key legal phrase.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {mappings.map((item, idx) => (
              <div
                key={idx}
                className="p-4 md:p-5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-purple-400/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                {/* Left: Former Law */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                      {item.src_act}
                    </span>
                    <span className="text-xs font-bold text-neutral-200">
                      Section {item.src_sec}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-neutral-400">
                    Former Colonial Law
                  </p>
                </div>

                {/* Center: Transition Indicator */}
                <div className="flex items-center gap-2 shrink-0 justify-center">
                  <div className="h-8 w-8 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-300 group-hover:scale-110 transition-transform">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 block">
                      {item.mapping_type}
                    </span>
                  </div>
                </div>

                {/* Right: New Enacted Law */}
                <div className="flex-1 space-y-1 md:text-right">
                  <div className="flex items-center gap-2 md:justify-end">
                    <span
                      className="text-xs md:text-sm font-bold text-white group-hover:text-purple-300 transition-colors font-['Times_New_Roman',_Times,_serif]"
                      style={{ fontFamily: "'Times New Roman', Times, serif" }}
                    >
                      Section {item.tgt_sec}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                      {item.tgt_act}
                    </span>
                  </div>
                  <p
                    className="text-xs md:text-sm font-medium text-neutral-100 truncate max-w-xs md:ml-auto font-['Times_New_Roman',_Times,_serif]"
                    style={{ fontFamily: "'Times New Roman', Times, serif" }}
                  >
                    {item.title}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-white/10 shrink-0">
                  <button
                    onClick={() => handleCopyMapping(item, idx)}
                    className="apple-glass-pill px-2.5 py-1 text-xs text-neutral-300 hover:text-white flex items-center gap-1 cursor-pointer"
                    title="Copy Citation"
                  >
                    {copiedIndex === idx ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    <span>{copiedIndex === idx ? "Copied" : "Copy"}</span>
                  </button>
                  <Link
                    to="/student/library"
                    search={{
                      act: item.tgt_act.toLowerCase().includes("bnss")
                        ? "bnss-2023"
                        : item.tgt_act.toLowerCase().includes("bsa")
                        ? "bsa-2023"
                        : "bns-2023",
                      section: item.tgt_sec,
                    }}
                    className="apple-glass-pill px-2.5 py-1 text-xs text-purple-300 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Act</span>
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
