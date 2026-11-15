import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  GraduationCap,
  Sparkles,
  BookOpen,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Award,
  Layers,
  Search,
  Scale,
  Landmark,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  Flame,
  Timer,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Gavel,
  BookMarked,
  ShieldCheck,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  MCQQuestion,
  DailyQuestion,
  JudgmentOfTheDay,
  fetchStudyMCQs,
  fetchDailyLegalQuestion,
  fetchJudgmentOfTheDay,
  fetchSectionDetail,
} from "@/lib/student-legal-library";

export const Route = createFileRoute("/_authenticated/student/study")({
  head: () => ({
    meta: [
      { title: "Study Centre — TRANA Student" },
      {
        name: "description",
        content:
          "Academic learning hub with timed MCQ practice quizzes, Bare Act explainers, exam revision guides, and daily legal problems.",
      },
    ],
  }),
  component: StudentStudyPage,
});

type StudyTab = "mcq" | "explainer" | "examprep" | "daily_question" | "judgment_of_day";

const QUICK_EXPLAINER_PROVISIONS = [
  { act: "BNS", sec: "103", label: "BNS 103: Murder & Mob Lynching" },
  { act: "BNS", sec: "303", label: "BNS 303: Theft & Community Service" },
  { act: "BNS", sec: "318", label: "BNS 318: Cheating & Inducing Delivery" },
  { act: "BNS", sec: "152", label: "BNS 152: Acts Endangering Sovereignty" },
  { act: "BNSS", sec: "35", label: "BNSS 35: Mandatory Notice of Arrest" },
  { act: "BNSS", sec: "173", label: "BNSS 173: Zero FIR Registration" },
  { act: "BNSS", sec: "479", label: "BNSS 479: Undertrial Bail Rights" },
  { act: "BSA", sec: "63", label: "BSA 63: Electronic Record Certificate" },
  { act: "NDPS", sec: "37", label: "NDPS 37: Twin Conditions of Bail" },
  { act: "POCSO", sec: "4", label: "POCSO 4: Penetrative Sexual Assault" },
];

