import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Sparkles, BookOpen, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lawyer/research")({
  head: () => ({
    meta: [
      { title: "Legal Professional Workspace — TRANA" },
      { name: "description", content: "TRANA Case Law and Statutory Research engine." },
      { property: "og:title", content: "Legal Professional Workspace — TRANA" },
    ],
  }),
  component: LawyerResearchPage,
});

function LawyerResearchPage() {
  const [query, setQuery] = useState("");
  const [joinedWaitlist, setJoinedWaitlist] = useState(false);

  function handleWaitlist(e: React.FormEvent) {
    e.preventDefault();
    setJoinedWaitlist(true);
    toast.success("Priority access requested for TRANA Advanced Case Research!");
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="border-b border-[#222222] pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl md:text-5xl font-medium text-white">
            Case Research
          </h1>
          <span className="border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs uppercase tracking-[0.15em] text-[#AAAAAA]">
            Planned
          </span>
        </div>
        <p className="mt-2 text-sm text-[#999999]">
          Comprehensive search across 70+ years of Supreme Court and High Court jurisprudence with semantic query analysis.
        </p>
      </div>

      <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-8 md:p-12 space-y-8">
        <div>
          <span className="text-xs uppercase tracking-[0.2em] text-[#888888]">
            Preview Architecture
          </span>
          <h2 className="mt-2 font-display text-3xl font-medium text-white">
            Semantic Case Law Intelligence
          </h2>
          <p className="mt-3 text-sm text-[#CCCCCC] leading-relaxed max-w-2xl font-light">
            TRANA's research module is designed to query across the Supreme Court of India and all 25 High Courts, mapping transitions between the Indian Penal Code and Bharatiya Nyaya Sanhita with ratio extraction.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#111111] border border-[#262626] p-5">
            <span className="text-xs uppercase tracking-[0.15em] text-amber-300 font-mono">01 Overruled Checker</span>
            <h3 className="mt-2 text-base font-medium text-white">Precedent Validity</h3>
            <p className="mt-1 text-xs text-[#888888]">Instant detection if a cited ruling was distinguished or overruled by a larger bench.</p>
          </div>

          <div className="bg-[#111111] border border-[#262626] p-5">
            <span className="text-xs uppercase tracking-[0.15em] text-emerald-400 font-mono">02 Transition Matrix</span>
            <h3 className="mt-2 text-base font-medium text-white">BNS & IPC Mappings</h3>
            <p className="mt-1 text-xs text-[#888888]">Automated cross-application of 1860/1973 case law to the new 2023 criminal codes.</p>
          </div>

          <div className="bg-[#111111] border border-[#262626] p-5">
            <span className="text-xs uppercase tracking-[0.15em] text-sky-400 font-mono">03 Bench Analysis</span>
            <h3 className="mt-2 text-base font-medium text-white">Coram Insights</h3>
            <p className="mt-1 text-xs text-[#888888]">Historical bail granting and sentencing patterns across High Court and Sessions benches.</p>
          </div>
        </div>

        <div className="border-t border-[#262626] pt-8">
          {joinedWaitlist ? (
            <div className="bg-emerald-950/40 border border-emerald-500/40 p-4 flex items-center gap-3 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              <span>You have been registered for early preview access to the Case Research engine!</span>
            </div>
          ) : (
            <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Suggest a specific case law research feature or law database..."
                className="flex-1 border border-[#333333] bg-[#0A0A0A] px-4 py-3 text-sm text-white focus:border-white focus:outline-none"
              />
              <button
                type="submit"
                className="bg-white text-black px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] hover:bg-neutral-200 transition-colors"
              >
                Join Feature Beta
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
