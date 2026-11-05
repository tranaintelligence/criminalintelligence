import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  MessageSquare, Search, Phone, ShieldCheck, Download, 
  ExternalLink, User, CheckCircle2, XCircle, Clock, RefreshCw, 
  AlertTriangle, ArrowRight, ShieldAlert, Sparkles, Filter,
  Bot, Scale, FileText, Lock, Check, Layers
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranaCredential } from "@/lib/trana-auth";
import { getAdminAllChats, AdminUserChatSession } from "@/lib/trana-admin-api";
import { maskConfidentialPatterns } from "@/lib/privacy-mask";

export const Route = createFileRoute("/founders/chats")({
  head: () => ({
    meta: [
      { title: "Real Chat Monitor — TRANA Founders" },
      { name: "description", content: "Supervisory oversight, telemetry audit, and compliance monitoring across platform Legal AI inquiries and advocate consultations." },
      { property: "og:title", content: "Real Chat Monitor — TRANA Founders" },
    ],
  }),
  component: FoundersChatsPage,
});

export type RealChatMessage = {
  id: string;
  sender: "citizen" | "ai" | "lawyer" | "system";
  senderName: string;
  text: string;
  timestamp: string;
  modelUsed?: string | null;
  processingTime?: number | null;
  structuredContent?: any;
  sources?: any;
};

export type RealChatSession = {
  id: string;
  category: "ai" | "advocate";
  title: string;
  participantPrimary: string;
  participantSecondary: string;
  mode: "Legal AI" | "Chat" | "Call";
  status: string;
  lastMessage: string;
  lastUpdated: string;
  timestampSort: number;
  messageCount: number;
  maskingInterceptions: number;
  messages: RealChatMessage[];
  intakeBrief?: string | null;
};

