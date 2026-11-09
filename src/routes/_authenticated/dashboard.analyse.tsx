import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { 
  Upload, X, FileText, Scale, ShieldCheck, CheckCircle2, 
  AlertTriangle, ArrowRight, ExternalLink, Copy, Check, Sparkles, 
  MessageSquare, Loader2, RotateCcw, Clock, Trash2, History, HeartHandshake
} from "lucide-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/trana-backend";
import { useTranaCredential, authFetch, authHeaders } from "@/lib/trana-auth";
import { ConnectProfessionalOfferModal } from "@/components/ConnectProfessionalOfferModal";

export const Route = createFileRoute("/_authenticated/dashboard/analyse")({
  head: () => ({
    meta: [
      { title: "Complaint Analyser — TRANA" },
      { name: "description", content: "Describe what happened or upload the FIR/complaint and understand your rights, sections, and next steps." },
      { property: "og:title", content: "Complaint Analyser — TRANA" },
      { property: "og:description", content: "Plain-language statutory analysis for criminal complaints and legal notices." },
    ],
  }),
  component: Analyse,
});

interface ApplicableLaw {
  act?: string;
  code?: string;
  section?: string;
  subsection?: string | null;
  offense?: string;
  punishment?: string;
  bailable?: boolean | null;
  cognizable?: boolean | null;
  explanation?: string;
}

interface StructuredAnalysis {
  general_analysis?: string;
  situation_meaning?: string;
  bail_status?: string;
  next_24_hours?: string[];
  rights?: string[];
  handling_authority?: string;
  applicable_laws?: ApplicableLaw[];
  suggest_lawyer?: boolean;
}

interface SourceChunk {
  content: string;
  document_name: string;
  section?: string;
  subsection?: string | null;
  act?: string;
  code?: string;
  explanation?: string;
  source_url?: string;
  verified?: boolean;
}

interface AnalysisResult {
  analysis: StructuredAnalysis;
  sources?: SourceChunk[];
  processing_time_seconds?: number;
  chatId?: string | null;
}

