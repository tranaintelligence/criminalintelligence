import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  MessageSquare, Search, Phone, Lock, ShieldCheck, 
  Send, UserMinus, FileText, ChevronRight, AlertCircle, 
  Clock, CheckCircle2, User 
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLawyerAuth } from "./lawyer";
import { maskConfidentialPatterns } from "@/lib/privacy-mask";
import type { ConsultationChatMessage } from "@/components/ConsultationChatModal";
import { CaseSummaryModal } from "@/components/CaseSummaryViewer";

export const Route = createFileRoute("/_authenticated/lawyer/inbox")({
  head: () => ({
    meta: [
      { title: "Case Inbox — Legal Professional Workspace — TRANA" },
      { name: "description", content: "Direct case communications, client consultations, and active matter inbox." },
      { property: "og:title", content: "Case Inbox — Legal Professional Workspace — TRANA" },
    ],
  }),
  component: LawyerCaseInboxPage,
});

type CaseItem = {
  id: string;
  client: string;
  matterType: string;
  section?: string;
  consultationType: "Call" | "Chat";
  status: "New Request" | "Confirmed" | "Denied" | "Withdrawn" | "Completed";
  date: string;
  intakeBrief?: string;
  lastMessage?: string;
};

function LawyerCaseInboxPage() {
  const { data: lawyer } = useLawyerAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [showCaseSummary, setShowCaseSummary] = useState(false);
  const [messages, setMessages] = useState<ConsultationChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch live consultations from Supabase
  const { data: dbConsults = [] } = useQuery({
    queryKey: ["lawyer-inbox-consultations", lawyer?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("consultations")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Reconcile live consultations, local referrals, and benchmark matters
  const cases: CaseItem[] = useMemo(() => {
    const list: CaseItem[] = [];

    // 1. Add from localStorage referrals (instant sync)
    let localReferrals: any[] = [];
    try {
      if (typeof window !== "undefined") {
        localReferrals = JSON.parse(localStorage.getItem("trana_client_referrals") || "[]");
      }
    } catch {
      // ignore
    }

    (localReferrals || []).forEach((r) => {
      if (r && r.id && !list.some((existing) => existing.id === r.id)) {
        list.push({
          id: r.id,
          client: r.client || "Citizen Client",
          matterType: r.matterType || "Legal Consultation Request",
          section: r.section || "Applicable Statutes",
          consultationType: r.consultationType === "Chat" ? "Chat" : "Call",
          status: (r.status as CaseItem["status"]) || "Confirmed",
          date: r.date || "Today",
          intakeBrief: r.intakeBrief,
          lastMessage: r.summary,
        });
      }
    });

    // 2. Add from Supabase consultations table
    (dbConsults || []).forEach((row) => {
      const rowId = `REF-${row.id.slice(0, 8).toUpperCase()}`;
      if (list.some((existing) => existing.id === rowId)) return;

      const briefText = row.intake_brief || row.note || "";
      let matter = "Legal Consultation Request";
      let sectionStr = "Applicable Statutes";
      if (briefText) {
        const matterMatch = briefText.match(/\*\*Matter\*\*:\s*([^\n]+)/);
        if (matterMatch) matter = matterMatch[1].trim();
        const sectionMatch =
          briefText.match(/\*\*Applicable Statutes\*\*:\s*([^\n]+)/) ||
          briefText.match(/\*\*Sections Identified\*\*:\s*([^\n]+)/);
        if (sectionMatch) sectionStr = sectionMatch[1].trim();
      }

      let clientName = "Citizen Client";
      const clientMatch = briefText.match(/\*\*Client\*\*:\s*([^(•\n]+)/);
      if (clientMatch && clientMatch[1].trim() && clientMatch[1].trim() !== "Citizen Client") {
        clientName = clientMatch[1].trim();
      } else if (row.user_id) {
        clientName = `Citizen (${row.user_id.slice(0, 8)})`;
      }

      const stLower = (row.status || "").toLowerCase();
      const statusLabel =
        stLower === "completed"
          ? "Completed"
          : stLower === "confirmed"
          ? "Confirmed"
          : stLower === "denied"
          ? "Denied"
          : "New Request";

      list.push({
        id: rowId,
        client: clientName,
        matterType: matter,
        section: sectionStr,
        consultationType: row.consult_type === "chat" ? "Chat" : "Call",
        status: statusLabel,
        date: row.created_at
          ? new Date(row.created_at).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "Today",
        intakeBrief: briefText,
      });
    });

    return list;
  }, [dbConsults]);

  // Default selected case
  useEffect(() => {
    if (cases.length > 0 && !selectedCaseId) {
      setSelectedCaseId(cases[0].id);
    }
  }, [cases, selectedCaseId]);

  const activeCase = useMemo(() => {
    return cases.find((c) => c.id === selectedCaseId) || cases[0];
  }, [cases, selectedCaseId]);

  const storageKey = activeCase ? `trana_consult_chat_${activeCase.id}` : "";

  // Load and subscribe to real-time chat messages for the selected case
  useEffect(() => {
    if (!activeCase || !storageKey) return;

    function loadMessages() {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
            return;
          }
        }

        // Initialize persistent channel with initial notice
        const initialSystem: ConsultationChatMessage[] = [
          {
            id: `msg-sys-${Date.now()}`,
            sender: "system",
            senderName: "TRANA Secure Relay",
            text: `Confidential consultation channel active for ${activeCase.client} with Counsel ${lawyer?.full_name || "Advocate"} (Mode: ${activeCase.consultationType}). Contact particulars and phone numbers are masked (XXXXX) for privacy.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ];
        localStorage.setItem(storageKey, JSON.stringify(initialSystem));
        setMessages(initialSystem);
      } catch (err) {
        console.warn("Failed to load chat:", err);
      }
    }

    loadMessages();

    function handleChatUpdate() {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          setMessages(JSON.parse(raw));
        }
      } catch {
        // ignore
      }
    }

    window.addEventListener("storage", handleChatUpdate);
    window.addEventListener("trana_consult_chat_update", handleChatUpdate);

    return () => {
      window.removeEventListener("storage", handleChatUpdate);
      window.removeEventListener("trana_consult_chat_update", handleChatUpdate);
    };
  }, [activeCase, storageKey, lawyer?.full_name]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim() || !activeCase || !storageKey) return;

    // Mask phone numbers, digit sequences, and Morse code to XXXXX
    const maskedText = maskConfidentialPatterns(inputText.trim());

    const newMessage: ConsultationChatMessage = {
      id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      sender: "lawyer",
      senderName: lawyer?.full_name || "Advocate Counsel",
      text: maskedText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updated = [...messages, newMessage];
    setMessages(updated);
    setInputText("");

    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
      const chatIndex = JSON.parse(localStorage.getItem("trana_all_consultation_chats_index") || "{}");
      chatIndex[activeCase.id] = {
        consultationId: activeCase.id,
        clientName: activeCase.client,
        lawyerName: lawyer?.full_name || "Advocate Counsel",
        consultationType: activeCase.consultationType,
        status: activeCase.status,
        lastMessage: maskedText,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem("trana_all_consultation_chats_index", JSON.stringify(chatIndex));
      window.dispatchEvent(new Event("trana_consult_chat_update"));
      window.dispatchEvent(new StorageEvent("storage", { key: storageKey }));
    } catch (err) {
      console.warn("Failed to save message:", err);
    }
  }

  // Lawyer Action: Leave Case
  async function handleLeaveCase() {
    if (!activeCase) return;
    const confirmed = window.confirm(
      `Are you sure you want to withdraw/leave the case for ${activeCase.client}? The client will be notified and given the option to consult another lawyer from the directory.`
    );
    if (!confirmed) return;

    const systemNotice: ConsultationChatMessage = {
      id: `msg-leave-${Date.now()}`,
      sender: "system",
      senderName: "TRANA Secure Relay",
      text: `Advocate ${lawyer?.full_name || "Counsel"} has withdrawn from this matter. Client is now free to consult another lawyer from the directory.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updated = [...messages, systemNotice];
    setMessages(updated);
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    }

    try {
      const chatIndex = JSON.parse(localStorage.getItem("trana_all_consultation_chats_index") || "{}");
      if (chatIndex[activeCase.id]) {
        chatIndex[activeCase.id].status = "Denied";
        chatIndex[activeCase.id].lastMessage = "Advocate has withdrawn from this matter.";
        chatIndex[activeCase.id].lastUpdated = new Date().toISOString();
        localStorage.setItem("trana_all_consultation_chats_index", JSON.stringify(chatIndex));
      }
    } catch {
      // ignore
    }

    const dbId = activeCase.id.replace(/^REF-/, "");
    try {
      await supabase.from("consultations").update({ status: "denied" }).or(`id.eq.${dbId},id.ilike.${dbId}%`);
    } catch (e) {
      console.warn("Supabase update error:", e);
    }

    try {
      const local = JSON.parse(localStorage.getItem("trana_client_referrals") || "[]");
      const updatedLocal = local.map((r: any) =>
        r.id === activeCase.id ? { ...r, status: "Denied", lawyerWithdrawn: true } : r
      );
      localStorage.setItem("trana_client_referrals", JSON.stringify(updatedLocal));
    } catch {
      // ignore
    }

    qc.invalidateQueries({ queryKey: ["lawyer-inbox-consultations"] });
    qc.invalidateQueries({ queryKey: ["lawyer-referrals-consultations"] });
    qc.invalidateQueries({ queryKey: ["consultations"] });
    qc.invalidateQueries({ queryKey: ["citizen-consultations-lock"] });

    window.dispatchEvent(new Event("trana_consult_chat_update"));
    toast.warning(`You have withdrawn from the case for ${activeCase.client}. Client is now free to consult another lawyer.`);
  }

  const filteredCases = cases.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.client.toLowerCase().includes(q) ||
      c.matterType.toLowerCase().includes(q) ||
      (c.section && c.section.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="border-b border-[#222222] pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[0.65rem] uppercase tracking-widest text-[#888888] font-mono block">
            CONFIDENTIAL CLIENT-COUNSEL RELAY
          </span>
          <h1 className="font-display text-4xl md:text-5xl font-medium text-white mt-1">
            Case Inbox
          </h1>
          <p className="mt-1.5 text-xs text-[#999999]">
            Active consultation chats, structured matter intake, and direct client correspondence.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="border border-white/20 bg-[#1A1A1A] px-3.5 py-1.5 text-xs font-mono text-white">
            Active Matters: {cases.filter((c) => c.status !== "Denied" && c.status !== "Completed").length}
          </div>
        </div>
      </div>

      {/* Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px] bg-[#141414] border border-[#2E2E2E]">
        {/* Left Column: Cases List */}
        <div className="lg:col-span-4 border-r border-[#262626] flex flex-col h-full bg-[#121212]">
          {/* Search Bar */}
          <div className="p-3.5 border-b border-[#262626]">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#666666]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cases by client or matter..."
                className="w-full border border-[#333333] bg-[#0A0A0A] py-2 pl-9 pr-3 text-xs text-white placeholder:text-[#555555] focus:border-white focus:outline-none"
              />
            </div>
          </div>

          {/* Cases Feed */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#202020]">
            {filteredCases.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#777777] font-mono">
                No client consultation matters found.
              </div>
            ) : (
              filteredCases.map((c) => {
              const isSelected = c.id === activeCase?.id;
              const isConfirmed = c.status === "Confirmed";
              const isDenied = c.status === "Denied";

              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCaseId(c.id)}
                  className={`w-full text-left p-4 transition-colors block ${
                    isSelected
                      ? "bg-[#1E1E1E] border-l-2 border-white"
                      : "hover:bg-[#181818] border-l-2 border-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-[#2A2A2A] border border-white/10 flex items-center justify-center text-[0.65rem] font-bold text-white uppercase">
                        {c.client.charAt(0)}
                      </div>
                      <span className="font-medium text-white text-sm truncate max-w-[150px]">
                        {c.client}
                      </span>
                    </div>

                    <span
                      className={`text-[0.6rem] font-mono uppercase px-2 py-0.5 rounded border ${
                        isConfirmed
                          ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-300"
                          : isDenied
                          ? "border-red-500/50 bg-red-950/40 text-red-400"
                          : "border-amber-500/50 bg-amber-950/40 text-amber-300"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>

                  <p className="text-xs text-[#CCCCCC] mt-1.5 line-clamp-1 font-sans">
                    {c.matterType}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between text-[0.65rem] text-[#888888] font-mono">
                    <span className="flex items-center gap-1">
                      {c.consultationType === "Call" ? (
                        <Phone className="h-2.5 w-2.5 text-sky-400" />
                      ) : (
                        <MessageSquare className="h-2.5 w-2.5 text-purple-400" />
                      )}
                      {c.consultationType}
                    </span>
                    <span>{c.date}</span>
                  </div>
                </button>
              );
            })
          )}
          </div>
        </div>

        {/* Right Column: Live Case Chat */}
        {activeCase ? (
          <div className="lg:col-span-8 flex flex-col h-full bg-[#0F0F0F]">
            {/* Chat Header */}
            <div className="p-4 border-b border-[#262626] bg-[#161616] flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[0.65rem] font-mono uppercase tracking-widest text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                    <Lock className="h-3 w-3 inline mr-1" />
                    Masked Relay
                  </span>
                  <span className="text-[0.65rem] font-mono uppercase text-[#AAAAAA] bg-[#222222] border border-[#333333] px-2 py-0.5 rounded">
                    {activeCase.consultationType === "Call" ? "Phone Consultation" : "Secure In-App Chat"}
                  </span>
                  <span
                    className={`text-[0.65rem] font-mono uppercase px-2 py-0.5 rounded border ${
                      activeCase.status === "Confirmed"
                        ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-300"
                        : activeCase.status === "Denied"
                        ? "border-red-500/50 bg-red-950/40 text-red-400"
                        : "border-amber-500/50 bg-amber-950/40 text-amber-300"
                    }`}
                  >
                    {activeCase.status}
                  </span>
                </div>
                <h2 className="mt-1 font-display text-2xl font-medium text-white">
                  {activeCase.client}
                </h2>
                <p className="text-xs text-[#999999] mt-0.5">
                  Matter: {activeCase.matterType}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {activeCase.intakeBrief && (
                  <button
                    type="button"
                    onClick={() => setShowCaseSummary(true)}
                    className="border border-emerald-500/40 bg-emerald-950/20 hover:bg-emerald-900/40 text-emerald-300 px-3 py-1.5 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors rounded"
                    title="View Comprehensive Case Summary"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Case Summary</span>
                  </button>
                )}
                {activeCase.status !== "Denied" && (
                  <button
                    type="button"
                    onClick={handleLeaveCase}
                    className="border border-red-500/50 bg-red-950/30 text-red-300 hover:bg-red-900/40 px-3 py-1.5 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors rounded"
                    title="Withdraw from representing this matter"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                    <span>Leave Case</span>
                  </button>
                )}
                <Link
                  to="/lawyer/drafter"
                  className="border border-white/30 px-3 py-1.5 text-xs uppercase tracking-wider text-white hover:border-white transition-colors"
                >
                  AI Drafter
                </Link>
              </div>
            </div>

            {/* Privacy Compliance Strip */}
            <div className="bg-[#121212] border-b border-[#222222] px-4 py-2 text-[0.7rem] text-[#888888] flex items-center gap-2 font-mono">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>
                Zero Evasion Guard: All phone numbers, sequences, and Morse code are automatically masked to XXXXX.
              </span>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#0C0C0C]">
              {messages.map((m) => {
                if (m.sender === "system") {
                  return (
                    <div key={m.id} className="text-center my-2">
                      <div className="inline-block max-w-[85%] border border-[#262626] bg-[#141414] px-3.5 py-2 text-[0.75rem] text-[#AAAAAA] rounded font-mono leading-relaxed">
                        {m.text}
                      </div>
                    </div>
                  );
                }

                const isMe = m.sender === "lawyer";

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 text-[0.65rem] text-[#777777] font-mono mb-1">
                      <span className="font-semibold text-[#AAAAAA]">{m.senderName}</span>
                      <span>•</span>
                      <span>{m.timestamp}</span>
                    </div>
                    <div
                      className={`max-w-[80%] rounded px-3.5 py-2.5 text-sm leading-relaxed ${
                        isMe
                          ? "bg-white text-black font-sans shadow-md"
                          : "bg-[#1C1C1C] text-white border border-[#2B2B2B]"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Box */}
            <form onSubmit={handleSend} className="border-t border-[#262626] bg-[#161616] p-3 flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Message ${activeCase.client}... (Numbers & sequences masked to XXXXX)`}
                className="flex-1 border border-[#333333] bg-[#0A0A0A] px-3.5 py-2.5 text-sm text-white placeholder:text-[#555555] focus:border-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="bg-white text-black px-4 py-2.5 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-200 transition-colors disabled:opacity-40 flex items-center gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>
        ) : (
          <div className="lg:col-span-8 flex items-center justify-center p-12 text-[#666666] font-mono text-xs">
            No active cases available in inbox.
          </div>
        )}
      </div>

      {/* Case Summary Modal */}
      {showCaseSummary && activeCase && (
        <CaseSummaryModal
          isOpen={showCaseSummary}
          onClose={() => setShowCaseSummary(false)}
          clientName={activeCase.client}
          matterType={activeCase.matterType}
          consultationType={activeCase.consultationType}
          content={activeCase.intakeBrief || ""}
        />
      )}
    </div>
  );
}