function FoundersChatsPage() {
  const { credential } = useTranaCredential();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "ai" | "advocate">("all");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [liveTrigger, setLiveTrigger] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Real Legal AI Chat Sessions from Backend Database
  const { 
    data: adminChats = [], 
    refetch: refetchAdminChats,
    isFetching: isFetchingAdminChats,
  } = useQuery({
    queryKey: ["founders-all-backend-chats", credential, liveTrigger],
    queryFn: async () => {
      if (!credential) return [];
      try {
        const chats = await getAdminAllChats(credential, { limit: 300 });
        return chats || [];
      } catch (err) {
        console.warn("Could not fetch admin platform chats:", err);
        return [];
      }
    },
    enabled: Boolean(credential),
    refetchInterval: 15000,
  });

  // 2. Fetch Real Advocate Consultations from Supabase
  const { 
    data: dbConsults = [], 
    refetch: refetchConsults,
    isFetching: isFetchingConsults,
  } = useQuery({
    queryKey: ["founders-all-consultations", liveTrigger],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("Founders consultations fetch error:", error);
        return [];
      }
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  // Real-time synchronization events (same window and cross-tab)
  useEffect(() => {
    function handleUpdate() {
      setLiveTrigger((prev) => prev + 1);
      refetchAdminChats();
      refetchConsults();
    }
    window.addEventListener("storage", handleUpdate);
    window.addEventListener("trana_consult_chat_update", handleUpdate);
    return () => {
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener("trana_consult_chat_update", handleUpdate);
    };
  }, [refetchAdminChats, refetchConsults]);

  // Aggregate and normalize all real sessions into Unified RealChatSession format
  const sessions: RealChatSession[] = useMemo(() => {
    const list: RealChatSession[] = [];

    // --- Process Real Platform Legal AI Chats ---
    (adminChats || []).forEach((s: AdminUserChatSession) => {
      if (!s || !s.id) return;

      const msgs: RealChatMessage[] = (s.messages || []).map((m, idx) => {
        const isUser = m.role === "user";
        return {
          id: m.id || `msg-ai-${s.id}-${idx}`,
          sender: isUser ? "citizen" : "ai",
          senderName: isUser ? s.user_email : "TRANA Legal AI",
          text: m.content || "",
          timestamp: m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
          modelUsed: m.model_used,
          processingTime: m.processing_time_seconds,
          structuredContent: m.structured_content,
          sources: m.sources,
        };
      });

      // Mask count for user inquiries if any
      const maskCount = msgs.reduce((acc, m) => {
        const matches = (m.text || "").match(/XXXXX/g);
        return acc + (matches ? matches.length : 0);
      }, 0);

      const lastMsgText = msgs.length > 0 ? msgs[msgs.length - 1].text : "Session initiated";
      const sessionDate = s.updated_at || s.created_at;
      const sortTime = sessionDate ? new Date(sessionDate).getTime() : 0;

      list.push({
        id: s.id,
        category: "ai",
        title: s.title || "Legal Inquiry",
        participantPrimary: s.user_email || "Anonymous Citizen",
        participantSecondary: "TRANA Legal AI",
        mode: "Legal AI",
        status: s.deleted_by_user ? "Archived by User" : "Active Session",
        lastMessage: lastMsgText,
        lastUpdated: sessionDate 
          ? new Date(sessionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
          : "Recent",
        timestampSort: sortTime,
        messageCount: s.message_count || msgs.length,
        maskingInterceptions: maskCount,
        messages: msgs,
      });
    });

    // --- Process Real Advocate Consultations ---
    (dbConsults || []).forEach((row) => {
      if (!row || !row.id) return;
      const rowId = `REF-${row.id.slice(0, 8).toUpperCase()}`;

      const briefText = row.intake_brief || "";
      let clientName = "Citizen Client";
      if (briefText) {
        const clientMatch = briefText.match(/\*\*Client\*\*:\s*([^(•\n]+)/);
        if (clientMatch && clientMatch[1].trim() && clientMatch[1].trim() !== "Citizen Client") {
          clientName = clientMatch[1].trim();
        } else if (row.user_id) {
          clientName = `Citizen (${row.user_id.slice(0, 8)})`;
        }
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
          ? "Withdrawn"
          : "Requested";

      // Parse messages from note field or fallback to localStorage
      let consultMessages: RealChatMessage[] = [];
      if (row.note) {
        try {
          const parsed = JSON.parse(row.note);
          if (Array.isArray(parsed) && parsed.length > 0) {
            consultMessages = parsed.map((m: any, idx: number) => ({
              id: m.id || `msg-adv-${idx}`,
              sender: m.sender === "lawyer" ? "lawyer" : m.sender === "system" ? "system" : "citizen",
              senderName: m.senderName || (m.sender === "lawyer" ? (row.lawyer_name || "Advocate") : clientName),
              text: m.text || "",
              timestamp: m.timestamp || "",
            }));
          }
        } catch {
          // not stored as JSON
        }
      }

      if (consultMessages.length === 0 && typeof window !== "undefined") {
        const localRaw = localStorage.getItem(`trana_consult_chat_${row.id}`) || localStorage.getItem(`trana_consult_chat_${rowId}`);
        if (localRaw) {
          try {
            const parsed = JSON.parse(localRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              consultMessages = parsed.map((m: any, idx: number) => ({
                id: m.id || `msg-adv-${idx}`,
                sender: m.sender === "lawyer" ? "lawyer" : m.sender === "system" ? "system" : "citizen",
                senderName: m.senderName || (m.sender === "lawyer" ? (row.lawyer_name || "Advocate") : clientName),
                text: m.text || "",
                timestamp: m.timestamp || "",
              }));
            }
          } catch {}
        }
      }

      // If no messages exchanged yet, provide system channel status
      if (consultMessages.length === 0) {
        consultMessages.push({
          id: `msg-init-${row.id}`,
          sender: "system",
          senderName: "TRANA Relay",
          text: `Consultation requested for ${clientName} with ${row.lawyer_name || "Advocate"}. Channel mode: ${row.consult_type === "call" ? "Telephonic Relay" : "Secure In-App Chat"}.`,
          timestamp: row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Created",
        });
      }

      const maskCount = consultMessages.reduce((acc, m) => {
        const matches = (m.text || "").match(/XXXXX/g);
        return acc + (matches ? matches.length : 0);
      }, 0);

      const lastMsg = consultMessages[consultMessages.length - 1]?.text || (briefText ? `Inquiry: ${briefText.slice(0, 80)}...` : "Consultation requested with counsel.");
      const sortTime = row.created_at ? new Date(row.created_at).getTime() : 0;

      list.push({
        id: rowId,
        category: "advocate",
        title: briefText ? briefText.slice(0, 50) + "..." : `Consultation with ${row.lawyer_name || "Counsel"}`,
        participantPrimary: clientName,
        participantSecondary: row.lawyer_name || "Advocate Counsel",
        mode: row.consult_type === "call" ? "Call" : "Chat",
        status: statusLabel,
        lastMessage: lastMsg,
        lastUpdated: row.created_at ? new Date(row.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "Today",
        timestampSort: sortTime,
        messageCount: consultMessages.length,
        maskingInterceptions: maskCount,
        messages: consultMessages,
        intakeBrief: briefText || null,
      });
    });

    // Sort newest first
    return list.sort((a, b) => b.timestampSort - a.timestampSort);
  }, [adminChats, dbConsults]);

  // Keep selection synchronized
  useEffect(() => {
    if (sessions.length > 0 && !sessions.some(s => s.id === selectedSessionId)) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  // Active selected session
  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === selectedSessionId) || sessions[0] || null;
  }, [sessions, selectedSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages]);

  // Aggregate Platform Telemetry Metrics (derived 100% from real database data)
  const stats = useMemo(() => {
    const totalSessions = sessions.length;
    const aiSessions = sessions.filter(s => s.category === "ai").length;
    const advocateSessions = sessions.filter(s => s.category === "advocate").length;
    
    let totalMessages = 0;
    let totalInterceptions = 0;
    const uniqueParticipants = new Set<string>();

    sessions.forEach((s) => {
      totalMessages += s.messageCount;
      totalInterceptions += s.maskingInterceptions;
      if (s.participantPrimary) uniqueParticipants.add(s.participantPrimary.toLowerCase());
    });

    return {
      totalSessions,
      aiSessions,
      advocateSessions,
      totalMessages,
      totalInterceptions,
      uniqueParticipants: uniqueParticipants.size,
    };
  }, [sessions]);

  // Filtered session list
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (categoryFilter === "ai" && s.category !== "ai") return false;
      if (categoryFilter === "advocate" && s.category !== "advocate") return false;

      if (statusFilter !== "All") {
        if (s.category === "advocate" && s.status !== statusFilter) return false;
        if (s.category === "ai" && statusFilter === "Withdrawn") return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          s.participantPrimary.toLowerCase().includes(q) ||
          s.participantSecondary.toLowerCase().includes(q) ||
          s.title.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          s.lastMessage.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [sessions, categoryFilter, statusFilter, search]);

  // Export full transcript as audit log
  function handleExportTranscript() {
    if (!activeSession) return;
    const lines = [
      `============================================================`,
      `TRANA LEGAL PLATFORM — SUPERVISORY CHAT AUDIT LOG`,
      `============================================================`,
      `Session ID          : ${activeSession.id}`,
      `Category            : ${activeSession.category === "ai" ? "Platform Legal AI Session" : "Client-Advocate Consultation"}`,
      `Primary Participant : ${activeSession.participantPrimary}`,
      `Interlocutor        : ${activeSession.participantSecondary}`,
      `Channel Mode        : ${activeSession.mode}`,
      `Status              : ${activeSession.status}`,
      `Total Messages      : ${activeSession.messages.length}`,
      `Audit Export Date   : ${new Date().toLocaleString("en-IN")}`,
      `============================================================\n`,
    ];

    if (activeSession.intakeBrief) {
      lines.push(`--- CASE INTAKE BRIEF ---`);
      lines.push(`${activeSession.intakeBrief}\n`);
    }

    lines.push(`--- MESSAGE TRANSCRIPT ---`);
    activeSession.messages.forEach((m) => {
      const senderTag = `[${m.senderName.toUpperCase()}]`;
      const meta = m.modelUsed ? ` (Model: ${m.modelUsed}${m.processingTime ? `, ${m.processingTime}s` : ""})` : "";
      lines.push(`${m.timestamp || ""} ${senderTag}${meta}:\n${m.text}\n`);
    });

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TRANA_AUDIT_${activeSession.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Transcript for ${activeSession.id} exported successfully.`);
  }

  // Format message text and visually highlight any masked tokens
  function renderMaskedText(text: string) {
    if (!text.includes("XXXXX")) {
      return <span className="whitespace-pre-wrap">{text}</span>;
    }
    const parts = text.split(/(XXXXX)/g);
    return (
      <span className="whitespace-pre-wrap">
        {parts.map((part, i) =>
          part === "XXXXX" ? (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 px-1 py-0.5 mx-0.5 rounded bg-white/10 border border-white/20 text-white font-mono font-bold text-[0.8rem] tracking-widest shadow-sm"
              title="TRANA Privacy Shield: Phone number, digits, or Morse code masked to protect neutrality"
            >
              <ShieldCheck className="h-3 w-3 inline text-emerald-400" />
              XXXXX
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  }

  const isSyncing = isFetchingAdminChats || isFetchingConsults;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#222222] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[0.65rem] border border-white/20 px-2 py-0.5 text-neutral-300 font-mono tracking-widest uppercase">
              Supervisory Monitor
            </span>
            <span className="text-xs text-[#888888] font-mono">• Founders Console</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl text-[#F0F0F0] mt-1">
            Platform Chat Monitor
          </h1>
          <p className="text-xs md:text-sm text-[#999999] mt-1 max-w-3xl">
            Real-time telemetry and supervisory oversight of legal inquiry sessions and client-advocate consultations. Live database-backed records only.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              refetchAdminChats();
              refetchConsults();
              setLiveTrigger((p) => p + 1);
              toast.success("All platform chat streams synchronized.");
            }}
            disabled={isSyncing}
            className="border border-[#333333] hover:border-white/40 bg-[#141414] hover:bg-[#1E1E1E] px-3.5 py-2 text-xs font-mono uppercase tracking-wider text-[#F0F0F0] flex items-center gap-2 transition-all rounded"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-neutral-300 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Sync Streams"}</span>
          </button>
        </div>
      </div>

      {/* High-Level Metric Tiles (Real Platform Data) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 font-mono">
        <div className="border border-[#222222] bg-[#111111] p-4 rounded">
          <div className="text-[0.7rem] text-[#888888] uppercase tracking-wider flex items-center justify-between">
            <span>Total Real Sessions</span>
            <MessageSquare className="h-4 w-4 text-neutral-300" />
          </div>
          <div className="mt-2 text-2xl md:text-3xl font-bold text-[#F0F0F0]">
            {stats.totalSessions}
          </div>
          <div className="mt-1 text-[0.65rem] text-[#888888]">
            {stats.aiSessions} Legal AI • {stats.advocateSessions} Consultations
          </div>
        </div>

        <div className="border border-[#222222] bg-[#111111] p-4 rounded">
          <div className="text-[0.7rem] text-[#888888] uppercase tracking-wider flex items-center justify-between">
            <span>Messages Audited</span>
            <Sparkles className="h-4 w-4 text-neutral-300" />
          </div>
          <div className="mt-2 text-2xl md:text-3xl font-bold text-[#F0F0F0]">
            {stats.totalMessages}
          </div>
          <div className="mt-1 text-[0.65rem] text-[#888888]">
            Database-backed queries + replies
          </div>
        </div>

        <div className="border border-[#222222] bg-[#111111] p-4 rounded">
          <div className="text-[0.7rem] text-[#888888] uppercase tracking-wider flex items-center justify-between">
            <span>Active Inquirers</span>
            <User className="h-4 w-4 text-neutral-300" />
          </div>
          <div className="mt-2 text-2xl md:text-3xl font-bold text-[#F0F0F0]">
            {stats.uniqueParticipants}
          </div>
          <div className="mt-1 text-[0.65rem] text-[#888888]">
            Distinct citizen accounts on platform
          </div>
        </div>

        <div className="border border-[#222222] bg-[#111111] p-4 rounded">
          <div className="text-[0.7rem] text-[#888888] uppercase tracking-wider flex items-center justify-between">
            <span>Anti-Evasion Shield</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-lg md:text-xl font-bold text-emerald-400 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>ENFORCED</span>
          </div>
          <div className="mt-1 text-[0.65rem] text-[#888888]">
            {stats.totalInterceptions} numbers masked to XXXXX
          </div>
        </div>
      </div>

      {/* Main Workspace: Split Master-Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
        {/* Left Column: Real Session Directory (5 cols) */}
        <div className="lg:col-span-5 flex flex-col border border-[#222222] bg-[#111111] rounded overflow-hidden">
          {/* Search and Category Filters */}
          <div className="p-3 border-b border-[#222222] space-y-3 bg-[#141414]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#666666]" />
              <input
                type="text"
                placeholder="Search citizen email, title, or inquiry..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0E0E0E] border border-[#2A2A2A] text-xs text-[#F0F0F0] pl-9 pr-3 py-2 font-mono placeholder:text-[#555555] focus:outline-none focus:border-white transition-colors rounded"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[0.7rem]">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={`px-2.5 py-1 border transition-colors rounded ${
                  categoryFilter === "all"
                    ? "border-white bg-[#242424] text-white"
                    : "border-[#2A2A2A] text-[#888888] hover:text-white"
                }`}
              >
                All Real Chats ({sessions.length})
              </button>

              <button
                type="button"
                onClick={() => setCategoryFilter("ai")}
                className={`px-2.5 py-1 border transition-colors rounded flex items-center gap-1 ${
                  categoryFilter === "ai"
                    ? "border-white bg-[#242424] text-white"
                    : "border-[#2A2A2A] text-[#888888] hover:text-white"
                }`}
              >
                <Bot className="h-3 w-3" />
                <span>Legal AI ({stats.aiSessions})</span>
              </button>

              <button
                type="button"
                onClick={() => setCategoryFilter("advocate")}
                className={`px-2.5 py-1 border transition-colors rounded flex items-center gap-1 ${
                  categoryFilter === "advocate"
                    ? "border-white bg-[#242424] text-white"
                    : "border-[#2A2A2A] text-[#888888] hover:text-white"
                }`}
              >
                <Scale className="h-3 w-3" />
                <span>Advocates ({stats.advocateSessions})</span>
              </button>
            </div>
          </div>

          {/* Real Session Feed */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#1D1D1D] max-h-[580px]">
            {filteredSessions.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#777777] font-mono flex flex-col items-center gap-2">
                <MessageSquare className="h-6 w-6 text-[#444444]" />
                <span className="font-semibold text-[#AAAAAA]">No real chat sessions found</span>
                <span className="text-[0.65rem] text-[#666666]">
                  {search ? "No sessions match your search terms." : "There are currently no recorded sessions in this category."}
                </span>
              </div>
            ) : (
              filteredSessions.map((s) => {
                const isSelected = s.id === activeSession?.id;
                const isAI = s.category === "ai";

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSessionId(s.id)}
                    className={`w-full text-left p-3.5 transition-all flex flex-col gap-1.5 ${
                      isSelected
                        ? "bg-[#1E1E1E] border-l-2 border-white"
                        : "hover:bg-[#161616] border-l-2 border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-[#F0F0F0] truncate flex items-center gap-1.5">
                        {isAI ? (
                          <Bot className="h-3.5 w-3.5 text-neutral-300 shrink-0" />
                        ) : (
                          <User className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                        )}
                        <span className="truncate">{s.participantPrimary}</span>
                      </span>
                      <span className="text-[0.65rem] font-mono text-[#888888] shrink-0">
                        {s.lastUpdated}
                      </span>
                    </div>

                    <div className="text-[0.75rem] text-[#CCCCCC] truncate font-medium flex items-center gap-1">
                      <span className="text-[#666666]">{isAI ? "Topic:" : "Counsel:"}</span>
                      <span className="text-[#E0E0E0] truncate">{isAI ? s.title : s.participantSecondary}</span>
                    </div>

                    <p className="text-[0.7rem] text-[#777777] truncate font-mono">
                      {s.lastMessage}
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-1 font-mono text-[0.65rem]">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 border border-white/20 bg-white/5 text-neutral-300 uppercase tracking-wider rounded">
                          {s.mode}
                        </span>

                        <span className="px-1.5 py-0.5 border border-[#333333] text-[#AAAAAA] uppercase tracking-wider rounded">
                          {s.messageCount} msg{s.messageCount === 1 ? "" : "s"}
                        </span>
                      </div>

                      {s.maskingInterceptions > 0 && (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          <span>{s.maskingInterceptions} Masked</span>
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Real Chat Transcript Supervisory Inspector (7 cols) */}
        <div className="lg:col-span-7 flex flex-col border border-[#222222] bg-[#111111] rounded overflow-hidden">
          {activeSession ? (
            <>
              {/* Active Session Header */}
              <div className="p-4 border-b border-[#222222] bg-[#161616] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display text-lg text-white">
                      {activeSession.participantPrimary}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-[#666666]" />
                    <span className="font-display text-lg text-neutral-300 flex items-center gap-1.5">
                      {activeSession.category === "ai" && <Bot className="h-4 w-4 text-neutral-300 inline" />}
                      {activeSession.participantSecondary}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[0.7rem] text-[#888888] flex-wrap">
                    <span>ID: {activeSession.id.slice(0, 16)}...</span>
                    <span>•</span>
                    <span className="uppercase">{activeSession.mode}</span>
                    <span>•</span>
                    <span className="text-neutral-300">{activeSession.status}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportTranscript}
                    className="border border-[#333333] hover:border-white/40 bg-[#0E0E0E] hover:bg-[#202020] px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-[#F0F0F0] flex items-center gap-1.5 transition-colors rounded"
                    title="Export verified transcript"
                  >
                    <Download className="h-3.5 w-3.5 text-neutral-300" />
                    <span>Download Log</span>
                  </button>
                </div>
              </div>

              {/* Anti-Evasion Privacy Banner */}
              <div className="bg-[#0E0E0E] border-b border-[#222222] px-4 py-2.5 text-[0.7rem] font-mono text-[#AAAAAA] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>
                    TRANA Anti-Evasion Privacy Engine: Contact numbers, digits, and Morse code transmissions are masked to <strong className="text-white">XXXXX</strong>.
                  </span>
                </div>
                <span className="hidden sm:inline text-[0.65rem] border border-white/20 text-neutral-300 px-1.5 py-0.5 rounded">
                  VERIFIED AUDIT LOG
                </span>
              </div>

              {/* Case Brief if available */}
              {activeSession.intakeBrief && (
                <div className="p-3.5 bg-[#141414] border-b border-[#222222] text-xs font-mono text-[#CCCCCC] space-y-1">
                  <div className="text-[0.65rem] uppercase text-[#888888] tracking-widest font-bold">
                    Intake Case Brief
                  </div>
                  <p className="line-clamp-2 text-[#999999]">
                    {activeSession.intakeBrief}
                  </p>
                </div>
              )}

              {/* Real Chat Messages Stream */}
              <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4 bg-[#0A0A0A] max-h-[520px]">
                {activeSession.messages.length === 0 ? (
                  <div className="text-center py-12 text-xs font-mono text-[#777777]">
                    No messages recorded in this conversation yet.
                  </div>
                ) : (
                  activeSession.messages.map((msg) => {
                    if (msg.sender === "system") {
                      return (
                        <div key={msg.id} className="flex justify-center my-2">
                          <div className="border border-[#333333] bg-[#141414] px-4 py-2 text-[0.75rem] text-[#888888] font-mono max-w-xl text-center flex items-center gap-2 rounded">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            <span>{msg.text}</span>
                          </div>
                        </div>
                      );
                    }

                    const isAI = msg.sender === "ai";
                    const isLawyer = msg.sender === "lawyer";
                    const isCitizen = msg.sender === "citizen";

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isCitizen ? "items-start" : "items-end"}`}
                      >
                        <div className="flex items-center gap-2 mb-1 text-[0.7rem] font-mono text-[#888888]">
                          <span className={isCitizen ? "text-white font-medium" : "text-neutral-300 font-medium"}>
                            {msg.senderName}
                          </span>
                          <span className="text-[0.65rem] uppercase px-1 border border-[#333333] text-[#777777] rounded">
                            {isAI ? "Platform AI" : isLawyer ? "Advocate Counsel" : "Citizen Client"}
                          </span>
                          {msg.modelUsed && (
                            <span className="text-[0.65rem] px-1 border border-white/20 text-neutral-300 font-mono rounded">
                              {msg.modelUsed}
                            </span>
                          )}
                          {msg.processingTime && (
                            <span className="text-[0.65rem] text-[#666666]">
                              {msg.processingTime.toFixed(1)}s
                            </span>
                          )}
                          <span>{msg.timestamp}</span>
                        </div>

                        <div
                          className={`max-w-2xl p-4 rounded text-xs md:text-sm leading-relaxed border ${
                            isCitizen
                              ? "bg-[#161616] border-[#2A2A2A] text-[#F0F0F0]"
                              : isAI
                              ? "bg-[#1A1A1A] border-white/10 text-[#F5F5F5]"
                              : "bg-[#1A1A1A] border-emerald-500/30 text-[#F5F5F5]"
                          }`}
                        >
                          {renderMaskedText(msg.text)}

                          {/* Render structured citations if present */}
                          {msg.structuredContent && typeof msg.structuredContent === "object" && (
                            <div className="mt-3 pt-3 border-t border-[#333333] space-y-2 text-xs font-mono">
                              {msg.structuredContent.applicable_laws && Array.isArray(msg.structuredContent.applicable_laws) && (
                                <div>
                                  <div className="text-[0.65rem] uppercase text-[#888888] font-bold">
                                    Statutory Provisions Cited:
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {msg.structuredContent.applicable_laws.map((law: any, li: number) => (
                                      <span key={li} className="px-1.5 py-0.5 bg-[#262626] border border-[#3A3A3A] text-neutral-300 text-[0.65rem] rounded">
                                        {law.act || law.code} {law.section ? `Sec ${law.section}` : ""}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {msg.structuredContent.bail_status && (
                                <div className="text-[#AAAAAA]">
                                  <strong className="text-white">Bail Outlook:</strong> {msg.structuredContent.bail_status}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Footer Audit Notice */}
              <div className="border-t border-[#222222] bg-[#111111] p-3 text-[0.7rem] font-mono text-[#777777] flex items-center justify-between">
                <span>
                  Supervisory Console • Confidential database-backed audit channel
                </span>
                <span className="text-neutral-300 font-bold">
                  {activeSession.messages.length} Total Messages
                </span>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-xs text-[#777777] font-mono gap-2">
              <MessageSquare className="h-8 w-8 text-[#333333]" />
              <span className="text-[#AAAAAA] font-medium">Select a chat session from the left</span>
              <span className="text-[#666666] text-[0.65rem]">All platform inquiries and consultation channels are listed live.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