interface StoredPastAnalysis {
  id: string;
  createdAt: string;
  summaryTitle: string;
  originalQuery: string;
  fileName?: string | null;
  result: AnalysisResult;
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
  badge,
  badgeVariant = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  badge?: string;
  badgeVariant?: "default" | "success" | "warning";
}) {
  const badgeClasses = {
    default: "bg-white/10 text-neutral-300 border-white/15",
    success: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    warning: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  }[badgeVariant];

  return (
    <div className="apple-glass-card rounded-2xl p-6 md:p-7 border border-white/15 bg-white/[0.04] backdrop-blur-xl shadow-xl transition-all">
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/[0.08] border border-white/20 flex items-center justify-center text-amber-300 shrink-0">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-lg font-medium text-white tracking-wide">{title}</h3>
            {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {badge && (
          <span className={`text-[11px] font-mono px-2.5 py-1 rounded-full border ${badgeClasses}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="text-sm leading-relaxed text-neutral-200">{children}</div>
    </div>
  );
}

function Analyse() {
  const navigate = useNavigate();
  const { credential } = useTranaCredential();
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [pastAnalyses, setPastAnalyses] = useState<StoredPastAnalysis[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("trana_citizen_past_analyses");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDeletePastAnalysis = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = pastAnalyses.filter((item) => item.id !== id);
    setPastAnalyses(updated);
    try {
      localStorage.setItem("trana_citizen_past_analyses", JSON.stringify(updated));
      toast.success("Analysis deleted from history");
    } catch {}
  };

  const handleLoadPastAnalysis = (item: StoredPastAnalysis) => {
    setResult(item.result);
    setText(item.originalQuery.startsWith("Uploaded Document:") ? "" : item.originalQuery);
    setActiveTab("new");
    toast.info("Loaded analysis from history");
  };

  function pick(f: File | undefined) {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return setErr("Please upload a file under 8 MB.");
    setErr(null);
    setFile(f);
  }

  async function submit() {
    if (!text.trim() && !file) return;
    setBusy(true);
    setErr(null);
    setResult(null);

    try {
      let createdChatId: string | null = null;

      // If user uploaded a document and is authenticated, upload via chat attachments for backend OCR/processing
      if (file && credential) {
        const createChatRes = await authFetch(`${API_URL}/api/chats`, credential, {
          method: "POST",
          headers: { ...authHeaders(credential), "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `Complaint: ${text.slice(0, 28) || file.name}`,
          }),
        });

        if (createChatRes.ok) {
          const chatData = await createChatRes.json();
          createdChatId = chatData.id;

          const formData = new FormData();
          formData.append("files", file, file.name);

          const uploadRes = await authFetch(
            `${API_URL}/api/chats/${encodeURIComponent(createdChatId)}/attachments`,
            credential,
            {
              method: "POST",
              body: formData,
            }
          );

          if (!uploadRes.ok) {
            console.warn("Attachment upload had non-ok status, proceeding with query.");
          }
        }
      }

      // Analyze endpoint call
      const queryPrompt = text.trim() || `Analyze the uploaded document (${file?.name}) thoroughly. Identify all applicable BNS/BNSS/BSA sections, explain the allegations, assess bail eligibility, list my immediate rights, and provide 24-hour next steps.`;

      const endpoint = credential ? `${API_URL}/api/analyze` : `${API_URL}/api/analyze/temporary`;
      const bodyPayload: Record<string, unknown> = {
        query: queryPrompt,
        model_preference: "quick",
      };

      if (credential && createdChatId) {
        bodyPayload.chat_id = createdChatId;
      }

      const res = await authFetch(endpoint, credential, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        let msg = "Could not complete the analysis. Please check your connection and try again.";
        try {
          const errorData = await res.json();
          if (errorData?.detail) {
            msg = typeof errorData.detail === "string" ? errorData.detail : errorData.detail.message || msg;
          }
        } catch {
          // keep fallback
        }
        throw new Error(msg);
      }

      const data = await res.json();
      const analysisObj: AnalysisResult = {
        analysis: data.analysis,
        sources: data.sources || [],
        processing_time_seconds: data.processing_time_seconds,
        chatId: createdChatId,
      };
      setResult(analysisObj);

      try {
        const titleSnippet = (data.analysis?.situation_meaning || text.trim() || file?.name || "Statutory Complaint Analysis").slice(0, 80);
        const record: StoredPastAnalysis = {
          id: `analysis-${Date.now()}`,
          createdAt: new Date().toISOString(),
          summaryTitle: titleSnippet,
          originalQuery: text.trim() || `Uploaded Document: ${file?.name}`,
          fileName: file?.name || null,
          result: analysisObj,
        };
        const updatedHistory = [record, ...pastAnalyses.filter((p) => p.summaryTitle !== titleSnippet).slice(0, 29)];
        setPastAnalyses(updatedHistory);
        localStorage.setItem("trana_citizen_past_analyses", JSON.stringify(updatedHistory));
      } catch (saveErr) {
        console.warn("Could not cache past analysis:", saveErr);
      }

      toast.success("Complaint analysis generated successfully.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong while analysing.");
    } finally {
      setBusy(false);
    }
  }

  const handleCopyReport = () => {
    if (!result) return;
    const a = result.analysis;
    const lines = [
      "TRANA STATUTORY COMPLAINT ANALYSIS",
      "==================================",
      "",
      a.situation_meaning ? `WHAT THIS MEANS:\n${a.situation_meaning}\n` : "",
      a.general_analysis ? `LEGAL ANALYSIS:\n${a.general_analysis}\n` : "",
      a.bail_status ? `BAIL STATUS:\n${a.bail_status}\n` : "",
      a.applicable_laws?.length
        ? `APPLICABLE SECTIONS:\n${a.applicable_laws
            .map((l) => `• ${l.act || l.code} Section ${l.section || ""}: ${l.explanation || ""}`)
            .join("\n")}\n`
        : "",
      a.next_24_hours?.length
        ? `NEXT 24 HOURS ACTION PLAN:\n${a.next_24_hours.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n`
        : "",
      a.rights?.length ? `YOUR RIGHTS:\n${a.rights.map((r) => `• ${r}`).join("\n")}\n` : "",
      a.handling_authority ? `COMPETENT AUTHORITY:\n${a.handling_authority}\n` : "",
      "==================================",
      "Generated for informational purposes via TRANA Statutory AI. Consult an advocate for legal representation.",
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    toast.success("Full analysis copied to clipboard.");
    setTimeout(() => setCopied(false), 2500);
  };

  const a = result?.analysis;

  return (
    <div className="max-w-5xl mx-auto py-4 px-3 sm:px-6 pb-20">
      {/* Header Banner */}
      <div className="apple-glass-card rounded-2xl p-6 sm:p-8 md:p-10 border border-white/15 bg-white/[0.04] backdrop-blur-xl shadow-2xl relative overflow-hidden mb-8">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-amber-400/[0.05] blur-3xl pointer-events-none" />
        <span className="inline-flex items-center gap-1.5 border border-amber-400/30 bg-amber-400/10 text-amber-300 px-3 py-1 rounded-full text-[10px] uppercase font-mono tracking-widest">
          <Sparkles className="h-3 w-3" />
          Statutory Intelligence · BNS / BNSS / BSA
        </span>
        <h1 className="mt-4 font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-white tracking-tight leading-tight">
          Complaint & Incident Analyser
        </h1>
        <p className="mt-2.5 max-w-2xl text-sm sm:text-base leading-relaxed text-neutral-300">
          Describe what happened or upload the FIR, police summon, or notice. TRANA decodes the exact statutory sections, determines bail eligibility under BNSS, and outlines your immediate legal rights.
        </p>
      </div>

      {/* View Switcher: New Analysis vs Past Analyses */}
      <div className="flex items-center gap-2 mb-6 p-1.5 rounded-2xl bg-white/[0.04] border border-white/10 w-fit backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setActiveTab("new")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            activeTab === "new"
              ? "bg-white text-black shadow-md font-semibold"
              : "text-neutral-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 text-sky-400" />
          <span>New Analysis</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            activeTab === "history"
              ? "bg-white text-black shadow-md font-semibold"
              : "text-neutral-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Clock className="h-3.5 w-3.5 text-sky-400" />
          <span>Past Analyses ({pastAnalyses.length})</span>
        </button>
      </div>

      {activeTab === "history" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div>
              <h2 className="font-display text-xl font-medium text-white">Your Past Statutory Analyses</h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Archived complaint evaluations, cited criminal sections, and bail eligibility records.
              </p>
            </div>
            {pastAnalyses.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Clear all past analyses from this device?")) {
                    setPastAnalyses([]);
                    localStorage.removeItem("trana_citizen_past_analyses");
                    toast.info("Past analyses cleared");
                  }
                }}
                className="text-xs text-red-400 hover:text-red-300 font-mono flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-950/20 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear History</span>
              </button>
            )}
          </div>

          {pastAnalyses.length === 0 ? (
            <div className="apple-glass-card rounded-2xl p-12 text-center border border-white/10 bg-white/[0.02]">
              <History className="h-10 w-10 text-neutral-500 mx-auto mb-3 opacity-60" />
              <h3 className="text-sm font-medium text-neutral-300">No Past Analyses Recorded</h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1 leading-relaxed">
                When you submit a legal situation or upload a complaint, TRANA automatically archives your statutory report here for future reference.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("new")}
                className="mt-5 inline-flex items-center gap-2 bg-white text-black px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                <span>Start New Analysis</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pastAnalyses.map((item) => {
                const lawCount = item.result.analysis?.applicable_laws?.length || 0;
                const bail = item.result.analysis?.bail_status;
                const formattedDate = new Date(item.createdAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={item.id}
                    className="apple-glass-card rounded-2xl p-5 border border-white/15 bg-white/[0.04] hover:border-white/30 backdrop-blur-xl transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-sky-400" />
                          <span>{formattedDate}</span>
                        </span>
                        {item.fileName && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-sky-500/30 text-sky-300 bg-sky-950/40">
                            {item.fileName}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-semibold text-white line-clamp-2 leading-snug">
                        {item.summaryTitle}
                      </h3>

                      <p className="mt-2 text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                        {item.originalQuery}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {item.result.analysis?.applicable_laws?.slice(0, 3).map((law, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-mono px-2 py-0.5 rounded border border-white/10 bg-white/5 text-neutral-200"
                          >
                            {law.act || law.code || "Sec"} {law.section}
                          </span>
                        ))}
                        {lawCount > 3 && (
                          <span className="text-[10px] font-mono text-neutral-500">
                            +{lawCount - 3} more
                          </span>
                        )}
                      </div>

                      {bail && (
                        <div className="mt-2.5">
                          <span className="text-[11px] font-sans text-neutral-300">
                            <strong className="text-amber-300 font-mono text-[10px] uppercase mr-1.5">Bail:</strong>
                            <span className="line-clamp-1">{bail}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 pt-3.5 border-t border-white/10 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadPastAnalysis(item)}
                        className="bg-white text-black px-3.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <span>View Analysis</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDeletePastAnalysis(item.id, e)}
                        className="text-neutral-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                        title="Delete from history"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Input Console */}
      <div className="apple-glass-card rounded-2xl p-6 md:p-8 border border-white/15 bg-white/[0.04] backdrop-blur-xl shadow-2xl">
        <div className="flex items-center justify-between gap-4 mb-2">
          <label htmlFor="situation" className="text-xs uppercase tracking-[0.2em] font-mono text-neutral-400">
            Describe Your Legal Situation or Paste Document Text
          </label>
          <span className="text-[11px] font-mono text-neutral-500">
            {text.length} characters
          </span>
        </div>

        <textarea
          id="situation"
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Example: My brother was called to the local police station regarding an allegation under Section 318 BNS (cheating). The police are asking him to hand over his laptop and mobile phone. What does this section mean, can they arrest him immediately without bail, and what should we do right now?"
          className="w-full resize-y rounded-xl border border-white/20 bg-white/[0.05] p-4 text-sm text-white placeholder:text-neutral-500 focus:border-amber-400/50 focus:bg-white/[0.08] focus:outline-none transition-all leading-relaxed shadow-inner"
          style={{ borderRadius: "14px" }}
        />

        {/* Upload Box */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
            <span className="uppercase tracking-[0.18em] font-mono">Or Upload FIR / Notice / Summons (PDF or Image)</span>
            {!credential && (
              <span className="text-amber-300/80 text-[11px]">Sign in recommended for document attachments</span>
            )}
          </div>

          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              pick(e.dataTransfer.files[0]);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-all ${
              drag
                ? "border-amber-400 bg-amber-400/[0.08]"
                : "border-white/20 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/40"
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-white/[0.08] border border-white/15 flex items-center justify-center text-neutral-300 mb-2">
              <Upload className="h-5 w-5" />
            </div>

            {file ? (
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-white/20 text-xs text-white">
                <FileText className="h-4 w-4 text-amber-300" />
                <span className="font-medium truncate max-w-xs">{file.name}</span>
                <span className="text-[10px] text-neutral-400">({(file.size / 1024).toFixed(0)} KB)</span>
                <button
                  type="button"
                  aria-label="Remove file"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="p-1 hover:text-rose-400 transition-colors ml-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div>
                <p className="text-xs text-neutral-300 font-medium">
                  Drag and drop FIR or summons, or <span className="text-amber-300 underline">browse device</span>
                </p>
                <p className="text-[11px] text-neutral-500 mt-1">Supports PDF, PNG, JPG, or Scanned Photos up to 8 MB</p>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </div>
        </div>

        {err && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        {/* Submit Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={submit}
            disabled={busy || (!text.trim() && !file)}
            className="apple-glass-pill px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-wider bg-white text-black hover:bg-neutral-200 border-none shadow-lg disabled:opacity-40 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-black" />
                <span>Analysing Situation…</span>
              </>
            ) : (
              <>
                <Scale className="h-4 w-4 text-black" />
                <span>Analyse Complaint Now</span>
              </>
            )}
          </button>

          {(text.trim() || file) && (
            <button
              type="button"
              onClick={() => {
                setText("");
                setFile(null);
                setErr(null);
                setResult(null);
              }}
              className="text-xs text-neutral-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Clear fields</span>
            </button>
          )}
        </div>

        {busy && (
          <p className="mt-3 text-xs text-neutral-400 flex items-center gap-2 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Examining BNS penal sections, searching BNSS bail classifications, and verifying statutory rights…
          </p>
        )}
      </div>

      {/* Analysis Results View */}
      {result && a && (
        <div className="mt-10 space-y-6 animate-fade-in">
          {/* Action & Metric Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white/[0.05] border border-white/10 text-xs">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Analysis Complete
              </span>
              {result.processing_time_seconds !== undefined && (
                <span className="text-neutral-400 font-mono">
                  ({result.processing_time_seconds.toFixed(2)}s)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyReport}
                className="apple-glass-pill px-3 py-1.5 rounded-lg text-neutral-300 hover:text-white text-xs flex items-center gap-1.5 border border-white/15 bg-white/5 cursor-pointer transition-all"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "Copied" : "Copy Report"}</span>
              </button>

              {result.chatId && (
                <button
                  type="button"
                  onClick={() => navigate({ to: "/dashboard/chat/$id", params: { id: result.chatId! } })}
                  className="apple-glass-pill px-3 py-1.5 rounded-lg text-amber-300 hover:text-white text-xs flex items-center gap-1.5 border border-amber-400/30 bg-amber-400/10 cursor-pointer transition-all"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Continue in Chat</span>
                </button>
              )}
            </div>
          </div>

          {/* Meaning / General Analysis */}
          {(a.situation_meaning || a.general_analysis) && (
            <SectionCard
              icon={FileText}
              title="What This Situation Means"
              subtitle="Plain-language breakdown of the allegations and circumstances"
            >
              <div className="space-y-3">
                {(a.situation_meaning || a.general_analysis || "")
                  .split(/\n\n+/)
                  .map((p, i) => (
                    <p key={i} className="leading-relaxed text-neutral-200">
                      {p}
                    </p>
                  ))}
              </div>
            </SectionCard>
          )}

          {/* Sections Identified */}
          {a.applicable_laws && a.applicable_laws.length > 0 && (
            <SectionCard
              icon={Scale}
              title="Statutory Sections & Allegations Identified"
              subtitle="Governing provisions under current Indian criminal legislation"
              badge={`${a.applicable_laws.length} Section${a.applicable_laws.length > 1 ? "s" : ""}`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {a.applicable_laws.map((law, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="font-semibold text-white font-mono text-sm">
                          {law.act || law.code} {law.section ? `Sec. ${law.section}` : ""}
                        </span>
                        {law.bailable !== undefined && law.bailable !== null && (
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                              law.bailable
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                            }`}
                          >
                            {law.bailable ? "Bailable" : "Non-Bailable"}
                          </span>
                        )}
                      </div>
                      {law.offense && (
                        <p className="text-xs text-amber-200 font-medium mb-1">
                          {law.offense}
                        </p>
                      )}
                      {law.explanation && (
                        <p className="text-xs text-neutral-300 leading-relaxed">
                          {law.explanation}
                        </p>
                      )}
                    </div>
                    {law.punishment && (
                      <div className="mt-3 pt-2 border-t border-white/10 text-[11px] text-neutral-400 font-mono">
                        Penalty: {law.punishment}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Bail Status */}
          {a.bail_status && !/^(?:not applicable|none|n\/?a)$/i.test(a.bail_status.trim()) && (
            <SectionCard
              icon={ShieldCheck}
              title="Bail Eligibility & Legal Assessment"
              subtitle="Procedural guidance under Bharatiya Nagarik Suraksha Sanhita (BNSS)"
              badge="Bail Assessment"
              badgeVariant="warning"
            >
              <div className="p-4 rounded-xl bg-amber-400/[0.05] border border-amber-400/20 space-y-2">
                <p className="font-medium text-amber-100">{a.bail_status}</p>
              </div>
            </SectionCard>
          )}

          {/* Next 24 Hours */}
          {a.next_24_hours && a.next_24_hours.length > 0 && (
            <SectionCard
              icon={CheckCircle2}
              title="Immediate Action Steps (Next 24 Hours)"
              subtitle="Step-by-step guidance to safeguard yourself and maintain legal composure"
            >
              <ol className="space-y-3">
                {a.next_24_hours.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 text-xs font-mono font-bold shrink-0 mt-0.5 border border-amber-400/30">
                      {idx + 1}
                    </span>
                    <span className="text-sm text-neutral-200 leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </SectionCard>
          )}

          {/* Rights */}
          {a.rights && a.rights.length > 0 && (
            <SectionCard
              icon={ShieldCheck}
              title="Your Essential Legal Rights"
              subtitle="Constitutional and statutory protections guaranteed under Indian law"
            >
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {a.rights.map((right, idx) => (
                  <li
                    key={idx}
                    className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-start gap-2.5 text-xs text-neutral-200 leading-relaxed"
                  >
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{right}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {/* Competent Authority */}
          {a.handling_authority && !/^(?:not applicable|none|n\/?a)$/i.test(a.handling_authority.trim()) && (
            <SectionCard
              icon={Scale}
              title="Competent Court & Authority"
              subtitle="Jurisdictional magistrate or investigating body handling this matter"
            >
              <p className="text-neutral-200">{a.handling_authority}</p>
            </SectionCard>
          )}

          {/* Verified Sources */}
          {result.sources && result.sources.length > 0 && (
            <SectionCard
              icon={FileText}
              title="Verified Statutory Sources"
              subtitle="Official statutory provisions resolved against the legislative database"
              badge={`${result.sources.length} Verified`}
              badgeVariant="success"
            >
              <div className="space-y-3">
                {result.sources.map((s, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-neutral-200 font-mono">
                        {s.act || s.code} {s.section ? `Section ${s.section}` : ""}
                      </span>
                      {s.source_url && (
                        <a
                          href={s.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-300 hover:text-white flex items-center gap-1 font-mono text-[11px]"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>Official Text</span>
                        </a>
                      )}
                    </div>
                    {s.explanation && <p className="text-neutral-300">{s.explanation}</p>}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Speak to a Lawyer Callout */}
          <div className="apple-glass-card rounded-2xl p-6 md:p-8 border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-white/[0.04] to-emerald-500/10 backdrop-blur-2xl shadow-2xl">
            <h3 className="font-display text-2xl font-semibold text-white">
              Consult a Verified Advocate
            </h3>
            <p className="mt-2 text-sm text-neutral-300 max-w-2xl leading-relaxed">
              TRANA has decoded the statutory provisions and immediate rights for you. For legal drafting, bail petitions in court, or ongoing police representation, connect directly with a verified advocate.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setIsConnectModalOpen(true)}
                className="apple-glass-pill px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-white text-black hover:bg-neutral-200 border-none flex items-center gap-2 cursor-pointer transition-all"
              >
                <span>Connect with an Advocate</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsConnectModalOpen(true)}
                className="apple-glass-pill px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30 flex items-center gap-2 cursor-pointer transition-all"
              >
                <HeartHandshake className="h-3.5 w-3.5" />
                <span>Free Legal Aid (15100)</span>
              </button>
              <Link
                to="/dashboard/consultations"
                className="apple-glass-pill px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-white/10 text-white hover:bg-white/20 border border-white/25 flex items-center gap-2 cursor-pointer transition-all"
              >
                <span>My Consultations</span>
              </Link>
            </div>
          </div>

          <p className="text-xs text-neutral-500 text-center leading-relaxed">
            This analysis is generated by TRANA Statutory AI for legal education and first-aid only. It does not establish an attorney-client relationship. Always consult a qualified advocate for representation before judicial authorities.
          </p>
        </div>
      )}
        </>
      )}

      {/* Connect with Advocate & Free Legal Aid Modal */}
      <ConnectProfessionalOfferModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        initialTopic={result?.offense_summary || text.slice(0, 100) || "Criminal Complaint Analysis"}
      />
    </div>
  );
}
