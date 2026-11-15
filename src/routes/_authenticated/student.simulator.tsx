import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
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
  Volume2,
  Mic,
  Briefcase,
  Flame,
  MessageSquare,
  Landmark,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  SimulationTemplate,
  fetchSimulationTemplates,
} from "@/lib/student-legal-library";
import {
  CourtroomPixelScene,
  PixelJudgeAvatar,
  PixelOppositionAvatar,
  PixelDefenseAvatar,
} from "@/components/CourtroomPixelScene";

export const Route = createFileRoute("/_authenticated/student/simulator")({
  head: () => ({
    meta: [
      { title: "Courtroom Case Simulator — TRANA Student" },
      {
        name: "description",
        content:
          "High-fidelity courtroom litigation simulator with presiding judicial bench, defense and prosecution tables, witness stand, and real-time judicial feedback.",
      },
    ],
  }),
  component: StudentSimulatorPage,
});

interface ChatTurn {
  sender: "judge" | "advocate" | "prosecutor" | "witness";
  name: string;
  roleTitle: string;
  text: string;
  timestamp: string;
  type?: "submission" | "question" | "ruling" | "objection";
}

interface AdjournedSession {
  template: SimulationTemplate;
  turns: ChatTurn[];
  inputArgument: string;
  timestamp: string;
}

const ADJOURNED_STORAGE_KEY = "trana_case_simulator_adjourned_session";

