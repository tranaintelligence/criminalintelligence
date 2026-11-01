import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  MessageSquare, Search, Phone, ShieldCheck, Download, 
  ExternalLink, User, CheckCircle2, XCircle, Clock, RefreshCw, 
  AlertTriangle, ArrowRight, ShieldAlert, Sparkles, Filter
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ConsultationChatMessage } from "@/components/ConsultationChatModal";
import { maskConfidentialPatterns } from "@/lib/privacy-mask";

export const Route = createFileRoute("/founders/chats")({
  head: () => ({
    meta: [
      { title: "Client Lawyer Chat Monitor — TRANA Founders" },
      { name: "description", content: "Supervisory monitoring, compliance audit, and anti-evasion privacy inspection of client-advocate communications." },
      { property: "og:title", content: "Client Lawyer Chat Monitor — TRANA Founders" },
    ],
  }),
  component: FoundersChatsPage,
});

type ChatSession = {
  id: string;
  clientName: string;
  lawyerName: string;
  consultationType: "Chat" | "Call";
  status: "Confirmed" | "Requested" | "Denied" | "Completed" | "Withdrawn";
  lastMessage: string;
  lastUpdated: string;
  messageCount: number;
  maskingInterceptions: number;
};

// Benchmark demonstration transcripts showing Anti-Evasion Privacy Masking in action
const benchmarkSessions: { session: ChatSession; messages: ConsultationChatMessage[] }[] = [
  {
    session: {
      id: "REF-ADV-001",
      clientName: "Rahul Verma",
      lawyerName: "Adv. Rajeshwaran Iyer",
      consultationType: "Chat",
      status: "Confirmed",
      lastMessage: "Thank you counsel, I have noted the documentation list.",
      lastUpdated: "Today, 10:45 AM",
      messageCount: 5,
      maskingInterceptions: 2,
    },
    messages: [
      {
        id: "bm-1",
        sender: "system",
        senderName: "TRANA Secure Relay",
        text: "Confidential consultation channel established. All communications are protected under TRANA Legal Privacy Shield. Direct contact phone numbers, numerical sequences, and Morse code are automatically masked to XXXXX.",
        timestamp: "10:30 AM",
      },
      {
        id: "bm-2",
        sender: "client",
        senderName: "Rahul Verma",
        text: "Hello Adv. Iyer, I am reaching out regarding a breach of non-compete clause in my prior employment contract.",
        timestamp: "10:32 AM",
      },
      {
        id: "bm-3",
        sender: "lawyer",
        senderName: "Adv. Rajeshwaran Iyer",
        text: "Namaste Mr. Verma. Under Section 27 of the Indian Contract Act, agreements in restraint of lawful profession or trade are void ab initio. Please share the key covenant wording.",
        timestamp: "10:35 AM",
      },
      {
        id: "bm-4",
        sender: "client",
        senderName: "Rahul Verma",
        text: "Understood! If you want to review the offer letter urgently, you can also reach me at XXXXX during office hours.",
        timestamp: "10:38 AM",
      },
      {
        id: "bm-5",
        sender: "client",
        senderName: "Rahul Verma",
        text: "Thank you counsel, I have noted the documentation list.",
        timestamp: "10:45 AM",
      },
    ],
  },
  {
    session: {
      id: "REF-ADV-002",
      clientName: "Priya Sharma",
      lawyerName: "Adv. Meenakshi Sundaram",
      consultationType: "Call",
      status: "Confirmed",
      lastMessage: "Confirmed for telephonic briefing at 4:00 PM.",
      lastUpdated: "Yesterday, 04:12 PM",
      messageCount: 4,
      maskingInterceptions: 1,
    },
    messages: [
      {
        id: "bm-6",
        sender: "system",
        senderName: "TRANA Secure Relay",
        text: "Secure Call Consultation scheduled. TRANA Virtual PBX will bridge the call at 04:00 PM without exposing either party's personal phone number.",
        timestamp: "03:50 PM",
      },
      {
        id: "bm-7",
        sender: "client",
        senderName: "Priya Sharma",
        text: "Good afternoon Adv. Sundaram, looking forward to discussing the RERA delayed possession compensation for our Noida tower.",
        timestamp: "03:55 PM",
      },
      {
        id: "bm-8",
        sender: "lawyer",
        senderName: "Adv. Meenakshi Sundaram",
        text: "Good afternoon Priya. Under Section 18 of RERA Act 2016, buyers are entitled to statutory interest for every month of delay until possession is handed over.",
        timestamp: "04:05 PM",
      },
      {
        id: "bm-9",
        sender: "client",
        senderName: "Priya Sharma",
        text: "Confirmed for telephonic briefing at 4:00 PM.",
        timestamp: "04:12 PM",
      },
    ],
  },
  {
    session: {
      id: "REF-ADV-003",
      clientName: "Vikram Mehta",
      lawyerName: "Adv. Rajeshwaran Iyer",
      consultationType: "Chat",
      status: "Withdrawn",
      lastMessage: "Advocate Rajeshwaran Iyer has withdrawn from this matter.",
      lastUpdated: "22 Oct 2026",
      messageCount: 3,
      maskingInterceptions: 1,
    },
    messages: [
      {
        id: "bm-10",
        sender: "client",
        senderName: "Vikram Mehta",
        text: "Need urgent consultation on commercial lease forfeiture.",
        timestamp: "11:00 AM",
      },
      {
        id: "bm-11",
        sender: "client",
        senderName: "Vikram Mehta",
        text: "Call back emergency: XXXXX",
        timestamp: "11:02 AM",
      },
      {
        id: "bm-12",
        sender: "system",
        senderName: "TRANA Secure Relay",
        text: "Advocate Rajeshwaran Iyer has withdrawn from this matter. Client is now free to consult another lawyer from the directory.",
        timestamp: "11:15 AM",
      },
    ],
  },
];

function FoundersChatsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | "Chat" | "Call">("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Confirmed" | "Requested" | "Withdrawn">("All");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("REF-ADV-001");
  const [liveTrigger, setLiveTrigger] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch real consultations from database
  const { data: dbConsults = [], refetch } = useQuery({
    queryKey: ["founders-all-consultations"],
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
  });

  // Listen for real-time chat updates across tabs and within this app
  useEffect(() => {
    function handleUpdate() {
      setLiveTrigger((prev) => prev + 1);
      refetch();
    }
    window.addEventListener("storage", handleUpdate);
    window.addEventListener("trana_consult_chat_update", handleUpdate);
    return () => {
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener("trana_consult_chat_update", handleUpdate);
    };
  }, [refetch]);

  // Aggregate all live and benchmark chat sessions
  const sessions = useMemo(() => {
    const list: ChatSession[] = [];

    // 1. Read from localStorage chat index
    let indexedChats: Record<string, any> = {};
    try {
      if (typeof window !== "undefined") {
        indexedChats = JSON.parse(localStorage.getItem("trana_all_consultation_chats_index") || "{}");
      }
    } catch {
      // ignore
    }

    Object.values(indexedChats).forEach((item: any) => {
      if (!item || !item.consultationId) return;
      const rawStored = localStorage.getItem(`trana_consult_chat_${item.consultationId}`);
      let msgCount = 0;
      let maskCount = 0;
      if (rawStored) {
        try {
          const parsed = JSON.parse(rawStored);
          if (Array.isArray(parsed)) {
            msgCount = parsed.length;
            maskCount = parsed.reduce((acc, m) => {
              const text = m.text || "";
              const matches = text.match(/XXXXX/g);
              return acc + (matches ? matches.length : 0);
            }, 0);
          }
        } catch {
          // ignore
        }
      }

      list.push({
        id: item.consultationId,
        clientName: item.clientName || "Citizen Client",
        lawyerName: item.lawyerName || "Advocate Counsel",
        consultationType: item.consultationType === "Call" ? "Call" : "Chat",
        status: (item.status as ChatSession["status"]) || "Confirmed",
        lastMessage: item.lastMessage || "Live communication active",
        lastUpdated: item.lastUpdated ? new Date(item.lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Active Now",
        messageCount: msgCount,
        maskingInterceptions: maskCount,
      });
    });

    // 2. Read from Supabase consultations
    (dbConsults || []).forEach((row) => {
      const rowId = `REF-${row.id.slice(0, 8).toUpperCase()}`;
      if (list.some((existing) => existing.id === rowId || existing.id === row.id)) return;

      const briefText = row.intake_brief || row.note || "";
      let clientName = "Citizen Client";
      const clientMatch = briefText.match(/\*\*Client\*\*:\s*([^(•\n]+)/);
      if (clientMatch && clientMatch[1].trim() && clientMatch[1].trim() !== "Citizen Client") {
        clientName = clientMatch[1].trim();
      } else if (row.user_id) {
        clientName = `Citizen (${row.user_id.slice(0, 6)})`;
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

      const rawStored = typeof window !== "undefined" ? localStorage.getItem(`trana_consult_chat_${row.id}`) || localStorage.getItem(`trana_consult_chat_${rowId}`) : null;
      let msgCount = 0;
      let maskCount = 0;
      let lastMsg = briefText ? `Inquiry: ${briefText.slice(0, 80)}...` : "Consultation requested with counsel.";
      if (rawStored) {
        try {
          const parsed = JSON.parse(rawStored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            msgCount = parsed.length;
            lastMsg = parsed[parsed.length - 1].text;
            maskCount = parsed.reduce((acc, m) => {
              const text = m.text || "";
              const matches = text.match(/XXXXX/g);
              return acc + (matches ? matches.length : 0);
            }, 0);
          }
        } catch {
          // ignore
        }
      }

      list.push({
        id: rowId,
        clientName,
        lawyerName: row.lawyer_name || "Advocate Counsel",
        consultationType: row.consult_type === "call" ? "Call" : "Chat",
        status: statusLabel,
        lastMessage: lastMsg,
        lastUpdated: row.created_at ? new Date(row.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "Today",
        messageCount: msgCount,
        maskingInterceptions: maskCount,
      });
    });

    // 3. Append benchmark records
    benchmarkSessions.forEach((bm) => {
      if (!list.some((existing) => existing.id === bm.session.id)) {
        list.push(bm.session);
      }
    });

    return list;
  }, [dbConsults, liveTrigger]);

  // Active selected session
  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === selectedSessionId) || sessions[0] || null;
  }, [sessions, selectedSessionId]);

  // Messages for active selected session
  const activeMessages: ConsultationChatMessage[] = useMemo(() => {
    if (!activeSession) return [];

    // Check localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(`trana_consult_chat_${activeSession.id}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {
          // ignore
        }
      }
      // Also check normalized DB ID
      const bareId = activeSession.id.replace(/^REF-/, "");
      const storedBare = localStorage.getItem(`trana_consult_chat_${bareId}`);
      if (storedBare) {
        try {
          const parsed = JSON.parse(storedBare);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {
          // ignore
        }
      }
    }

    // Benchmark fallback
    const bm = benchmarkSessions.find((b) => b.session.id === activeSession.id);
    if (bm) return bm.messages;

    return [
      {
        id: "sys-init",
        sender: "system",
        senderName: "TRANA Secure Relay",
        text: `Consultation session for ${activeSession.clientName} & ${activeSession.lawyerName}. TRANA Anti-Evasion Privacy Masking active.`,
        timestamp: "Initial",
      },
    ];
  }, [activeSession, liveTrigger]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages]);

  // Aggregate Platform Privacy Metrics
  const stats = useMemo(() => {
    const totalSessions = sessions.length;
    let totalMessages = 0;
    let totalInterceptions = 0;

    sessions.forEach((s) => {
      totalMessages += Math.max(s.messageCount, 1);
      totalInterceptions += s.maskingInterceptions;
    });

    // Count chat vs call
    const chatCount = sessions.filter((s) => s.consultationType === "Chat").length;
    const callCount = sessions.filter((s) => s.consultationType === "Call").length;

    return { totalSessions, totalMessages, totalInterceptions, chatCount, callCount };
  }, [sessions]);

  // Filtered session list
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (typeFilter !== "All" && s.consultationType !== typeFilter) return false;
      if (statusFilter !== "All" && s.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          s.clientName.toLowerCase().includes(q) ||
          s.lawyerName.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          s.lastMessage.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [sessions, typeFilter, statusFilter, search]);

  // Export full transcript as audit log
  function handleExportTranscript() {
    if (!activeSession) return;
    const lines = [
      `============================================================`,
      `TRANA LEGAL PLATFORM — CLIENT-LAWYER CHAT AUDIT LOG`,
      `============================================================`,
      `Session ID        : ${activeSession.id}`,
      `Client Name       : ${activeSession.clientName}`,
      `Advocate Counsel  : ${activeSession.lawyerName}`,
      `Consultation Type : ${activeSession.consultationType}`,
      `Case Status       : ${activeSession.status}`,
      `Privacy Masking   : ACTIVE (Anti-Evasion Engine v2.0 - XXXXX)`,
      `Audit Date        : ${new Date().toLocaleString("en-IN")}`,
      `============================================================\n`,
    ];

    activeMessages.forEach((m) => {
      const senderLabel =
        m.sender === "system"
          ? "[SYSTEM NOTICE]"
          : m.sender === "lawyer"
          ? `[ADVOCATE: ${m.senderName}]`
          : `[CLIENT: ${m.senderName}]`;
      lines.push(`${m.timestamp} ${senderLabel}:\n${m.text}\n`);
    });

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TRANA_CHAT_AUDIT_${activeSession.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Transcript for ${activeSession.id} downloaded.`);
  }

  // Format message text and visually highlight any masked tokens
  function renderMaskedText(text: string) {
    if (!text.includes("XXXXX")) {
      return <span>{text}</span>;
    }
    const parts = text.split(/(XXXXX)/g);
    return (
      <span>
        {parts.map((part, i) =>
          part === "XXXXX" ? (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 px-1 py-0.5 mx-0.5 rounded bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 font-mono font-bold text-[0.8rem] tracking-widest shadow-sm"
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#222222] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[0.65rem] border border-white/20 px-2 py-0.5 text-emerald-400 font-mono tracking-widest uppercase">
              Supervisory Monitor
            </span>
            <span className="text-xs text-[#888888] font-mono">• Founders Desk</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl text-[#F0F0F0] mt-1">
            Client Lawyer Chat
          </h1>
          <p className="text-xs md:text-sm text-[#999999] mt-1 max-w-3xl">
            Live supervisory oversight of all client-advocate communications with automated phone, number-sequence, and Morse code privacy masking (XXXXX).
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              refetch();
              setLiveTrigger((p) => p + 1);
              toast.success("Chat stream synchronized.");
            }}
            className="border border-[#333333] hover:border-white bg-[#141414] hover:bg-[#1E1E1E] px-3 py-2 text-xs font-mono uppercase tracking-wider text-[#F0F0F0] flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 text-emerald-400" />
            <span>Sync Stream</span>
          </button>
        </div>
      </div>

      {/* High-Level Metric Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 font-mono">
        <div className="border border-[#222222] bg-[#111111] p-4">
          <div className="text-[0.7rem] text-[#888888] uppercase tracking-wider flex items-center justify-between">
            <span>Active Channels</span>
            <MessageSquare className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl md:text-3xl font-bold text-[#F0F0F0]">
            {stats.totalSessions}
          </div>
          <div className="mt-1 text-[0.65rem] text-[#888888]">
            {stats.chatCount} Chats • {stats.callCount} Call Relays
          </div>
        </div>

        <div className="border border-[#222222] bg-[#111111] p-4">
          <div className="text-[0.7rem] text-[#888888] uppercase tracking-wider flex items-center justify-between">
            <span>Masking Interceptions</span>
            <ShieldAlert className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl md:text-3xl font-bold text-amber-300">
            {stats.totalInterceptions}
          </div>
          <div className="mt-1 text-[0.65rem] text-[#888888]">
            Numbers & Morse blocked to XXXXX
          </div>
        </div>

        <div className="border border-[#222222] bg-[#111111] p-4">
          <div className="text-[0.7rem] text-[#888888] uppercase tracking-wider flex items-center justify-between">
            <span>Messages Audited</span>
            <Sparkles className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl md:text-3xl font-bold text-[#F0F0F0]">
            {stats.totalMessages}
          </div>
          <div className="mt-1 text-[0.65rem] text-[#888888]">
            Zero off-platform leakages
          </div>
        </div>

        <div className="border border-[#222222] bg-[#111111] p-4">
          <div className="text-[0.7rem] text-[#888888] uppercase tracking-wider flex items-center justify-between">
            <span>Anti-Evasion Engine</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-lg md:text-xl font-bold text-emerald-400 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>ENFORCED</span>
          </div>
          <div className="mt-1 text-[0.65rem] text-[#888888]">
            Full platform neutrality certified
          </div>
        </div>
      </div>

      {/* Main Workspace: Master-Detail Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
        {/* Left Column: Chat Channel Directory (5 cols) */}
        <div className="lg:col-span-5 flex flex-col border border-[#222222] bg-[#111111]">
          {/* Search and Filters */}
          <div className="p-3 border-b border-[#222222] space-y-3 bg-[#141414]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#666666]" />
              <input
                type="text"
                placeholder="Search by client, lawyer, matter, or text..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0E0E0E] border border-[#2A2A2A] text-xs text-[#F0F0F0] pl-9 pr-3 py-2 font-mono placeholder:text-[#555555] focus:outline-none focus:border-white transition-colors"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[0.7rem]">
              {(["All", "Chat", "Call"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`px-2 py-1 border transition-colors ${
                    typeFilter === t
                      ? "border-white bg-[#222222] text-white"
                      : "border-[#2A2A2A] text-[#888888] hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}

              <div className="h-3 w-[1px] bg-[#333333] mx-1" />

              {(["All", "Confirmed", "Requested", "Withdrawn"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-2 py-1 border transition-colors ${
                    statusFilter === s
                      ? "border-emerald-500/80 bg-emerald-950/40 text-emerald-300"
                      : "border-[#2A2A2A] text-[#888888] hover:text-white"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Session List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#1D1D1D] max-h-[580px]">
            {filteredSessions.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#777777] font-mono">
                No matching chat sessions found.
              </div>
            ) : (
              filteredSessions.map((s) => {
                const isSelected = s.id === activeSession?.id;
                const isConfirmed = s.status === "Confirmed";
                const isWithdrawn = s.status === "Withdrawn" || s.status === "Denied";

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSessionId(s.id)}
                    className={`w-full text-left p-3.5 transition-all flex flex-col gap-1.5 ${
                      isSelected
                        ? "bg-[#1C1C1C] border-l-2 border-emerald-400"
                        : "hover:bg-[#161616] border-l-2 border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-[#F0F0F0] truncate flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-[#888888] shrink-0" />
                        <span>{s.clientName}</span>
                      </span>
                      <span className="text-[0.65rem] font-mono text-[#888888] shrink-0">
                        {s.lastUpdated}
                      </span>
                    </div>

                    <div className="text-[0.75rem] text-[#AAAAAA] truncate flex items-center gap-1">
                      <span className="text-[#666666]">Counsel:</span>
                      <span className="font-medium text-white">{s.lawyerName}</span>
                    </div>

                    <p className="text-[0.7rem] text-[#777777] truncate font-mono">
                      {s.lastMessage}
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-1 font-mono text-[0.65rem]">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 border uppercase tracking-wider flex items-center gap-1 ${
                            s.consultationType === "Chat"
                              ? "border-purple-500/40 bg-purple-950/20 text-purple-300"
                              : "border-sky-500/40 bg-sky-950/20 text-sky-300"
                          }`}
                        >
                          {s.consultationType === "Chat" ? (
                            <MessageSquare className="h-2.5 w-2.5" />
                          ) : (
                            <Phone className="h-2.5 w-2.5" />
                          )}
                          <span>{s.consultationType}</span>
                        </span>

                        <span
                          className={`px-1.5 py-0.5 border uppercase tracking-wider ${
                            isConfirmed
                              ? "border-emerald-500/50 bg-emerald-950/30 text-emerald-300"
                              : isWithdrawn
                              ? "border-red-500/50 bg-red-950/30 text-red-300"
                              : "border-amber-500/50 bg-amber-950/30 text-amber-300"
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>

                      {s.maskingInterceptions > 0 && (
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3" />
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

        {/* Right Column: Chat Transcript Supervisory Inspector (7 cols) */}
        <div className="lg:col-span-7 flex flex-col border border-[#222222] bg-[#111111] overflow-hidden">
          {activeSession ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-[#222222] bg-[#161616] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display text-lg text-white">
                      {activeSession.clientName}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-[#666666]" />
                    <span className="font-display text-lg text-emerald-300">
                      {activeSession.lawyerName}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[0.7rem] text-[#888888]">
                    <span>ID: {activeSession.id}</span>
                    <span>•</span>
                    <span className="uppercase">{activeSession.consultationType} Mode</span>
                    <span>•</span>
                    <span className="text-emerald-400">{activeSession.status}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportTranscript}
                    className="border border-[#333333] hover:border-white bg-[#0E0E0E] hover:bg-[#202020] px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-[#F0F0F0] flex items-center gap-1.5 transition-colors"
                    title="Export certified transcript"
                  >
                    <Download className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Download Log</span>
                  </button>
                </div>
              </div>

              {/* Anti-Evasion Privacy Banner */}
              <div className="bg-[#0E0E0E] border-b border-[#222222] px-4 py-2.5 text-[0.7rem] font-mono text-[#AAAAAA] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>
                    TRANA Anti-Evasion Engine: All direct contact digits, spaced numbers, and Morse code transmissions are masked to <strong className="text-emerald-300">XXXXX</strong>.
                  </span>
                </div>
                <span className="hidden sm:inline text-[0.65rem] border border-emerald-500/40 text-emerald-400 px-1.5 py-0.5">
                  AUDIT LOG SECURE
                </span>
              </div>

              {/* Live Chat Stream */}
              <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4 bg-[#0A0A0A] max-h-[520px]">
                {activeMessages.map((msg) => {
                  if (msg.sender === "system") {
                    return (
                      <div key={msg.id} className="flex justify-center my-2">
                        <div className="border border-[#333333] bg-[#141414] px-4 py-2 text-[0.75rem] text-[#888888] font-mono max-w-xl text-center flex items-center gap-2">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          <span>{msg.text}</span>
                        </div>
                      </div>
                    );
                  }

                  const isLawyer = msg.sender === "lawyer";

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isLawyer ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center gap-2 mb-1 text-[0.7rem] font-mono text-[#888888]">
                        <span className={isLawyer ? "text-emerald-300 font-medium" : "text-white font-medium"}>
                          {msg.senderName}
                        </span>
                        <span className="text-[0.65rem] uppercase px-1 border border-[#333333] text-[#777777]">
                          {isLawyer ? "Advocate Counsel" : "Citizen Client"}
                        </span>
                        <span>{msg.timestamp}</span>
                      </div>

                      <div
                        className={`max-w-md p-3.5 rounded text-xs md:text-sm leading-relaxed border ${
                          isLawyer
                            ? "bg-[#171717] border-emerald-500/30 text-[#F0F0F0]"
                            : "bg-[#1F1F1F] border-[#383838] text-[#F0F0F0]"
                        }`}
                      >
                        {renderMaskedText(msg.text)}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Footer info bar */}
              <div className="border-t border-[#222222] bg-[#111111] p-3 text-[0.7rem] font-mono text-[#777777] flex items-center justify-between">
                <span>
                  Supervisory View Only • Client-Lawyer privileged audit channel
                </span>
                <span className="text-emerald-400">
                  Total Messages: {activeMessages.length}
                </span>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-xs text-[#777777] font-mono">
              Select a chat session from the left to view the supervisory transcript.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

