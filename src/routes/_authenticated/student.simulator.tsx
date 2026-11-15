import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Gavel,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Scale,
  Sparkles,
  ArrowLeft,
  Send,
  Award,
  BookOpen,
  HelpCircle,
  FileText,
  User,
  Shield,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import {
  SimulationTemplate,
  fetchSimulationTemplates,
} from "@/lib/student-legal-library";

export const Route = createFileRoute("/_authenticated/student/simulator")({
  head: () => ({
    meta: [
      { title: "Case Simulator — TRANA Student" },
      {
        name: "description",
        content:
          "Interactive courtroom trial and bail hearing simulations with simulated judicial interventions.",
      },
    ],
  }),
  component: StudentSimulatorPage,
});

interface ChatTurn {
  sender: "judge" | "advocate";
  text: string;
  timestamp: string;
}

function StudentSimulatorPage() {
  const [templates, setTemplates] = useState<SimulationTemplate[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [activeTemplate, setActiveTemplate] = useState<SimulationTemplate | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [inputArgument, setInputArgument] = useState("");
  const [isSubmittingTurn, setIsSubmittingTurn] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<{
    score: number;
    breakdown: Record<string, number>;
    feedback: string;
  } | null>(null);

  useEffect(() => {
    async function loadTemplates() {
      const data = await fetchSimulationTemplates();
      setTemplates(data);
    }
    loadTemplates();
  }, []);

  function handleStartSimulation(template: SimulationTemplate) {
    setActiveTemplate(template);
    setEvaluationResult(null);
    setTurns([
      {
        sender: "judge",
        text: `Bench is in session. Matter titled "${template.title}". Counsel for the accused, what are your primary submissions before this Court?`,
        timestamp: "Now",
      },
    ]);
  }

  function handleExitSimulation() {
    setActiveTemplate(null);
    setTurns([]);
    setInputArgument("");
    setEvaluationResult(null);
  }

  async function handleSendArgument(e: React.FormEvent) {
    e.preventDefault();
    if (!inputArgument.trim() || isSubmittingTurn || !activeTemplate) return;

    const userText = inputArgument.trim();
    setInputArgument("");
    const newTurns: ChatTurn[] = [
      ...turns,
      { sender: "advocate", text: userText, timestamp: "Just now" },
    ];
    setTurns(newTurns);
    setIsSubmittingTurn(true);

    // Simulate judicial intervention based on argument
    setTimeout(() => {
      let judgeReply = "";
      const lower = userText.toLowerCase();

      if (lower.includes("479") || lower.includes("undertrial") || lower.includes("one-third")) {
        judgeReply =
          "Counsel, the Court notes your reliance on Section 479(1) of BNSS, 2023. Does your client have any concurrent FIRs registered against him or is this his first prosecution?";
      } else if (lower.includes("480") || lower.includes("bail") || lower.includes("antil")) {
        judgeReply =
          "Learned counsel, under the Satender Kumar Antil guidelines, this falls within Category A offences. Has recovery of the alleged property been completed by the investigating agency?";
      } else if (lower.includes("63") || lower.includes("certificate") || lower.includes("bsa") || lower.includes("electronic")) {
        judgeReply =
          "Counsel, prosecution has filed secondary electronic printouts. You argue absence of Section 63 BSA certificate. How does the ruling in Arjun Panditrao apply at this interlocutory stage?";
      } else if (lower.includes("civil") || lower.includes("contract") || lower.includes("cheating") || lower.includes("316") || lower.includes("318")) {
        judgeReply =
          "The Court is examining the ingredient of fraudulent inducement at inception. How do you distinguish commercial breach of agreement from dishonest misappropriation under BNS 316?";
      } else {
        judgeReply =
          "Counsel, the Bench is listening. Please cite the applicable statutory sections and how the factual matrix satisfies the legal threshold.";
      }

      setTurns((prev) => [
        ...prev,
        { sender: "judge", text: judgeReply, timestamp: "Just now" },
      ]);
      setIsSubmittingTurn(false);
    }, 900);
  }

  function handleConcludeSimulation() {
    if (!activeTemplate) return;
    // Calculate synthetic score based on turns
    const score = Math.min(94, 68 + turns.length * 5);
    setEvaluationResult({
      score,
      breakdown: {
        "Statutory Provision Accuracy": 28,
        "Application of Supreme Court Precedents": 24,
        "Factual Submissions & Argumentation": 22,
        "Courtroom Decorum & Persuasiveness": 18,
      },
      feedback:
        "Strong presentation of statutory provisions. Your submissions correctly integrated newly enacted BNSS/BNS provisions with applicable Supreme Court precedents. To achieve higher distinctions, emphasize specific factual recovery details and cite bench corams.",
    });
    toast.success("Simulation submitted for evaluation!");
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <Gavel className="h-4 w-4" />
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-semibold text-white tracking-wide">
              Case Simulator
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
              Interactive Moot Court
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
            Simulate realistic trial arguments, bail hearings, and cross-examinations. Argue before simulated judicial benches and receive rubric-based scoring on legal accuracy.
          </p>
        </div>

        <Link
          to="/student/library"
          className="apple-glass-pill px-3.5 py-1.5 text-xs text-neutral-200 hover:text-white flex items-center gap-2 self-start sm:self-auto"
        >
          <BookOpen className="h-3.5 w-3.5 text-purple-400" />
          <span>Statutory Library</span>
        </Link>
      </div>

      {activeTemplate ? (
        /* ══════════════════════════════════════════════════════════════════
           ACTIVE SIMULATION ARENA (SPLIT SCREEN)
           ══════════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={handleExitSimulation}
              className="text-xs font-mono text-purple-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Exit Simulation</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {activeTemplate.court}
              </span>
              <button
                onClick={handleConcludeSimulation}
                className="bg-white text-black hover:bg-neutral-200 px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer shadow-md"
              >
                Conclude & Evaluate
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Panel: Brief, Facts & Statutes (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="apple-glass-card border-white/15 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                    {activeTemplate.difficulty} Level
                  </span>
                  <span className="text-xs font-mono text-neutral-400">
                    Role: Defense Counsel
                  </span>
                </div>
                <h2 className="text-base font-semibold text-white">
                  {activeTemplate.title}
                </h2>
                <p className="text-xs text-neutral-300 leading-relaxed bg-white/[0.02] p-3 rounded-xl border border-white/10 font-sans">
                  {activeTemplate.scenario_text}
                </p>
              </div>

              {/* Material Facts */}
              <div className="apple-glass-card border-white/15 p-5 space-y-2.5">
                <h3 className="text-xs uppercase font-mono tracking-wider text-purple-300 font-bold flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  <span>Case Record & Material Facts:</span>
                </h3>
                <div className="space-y-2">
                  {activeTemplate.facts.map((fact, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-neutral-300 flex items-start gap-2"
                    >
                      <span className="h-4 w-4 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-[10px] font-mono shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <p className="leading-relaxed">{fact}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Statutory Anchor Checklist */}
              <div className="apple-glass-card border-white/15 p-5 space-y-2.5">
                <h3 className="text-xs uppercase font-mono tracking-wider text-amber-300 font-bold flex items-center gap-1.5">
                  <Scale className="h-3.5 w-3.5" />
                  <span>Key Provisions & Precedents:</span>
                </h3>
                <div className="space-y-1.5">
                  {activeTemplate.key_statutory_points.map((pt, i) => (
                    <div
                      key={i}
                      className="text-xs font-mono text-neutral-300 p-2 rounded-lg bg-white/[0.02] border border-white/10 flex items-start gap-2"
                    >
                      <span className="text-purple-400">•</span>
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Panel: Simulated Courtroom Hearing (7 cols) */}
            <div className="lg:col-span-7 apple-glass-card border-white/15 p-5 flex flex-col h-[650px] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-semibold text-white">Courtroom Session Active</span>
                </div>
                <span className="text-[11px] font-mono text-neutral-400">
                  {turns.length} turns recorded
                </span>
              </div>

              {/* Dialogue Transcript */}
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-2">
                {turns.map((t, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${
                      t.sender === "advocate" ? "items-end" : "items-start"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[10px] font-mono text-neutral-400">
                        {t.sender === "judge" ? "Hon'ble Court (Magistrate)" : "You (Defense Counsel)"}
                      </span>
                    </div>
                    <div
                      className={`max-w-[88%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                        t.sender === "advocate"
                          ? "bg-purple-900/40 border border-purple-500/40 text-purple-100 rounded-tr-none"
                          : "bg-white/[0.06] border border-white/15 text-neutral-200 rounded-tl-none font-serif"
                      }`}
                    >
                      {t.text}
                    </div>
                  </div>
                ))}
                {isSubmittingTurn && (
                  <div className="flex items-center gap-2 text-xs font-mono text-purple-300 pt-2">
                    <Sparkles className="h-3.5 w-3.5 animate-spin" />
                    <span>The Court is reviewing your submissions...</span>
                  </div>
                )}
              </div>

              {/* Input Box */}
              <form onSubmit={handleSendArgument} className="mt-4 pt-3 border-t border-white/10 flex gap-2">
                <input
                  type="text"
                  placeholder="State your legal submission, cite statutory sections or case law..."
                  value={inputArgument}
                  onChange={(e) => setInputArgument(e.target.value)}
                  disabled={isSubmittingTurn}
                  className="flex-1 apple-glass-input px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 rounded-xl"
                />
                <button
                  type="submit"
                  disabled={isSubmittingTurn || !inputArgument.trim()}
                  className="bg-white text-black hover:bg-neutral-200 disabled:opacity-40 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Argue</span>
                </button>
              </form>
            </div>
          </div>

          {/* Evaluation Result Modal */}
          {evaluationResult && (
            <div className="apple-glass-card border-purple-500/40 p-6 md:p-8 space-y-4 shadow-2xl bg-purple-950/20">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold text-lg font-mono">
                    {evaluationResult.score}%
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Courtroom Performance Assessment</h3>
                    <p className="text-xs text-neutral-400 font-mono">Simulated Bench Rubric Score</p>
                  </div>
                </div>
                <button
                  onClick={() => setEvaluationResult(null)}
                  className="text-xs font-mono text-neutral-400 hover:text-white"
                >
                  Close ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {Object.entries(evaluationResult.breakdown).map(([k, v], i) => (
                  <div key={i} className="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs">
                    <span className="text-neutral-400 block">{k}</span>
                    <span className="text-sm font-bold text-white font-mono mt-1 block">{v} / 30 pts</span>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-neutral-200 leading-relaxed font-sans">
                <span className="text-[10px] uppercase font-mono text-purple-300 font-bold block mb-1">
                  Judicial Feedback & Coaching:
                </span>
                {evaluationResult.feedback}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════════
           TEMPLATE CATALOG VIEW
           ══════════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            {["all", "Beginner", "Intermediate", "Advanced"].map((diff) => (
              <button
                key={diff}
                onClick={() => setSelectedDifficulty(diff)}
                className={`px-4 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                  selectedDifficulty === diff
                    ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                    : "apple-glass-pill text-neutral-300 hover:text-white"
                }`}
              >
                {diff === "all" ? "All Difficulty Levels" : `${diff} Level`}
              </button>
            ))}
          </div>

          {/* Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates
              .filter(
                (t) =>
                  selectedDifficulty === "all" ||
                  t.difficulty.toLowerCase() === selectedDifficulty.toLowerCase()
              )
              .map((template) => (
                <div
                  key={template.id}
                  className="apple-glass-card p-6 flex flex-col justify-between space-y-4 hover:border-purple-400/50 hover:bg-white/[0.05] transition-all"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {template.category}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-neutral-300">
                        {template.difficulty}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-white">
                      {template.title}
                    </h3>

                    <p className="text-xs text-neutral-400 line-clamp-3 leading-relaxed">
                      {template.scenario_text}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-neutral-400">
                      Court: {template.court.split(",")[0]}
                    </span>
                    <button
                      onClick={() => handleStartSimulation(template)}
                      className="bg-white text-black hover:bg-neutral-200 px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Play className="h-3 w-3 fill-black" />
                      <span>Start Trial</span>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