function StudentSimulatorPage() {
  const [templates, setTemplates] = useState<SimulationTemplate[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [activeTemplate, setActiveTemplate] = useState<SimulationTemplate | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [inputArgument, setInputArgument] = useState("");
  const [isSubmittingTurn, setIsSubmittingTurn] = useState(false);
  const [isGavelStriking, setIsGavelStriking] = useState(false);
  const [adjournedSession, setAdjournedSession] = useState<AdjournedSession | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<{
    score: number;
    breakdown: Record<string, number>;
    feedback: string;
  } | null>(null);

  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadTemplates() {
      const data = await fetchSimulationTemplates();
      setTemplates(data);
    }
    loadTemplates();

    try {
      const raw = localStorage.getItem(ADJOURNED_STORAGE_KEY);
      if (raw) {
        setAdjournedSession(JSON.parse(raw));
      }
    } catch {}
  }, []);

  // Scroll ONLY the internal transcript container, NEVER the window!
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [turns]);

  function triggerGavel() {
    setIsGavelStriking(true);
    setTimeout(() => setIsGavelStriking(false), 900);
  }

  function handleStartSimulation(template: SimulationTemplate) {
    setActiveTemplate(template);
    setEvaluationResult(null);
    triggerGavel();
    setTurns([
      {
        sender: "judge",
        name: "Hon'ble Presiding Magistrate",
        roleTitle: "Bench (Presiding Officer)",
        text: `The Court is in session. Matter Item No. 04 called: "${template.title}". Counsel for the accused, what are your primary submissions before this Court?`,
        timestamp: "10:30 AM",
        type: "question",
      },
    ]);
  }

  // 1. Step Down: completely resets the case and closes normally
  function handleStepDown() {
    setActiveTemplate(null);
    setTurns([]);
    setInputArgument("");
    setEvaluationResult(null);
    setIsSubmittingTurn(false);
    toast.info("Stepped down from the podium. Case closed and reset.");
  }

  // 2. Adjourn Session: saves progress so user can resume at their convenience
  function handleAdjournSession() {
    if (!activeTemplate) return;
    const sessionData: AdjournedSession = {
      template: activeTemplate,
      turns,
      inputArgument,
      timestamp: new Date().toISOString(),
    };
    try {
      localStorage.setItem(ADJOURNED_STORAGE_KEY, JSON.stringify(sessionData));
      setAdjournedSession(sessionData);
    } catch (err) {
      console.warn("Failed to persist adjourned session:", err);
    }

    setActiveTemplate(null);
    setTurns([]);
    setInputArgument("");
    setEvaluationResult(null);
    setIsSubmittingTurn(false);
    toast.success(
      "Court adjourned! Proceedings saved. You can take your time and resume from where you left off at your convenience."
    );
  }

  function handleResumeAdjournedTrial() {
    if (!adjournedSession) return;
    setActiveTemplate(adjournedSession.template);
    setTurns(adjournedSession.turns);
    setInputArgument(adjournedSession.inputArgument || "");
    setEvaluationResult(null);
    setIsSubmittingTurn(false);
    triggerGavel();
    toast.success(`Resumed trial for "${adjournedSession.template.title}" from where you left off.`);
  }

  function handleDiscardAdjournedSession() {
    try {
      localStorage.removeItem(ADJOURNED_STORAGE_KEY);
      setAdjournedSession(null);
      toast.info("Adjourned trial record removed.");
    } catch {}
  }

  async function handleSendArgument(customText?: string) {
    const userText = (customText || inputArgument).trim();
    if (!userText || isSubmittingTurn || !activeTemplate) return;

    // Record window scroll position to lock it in place — never let page go down!
    const currentScrollY = typeof window !== "undefined" ? window.scrollY : 0;

    setInputArgument("");
    const newTurns: ChatTurn[] = [
      ...turns,
      {
        sender: "advocate",
        name: "Advocate (You)",
        roleTitle: "Defense Counsel",
        text: userText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        type: "submission",
      },
    ];
    setTurns(newTurns);
    setIsSubmittingTurn(true);

    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        window.scrollTo({ top: currentScrollY, behavior: "instant" });
      });
    }

    // Dynamic simulated courtroom interactions (Judge and opposing Public Prosecutor)
    setTimeout(() => {
      triggerGavel();
      const lower = userText.toLowerCase();
      let judgeReply = "";
      let prosReply = "";

      if (lower.includes("479") || lower.includes("undertrial") || lower.includes("one-third")) {
        prosReply =
          "State Counsel: The application is vehemently opposed. The accused was found in possession of stolen property in a public place. Release under 479 cannot be automatic.";
        judgeReply =
          "Counsel, the Court notes your reliance on Section 479(1) Proviso 1 of BNSS, 2023. Does your client have any concurrent FIRs registered against him or is this his first prosecution?";
      } else if (lower.includes("480") || lower.includes("bail") || lower.includes("antil")) {
        prosReply =
          "State Counsel: Investigation was completed only days ago. Bail should not be granted without heavy sureties.";
        judgeReply =
          "Learned counsel, under the Satender Kumar Antil guidelines, this falls within Category A offences. Has recovery of the alleged property been completed by the investigating agency?";
      } else if (lower.includes("63") || lower.includes("certificate") || lower.includes("bsa") || lower.includes("electronic")) {
        prosReply =
          "Public Prosecutor: The IO has certified the chats through the general case diary entry. The electronic printouts are genuine.";
        judgeReply =
          "Counsel, the prosecution argues the diary suffices. Under Arjun Panditrao Khotkar, secondary electronic records require a specific Section 63 BSA certificate. How does the absence impact framing of charges?";
      } else if (lower.includes("civil") || lower.includes("contract") || lower.includes("cheating") || lower.includes("316") || lower.includes("318")) {
        prosReply =
          "State Counsel: An amount of ₹15,00,000 was transferred and goods were diverted. Dishonest intention is evident.";
        judgeReply =
          "The Court is examining the ingredient of fraudulent inducement at inception. How do you distinguish commercial breach of agreement from dishonest misappropriation under BNS 316?";
      } else {
        judgeReply =
          "Counsel, the Bench is listening. Please cite the applicable statutory sections and how the factual matrix satisfies the legal threshold.";
      }

      const additions: ChatTurn[] = [];
      if (prosReply) {
        additions.push({
          sender: "prosecutor",
          name: "Adv. Alok Verma",
          roleTitle: "Public Prosecutor (State)",
          text: prosReply,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          type: "objection",
        });
      }
      additions.push({
        sender: "judge",
        name: "Hon'ble Presiding Magistrate",
        roleTitle: "Bench (Presiding Officer)",
        text: judgeReply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        type: "question",
      });

      setTurns((prev) => [...prev, ...additions]);
      setIsSubmittingTurn(false);

      // Keep user at the courtroom podium & arena without page jump
      if (typeof window !== "undefined") {
        requestAnimationFrame(() => {
          window.scrollTo({ top: currentScrollY, behavior: "instant" });
        });
      }
    }, 1100);
  }

  function handleConcludeSimulation() {
    if (!activeTemplate) return;
    const score = Math.min(96, 72 + turns.length * 4);
    setEvaluationResult({
      score,
      breakdown: {
        "Statutory Law & Section Accuracy": 29,
        "Supreme Court Precedent Application": 25,
        "Rebuttal of State Prosecution": 23,
        "Courtroom Decorum & Persuasiveness": 19,
      },
      feedback:
        "Commendable performance before the Bench. You effectively answered the prosecution's objections and grounded your submissions in Section 479/480 BNSS and binding Supreme Court jurisprudence. Your arguments were clear, structured, and respectful of courtroom decorum.",
    });
    triggerGavel();
    toast.success("Courtroom hearing concluded! Bench evaluation generated.");
  }

  return (
    <div className="relative min-h-screen space-y-6 max-w-7xl mx-auto pb-16">
      {/* ══════════════════════════════════════════════════════════════════
          COURTROOM AMBIANCE & MAHOGANY WOOD PANELLING BACKDROP
          ══════════════════════════════════════════════════════════════════ */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none">
        {/* Warm courtroom chandelier spotlights */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-amber-600/[0.10] blur-[160px] rounded-full" />
        <div className="absolute bottom-0 left-10 w-[500px] h-[400px] bg-[#3a0d17]/[0.15] blur-[150px] rounded-full" />

        {/* Polished wood panelling texture */}
        <div
          className="absolute inset-0 opacity-20 mix-blend-screen bg-repeat"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' fill='%23190e09'/%3E%3Cpath d='M0 0h120v120H0z' fill='none' stroke='%232b170c' stroke-width='1.5'/%3E%3Cpath d='M60 0v120M0 60h120' stroke='%23381e0f' stroke-width='1'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/30 pb-5 backdrop-blur-md bg-black/60 p-4 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-md">
              <Gavel className="h-5 w-5" />
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-white tracking-wide font-serif">
              Courtroom Case Simulator
            </h1>
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase font-bold">
              Live Judicial Bench
            </span>
          </div>
          <p className="text-xs text-neutral-300 mt-1 max-w-2xl">
            Simulate realistic trial arguments, bail hearings, and cross-examinations before an interactive Bench with authentic courtroom desks, opposing Public Prosecutor, and witness stand.
          </p>
        </div>

        <Link
          to="/student/library"
          className="apple-glass-pill px-4 py-2 text-xs text-amber-300 hover:text-white flex items-center gap-2 self-start sm:self-auto border-amber-500/30 bg-black/60 shadow-lg"
        >
          <BookOpen className="h-4 w-4 text-amber-400" />
          <span>Statutory Library</span>
        </Link>
      </div>

      {activeTemplate ? (
        /* ══════════════════════════════════════════════════════════════════
           LIVE COURTROOM CHAMBER VIEW
           ══════════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          {/* Courtroom Top Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-black/75 backdrop-blur-xl p-3.5 px-5 rounded-2xl border border-amber-500/30 shadow-lg">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* 1. Step Down Button: completely resets the case and closes normally */}
              <button
                type="button"
                onClick={handleStepDown}
                className="apple-glass-pill px-3.5 py-1.5 text-xs text-rose-300 hover:text-white border-rose-500/40 hover:bg-rose-950/50 flex items-center gap-1.5 transition-all cursor-pointer font-medium"
                title="Step down from the speaking podium, reset the whole case and close normally"
              >
                <RotateCcw className="h-3.5 w-3.5 text-rose-400" />
                <span>Step Down (Reset & Close)</span>
              </button>

              {/* 2. Adjourn Session Button: gives user time and saves progress to resume at convenience */}
              <button
                type="button"
                onClick={handleAdjournSession}
                className="apple-glass-pill px-3.5 py-1.5 text-xs text-amber-300 hover:text-white border-amber-500/40 hover:bg-amber-950/50 flex items-center gap-1.5 transition-all cursor-pointer font-medium"
                title="Adjourn session and save proceedings to resume from where you left off at your convenience"
              >
                <Clock className="h-3.5 w-3.5 text-amber-400" />
                <span>Adjourn Session (Resume Later)</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* Gavel Strike Action Trigger */}
              <button
                type="button"
                onClick={triggerGavel}
                className="apple-glass-pill px-3 py-1 text-xs text-amber-300 hover:text-amber-200 border-amber-500/40 flex items-center gap-1.5 cursor-pointer bg-black/50"
                title="Strike Gavel"
              >
                <Gavel className={`h-3.5 w-3.5 ${isGavelStriking ? "animate-bounce text-amber-400" : ""}`} />
                <span>Order in Court</span>
              </button>

              <button
                type="button"
                onClick={handleConcludeSimulation}
                className="bg-amber-400 hover:bg-amber-300 text-black px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer shadow-md transition-all hover:scale-105"
              >
                Conclude Hearing & Evaluate
              </button>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              RETRO PIXEL COURTROOM ARENA (JUDGE, OPPOSITION & CROWD)
              ══════════════════════════════════════════════════════════════════ */}
          <CourtroomPixelScene
            courtTitle={activeTemplate.court}
            isGavelStriking={isGavelStriking}
            onTriggerGavel={triggerGavel}
            latestTurn={turns.length > 0 ? turns[turns.length - 1] : null}
            allTurns={turns}
            inputArgument={inputArgument}
            onInputChange={setInputArgument}
            onSubmitArgument={handleSendArgument}
            isSubmittingTurn={isSubmittingTurn}
            onQuickSubmission={(text) => handleSendArgument(text)}
          />

          {/* ══════════════════════════════════════════════════════════════════
              COURTROOM SPLIT FLOOR: DEFENSE DOCKET & LIVE TRANSCRIPT
              ══════════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Defense Table Briefcase & Evidence (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Defense Bar Placard Card */}
              <div className="rounded-2xl bg-gradient-to-br from-[#1a110a] via-[#120a05] to-[#0a0502] border-2 border-amber-600/40 p-5 space-y-3 shadow-xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">
                      Defense Counsel Bar (You)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Advocate for Accused
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white font-serif">
                  {activeTemplate.title}
                </h3>

                <p className="text-xs text-neutral-300 leading-relaxed bg-black/40 p-3.5 rounded-xl border border-white/10 font-sans">
                  {activeTemplate.scenario_text}
                </p>
              </div>

              {/* Material Facts Dossier */}
              <div className="rounded-2xl bg-black/70 backdrop-blur-xl border border-amber-500/30 p-5 space-y-3 shadow-xl">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <FileText className="h-4 w-4 text-amber-400" />
                  <h4 className="text-xs font-mono uppercase tracking-wider text-amber-300 font-bold">
                    Material Facts & Case Record:
                  </h4>
                </div>
                <div className="space-y-2">
                  {activeTemplate.facts.map((fact, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-neutral-200 flex items-start gap-2.5 leading-relaxed"
                    >
                      <span className="h-5 w-5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <p>{fact}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Statutory Anchor Checklist */}
              <div className="rounded-2xl bg-black/70 backdrop-blur-xl border border-amber-500/30 p-5 space-y-3 shadow-xl">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <Scale className="h-4 w-4 text-amber-400" />
                  <h4 className="text-xs font-mono uppercase tracking-wider text-amber-300 font-bold">
                    Key Legal Provisions & Precedents:
                  </h4>
                </div>
                <div className="space-y-2">
                  {activeTemplate.key_statutory_points.map((pt, i) => (
                    <div
                      key={i}
                      className="text-xs font-mono text-neutral-200 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-start gap-2"
                    >
                      <span className="text-amber-400 font-bold">•</span>
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Courtroom Prompts */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1f1008] to-[#120804] border border-amber-500/30 space-y-2">
                <span className="text-[10px] font-mono text-amber-400 uppercase font-bold block">
                  Quick Submissions:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isSubmittingTurn}
                    onClick={() =>
                      handleSendArgument(
                        "Hon'ble Bench, under Satender Kumar Antil v. CBI, this matter falls strictly within Category A. Recovery of the property is already effected and the accused has clean police antecedents."
                      )
                    }
                    className="apple-glass-pill px-3 py-1.5 text-[11px] text-amber-300 hover:text-white border-amber-500/30 cursor-pointer disabled:opacity-40"
                  >
                    Cite Satender Antil & Category A
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingTurn}
                    onClick={() =>
                      handleSendArgument(
                        "The accused is an indigent first-time offender entitled to statutory release under Section 479(1) Proviso of BNSS, 2023 having undergone requisite detention."
                      )
                    }
                    className="apple-glass-pill px-3 py-1.5 text-[11px] text-amber-300 hover:text-white border-amber-500/30 cursor-pointer disabled:opacity-40"
                  >
                    Argue Section 479 BNSS Undertrial Release
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingTurn}
                    onClick={() =>
                      handleSendArgument(
                        "I object to the admissibility of the electronic printouts under Section 63 BSA, 2023. The investigating agency failed to produce a valid certificate."
                      )
                    }
                    className="apple-glass-pill px-3 py-1.5 text-[11px] text-amber-300 hover:text-white border-amber-500/30 cursor-pointer disabled:opacity-40"
                  >
                    Raise Section 63 BSA Objection
                  </button>
                </div>
              </div>
            </div>

            {/* Right: The Live Courtroom Bar & Transcript (7 cols) */}
            <div className="lg:col-span-7 rounded-3xl bg-gradient-to-b from-[#180e07] via-[#0f0905] to-[#080402] border-2 border-amber-500/40 p-5 flex flex-col h-[700px] shadow-2xl relative overflow-hidden">
              {/* Transcript Banner */}
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">
                    Official Courtroom Transcript & Proceedings
                  </span>
                </div>
                <span className="text-[11px] font-mono text-neutral-400">
                  {turns.length} submissions recorded
                </span>
              </div>

              {/* Dialogue Transcript Stream */}
              <div ref={transcriptContainerRef} className="flex-1 overflow-y-auto space-y-4 pr-2">
                {turns.map((t, i) => {
                  const isAdvocate = t.sender === "advocate";
                  const isJudge = t.sender === "judge";
                  const isProsecutor = t.sender === "prosecutor";

                  return (
                    <div
                      key={i}
                      className={`flex flex-col ${
                        isAdvocate ? "items-end" : "items-start"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1 px-1">
                        {isJudge && <PixelJudgeAvatar isGavelStriking={isGavelStriking} />}
                        {isProsecutor && <PixelOppositionAvatar isObjecting={true} />}
                        {isAdvocate && <PixelDefenseAvatar />}
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                            isJudge
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : isProsecutor
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                              : "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                          }`}
                        >
                          {t.roleTitle}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400">
                          {t.name}
                        </span>
                        <span className="text-[9px] font-mono text-neutral-500 ml-auto">
                          {t.timestamp}
                        </span>
                      </div>

                      <div
                        className={`max-w-[90%] p-4 rounded-2xl text-xs md:text-sm leading-relaxed shadow-lg ${
                          isAdvocate
                            ? "bg-gradient-to-r from-purple-950/70 to-purple-900/60 border border-purple-500/50 text-white rounded-tr-none font-sans"
                            : isProsecutor
                            ? "bg-gradient-to-r from-rose-950/60 to-red-900/50 border border-rose-500/40 text-rose-100 rounded-tl-none font-sans"
                            : "bg-gradient-to-r from-[#2c170d] to-[#1c0f08] border border-amber-500/50 text-amber-50 rounded-tl-none font-serif shadow-amber-950/40"
                        }`}
                      >
                        {t.text}
                      </div>
                    </div>
                  );
                })}
                {isSubmittingTurn && (
                  <div className="flex items-center gap-2 text-xs font-mono text-amber-300 pt-2 p-3 bg-black/40 rounded-xl border border-amber-500/30 animate-pulse">
                    <Gavel className="h-4 w-4 animate-spin text-amber-400" />
                    <span>The Bench is deliberating upon counsel's submission...</span>
                  </div>
                )}
              </div>

              {/* Transcript Recording Footer */}
              <div className="mt-4 pt-3 border-t border-amber-500/20 flex flex-wrap items-center justify-between text-[11px] font-mono text-neutral-400 gap-2">
                <span className="flex items-center gap-1.5 text-amber-300">
                  <Mic className="h-3.5 w-3.5 text-amber-400" />
                  <span>Submissions are entered via the Courtroom Podium above</span>
                </span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Official Shorthand Log</span>
                </span>
              </div>
            </div>
          </div>

          {/* Evaluation Result Sheet */}
          {evaluationResult && (
            <div className="rounded-3xl bg-gradient-to-br from-[#24130b] via-[#170c07] to-[#0a0502] border-2 border-amber-500/60 p-6 md:p-8 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-amber-500/30 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-300 font-bold text-xl font-mono shadow-[0_0_15px_rgba(212,175,55,0.4)]">
                    {evaluationResult.score}%
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white font-serif">Judicial Bench Performance Evaluation</h3>
                    <p className="text-xs text-amber-300/80 font-mono">Assessed by Hon'ble Presiding Judge</p>
                  </div>
                </div>
                <button
                  onClick={() => setEvaluationResult(null)}
                  className="text-xs font-mono text-neutral-400 hover:text-white"
                >
                  Close ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {Object.entries(evaluationResult.breakdown).map(([k, v], i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-black/60 border border-amber-500/30 text-xs">
                    <span className="text-neutral-300 block font-medium">{k}</span>
                    <span className="text-base font-bold text-amber-300 font-mono mt-1 block">{v} / 30 pts</span>
                  </div>
                ))}
              </div>

              <div className="p-5 rounded-2xl bg-black/60 border border-amber-500/30 text-xs md:text-sm text-neutral-200 leading-relaxed font-sans space-y-1.5">
                <span className="text-[10px] uppercase font-mono text-amber-400 font-bold block">
                  Judicial Feedback & Coaching Ratio:
                </span>
                <p>{evaluationResult.feedback}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════════
           COURTROOM TRIAL CATALOG VIEW
           ══════════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          {/* Adjourned Trial Recovery Card */}
          {adjournedSession && (
            <div className="rounded-3xl bg-gradient-to-r from-[#2c1808] via-[#1a0e05] to-[#100702] border-2 border-amber-400 p-5 md:p-6 shadow-[0_12px_35px_rgba(245,158,11,0.25)] flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative overflow-hidden">
              <div className="space-y-2 max-w-xl z-10">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/25 text-amber-200 border border-amber-400/50 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-amber-300" />
                    <span>Adjourned Court Proceedings</span>
                  </span>
                  <span className="text-xs font-mono text-neutral-400">
                    Saved {new Date(adjournedSession.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <h3 className="font-serif text-lg md:text-xl font-bold text-white">
                  {adjournedSession.template.title}
                </h3>
                <p className="text-xs text-neutral-300 leading-relaxed font-sans">
                  You adjourned this session with <strong>{adjournedSession.turns.length} courtroom statements</strong> recorded. You can take your time and resume hearing arguments from where you left off at your convenience.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0 z-10">
                <button
                  type="button"
                  onClick={handleResumeAdjournedTrial}
                  className="bg-amber-400 hover:bg-amber-300 text-black px-5 py-2.5 rounded-full text-xs font-extrabold flex items-center gap-2 shadow-lg transition-transform hover:scale-105 cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5 fill-black" />
                  <span>Resume Trial</span>
                </button>
                <button
                  type="button"
                  onClick={handleDiscardAdjournedSession}
                  className="apple-glass-pill px-3.5 py-2 text-xs text-rose-300 hover:text-white border-rose-500/40 hover:bg-rose-950/40 cursor-pointer transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          {/* Retro Pixel Courtroom Banner Preview */}
          <div className="rounded-3xl bg-gradient-to-r from-[#211107] via-[#140a04] to-[#0d0502] border-2 border-amber-500/40 p-5 md:p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
            <div className="space-y-2 max-w-xl z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-[10px] font-mono text-amber-300 uppercase font-bold">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>16-Bit Interactive Courtroom</span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold font-serif text-white">
                Step to the Bar: Argue, Object & Persuade the Court
              </h2>
              <p className="text-xs text-neutral-300 leading-relaxed font-sans">
                Experience an interactive virtual courtroom featuring an animated <strong>Pixel Judge</strong> on the elevated Dais, sharp <strong>Opposing State Prosecutor</strong> contesting your grounds, and a live <strong>Courtroom Spectator Gallery</strong> following every statutory citation.
              </p>
            </div>

            <div className="flex items-end gap-3 z-10 shrink-0 bg-black/60 p-3 px-5 rounded-2xl border border-amber-500/30 shadow-inner">
              <div className="text-center">
                <PixelDefenseAvatar />
                <span className="text-[9px] font-mono text-purple-300 block mt-1">Defense</span>
              </div>
              <div className="text-center scale-125 mx-2">
                <PixelJudgeAvatar />
                <span className="text-[9px] font-mono text-amber-300 block mt-1">Judge</span>
              </div>
              <div className="text-center">
                <PixelOppositionAvatar isObjecting={true} />
                <span className="text-[9px] font-mono text-rose-300 block mt-1">Opposition</span>
              </div>
            </div>
          </div>

          {/* Difficulty Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            {["all", "Beginner", "Intermediate", "Advanced"].map((diff) => (
              <button
                key={diff}
                onClick={() => setSelectedDifficulty(diff)}
                className={`px-4 py-2 rounded-full font-medium transition-all cursor-pointer ${
                  selectedDifficulty === diff
                    ? "bg-amber-400 text-black font-bold shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                    : "apple-glass-pill text-neutral-300 hover:text-white border-amber-500/20 bg-black/60"
                }`}
              >
                {diff === "all" ? "All Difficulty Benches" : `${diff} Level`}
              </button>
            ))}
          </div>

          {/* Courtroom Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {templates
              .filter(
                (t) =>
                  selectedDifficulty === "all" ||
                  t.difficulty.toLowerCase() === selectedDifficulty.toLowerCase()
              )
              .map((template) => (
                <div
                  key={template.id}
                  className="rounded-3xl bg-gradient-to-br from-[#24130b] via-[#150b06] to-[#0a0502] border-2 border-amber-500/40 hover:border-amber-400 p-6 flex flex-col justify-between space-y-4 transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.85)] hover:shadow-[0_15px_35px_rgba(245,158,11,0.2)] hover:-translate-y-1"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {template.category}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/60 text-neutral-300 border border-white/10">
                        {template.difficulty}
                      </span>
                    </div>

                    <h3 className="font-serif text-base font-bold text-white leading-snug">
                      {template.title}
                    </h3>

                    <p className="text-xs text-neutral-300 line-clamp-3 leading-relaxed font-sans">
                      {template.scenario_text}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-neutral-400 truncate max-w-[140px]">
                      {template.court.split(",")[0]}
                    </span>
                    <button
                      onClick={() => handleStartSimulation(template)}
                      className="bg-amber-400 hover:bg-amber-300 text-black px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-transform hover:scale-105"
                    >
                      <Play className="h-3 w-3 fill-black" />
                      <span>Enter Court</span>
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
