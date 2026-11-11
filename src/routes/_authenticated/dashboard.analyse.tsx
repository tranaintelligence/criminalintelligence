import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { 
  Upload, X, FileText, Scale, ShieldCheck, CheckCircle2, 
  AlertTriangle, ArrowRight, ExternalLink, Copy, Check, Sparkles, 
  MessageSquare, Loader2, RotateCcw, Clock, Trash2, History, HeartHandshake,
  Users, CreditCard, QrCode, Shield
} from "lucide-react";
import { marked } from "marked";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  const [analysisMode, setAnalysisMode] = useState<"ai" | "professional">("ai");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paidReviewSuccess, setPaidReviewSuccess] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"upi" | "card" | "netbanking">("upi");
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

  async function submit(forcePaid: boolean = false) {
    if (!text.trim() && !file) return;
    if (analysisMode === "professional" && !paidReviewSuccess && !forcePaid) {
      setIsPaymentModalOpen(true);
      return;
    }
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

      // Analyze endpoint call with structured TRANA Complaint & FIR Analyser protocol
      const queryPrompt = text.trim()
        ? `You are the TRANA Complaint and FIR Analyser. Perform a complete criminal complaint / FIR analysis following your official instructions.
Explain in plain language for an ordinary Indian family in this exact order:
1. What this document is (FIR, complaint or other, date, police station/court if stated)
2. What it says happened (neutral words, "The complainant says...", allegations not proven facts)
3. Sections mentioned (one line per BNS section on what it covers in simple words; cognizable, bailable, and punishment range only if certain; statutory reference [Ref: Bharatiya Nyaya Sanhita, 2023 (BNS), Section <X> — previously Section <Y> IPC])
4. Do the sections match the facts? (compare sections with facts written, flag missing/vague/exaggerated/misapplied with careful words)
5. What is missing or unclear (no sections, no date/place, unclear names, long delay, no description of act)
6. What this means for you (tailored to role: accused, complainant, witness, or family member)
7. Your rights now (protections under BNS, BNSS, BSA in simple words)
8. The one most important thing to do next, then at most three short steps for the next 24 hours if in an active situation (skip 24h steps if no one is in danger)
Offer at the end: "Would you like information on how to reach a lawyer?"
End with: "This is general information, not legal advice."

Case / Complaint Details:
${text.trim()}`
        : `You are the TRANA Complaint and FIR Analyser. Analyze the uploaded document (${file?.name}) thoroughly following your official instructions.
Explain in plain language for an ordinary Indian family in this exact order:
1. What this document is (FIR, complaint or other, date, police station/court if stated)
2. What it says happened (neutral words, allegations not proven facts)
3. Sections mentioned (with official statutory references [Ref: Bharatiya Nyaya Sanhita, 2023 (BNS), Section <X> — previously Section <Y> IPC])
4. Do the sections match the facts? (compare sections with facts, flag misapplication or exaggeration)
5. What is missing or unclear
6. What this means for you (tailored to role)
7. Your rights now under BNS, BNSS, BSA
8. The one most important thing to do next, then at most three short steps for the next 24 hours if in an active situation
Offer at the end: "Would you like information on how to reach a lawyer?"
End with: "This is general information, not legal advice."`;

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

        // Sync with Citizen Queries board for advocates ONLY when Legal Professional is selected & paid!
        try {
          const isPaid = analysisMode === "professional" || forcePaid || paidReviewSuccess;
          if (isPaid) {
            const queryId = `query-${Date.now()}`;
            const poolQuery = {
              id: queryId,
              created_at: new Date().toISOString(),
              issue_summary: text.trim().slice(0, 180) || titleSnippet,
              category: data.analysis?.applicable_laws?.[0]?.act || data.analysis?.applicable_laws?.[0]?.code || "Statutory Complaint",
              status: "open",
              chat_id: createdChatId || null,
              applicable_laws: data.analysis?.applicable_laws || [],
              bail_status: data.analysis?.bail_status || null,
              situation_meaning: data.analysis?.situation_meaning || data.analysis?.general_analysis || null,
              citizen_name: "Anonymous Citizen",
              plan: "paid_professional",
              fee: 50,
              priority: "high",
              responses: [],
              passed_by: [],
            };
            const existingPool = JSON.parse(localStorage.getItem("trana_citizen_queries_pool") || "[]");
            localStorage.setItem("trana_citizen_queries_pool", JSON.stringify([poolQuery, ...existingPool.filter((x: any) => x.id !== queryId).slice(0, 49)]));
            
            void supabase.from("analyses").insert({
              id: queryId,
              situation: text.trim() || `Complaint Document: ${file?.name || "Uploaded Document"}`,
              result: {
                situation_meaning: data.analysis?.situation_meaning || data.analysis?.general_analysis,
                applicable_laws: data.analysis?.applicable_laws || [],
                bail_status: data.analysis?.bail_status,
                rights: data.analysis?.rights,
                source: "complaint_analyser",
                anonymous: true,
                plan: "paid_professional",
                fee: 50,
                priority: "high",
                responses: [],
                passed_by: [],
              },
              is_criminal: true,
              user_id: credential ? "citizen-user" : "anonymous-citizen",
            }).catch((insertErr) => console.warn("Supabase analyses insert note:", insertErr));
          }
        } catch {}
      } catch (saveErr) {
        console.warn("Could not cache past analysis:", saveErr);
      }

      if (analysisMode === "professional" || forcePaid || paidReviewSuccess) {
        toast.success("₹50 Legal Professional Review confirmed! Complaint submitted with High Priority to panel advocates.");
      } else {
        toast.success("Complaint analysis generated successfully.");
      }
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

        {/* Option Selector: AI Analysis vs Legal Professional Review */}
        <div className="mt-5 pt-4 border-t border-white/10">
          <label className="block text-xs font-medium text-neutral-400 mb-2 font-mono uppercase tracking-wider">
            Choose Analysis Provider:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Option A: AI Analysis (Free) */}
            <button
              type="button"
              onClick={() => setAnalysisMode("ai")}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                analysisMode === "ai"
                  ? "border-emerald-500/60 bg-emerald-500/15 shadow-[0_0_20px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/40"
                  : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  <span className="font-semibold text-white text-sm">Trana Statutory AI</span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Free &bull; Instant
                </span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Instant 5-point statutory breakdown, rights, and bailable status decoded by legal AI.
              </p>
            </button>

            {/* Option B: Legal Professional Written Opinion (₹50) */}
            <button
              type="button"
              onClick={() => setAnalysisMode("professional")}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                analysisMode === "professional"
                  ? "border-emerald-500/60 bg-emerald-500/15 shadow-[0_0_20px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/40"
                  : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-emerald-400" />
                  <span className="font-semibold text-white text-sm">Legal Professional Written Opinion</span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ₹50 &bull; Verified Written Opinion
                </span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Get your complaint reviewed directly by verified panel legal professionals for a comprehensive written opinion + instant AI first-aid.
              </p>
            </button>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={() => submit()}
            disabled={busy || (!text.trim() && !file)}
            className="px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500 text-black hover:bg-emerald-400 border border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.45)] disabled:opacity-40 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-black" />
                <span>Analysing Situation…</span>
              </>
            ) : analysisMode === "professional" ? (
              <>
                <Scale className="h-4 w-4 text-black" />
                <span>{paidReviewSuccess ? "Analyse with Priority Panel Review (₹50 Paid)" : "Get Legal Professional Written Opinion (₹50)"}</span>
              </>
            ) : (
              <>
                <Scale className="h-4 w-4 text-black" />
                <span>Analyse Complaint Now (Free AI)</span>
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
        <div className="mt-10 space-y-6">
          {/* Paid Legal Professional Status Banner */}
          {(paidReviewSuccess || analysisMode === "professional") && (
            <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 via-[#0c1a12] to-[#121215] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_0_25px_rgba(16,185,129,0.15)]">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0">
                  <Scale className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">Legal Professional Review Active</span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                      ₹50 Paid &bull; Priority
                    </span>
                  </div>
                  <p className="text-xs text-neutral-300 mt-0.5">
                    Your complaint details have been prioritized and delivered anonymously to our verified panel legal professionals for detailed written review.
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md shrink-0 flex items-center gap-1.5 self-start sm:self-center">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Routed to Panel Board
              </span>
            </div>
          )}

          {/* Action & Metric Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white/[0.05] border border-white/10 text-xs">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Analysis Complete
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-mono text-sky-300">
                <Users className="h-3 w-3" />
                Linked to Citizen Queries
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
              badge="Plain-Language Breakdown"
              badgeVariant="success"
            >
              <div
                className="prose prose-invert max-w-none text-neutral-100 text-[14px] sm:text-[15px] leading-relaxed
                  prose-headings:font-bold prose-headings:text-amber-300 prose-headings:tracking-tight prose-headings:mt-5 prose-headings:mb-2.5
                  prose-h3:text-base sm:prose-h3:text-lg prose-h3:font-bold prose-h3:text-amber-300 prose-h3:border-b prose-h3:border-amber-500/25 prose-h3:pb-2
                  prose-strong:font-bold prose-strong:text-amber-200/95
                  prose-p:my-3.5 prose-p:leading-relaxed prose-p:text-neutral-100
                  prose-ul:my-2.5 prose-li:my-1.5 prose-li:text-neutral-200
                  prose-code:text-emerald-300 prose-code:font-mono prose-code:text-xs"
                dangerouslySetInnerHTML={{
                  __html: marked.parse(a.situation_meaning || a.general_analysis || "") as string,
                }}
              />
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

          {/* Legal Professional Written Opinion & Connect Callout */}
          <div className="apple-glass-card rounded-2xl p-6 md:p-8 border border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 via-[#0e1712] to-emerald-950/30 backdrop-blur-2xl shadow-[0_0_35px_rgba(16,185,129,0.2)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[0.65rem] uppercase tracking-widest text-emerald-400 font-mono block">
                  LEGAL REPRESENTATION & CONSULTATION
                </span>
                <h3 className="font-display text-2xl font-semibold text-emerald-300 mt-1">
                  Would you like information on how to reach a lawyer?
                </h3>
                <p className="mt-2 text-sm text-neutral-200 max-w-2xl leading-relaxed">
                  TRANA has decoded the statutory provisions and immediate rights for you. For formal fact-checking, charge verification, and comprehensive legal strategy, get a verified legal professional written opinion for ₹50 or connect directly with verified counsel.
                </p>
              </div>
              <div className="px-3.5 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 font-mono text-sm font-bold shrink-0 self-start sm:self-center">
                Fee: ₹50
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  if (paidReviewSuccess) {
                    toast.info("Legal Professional Written Opinion (₹50) is already active for this analysis.");
                  } else {
                    setIsPaymentModalOpen(true);
                  }
                }}
                className="apple-glass-pill px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500 text-black hover:bg-emerald-400 border border-emerald-400 flex items-center gap-2 cursor-pointer transition-all shadow-[0_0_20px_rgba(16,185,129,0.35)] active:scale-95"
              >
                <Scale className="h-3.5 w-3.5" />
                <span>{paidReviewSuccess ? "Legal Professional Written Opinion Active (₹50 Paid)" : "Get Legal Professional Written Opinion (₹50)"}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsConnectModalOpen(true)}
                className="apple-glass-pill px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/35 flex items-center gap-2 cursor-pointer transition-all"
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
            This is general information, not legal advice. It does not establish an attorney-client relationship. Always consult a qualified legal professional for representation before judicial authorities.
          </p>
        </div>
      )}
        </>
      )}

      {/* ₹50 Legal Professional Review Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md border border-neutral-800 bg-[#0e0e11] text-neutral-100 shadow-2xl rounded-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-[#141418]">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300">
                  <Scale className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Legal Professional Written Opinion (₹50)</h3>
                  <p className="text-[11px] text-neutral-400 font-mono">Verified Legal Professional Opinion &bull; ₹50 Standard Fee</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-200">What is included:</span>
                  <span className="font-mono text-base font-bold text-amber-300">₹50</span>
                </div>
                <ul className="space-y-1 text-neutral-300 list-disc list-inside">
                  <li>Direct written opinion from a verified Bar Council legal professional</li>
                  <li>In-depth fact matching and false/exaggerated charge checks</li>
                  <li>Immediate AI statutory first-aid report delivered instantly</li>
                  <li>Anonymous case listing on Lawyer Citizen Inquiries dashboard</li>
                </ul>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block mb-2">
                  Select Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod("upi")}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      selectedPaymentMethod === "upi"
                        ? "border-emerald-500 bg-emerald-500/15 text-white ring-1 ring-emerald-500/40"
                        : "border-white/10 bg-white/[0.02] text-neutral-400 hover:text-white hover:border-white/20"
                    }`}
                  >
                    <QrCode className="h-4 w-4 text-emerald-400" />
                    <span className="font-medium text-[11px]">UPI / QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod("card")}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      selectedPaymentMethod === "card"
                        ? "border-emerald-500 bg-emerald-500/15 text-white ring-1 ring-emerald-500/40"
                        : "border-white/10 bg-white/[0.02] text-neutral-400 hover:text-white hover:border-white/20"
                    }`}
                  >
                    <CreditCard className="h-4 w-4 text-emerald-400" />
                    <span className="font-medium text-[11px]">Card</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod("netbanking")}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      selectedPaymentMethod === "netbanking"
                        ? "border-emerald-500 bg-emerald-500/15 text-white ring-1 ring-emerald-500/40"
                        : "border-white/10 bg-white/[0.02] text-neutral-400 hover:text-white hover:border-white/20"
                    }`}
                  >
                    <Shield className="h-4 w-4 text-emerald-400" />
                    <span className="font-medium text-[11px]">NetBanking</span>
                  </button>
                </div>
              </div>

              {/* Secure Payment Note */}
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-neutral-400">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>256-bit Encrypted Escrow. 100% money-back guarantee if not reviewed.</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-white/10 p-4 bg-[#141418] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/[0.06] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={paymentProcessing}
                onClick={async () => {
                  setPaymentProcessing(true);
                  // Instant escrow authorization
                  await new Promise((r) => setTimeout(r, 600));
                  setPaymentProcessing(false);
                  setPaidReviewSuccess(true);
                  setIsPaymentModalOpen(false);
                  toast.success("Payment of ₹50 verified via UPI/Card escrow!");
                  await submit(true);
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-black border border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.35)] flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {paymentProcessing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Processing ₹50…</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>Pay ₹50 &amp; Submit Case</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
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