function StudentStudyPage() {
  const [activeTab, setActiveTab] = useState<StudyTab>("mcq");

  // MCQ State
  const [allMcqs, setAllMcqs] = useState<MCQQuestion[]>([]);
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string>("all");
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);

  // Timer Mode State (60s countdown)
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Daily Question & Judgment of the Day
  const [dailyQ, setDailyQ] = useState<DailyQuestion | null>(null);
  const [dailySelectedOption, setDailySelectedOption] = useState<number | null>(null);
  const [dailySubmitted, setDailySubmitted] = useState(false);
  const [jotd, setJotd] = useState<JudgmentOfTheDay | null>(null);

  // Bare Act Explainer State
  const [explainerAct, setExplainerAct] = useState("BNS");
  const [explainerSection, setExplainerSection] = useState("303");
  const [explainerResult, setExplainerResult] = useState<any>(null);
  const [loadingExplainer, setLoadingExplainer] = useState(false);

  // Expanded Revision Guide Index
  const [expandedGuide, setExpandedGuide] = useState<number | null>(0);

  // Load initial datasets
  useEffect(() => {
    async function loadData() {
      const qList = await fetchStudyMCQs();
      setAllMcqs(qList);
      const dq = await fetchDailyLegalQuestion();
      setDailyQ(dq);
      const j = await fetchJudgmentOfTheDay();
      setJotd(j);

      // Pre-load default explainer
      try {
        const defaultDetail = await fetchSectionDetail("BNS", "303");
        setExplainerResult(defaultDetail);
      } catch {}
    }
    loadData();
  }, []);

  // Filtered MCQs based on selected topic filter
  const filteredMcqs = useMemo(() => {
    if (selectedTopicFilter === "all") return allMcqs;
    return allMcqs.filter((m) =>
      m.act.toUpperCase().includes(selectedTopicFilter.toUpperCase())
    );
  }, [allMcqs, selectedTopicFilter]);

  const currentMcq = filteredMcqs[currentMcqIndex];

  // Timer logic
  useEffect(() => {
    if (!timerEnabled || isAnswerSubmitted || quizCompleted) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setTimeLeft(60);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleAutoSubmitOnTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentMcqIndex, timerEnabled, isAnswerSubmitted, quizCompleted]);

  function handleAutoSubmitOnTimeout() {
    setIsAnswerSubmitted(true);
    setStreak(0);
    toast.error("Time expired! Answer submitted automatically.");
  }

  async function handleSearchExplainer(e?: React.FormEvent, customAct?: string, customSec?: string) {
    if (e) e.preventDefault();
    const actToUse = customAct || explainerAct;
    const secToUse = (customSec || explainerSection).trim();
    if (!secToUse) return;

    setLoadingExplainer(true);
    try {
      const detail = await fetchSectionDetail(actToUse, secToUse);
      setExplainerResult(detail);
      setExplainerAct(actToUse);
      setExplainerSection(secToUse);
    } finally {
      setLoadingExplainer(false);
    }
  }

  function handleOptionSelect(idx: number) {
    if (isAnswerSubmitted) return;
    setSelectedOption(idx);
  }

  function handleSubmitAnswer() {
    if (selectedOption === null || isAnswerSubmitted) return;
    setIsAnswerSubmitted(true);
    const curr = filteredMcqs[currentMcqIndex];
    if (curr && selectedOption === curr.correct_index) {
      setScore((prev) => prev + 1);
      setStreak((prev) => prev + 1);
      toast.success("Correct answer! Statutory explanation displayed.");
    } else {
      setStreak(0);
      toast.error("Incorrect choice. Review statutory ratio below.");
    }
  }

  function handleNextQuestion() {
    if (currentMcqIndex < filteredMcqs.length - 1) {
      setCurrentMcqIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswerSubmitted(false);
    } else {
      setQuizCompleted(true);
      toast.success("Quiz completed! Review your score summary below.");
    }
  }

  function handleResetQuiz() {
    setCurrentMcqIndex(0);
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setScore(0);
    setStreak(0);
    setQuizCompleted(false);
    setTimeLeft(60);
  }

  function handleTopicFilterChange(topic: string) {
    setSelectedTopicFilter(topic);
    setCurrentMcqIndex(0);
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setScore(0);
    setStreak(0);
    setQuizCompleted(false);
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <GraduationCap className="h-4 w-4" />
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-semibold text-white tracking-wide">
              Study Centre
            </h1>
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider font-semibold">
              Academic Hub
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
            Prepare for semester examinations, judicial services competitive exams, and moot courts with timed MCQ practice, Bare Act conceptual explainers, daily legal challenges, and structured revision guides.
          </p>
        </div>

        <Link
          to="/student/library"
          className="apple-glass-pill px-3.5 py-2 text-xs text-neutral-200 hover:text-white flex items-center gap-2 self-start sm:self-auto shrink-0 shadow-lg"
        >
          <BookOpen className="h-3.5 w-3.5 text-purple-400" />
          <span>Browse Criminal Library</span>
        </Link>
      </div>

      {/* 5 Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-white/10 overflow-x-auto pb-1 text-xs">
        {[
          { id: "mcq", label: "MCQ Practice Quiz", icon: CheckCircle2 },
          { id: "explainer", label: "Bare Act Explainer", icon: Sparkles },
          { id: "daily_question", label: "Daily Legal Problem", icon: Clock },
          { id: "judgment_of_day", label: "Judgment of the Day", icon: Landmark },
          { id: "examprep", label: "Exam Revision Guides", icon: Layers },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as StudyTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-2xl font-medium transition-all whitespace-nowrap cursor-pointer ${
                active
                  ? "text-purple-100 border-b-2 border-purple-400 bg-purple-950/30 font-semibold shadow-[0_0_18px_rgba(168,85,247,0.2)]"
                  : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${active ? "text-purple-300" : "text-neutral-400"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* Tab 1: MCQ Practice Quiz */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "mcq" && (
        <div className="space-y-4 max-w-4xl mx-auto">
          {/* Top Controls: Filter Pills & Timer Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 apple-glass-card p-4 rounded-2xl border-white/10">
            {/* Topic Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              {[
                { id: "all", label: "All Laws" },
                { id: "BNS", label: "BNS 2023" },
                { id: "BNSS", label: "BNSS 2023" },
                { id: "BSA", label: "BSA 2023" },
                { id: "POCSO", label: "POCSO" },
                { id: "NDPS", label: "NDPS" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => handleTopicFilterChange(pill.id)}
                  className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all cursor-pointer ${
                    selectedTopicFilter === pill.id
                      ? "bg-purple-600/40 text-purple-200 border border-purple-500/50 shadow-sm"
                      : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Right: Timer Mode Toggle & Reset */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setTimerEnabled((prev) => !prev)}
                className={`apple-glass-pill px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer transition-all ${
                  timerEnabled
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                    : "text-neutral-400 hover:text-white"
                }`}
                title="Toggle 60-second exam countdown timer"
              >
                <Timer className="h-3.5 w-3.5" />
                <span>{timerEnabled ? `Exam Timer: ${timeLeft}s` : "Enable Timer (60s)"}</span>
              </button>

              <button
                onClick={handleResetQuiz}
                className="apple-glass-pill px-3 py-1.5 text-xs text-neutral-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
                title="Restart Quiz"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Quiz Container */}
          <div className="apple-glass-card border-white/15 p-6 md:p-8 space-y-6 shadow-2xl relative">
            {/* Timer Progress Bar (When Enabled) */}
            {timerEnabled && !isAnswerSubmitted && !quizCompleted && (
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ${
                    timeLeft > 30
                      ? "bg-emerald-400"
                      : timeLeft > 10
                      ? "bg-amber-400"
                      : "bg-rose-500 animate-pulse"
                  }`}
                  style={{ width: `${(timeLeft / 60) * 100}%` }}
                />
              </div>
            )}

            {/* Score & Streak Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                  {currentMcq ? currentMcq.act : "All Criminal Acts"}
                </span>
                <span className="text-xs text-neutral-400 font-mono hidden sm:inline">
                  Topic: {currentMcq?.topic}
                </span>
              </div>

              <div className="flex items-center gap-4">
                {streak > 1 && (
                  <div className="flex items-center gap-1 text-xs font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    <Flame className="h-3.5 w-3.5 fill-amber-400" />
                    <span>{streak} Streak</span>
                  </div>
                )}
                <span className="text-xs font-mono text-purple-300 font-bold">
                  Score: {score} / {filteredMcqs.length}
                </span>
              </div>
            </div>

            {/* Main Quiz Flow */}
            {quizCompleted ? (
              /* Quiz Completion Summary Card */
              <div className="text-center py-10 space-y-5">
                <div className="h-16 w-16 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 mx-auto">
                  <Award className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-white font-display">
                    MCQ Practice Session Complete!
                  </h2>
                  <p className="text-xs text-neutral-400">
                    You answered {score} out of {filteredMcqs.length} questions correctly (
                    {Math.round((score / (filteredMcqs.length || 1)) * 100)}% accuracy).
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    onClick={handleResetQuiz}
                    className="bg-white text-black hover:bg-neutral-200 px-6 py-2.5 rounded-full text-xs font-semibold cursor-pointer shadow-md flex items-center gap-2"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Retake Quiz</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("examprep")}
                    className="apple-glass-pill px-5 py-2.5 text-xs text-purple-300 hover:text-white flex items-center gap-2 cursor-pointer"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>Review Exam Cheat-Sheets</span>
                  </button>
                </div>
              </div>
            ) : currentMcq ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between text-xs font-mono text-neutral-500">
                  <span>
                    Question {currentMcqIndex + 1} of {filteredMcqs.length}
                  </span>
                  <span className="text-neutral-400">Single Choice Correct</span>
                </div>

                {/* Question Text */}
                <h2 className="text-base md:text-lg font-medium text-white leading-relaxed font-sans">
                  {currentMcq.question}
                </h2>

                {/* Option Choices */}
                <div className="space-y-3">
                  {currentMcq.options.map((opt, i) => {
                    const isSelected = selectedOption === i;
                    const isCorrect = isAnswerSubmitted && i === currentMcq.correct_index;
                    const isWrong = isAnswerSubmitted && isSelected && i !== currentMcq.correct_index;

                    return (
                      <div
                        key={i}
                        onClick={() => handleOptionSelect(i)}
                        className={`p-4 rounded-2xl border text-xs md:text-sm transition-all flex items-start gap-3.5 cursor-pointer ${
                          isCorrect
                            ? "bg-gradient-to-r from-emerald-950/70 via-emerald-900/40 to-teal-950/60 border-emerald-400/80 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                            : isWrong
                            ? "bg-gradient-to-r from-rose-950/70 via-rose-900/40 to-red-950/60 border-rose-400/80 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.25)]"
                            : isSelected
                            ? "bg-gradient-to-r from-purple-950/70 via-purple-900/40 to-indigo-950/60 border-purple-400/80 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)]"
                            : "bg-white/[0.03] hover:bg-white/[0.07] border-white/10 hover:border-purple-400/40 text-neutral-200"
                        }`}
                      >
                        <span className="h-6 w-6 rounded-full border border-current flex items-center justify-center text-xs font-mono shrink-0 mt-0.5 font-bold">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="leading-relaxed flex-1">{opt}</span>
                        {isCorrect && (
                          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 self-center" />
                        )}
                        {isWrong && (
                          <XCircle className="h-5 w-5 text-rose-400 shrink-0 self-center" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Statutory Ratio & In-Depth Analysis on Submission */}
                {isAnswerSubmitted && (
                  <div className="p-5 rounded-2xl bg-purple-950/25 border border-purple-500/40 space-y-3 shadow-inner">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-purple-500/20 pb-2">
                      <span className="text-xs uppercase font-mono tracking-wider text-purple-300 font-bold flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4" />
                        <span>Statutory Ratio & Judicial Authority</span>
                      </span>
                      <span className="text-xs font-mono text-amber-300 font-bold">
                        {currentMcq.reference_section}
                      </span>
                    </div>

                    <p
                      className="text-xs md:text-sm text-neutral-100 leading-relaxed font-['Times_New_Roman',_Times,_serif]"
                      style={{ fontFamily: "'Times New Roman', Times, serif" }}
                    >
                      {currentMcq.explanation}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-2 flex items-center justify-between">
                  <div className="text-xs font-mono text-neutral-500">
                    {!isAnswerSubmitted && "Select an option and click Submit"}
                  </div>

                  <div>
                    {!isAnswerSubmitted ? (
                      <button
                        onClick={handleSubmitAnswer}
                        disabled={selectedOption === null}
                        className="bg-white text-black hover:bg-neutral-200 disabled:opacity-40 px-6 py-2.5 rounded-full text-xs font-semibold cursor-pointer shadow-md transition-all"
                      >
                        Submit Answer
                      </button>
                    ) : (
                      <button
                        onClick={handleNextQuestion}
                        className="bg-purple-600 text-white hover:bg-purple-500 px-6 py-2.5 rounded-full text-xs font-semibold cursor-pointer shadow-md flex items-center gap-1.5 transition-all"
                      >
                        <span>
                          {currentMcqIndex < filteredMcqs.length - 1
                            ? "Next Question"
                            : "Complete Quiz"}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-xs text-neutral-400 space-y-2">
                <p>No questions found for the selected topic filter.</p>
                <button
                  onClick={() => handleTopicFilterChange("all")}
                  className="apple-glass-pill px-3 py-1 text-xs text-purple-300"
                >
                  Show All Questions
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* Tab 2: Bare Act Explainer */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "explainer" && (
        <div className="apple-glass-card border-white/15 p-6 md:p-8 space-y-6 max-w-4xl mx-auto shadow-2xl">
          <div>
            <h2 className="text-base font-semibold text-white">
              Bare Act Conceptual & Statutory Explainer
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Select or search any statutory provision from BNS, BNSS, BSA, or Special Acts to view its essential ingredients (Actus Reus & Mens Rea), plain-language interpretation, and courtroom application.
            </p>
          </div>

          {/* Quick-Pick Provision Chips */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-purple-400" />
              <span>Quick-Jump Essential Provisions:</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {QUICK_EXPLAINER_PROVISIONS.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSearchExplainer(undefined, item.act, item.sec)}
                  className={`apple-glass-pill px-3 py-1 text-xs transition-all cursor-pointer ${
                    explainerAct === item.act && explainerSection === item.sec
                      ? "bg-purple-500/30 border-purple-400 text-white"
                      : "text-neutral-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Search Form */}
          <form
            onSubmit={(e) => handleSearchExplainer(e)}
            className="flex flex-col sm:flex-row gap-3 pt-2"
          >
            <select
              value={explainerAct}
              onChange={(e) => setExplainerAct(e.target.value)}
              className="apple-glass-input px-3.5 py-2.5 text-xs text-white bg-[#121118] border-white/15 rounded-xl"
            >
              <option value="BNS">BNS 2023 (Penal Code)</option>
              <option value="BNSS">BNSS 2023 (Procedure & Bail)</option>
              <option value="BSA">BSA 2023 (Evidence)</option>
              <option value="POCSO">POCSO Act 2012</option>
              <option value="NDPS">NDPS Act 1985</option>
              <option value="PMLA">PMLA 2002</option>
            </select>

            <input
              type="text"
              placeholder="Section number (e.g. 103, 303, 35, 479, 63, 37)..."
              value={explainerSection}
              onChange={(e) => setExplainerSection(e.target.value)}
              className="flex-1 apple-glass-input px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 rounded-xl font-mono border-white/15"
            />

            <button
              type="submit"
              disabled={loadingExplainer}
              className="bg-white text-black hover:bg-neutral-200 px-6 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-md shrink-0 transition-all"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{loadingExplainer ? "Analyzing..." : "Explain Section"}</span>
            </button>
          </form>

          {/* Explainer Analysis Output */}
          {explainerResult && (
            <div className="space-y-5 pt-4 border-t border-white/10">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold uppercase">
                    {explainerResult.act_code} Provision Analysis
                  </span>
                  <h3
                    className="text-base md:text-lg font-bold text-white mt-1 font-['Times_New_Roman',_Times,_serif]"
                    style={{ fontFamily: "'Times New Roman', Times, serif" }}
                  >
                    Section {explainerResult.section_number}: {explainerResult.heading}
                  </h3>
                </div>

                <Link
                  to="/student/library"
                  search={{
                    act: explainerResult.act_code.toLowerCase().includes("bnss")
                      ? "bnss-2023"
                      : explainerResult.act_code.toLowerCase().includes("bsa")
                      ? "bsa-2023"
                      : "bns-2023",
                    section: explainerResult.section_number,
                  }}
                  className="apple-glass-pill px-3 py-1.5 text-xs text-purple-300 hover:text-white flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                >
                  <span>Open in Full Bare Act Library</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              {/* Official Gazette Text Box */}
              {explainerResult.bare_act_text && (
                <div className="p-5 rounded-2xl bg-[#090710] border border-purple-500/20 space-y-2 shadow-inner">
                  <span className="text-[10px] uppercase font-mono text-purple-300/80 font-bold block">
                    Bare Act Statutory Text (Gazette of India):
                  </span>
                  <p
                    className="text-xs md:text-sm text-neutral-100 leading-relaxed font-['Times_New_Roman',_Times,_serif]"
                    style={{ fontFamily: "'Times New Roman', Times, serif" }}
                  >
                    {explainerResult.bare_act_text}
                  </p>
                </div>
              )}

              {/* Plain Language Interpretation */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/40 via-purple-900/20 to-indigo-950/30 border border-purple-500/40 text-xs md:text-sm text-purple-100 leading-relaxed space-y-2 shadow-sm">
                <span className="text-[10px] uppercase font-mono text-purple-300 font-bold block tracking-wider">
                  Plain Language Conceptual Breakdown:
                </span>
                <p>{explainerResult.simple_explanation}</p>
              </div>

              {/* Essential Ingredients Breakdown */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <span className="text-[10px] uppercase font-mono text-amber-300 font-bold block tracking-wider">
                  Essential Ingredients Required to Establish Offence / Procedure:
                </span>
                <div className="space-y-2.5">
                  {explainerResult.ingredients.map((ing: string, i: number) => (
                    <div key={i} className="text-xs text-neutral-200 flex items-start gap-2.5">
                      <span className="h-5 w-5 rounded-full bg-purple-500/25 border border-purple-400/50 text-purple-200 flex items-center justify-center text-[10px] font-mono shrink-0 mt-0.5 font-bold shadow-[0_0_8px_rgba(168,85,247,0.3)]">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{ing}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Punishment & Courtroom Consequences */}
              {explainerResult.punishment && (
                <div className="p-4 rounded-2xl bg-amber-950/25 border border-amber-500/30 flex items-start gap-3 text-amber-100">
                  <Gavel className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono text-amber-300 font-bold block tracking-wider">
                      Prescribed Punishment & Courtroom Ramifications:
                    </span>
                    <p className="text-xs text-neutral-200">{explainerResult.punishment}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* Tab 3: Daily Legal Problem */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "daily_question" && dailyQ && (
        <div className="apple-glass-card border-white/15 p-6 md:p-8 space-y-6 max-w-4xl mx-auto shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-400" />
              <span className="text-xs font-mono uppercase tracking-wider text-purple-300 font-bold">
                Daily Moot Court & Bar Examination Problem • {dailyQ.date}
              </span>
            </div>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-white/10 text-neutral-300">
              {dailyQ.topic}
            </span>
          </div>

          {/* Scenario Text Formatted as Law School Factum */}
          <div
            className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 text-base md:text-lg text-amber-50 leading-relaxed font-['Times_New_Roman',_Times,_serif] shadow-inner"
            style={{ fontFamily: "'Times New Roman', Times, serif" }}
          >
            {dailyQ.scenario}
          </div>

          {/* Options */}
          <div className="space-y-3">
            {dailyQ.options.map((opt, i) => {
              const isSelected = dailySelectedOption === i;
              const isCorrect = dailySubmitted && i === dailyQ.correct_index;
              const isWrong = dailySubmitted && isSelected && i !== dailyQ.correct_index;

              return (
                <div
                  key={i}
                  onClick={() => !dailySubmitted && setDailySelectedOption(i)}
                  className={`p-4 rounded-2xl border text-xs md:text-sm transition-all flex items-start gap-3.5 cursor-pointer ${
                    isCorrect
                      ? "bg-emerald-950/40 border-emerald-500/60 text-emerald-200"
                      : isWrong
                      ? "bg-rose-950/40 border-rose-500/60 text-rose-200"
                      : isSelected
                      ? "bg-purple-950/40 border-purple-400 text-white"
                      : "bg-white/[0.03] border-white/10 text-neutral-300 hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="h-6 w-6 rounded-full border border-current flex items-center justify-center text-xs font-mono shrink-0 mt-0.5 font-bold">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="leading-relaxed flex-1">{opt}</span>
                </div>
              );
            })}
          </div>

          {/* Statutory Ratio upon Submission */}
          {dailySubmitted && (
            <div className="p-5 rounded-2xl bg-purple-950/25 border border-purple-500/40 text-xs md:text-sm text-neutral-100 leading-relaxed space-y-2 shadow-inner">
              <span className="text-[10px] uppercase font-mono text-purple-300 font-bold block">
                Statutory Ratio & Judicial Principle ({dailyQ.applicable_section}):
              </span>
              <p
                className="font-['Times_New_Roman',_Times,_serif]"
                style={{ fontFamily: "'Times New Roman', Times, serif" }}
              >
                {dailyQ.explanation}
              </p>
            </div>
          )}

          {!dailySubmitted && (
            <button
              onClick={() => {
                if (dailySelectedOption !== null) setDailySubmitted(true);
              }}
              disabled={dailySelectedOption === null}
              className="bg-white text-black hover:bg-neutral-200 disabled:opacity-40 px-6 py-2.5 rounded-full text-xs font-semibold cursor-pointer shadow-md transition-all"
            >
              Verify Legal Answer
            </button>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* Tab 4: Judgment of the Day */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "judgment_of_day" && jotd && (
        <div className="apple-glass-card border-white/15 p-6 md:p-8 space-y-6 max-w-4xl mx-auto shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-purple-400" />
              <span className="text-xs font-mono uppercase tracking-wider text-purple-300 font-bold">
                Supreme Court Landmark Precedent of the Day
              </span>
            </div>
            <span className="text-xs font-mono text-amber-300 font-bold">{jotd.citation}</span>
          </div>

          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white font-serif">{jotd.case_name}</h2>
            <p className="text-xs font-mono text-neutral-400 mt-1">{jotd.bench} • Year: {jotd.date}</p>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2 text-xs md:text-sm text-neutral-200 leading-relaxed font-sans">
            <span className="text-[10px] uppercase font-mono text-neutral-400 font-bold block">
              Case Factual Matrix & Procedural Context:
            </span>
            <p>{jotd.summary}</p>
          </div>

          <div className="p-5 rounded-2xl bg-purple-950/25 border border-purple-500/30 space-y-2 text-xs md:text-sm text-purple-200 leading-relaxed font-sans">
            <span className="text-[10px] uppercase font-mono text-purple-300 font-bold block">
              Legal Principle & Ratio Decidendi:
            </span>
            <p
              className="font-['Times_New_Roman',_Times,_serif] text-neutral-100"
              style={{ fontFamily: "'Times New Roman', Times, serif" }}
            >
              {jotd.legal_significance}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs font-mono text-neutral-400">Linked Statutory Provisions:</span>
            {jotd.linked_sections.map((sec, i) => (
              <span
                key={i}
                className="text-xs font-mono px-2.5 py-1 rounded-md bg-white/10 text-neutral-200 border border-white/15 font-semibold"
              >
                {sec}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* Tab 5: Exam Prep Revision Guides (4 Structured Modules) */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "examprep" && (
        <div className="space-y-4 max-w-5xl mx-auto">
          <div className="apple-glass-card p-6 border-white/10">
            <h2 className="text-base font-semibold text-white">
              Judicial Services & Law School Examination Revision Guides
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              High-yield comparative synthesis covering substantive criminal law shifts, bail procedural safeguards, digital evidence rules, and special legislation twin conditions.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Guide 1: BNS 2023 */}
            <div className="rounded-3xl bg-gradient-to-br from-[#260f3a]/85 via-[#180927]/90 to-[#0e0417]/95 border border-purple-500/40 hover:border-purple-400/80 p-6 space-y-4 shadow-xl transition-all relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-fuchsia-400 to-indigo-500 opacity-80" />
              <div
                className="flex items-start justify-between cursor-pointer"
                onClick={() => setExpandedGuide((prev) => (prev === 0 ? null : 0))}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-purple-500/25 text-purple-200 border border-purple-400/40 font-bold tracking-wider shadow-sm">
                      Revision Module 1 • Substantive Penal Law
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-purple-300">
                    BNS 2023: Substantive Offence Overhaul & Landmark Shifts
                  </h3>
                  <p className="text-xs text-neutral-300 leading-relaxed font-light">
                    Community service as punishment, mob lynching (Sec 103(2)), organised crime (Sec 111), and replacement of colonial sedition (Sec 152).
                  </p>
                </div>
                <button className="h-8 w-8 rounded-full bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 flex items-center justify-center text-purple-200 shrink-0 cursor-pointer">
                  {expandedGuide === 0 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>

              {expandedGuide === 0 && (
                <div className="space-y-4 pt-4 border-t border-purple-500/20 text-xs text-neutral-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
                      <strong className="text-purple-300 block font-mono text-[11px]">
                        1. Community Service (Section 4 & 303(2))
                      </strong>
                      <p className="leading-relaxed text-neutral-300">
                        Introduced as a formal statutory punishment for small, non-violent offences (e.g. theft under ₹5,000 for first-time offenders who restore the property; misconduct in public by a drunken person).
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
                      <strong className="text-purple-300 block font-mono text-[11px]">
                        2. Mob Lynching & Hate Murders (Section 103(2))
                      </strong>
                      <p className="leading-relaxed text-neutral-300">
                        When 5 or more persons acting in concert commit murder on grounds of race, caste, sex, place of birth, or belief, every member faces death or life imprisonment, closing the IPC statutory gap.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
                      <strong className="text-purple-300 block font-mono text-[11px]">
                        3. Organised Crime & Petty Organised Crime (Sec 111 & 112)
                      </strong>
                      <p className="leading-relaxed text-neutral-300">
                        Codifies syndicate kidnapping, extortion, contract killing, and cybercrimes previously handled under state special acts (like MCOCA) into the national substantive penal code.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
                      <strong className="text-purple-300 block font-mono text-[11px]">
                        4. Repeal of Sedition & Act Endangering Sovereignty (Sec 152)
                      </strong>
                      <p className="leading-relaxed text-neutral-300">
                        Colonial offence of Sedition (Sec 124A IPC) repealed. Replaced with narrow offences penalizing acts exciting secession, armed rebellion, or endangering the sovereignty and territorial integrity of India.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] font-mono text-amber-300">
                      Exam Tip: Highlight Section 358 BNS savings clause when answering retrospective questions!
                    </span>
                    <Link
                      to="/student/library"
                      search={{ act: "bns-2023" }}
                      className="apple-glass-pill px-3 py-1.5 text-xs text-purple-300 hover:text-white flex items-center gap-1 bg-purple-500/20 border-purple-400/40"
                    >
                      <span>Study BNS Chapters</span>
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Guide 2: BNSS 2023 */}
            <div className="rounded-3xl bg-gradient-to-br from-[#2a1b0b]/85 via-[#1a1005]/90 to-[#0e0802]/95 border border-amber-500/40 hover:border-amber-400/80 p-6 space-y-4 shadow-xl transition-all relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 opacity-80" />
              <div
                className="flex items-start justify-between cursor-pointer"
                onClick={() => setExpandedGuide((prev) => (prev === 1 ? null : 1))}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-amber-500/25 text-amber-200 border border-amber-400/40 font-bold tracking-wider shadow-sm">
                      Revision Module 2 • Criminal Procedure & Bail
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-amber-300">
                    BNSS 2023: Bail Categories & Undertrial Safeguards
                  </h3>
                  <p className="text-xs text-neutral-300 leading-relaxed font-light">
                    One-third detention rule for first-time undertrials (Sec 479), mandatory notice of appearance (Sec 35), and Zero FIR registration (Sec 173).
                  </p>
                </div>
                <button className="h-8 w-8 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 flex items-center justify-center text-amber-200 shrink-0 cursor-pointer">
                  {expandedGuide === 1 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>

              {expandedGuide === 1 && (
                <div className="space-y-4 pt-4 border-t border-amber-500/20 text-xs text-neutral-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
                      <strong className="text-amber-300 block font-mono text-[11px]">
                        1. First-Time Undertrial Bail (Section 479(1))
                      </strong>
                      <p className="leading-relaxed text-neutral-300">
                        First-time offenders (never previously convicted of any offence) are entitled to mandatory release on bond after undergoing one-third of the maximum sentence, compared to one-half for repeat offenders.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
                      <strong className="text-amber-300 block font-mono text-[11px]">
                        2. Mandatory Notice of Appearance (Section 35(3))
                      </strong>
                      <p className="leading-relaxed text-neutral-300">
                        Police officers cannot arrest without prior recorded reasons for offences punishable with up to 7 years. Mandatory notice of appearance must be served, embedding Arnesh Kumar principles into statute.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
                      <strong className="text-amber-300 block font-mono text-[11px]">
                        3. Zero FIR & Electronic FIR (Section 173)
                      </strong>
                      <p className="leading-relaxed text-neutral-300">
                        Information relating to a cognizable offence can be lodged at any police station irrespective of territorial jurisdiction. e-FIR can be registered electronically and signed within 3 days.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
                      <strong className="text-amber-300 block font-mono text-[11px]">
                        4. Forensic Investigation & Audio-Video Recording (Sec 176(3) & 105)
                      </strong>
                      <p className="leading-relaxed text-neutral-300">
                        Forensic team visit made mandatory for offences punishable with 7 years or more. Search and seizure proceedings must be recorded via mobile phone or audio-video electronic means.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] font-mono text-amber-300">
                      Exam Tip: Section 479 applies retroactively to pending undertrials (Supreme Court SMW 4/2021).
                    </span>
                    <Link
                      to="/student/converters"
                      className="apple-glass-pill px-3 py-1.5 text-xs text-amber-300 hover:text-white flex items-center gap-1 bg-amber-500/20 border-amber-400/40"
                    >
                      <span>CrPC ↔ BNSS Matrix</span>
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Guide 3: BSA 2023 */}
            <div className="rounded-3xl bg-gradient-to-br from-[#0c2448]/85 via-[#071730]/90 to-[#030b18]/95 border border-sky-500/40 hover:border-sky-400/80 p-6 space-y-4 shadow-xl transition-all relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 via-cyan-300 to-blue-500 opacity-80" />
              <div
                className="flex items-start justify-between cursor-pointer"
                onClick={() => setExpandedGuide((prev) => (prev === 2 ? null : 2))}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-sky-500/25 text-sky-200 border border-sky-400/40 font-bold tracking-wider shadow-sm">
                      Revision Module 3 • Evidence Law & Digital Proof
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-sky-300">
                    BSA 2023: Digital Evidence & Electronic Records Admissibility
                  </h3>
                  <p className="text-xs text-neutral-300 leading-relaxed font-light">
                    Mandatory certificate requirements (Sec 63), primary electronic records (Sec 57), and confession rules (Sec 22-24).
                  </p>
                </div>
                <button className="h-8 w-8 rounded-full bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 flex items-center justify-center text-sky-200 shrink-0 cursor-pointer">
                  {expandedGuide === 2 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>

              {expandedGuide === 2 && (
                <div className="space-y-4 pt-4 border-t border-sky-500/20 text-xs text-neutral-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
                      <strong className="text-sky-300 block font-mono text-[11px]">
                        1. Section 63 Certificate (Superseding 65B IEA)
                      </strong>
                      <p className="leading-relaxed text-neutral-300">
                        Secondary electronic records printed on paper or stored on semiconductor memory require a signed certificate verifying device custody and hash authenticity.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
                      <strong className="text-sky-300 block font-mono text-[11px]">
                        2. Electronic Originals as Primary Evidence (Section 57)
                      </strong>
                      <p className="leading-relaxed text-neutral-300">
                        Explanations 4 to 7 establish that video recordings, digital files generated simultaneously, or electronic storage across cloud nodes constitute primary evidence without Section 63 certificate.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
                      <strong className="text-sky-300 block font-mono text-[11px]">
                        3. Police Confessions & Involuntary Statements (Sec 22 & 23)
                      </strong>
                      <p className="leading-relaxed text-neutral-300">
                        Confessions made to a police officer remain inadmissible under Section 23. Only the portion leading to the discovery of a distinct fact under Section 24 can be proved.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
                      <strong className="text-sky-300 block font-mono text-[11px]">
                        4. Burden of Proof & Presumptions (Sec 104 & 118)
                      </strong>
                      <p className="leading-relaxed text-neutral-300">
                        Whoever asserts the existence of facts must prove them. Special statutory presumptions (e.g. dowry death under Section 118) reverse the evidentiary burden once foundation is established.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] font-mono text-amber-300">
                      Exam Tip: Contrast Section 63 BSA certificate with Section 65B Arjun Panditrao Kotkar ratio.
                    </span>
                    <Link
                      to="/student/library"
                      search={{ act: "bsa-2023" }}
                      className="apple-glass-pill px-3 py-1.5 text-xs text-sky-300 hover:text-white flex items-center gap-1 bg-sky-500/20 border-sky-400/40"
                    >
                      <span>Study BSA Sections</span>
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Guide 4: Special Criminal Acts */}
            <div className="rounded-3xl bg-gradient-to-br from-[#092d24]/85 via-[#051e18]/90 to-[#020e0b]/95 border border-emerald-500/40 hover:border-emerald-400/80 p-6 space-y-4 shadow-xl transition-all relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-400 via-emerald-300 to-emerald-500 opacity-80" />
              <div
                className="flex items-start justify-between cursor-pointer"
                onClick={() => setExpandedGuide((prev) => (prev === 3 ? null : 3))}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/25 text-emerald-200 border border-emerald-400/40 font-bold tracking-wider shadow-sm">
                      Revision Module 4 • Special Criminal Legislation
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-emerald-300">
                    Special Criminal Statutes: POCSO, NDPS & PMLA Rapid Matrix
                  </h3>
                  <p className="text-xs text-neutral-300 leading-relaxed font-light">
                    Bail restrictions, statutory twin conditions, reverse burden of proof, and special court procedures.
                  </p>
                </div>
                <button className="h-8 w-8 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0 cursor-pointer">
                  {expandedGuide === 3 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>

              {expandedGuide === 3 && (
                <div className="space-y-4 pt-4 border-t border-emerald-500/20 text-xs text-neutral-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
                      <strong className="text-emerald-300 block font-mono text-[11px]">
                        1. NDPS Act Section 37 (Twin Conditions of Bail)
                      </strong>
                      <p className="leading-relaxed text-neutral-300">
                        In commercial quantity cases, bail can only be granted if the Public Prosecutor is heard and the Court finds reasonable grounds that the accused is not guilty and unlikely to re-offend.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
                      <strong className="text-emerald-300 block font-mono text-[11px]">
                        2. POCSO Act Section 29 & 30 (Statutory Presumptions)
                      </strong>
                      <p className="leading-relaxed text-neutral-300">
                        The Special Court must presume that the accused committed the offence and possessed culpable mental state, placing the burden of rebuttal on the accused beyond reasonable doubt.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
                      <strong className="text-emerald-300 block font-mono text-[11px]">
                        3. PMLA Section 45 (Money Laundering Bail Bar)
                      </strong>
                      <p className="leading-relaxed text-neutral-300">
                        Twin conditions upheld by the Supreme Court in Vijay Madanlal Choudhary. Scheduled offence (predicate offence) must exist for money laundering prosecution to stand.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
                      <strong className="text-emerald-300 block font-mono text-[11px]">
                        4. SC/ST Act Section 18/18A (Anticipatory Bail Bar)
                      </strong>
                      <p className="leading-relaxed text-neutral-300">
                        Section 438 CrPC / 482 BNSS does not apply. However, per Prathvi Raj Chauhan, courts may grant pre-arrest relief if no prima facie case is disclosed in the FIR.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] font-mono text-amber-300">
                      Exam Tip: Check whether the quantity is small, intermediate, or commercial when answering NDPS bail questions.
                    </span>
                    <Link
                      to="/student/library"
                      className="apple-glass-pill px-3 py-1.5 text-xs text-emerald-300 hover:text-white flex items-center gap-1 bg-emerald-500/20 border-emerald-400/40"
                    >
                      <span>Explore Special Acts in Library</span>
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
