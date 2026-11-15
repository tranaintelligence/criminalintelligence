import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
          "Academic learning hub with MCQ practice quizzes, Bare Act explainers, exam revision guides, and daily legal problems.",
      },
    ],
  }),
  component: StudentStudyPage,
});

type StudyTab = "mcq" | "explainer" | "examprep" | "daily_question" | "judgment_of_day";

function StudentStudyPage() {
  const [activeTab, setActiveTab] = useState<StudyTab>("mcq");

  // MCQ State
  const [mcqs, setMcqs] = useState<MCQQuestion[]>([]);
  const [selectedAct, setSelectedAct] = useState<string>("all");
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [score, setScore] = useState(0);

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

  useEffect(() => {
    async function loadData() {
      const qList = await fetchStudyMCQs();
      setMcqs(qList);
      const dq = await fetchDailyLegalQuestion();
      setDailyQ(dq);
      const j = await fetchJudgmentOfTheDay();
      setJotd(j);
    }
    loadData();
  }, []);

  async function handleSearchExplainer(e: React.FormEvent) {
    e.preventDefault();
    if (!explainerSection.trim()) return;
    setLoadingExplainer(true);
    try {
      const detail = await fetchSectionDetail(explainerAct, explainerSection.trim());
      setExplainerResult(detail);
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
    const curr = mcqs[currentMcqIndex];
    if (curr && selectedOption === curr.correct_index) {
      setScore((prev) => prev + 1);
      toast.success("Correct answer! Statutory explanation displayed.");
    } else {
      toast.error("Incorrect. Review the statutory reference.");
    }
  }

  function handleNextQuestion() {
    if (currentMcqIndex < mcqs.length - 1) {
      setCurrentMcqIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswerSubmitted(false);
    } else {
      toast.success(`Quiz completed! Final Score: ${score + (selectedOption === mcqs[currentMcqIndex]?.correct_index ? 1 : 0)} / ${mcqs.length}`);
    }
  }

  function handleResetQuiz() {
    setCurrentMcqIndex(0);
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setScore(0);
  }

  const currentMcq = mcqs[currentMcqIndex];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
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
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
              Academic Hub
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
            Prepare for semester exams, judicial services examinations, and moot court research with topic-wise MCQ practice, statutory explainers, and daily legal challenges.
          </p>
        </div>

        <Link
          to="/student/library"
          className="apple-glass-pill px-3.5 py-1.5 text-xs text-neutral-200 hover:text-white flex items-center gap-2 self-start sm:self-auto"
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
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-medium transition-all whitespace-nowrap cursor-pointer ${
                active
                  ? "text-white border-b-2 border-purple-400 bg-white/[0.06] font-semibold"
                  : "text-neutral-400 hover:text-white hover:bg-white/[0.02]"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${active ? "text-purple-300" : "text-neutral-400"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: MCQ Practice */}
      {activeTab === "mcq" && (
        <div className="apple-glass-card border-white/15 p-6 md:p-8 space-y-6 max-w-4xl mx-auto shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                {currentMcq ? currentMcq.act : "All Criminal Acts"}
              </span>
              <span className="text-xs text-neutral-400 font-mono">
                Topic: {currentMcq?.topic}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-purple-300 font-bold">
                Score: {score} / {mcqs.length}
              </span>
              <button
                onClick={handleResetQuiz}
                className="apple-glass-pill px-2.5 py-1 text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                title="Restart Quiz"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {currentMcq ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-500">
                <span>Question {currentMcqIndex + 1} of {mcqs.length}</span>
                <span className="text-neutral-400">Single Choice Correct</span>
              </div>

              <h2 className="text-base md:text-lg font-medium text-white leading-relaxed font-sans">
                {currentMcq.question}
              </h2>

              <div className="space-y-2.5">
                {currentMcq.options.map((opt, i) => {
                  const isSelected = selectedOption === i;
                  const isCorrect = isAnswerSubmitted && i === currentMcq.correct_index;
                  const isWrong = isAnswerSubmitted && isSelected && i !== currentMcq.correct_index;

                  return (
                    <div
                      key={i}
                      onClick={() => handleOptionSelect(i)}
                      className={`p-4 rounded-xl border text-xs md:text-sm transition-all flex items-start gap-3 cursor-pointer ${
                        isCorrect
                          ? "bg-emerald-950/40 border-emerald-500/60 text-emerald-200"
                          : isWrong
                          ? "bg-rose-950/40 border-rose-500/60 text-rose-200"
                          : isSelected
                          ? "bg-purple-950/30 border-purple-400 text-white shadow-[0_0_12px_rgba(168,85,247,0.2)]"
                          : "bg-white/[0.03] border-white/10 text-neutral-300 hover:bg-white/[0.06] hover:border-white/20"
                      }`}
                    >
                      <span className="h-5 w-5 rounded-full border border-current flex items-center justify-center text-xs font-mono shrink-0 mt-0.5">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="leading-relaxed flex-1">{opt}</span>
                    </div>
                  );
                })}
              </div>

              {/* Statutory Explanation on Submission */}
              {isAnswerSubmitted && (
                <div className="p-4 md:p-5 rounded-2xl bg-white/[0.04] border border-purple-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-mono tracking-wider text-purple-300 font-bold flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Statutory Ratio & Explanation:</span>
                    </span>
                    <span className="text-xs font-mono text-amber-300">
                      {currentMcq.reference_section}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-200 leading-relaxed font-sans">
                    {currentMcq.explanation}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between">
                <div>
                  {!isAnswerSubmitted ? (
                    <button
                      onClick={handleSubmitAnswer}
                      disabled={selectedOption === null}
                      className="bg-white text-black hover:bg-neutral-200 disabled:opacity-40 px-6 py-2 rounded-full text-xs font-semibold cursor-pointer shadow-md"
                    >
                      Submit Answer
                    </button>
                  ) : (
                    <button
                      onClick={handleNextQuestion}
                      className="bg-purple-600 text-white hover:bg-purple-500 px-6 py-2 rounded-full text-xs font-semibold cursor-pointer shadow-md flex items-center gap-1.5"
                    >
                      <span>{currentMcqIndex < mcqs.length - 1 ? "Next Question" : "Complete Quiz"}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-xs text-neutral-400">
              No questions found for this topic.
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Bare Act Explainer */}
      {activeTab === "explainer" && (
        <div className="apple-glass-card border-white/15 p-6 md:p-8 space-y-6 max-w-4xl mx-auto shadow-2xl">
          <div>
            <h2 className="text-base font-semibold text-white">
              Bare Act AI Conceptual Explainer
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Enter any Act code and section number to get an instant breakdown of statutory ingredients, actus reus, mens rea, and practical courtroom application.
            </p>
          </div>

          <form onSubmit={handleSearchExplainer} className="flex flex-col sm:flex-row gap-3">
            <select
              value={explainerAct}
              onChange={(e) => setExplainerAct(e.target.value)}
              className="apple-glass-input px-3 py-2.5 text-xs text-white bg-[#121118]"
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
              placeholder="Section number (e.g. 303, 35, 479, 61, 4)..."
              value={explainerSection}
              onChange={(e) => setExplainerSection(e.target.value)}
              className="flex-1 apple-glass-input px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 rounded-xl font-mono"
            />

            <button
              type="submit"
              disabled={loadingExplainer}
              className="bg-white text-black hover:bg-neutral-200 px-6 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-md shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{loadingExplainer ? "Analyzing..." : "Explain Section"}</span>
            </button>
          </form>

          {explainerResult && (
            <div className="space-y-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  {explainerResult.act_code} Section {explainerResult.section_number}: {explainerResult.heading}
                </h3>
                <Link
                  to="/student/library"
                  className="text-xs font-mono text-purple-300 hover:underline flex items-center gap-1"
                >
                  <span>Open in Library</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-neutral-200 leading-relaxed space-y-2">
                <span className="text-[10px] uppercase font-mono text-purple-300 font-bold block">
                  Plain Language Conceptual Breakdown:
                </span>
                <p>{explainerResult.simple_explanation}</p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                <span className="text-[10px] uppercase font-mono text-amber-300 font-bold block">
                  Essential Ingredients Required by Law:
                </span>
                <div className="space-y-1.5">
                  {explainerResult.ingredients.map((ing: string, i: number) => (
                    <div key={i} className="text-xs text-neutral-300 flex items-start gap-2">
                      <span className="text-purple-400 font-mono font-bold">•</span>
                      <span>{ing}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Daily Legal Question */}
      {activeTab === "daily_question" && dailyQ && (
        <div className="apple-glass-card border-white/15 p-6 md:p-8 space-y-6 max-w-4xl mx-auto shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-400" />
              <span className="text-xs font-mono uppercase tracking-wider text-purple-300 font-bold">
                Daily Legal Problem • {dailyQ.date}
              </span>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/10 text-neutral-300">
              {dailyQ.topic}
            </span>
          </div>

          <div
            className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 text-base md:text-lg text-amber-50 leading-relaxed font-['Times_New_Roman',_Times,_serif]"
            style={{ fontFamily: "'Times New Roman', Times, serif" }}
          >
            {dailyQ.scenario}
          </div>

          <div className="space-y-2.5">
            {dailyQ.options.map((opt, i) => {
              const isSelected = dailySelectedOption === i;
              const isCorrect = dailySubmitted && i === dailyQ.correct_index;
              const isWrong = dailySubmitted && isSelected && i !== dailyQ.correct_index;

              return (
                <div
                  key={i}
                  onClick={() => !dailySubmitted && setDailySelectedOption(i)}
                  className={`p-4 rounded-xl border text-xs md:text-sm transition-all flex items-start gap-3 cursor-pointer ${
                    isCorrect
                      ? "bg-emerald-950/40 border-emerald-500/60 text-emerald-200"
                      : isWrong
                      ? "bg-rose-950/40 border-rose-500/60 text-rose-200"
                      : isSelected
                      ? "bg-purple-950/30 border-purple-400 text-white"
                      : "bg-white/[0.03] border-white/10 text-neutral-300 hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="h-5 w-5 rounded-full border border-current flex items-center justify-center text-xs font-mono shrink-0 mt-0.5">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="leading-relaxed flex-1">{opt}</span>
                </div>
              );
            })}
          </div>

          {dailySubmitted && (
            <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-neutral-200 leading-relaxed space-y-1.5">
              <span className="text-[10px] uppercase font-mono text-purple-300 font-bold block">
                Statutory Reference: {dailyQ.applicable_section}
              </span>
              <p>{dailyQ.explanation}</p>
            </div>
          )}

          {!dailySubmitted && (
            <button
              onClick={() => {
                if (dailySelectedOption !== null) setDailySubmitted(true);
              }}
              disabled={dailySelectedOption === null}
              className="bg-white text-black hover:bg-neutral-200 disabled:opacity-40 px-6 py-2.5 rounded-full text-xs font-semibold cursor-pointer shadow-md"
            >
              Verify Answer
            </button>
          )}
        </div>
      )}

      {/* Tab 4: Judgment of the Day */}
      {activeTab === "judgment_of_day" && jotd && (
        <div className="apple-glass-card border-white/15 p-6 md:p-8 space-y-6 max-w-4xl mx-auto shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-purple-400" />
              <span className="text-xs font-mono uppercase tracking-wider text-purple-300 font-bold">
                Featured Landmark Precedent of the Day
              </span>
            </div>
            <span className="text-xs font-mono text-amber-300">{jotd.citation}</span>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white font-serif">{jotd.case_name}</h2>
            <p className="text-xs font-mono text-neutral-400 mt-1">{jotd.bench}</p>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2 text-xs md:text-sm text-neutral-200 leading-relaxed font-sans">
            <span className="text-[10px] uppercase font-mono text-neutral-400 font-bold block">
              Case Summary & Facts:
            </span>
            <p>{jotd.summary}</p>
          </div>

          <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-2 text-xs md:text-sm text-purple-200 leading-relaxed font-sans">
            <span className="text-[10px] uppercase font-mono text-purple-300 font-bold block">
              Legal Principle & Ratio Decidendi:
            </span>
            <p>{jotd.legal_significance}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-neutral-400">Linked Statutory Provisions:</span>
            {jotd.linked_sections.map((sec, i) => (
              <span
                key={i}
                className="text-xs font-mono px-2 py-0.5 rounded bg-white/10 text-neutral-200 border border-white/15"
              >
                {sec}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Exam Prep Revision Guides */}
      {activeTab === "examprep" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
          <div className="apple-glass-card p-6 space-y-3">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Revision Guide 1
            </span>
            <h3 className="text-sm font-semibold text-white">
              BNS 2023: Substantive Offence Overhaul & Key Shifts
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Consolidated comparative chart detailing the merger of sedition into acts endangering sovereignty (Sec 152), community service as punishment (Sec 4), and organized crime definitions (Sec 111).
            </p>
            <div className="pt-2">
              <Link
                to="/student/library"
                className="text-xs font-mono text-purple-300 hover:underline flex items-center gap-1"
              >
                <span>Study BNS Chapters</span>
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="apple-glass-card p-6 space-y-3">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Revision Guide 2
            </span>
            <h3 className="text-sm font-semibold text-white">
              BNSS 2023: Bail Categories & Undertrial Safeguards
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Framework of Section 479 undertrial detention limits (one-third period rule for first-time offenders), mandatory notice of appearance under Section 35(3), and electronic summons procedure.
            </p>
            <div className="pt-2">
              <Link
                to="/student/converters"
                className="text-xs font-mono text-purple-300 hover:underline flex items-center gap-1"
              >
                <span>CrPC ↔ BNSS Matrix</span>
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
