import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Sparkles, BookOpen, Clock, CheckCircle2, Landmark, GraduationCap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/student/research")({
  head: () => ({
    meta: [
      { title: "Academic Case Research — TRANA Student" },
      { name: "description", content: "AI-assisted legal research across Supreme Court and High Court jurisprudence for law scholars." },
      { property: "og:title", content: "Academic Case Research — TRANA Student" },
    ],
  }),
  component: StudentResearchPage,
});

function StudentResearchPage() {
  const [query, setQuery] = useState("");
  const [joinedWaitlist, setJoinedWaitlist] = useState(false);

  function handleWaitlist(e: React.FormEvent) {
    e.preventDefault();
    setJoinedWaitlist(true);
    toast.success("Scholar early access registered for TRANA Case Research!");
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="border-b border-[#222222] pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl md:text-4xl font-medium text-white">
            Academic Case Research
          </h1>
          <span className="border border-purple-500/40 bg-purple-950/20 px-3 py-1 text-xs uppercase tracking-[0.15em] text-purple-300 font-mono">
            Research Preview
          </span>
        </div>
        <p className="mt-2 text-xs md:text-sm text-[#999999]">
          Semantic search across 70+ years of Supreme Court and High Court jurisprudence for moot court memorials and academic dissertations.
        </p>
      </div>

      <div className="bg-[#141414] border border-[#262626] p-6 md:p-10 space-y-8">
        <div>
          <span className="text-[0.65rem] uppercase tracking-[0.2em] text-[#888888] font-mono">
            Academic Intelligence Engine
          </span>
          <h2 className="mt-2 font-display text-2xl md:text-3xl font-medium text-white">
            Precedent Analysis & Ratio Decidendi Extraction
          </h2>
          <p className="mt-3 text-xs md:text-sm text-[#CCCCCC] leading-relaxed max-w-2xl font-light">
            TRANA's research module is designed to query across the Supreme Court of India and all 25 High Courts, mapping statutory transitions between IPC and BNS with automated ratio extraction.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#101010] border border-[#242424] p-5">
            <span className="text-xs uppercase tracking-[0.15em] text-amber-300 font-mono">Overruled Checker</span>
            <h3 className="mt-2 text-sm font-medium text-white">Precedent Validity</h3>
            <p className="mt-1 text-xs text-[#888888]">Instant detection if a cited ruling was distinguished or overruled by a larger bench.</p>
          </div>

          <div className="bg-[#101010] border border-[#242424] p-5">
            <span className="text-xs uppercase tracking-[0.15em] text-emerald-400 font-mono">Transition Matrix</span>
            <h3 className="mt-2 text-sm font-medium text-white">BNS & IPC Mappings</h3>
            <p className="mt-1 text-xs text-[#888888]">Automated cross-application of 1860/1973 case law to the new 2023 criminal codes.</p>
          </div>

          <div className="bg-[#101010] border border-[#242424] p-5">
            <span className="text-xs uppercase tracking-[0.15em] text-purple-400 font-mono">Moot Court Mode</span>
            <h3 className="mt-2 text-sm font-medium text-white">Counter-Arguments</h3>
            <p className="mt-1 text-xs text-[#888888]">Simulate appellant vs respondent authorities for moot court competitions.</p>
          </div>
        </div>

        <div className="border-t border-[#262626] pt-6">
          {joinedWaitlist ? (
            <div className="bg-emerald-950/40 border border-emerald-500/40 p-4 flex items-center gap-3 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              <span>You have been registered for early academic access to the Case Research engine!</span>
            </div>
          ) : (
            <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Suggest a legal topic, journal database, or research feature..."
                className="flex-1 border border-[#333333] bg-[#0A0A0A] px-4 py-2.5 text-xs text-white focus:border-purple-400 focus:outline-none"
              />
              <button
                type="submit"
                className="bg-white text-black px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] hover:bg-neutral-200 transition-colors"
              >
                Join Scholar Beta
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

