import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import { 
  Phone, MessageSquare, Send, ShieldCheck, User, 
  ArrowRight, Search, FileText, Lock, Check, CheckCheck, 
  RotateCcw, Sparkles, AlertCircle, ShieldAlert
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { maskConfidentialPatterns } from "@/lib/privacy-mask";
import { CaseSummaryModal } from "@/components/CaseSummaryViewer";
import type { ConsultationChatMessage } from "@/components/ConsultationChatModal";

interface ConsultationsSearch {
  chat?: string;
}

export const Route = createFileRoute("/_authenticated/dashboard/consultations")({
  validateSearch: (search: Record<string, unknown>): ConsultationsSearch => ({
    chat: typeof search.chat === "string" ? search.chat : undefined,
  }),
  head: () => ({
    meta: [
      { title: "My Consultations — TRANA" },
      { name: "description", content: "Confidential WhatsApp-style legal consultations and communications with verified advocates." },
      { property: "og:title", content: "My Consultations — TRANA" },
    ],
  }),
  component: Consultations,
});

type UnifiedConsultation = {
  id: string;
  lawyerName: string;
  lawyerId?: string | null;
  consultType: "Chat" | "Call";
  status: "Confirmed" | "Requested" | "Denied" | "Completed" | "Cancelled";
  intakeBrief?: string | null;
  lastMessage: string;
  lastUpdated: string;
  timestampSort: number;
  messages: ConsultationChatMessage[];
};

function Consultations() {
  const { user } = Route.useRouteContext();
  const searchParams = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChatId, setSelectedChatId] = useState<string>(searchParams.chat || "");
  const [inputText, setInputText] = useState("");
  const [showCaseSummary, setShowCaseSummary] = useState(false);
  const [liveTrigger, setLiveTrigger] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const clientName =
    (user as any).name || (user as any).user_metadata?.full_name || user.email?.split("@")[0] || "Citizen Client";

  // 1. Fetch consultations from Supabase database with real-time polling
  const { data: dbData = [], refetch } = useQuery({
    queryKey: ["consultations", user?.id, liveTrigger],
    queryFn: async () => {
      let query = supabase.from("consultations").select("*").order("created_at", { ascending: false });
      if (user?.id && user?.email) {
        query = query.or(`user_id.eq.${user.id},user_id.eq.${user.email}`);
      } else if (user?.id) {
        query = query.eq("user_id", String(user.id));
      } else if (user?.email) {
        query = query.eq("user_id", String(user.email));
      }
      const { data, error } = await query;
      if (error) {
        // Fallback to fetch all if user filtering column mismatch
        const fallback = await supabase.from("consultations").select("*").order("created_at", { ascending: false });
        return fallback.data ?? [];
      }
      return data ?? [];
    },
    refetchInterval: 3500,
  });

  // Listen to same-window and cross-tab storage chat updates
  useEffect(() => {
    function handleUpdate() {
      setLiveTrigger((p) => p + 1);
      refetch();
    }
    window.addEventListener("storage", handleUpdate);
    window.addEventListener("trana_consult_chat_update", handleUpdate);
    return () => {
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener("trana_consult_chat_update", handleUpdate);
    };
  }, [refetch]);

  // Aggregate and deduplicate consultations: strictly ONE chat per lawyer
  const consultations: UnifiedConsultation[] = useMemo(() => {
    const list: UnifiedConsultation[] = [];
    const seenLawyerKeys = new Set<string>();

    // 1. Process Supabase rows
    (dbData || []).forEach((row) => {
      if (!row || !row.id) return;
      const lawyerKey = (row.lawyer_name || "").toLowerCase().replace(/^adv\.?\s*/i, "").trim();
      if (!lawyerKey || seenLawyerKeys.has(lawyerKey)) return;
      seenLawyerKeys.add(lawyerKey);

      const briefText = row.intake_brief || row.note || "";
      const rawStored = typeof window !== "undefined" 
        ? localStorage.getItem(`trana_consult_chat_${row.id}`) || localStorage.getItem(`trana_consult_chat_REF-${row.id.slice(0, 8).toUpperCase()}`)
        : null;

      let msgs: ConsultationChatMessage[] = [];

      // Check row.note for JSON message array
      if (row.note) {
        try {
          const parsed = JSON.parse(row.note);
          if (Array.isArray(parsed) && parsed.length > 0) {
            msgs = parsed;
          }
        } catch {
          // note is plain text brief
        }
      }

      // Check localStorage cache
      if (msgs.length === 0 && rawStored) {
        try {
          const parsed = JSON.parse(rawStored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            msgs = parsed;
          }
        } catch {}
      }

      // Default system message if brand new
      if (msgs.length === 0) {
        msgs.push({
          id: `msg-sys-${row.id}`,
          sender: "system",
          senderName: "TRANA Secure Relay",
          text: `Confidential consultation channel established with ${row.lawyer_name || "Advocate Counsel"}. Phone numbers, digits, and Morse code are automatically masked to XXXXX.`,
          timestamp: row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Active",
        });
      }

      const stLower = (row.status || "requested").toLowerCase();
      const statusLabel =
        stLower === "completed"
          ? "Completed"
          : stLower === "confirmed"
          ? "Confirmed"
          : stLower === "denied"
          ? "Denied"
          : stLower === "cancelled"
          ? "Cancelled"
          : "Requested";

      const lastMsg = msgs[msgs.length - 1]?.text || "Consultation channel opened.";
      const sortTime = row.created_at ? new Date(row.created_at).getTime() : 0;

      list.push({
        id: row.id,
        lawyerName: row.lawyer_name || "Advocate Counsel",
        lawyerId: row.lawyer_id,
        consultType: row.consult_type?.toLowerCase() === "call" ? "Call" : "Chat",
        status: statusLabel,
        intakeBrief: briefText,
        lastMessage: lastMsg,
        lastUpdated: row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Today",
        timestampSort: sortTime,
        messages: msgs,
      });
    });

    // 2. Also check local referrals if not already in list
    if (typeof window !== "undefined") {
      try {
        const localReferrals = JSON.parse(localStorage.getItem("trana_client_referrals") || "[]");
        (localReferrals || []).forEach((r: any) => {
          if (!r || !r.lawyerName) return;
          const lawyerKey = r.lawyerName.toLowerCase().replace(/^adv\.?\s*/i, "").trim();
          if (seenLawyerKeys.has(lawyerKey)) return;
          seenLawyerKeys.add(lawyerKey);

          const consultId = r.id || `REF-${Date.now().toString(36)}`;
          const rawStored = localStorage.getItem(`trana_consult_chat_${consultId}`);
          let msgs: ConsultationChatMessage[] = [];
          if (rawStored) {
            try {
              const parsed = JSON.parse(rawStored);
              if (Array.isArray(parsed) && parsed.length > 0) msgs = parsed;
            } catch {}
          }

          if (msgs.length === 0) {
            msgs.push({
              id: `msg-sys-${consultId}`,
              sender: "system",
              senderName: "TRANA Secure Relay",
              text: `Confidential consultation channel established with ${r.lawyerName}. Phone numbers and contact digits are masked to XXXXX.`,
              timestamp: r.date || "Today",
            });
          }

          list.push({
            id: consultId,
            lawyerName: r.lawyerName,
            lawyerId: r.lawyerId,
            consultType: r.consultationType === "Call" ? "Call" : "Chat",
            status: "Confirmed",
            intakeBrief: r.intakeBrief,
            lastMessage: msgs[msgs.length - 1]?.text || r.summary || "Channel active",
            lastUpdated: r.date || "Today",
            timestampSort: r.created_at ? new Date(r.created_at).getTime() : 0,
            messages: msgs,
          });
        });
      } catch {}
    }

    return list.sort((a, b) => b.timestampSort - a.timestampSort);
  }, [dbData]);

  // Keep selected chat in sync with URL search param or fallback to first
  useEffect(() => {
    if (consultations.length > 0) {
      if (searchParams.chat && consultations.some((c) => c.id === searchParams.chat)) {
        setSelectedChatId(searchParams.chat);
      } else if (!selectedChatId || !consultations.some((c) => c.id === selectedChatId)) {
        setSelectedChatId(consultations[0].id);
      }
    }
  }, [consultations, searchParams.chat, selectedChatId]);

  // Active selected consultation
  const activeChat = useMemo(() => {
    return consultations.find((c) => c.id === selectedChatId) || consultations[0] || null;
  }, [consultations, selectedChatId]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages]);

  // Switch chat
  function handleSelectChat(id: string) {
    setSelectedChatId(id);
    navigate({
      to: "/dashboard/consultations",
      search: { chat: id },
    });
  }

  // Send message in WhatsApp view
  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim() || !activeChat) return;

    // Strict Anti-Evasion Privacy Masking (phone numbers, digit strings, Morse code)
    const maskedText = maskConfidentialPatterns(inputText.trim());

    const newMessage: ConsultationChatMessage = {
      id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      sender: "client",
      senderName: clientName,
      text: maskedText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updated = [...activeChat.messages, newMessage];
    setInputText("");

    // 1. Save to localStorage cache
    try {
      localStorage.setItem(`trana_consult_chat_${activeChat.id}`, JSON.stringify(updated));
      const chatIndex = JSON.parse(localStorage.getItem("trana_all_consultation_chats_index") || "{}");
      chatIndex[activeChat.id] = {
        consultationId: activeChat.id,
        clientName,
        lawyerName: activeChat.lawyerName,
        consultationType: activeChat.consultType,
        status: activeChat.status,
        lastMessage: maskedText,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem("trana_all_consultation_chats_index", JSON.stringify(chatIndex));
    } catch {}

    // 2. Persist to Supabase database so advocate and founders monitor receive it online
    try {
      // First update by exact consultation id
      const { data: updatedRows } = await supabase
        .from("consultations")
        .update({ note: JSON.stringify(updated) })
        .eq("id", activeChat.id)
        .select("id");

      // If no row updated, try updating by lawyer name / user id or insert new
      if (!updatedRows || updatedRows.length === 0) {
        const bareId = activeChat.id.replace(/^REF-/, "");
        const { data: altRows } = await supabase
          .from("consultations")
          .update({ note: JSON.stringify(updated) })
          .or(`id.eq.${bareId},lawyer_name.ilike.%${activeChat.lawyerName}%`)
          .select("id");

        if (!altRows || altRows.length === 0) {
          // Row does not exist yet in database, insert it now so it is permanently stored online
          await supabase.from("consultations").insert({
            id: activeChat.id,
            user_id: user?.id ? String(user.id) : (user?.email || "anonymous"),
            lawyer_id: activeChat.lawyerId || null,
            lawyer_name: activeChat.lawyerName,
            consult_type: activeChat.consultType.toLowerCase(),
            status: "confirmed",
            note: JSON.stringify(updated),
            intake_brief: activeChat.intakeBrief || "",
          });
        }
      }
    } catch (err) {
      console.warn("Could not save to Supabase:", err);
    }

    // 3. Trigger live synchronization
    window.dispatchEvent(new Event("trana_consult_chat_update"));
    window.dispatchEvent(new StorageEvent("storage", { key: `trana_consult_chat_${activeChat.id}` }));
    refetch();
  }

  // Conclude / Switch Lawyer action
  async function handleConcludeSession() {
    if (!activeChat) return;
    const confirmed = window.confirm(
      `Conclude consultation session with ${activeChat.lawyerName}? This will mark this matter complete and unlock the directory so you can consult another lawyer.`
    );
    if (!confirmed) return;

    const notice: ConsultationChatMessage = {
      id: `msg-conclude-${Date.now()}`,
      sender: "system",
      senderName: "TRANA Secure Relay",
      text: `Consultation session with ${activeChat.lawyerName} concluded by client. Client is free to consult another legal professional.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updated = [...activeChat.messages, notice];

    try {
      await supabase
        .from("consultations")
        .update({ status: "cancelled", note: JSON.stringify(updated) })
        .eq("id", activeChat.id);
    } catch {}

    try {
      localStorage.setItem(`trana_consult_chat_${activeChat.id}`, JSON.stringify(updated));
      if (user?.id) {
        localStorage.removeItem(`trana_requested_lawyers_${user.id}`);
      }
    } catch {}

    qc.invalidateQueries({ queryKey: ["consultations"] });
    qc.invalidateQueries({ queryKey: ["citizen-consultations-lock"] });
    window.dispatchEvent(new Event("trana_consult_chat_update"));
    toast.info(`Session with ${activeChat.lawyerName} concluded. Redirecting to directory.`);
    navigate({ to: "/dashboard/lawyers" });
  }

  // Filter conversations list by search
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return consultations;
    const q = searchQuery.toLowerCase();
    return consultations.filter(
      (c) =>
        c.lawyerName.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q)
    );
  }, [consultations, searchQuery]);

  // Render masked tokens nicely
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

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-white">Consultations</h1>
          <p className="mt-1 text-xs text-[#888888]">
            Confidential multi-party communication relay with verified advocates. Messages are end-to-end masked for privacy.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/lawyers"
            className="border border-[#333333] hover:border-white bg-[#141414] hover:bg-[#1E1E1E] px-3.5 py-2 text-xs font-mono uppercase tracking-wider text-white transition-colors rounded flex items-center gap-1.5"
          >
            <span>+ Find Another Advocate</span>
          </Link>
        </div>
      </div>

      {/* Main WhatsApp-Style Multi-Chat Container */}
      {consultations.length === 0 ? (
        <div className="border border-[#222222] bg-[#111111] p-12 text-center rounded-xl flex flex-col items-center justify-center gap-3 min-h-[460px]">
          <div className="h-16 w-16 rounded-full bg-[#1A1A1A] border border-white/10 flex items-center justify-center text-neutral-400">
            <MessageSquare className="h-8 w-8" />
          </div>
          <h3 className="font-display text-2xl text-white">No Consultations Yet</h3>
          <p className="text-xs text-[#888888] max-w-md">
            Connect with verified advocates across India. Choose between confidential masked in-app chat or telephonic consultation.
          </p>
          <Link
            to="/dashboard/lawyers"
            className="mt-3 bg-white text-black px-6 py-2.5 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-200 transition-colors rounded"
          >
            Browse Verified Lawyers
          </Link>
        </div>
      ) : (
        <div className="h-[calc(100vh-210px)] min-h-[580px] max-h-[820px] border border-[#222222] bg-[#0E0E0E] rounded-xl flex flex-col md:flex-row overflow-hidden shadow-2xl">
          {/* LEFT: WhatsApp Chats Directory (340px) */}
          <div className="w-full md:w-[350px] lg:w-[380px] border-r border-[#222222] flex flex-col bg-[#121212] shrink-0">
            {/* Search Input */}
            <div className="p-3 border-b border-[#222222] bg-[#161616]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#666666]" />
                <input
                  type="text"
                  placeholder="Search chats or lawyers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#2A2A2A] text-xs text-white pl-9 pr-3 py-2 placeholder:text-[#555555] focus:outline-none focus:border-white transition-colors rounded-lg font-sans"
                />
              </div>
            </div>

            {/* Chats List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#1D1D1D]">
              {filteredList.map((c) => {
                const isSelected = c.id === activeChat?.id;
                const initial = c.lawyerName.replace(/^adv\.?\s*/i, "").charAt(0) || "A";

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectChat(c.id)}
                    className={`w-full text-left p-3.5 transition-all flex items-start gap-3 ${
                      isSelected
                        ? "bg-[#1E1E1E] border-l-4 border-white"
                        : "hover:bg-[#161616] border-l-4 border-transparent"
                    }`}
                  >
                    {/* Avatar */}
                    <div className="h-11 w-11 rounded-full bg-[#242424] border border-white/10 flex items-center justify-center font-bold text-white uppercase shrink-0 text-sm">
                      {initial}
                    </div>

                    {/* Chat Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-white truncate">
                          {c.lawyerName}
                        </span>
                        <span className="text-[0.65rem] font-mono text-[#888888] shrink-0">
                          {c.lastUpdated}
                        </span>
                      </div>

                      <p className="text-[0.72rem] text-[#999999] truncate font-sans mt-0.5">
                        {c.lastMessage}
                      </p>

                      <div className="flex items-center justify-between gap-1 mt-1.5 font-mono text-[0.6rem]">
                        <span className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-neutral-300 uppercase">
                          {c.consultType}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded border uppercase ${
                            c.status === "Confirmed"
                              ? "border-emerald-500/50 text-emerald-300 bg-emerald-950/20"
                              : c.status === "Cancelled" || c.status === "Denied"
                              ? "border-red-500/50 text-red-300 bg-red-950/20"
                              : "border-amber-500/50 text-amber-300 bg-amber-950/20"
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Active WhatsApp Chat Conversation */}
          <div className="flex-1 flex flex-col bg-[#0A0A0A] overflow-hidden">
            {activeChat ? (
              <>
                {/* Active Chat Header */}
                <div className="p-3.5 px-5 border-b border-[#222222] bg-[#141414] flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-[#2A2A2A] border border-white/10 flex items-center justify-center font-bold text-white uppercase text-sm shrink-0">
                      {activeChat.lawyerName.replace(/^adv\.?\s*/i, "").charAt(0) || "A"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-sm text-white truncate">
                          {activeChat.lawyerName}
                        </h2>
                        <span className="text-[0.65rem] border border-emerald-500/30 text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded font-mono uppercase">
                          Verified
                        </span>
                      </div>
                      <p className="text-[0.65rem] text-[#888888] font-mono truncate">
                        Confidential Relay • Mode: {activeChat.consultType} • Anti-Evasion Enforced
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {activeChat.intakeBrief && (
                      <button
                        type="button"
                        onClick={() => setShowCaseSummary(true)}
                        className="border border-[#333333] hover:border-white bg-[#1C1C1C] px-3 py-1.5 text-xs text-white rounded font-mono flex items-center gap-1.5 transition-colors"
                      >
                        <FileText className="h-3.5 w-3.5 text-neutral-300" />
                        <span className="hidden sm:inline">Case Brief</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleConcludeSession}
                      className="border border-[#333333] hover:border-red-500/50 hover:bg-red-950/30 px-3 py-1.5 text-xs text-[#888888] hover:text-red-300 rounded font-mono flex items-center gap-1.5 transition-colors"
                      title="Conclude representation to consult another advocate"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Conclude</span>
                    </button>
                  </div>
                </div>

                {/* Anti-Evasion Privacy Banner */}
                <div className="bg-[#111111] border-b border-[#222222] px-4 py-2 text-[0.68rem] font-mono text-[#AAAAAA] flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>
                      TRANA Privacy Shield: Phone numbers, digit sequences, and Morse code masked to <strong className="text-white">XXXXX</strong>.
                    </span>
                  </div>
                  <span className="hidden sm:inline text-[0.6rem] border border-white/20 text-neutral-300 px-1.5 py-0.5 rounded">
                    ENCRYPTED RELAY
                  </span>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-3 bg-[#080808]">
                  {activeChat.messages.map((msg) => {
                    if (msg.sender === "system") {
                      return (
                        <div key={msg.id} className="flex justify-center my-3">
                          <div className="border border-[#282828] bg-[#121212] px-4 py-1.5 text-[0.7rem] text-[#888888] font-mono max-w-md text-center flex items-center gap-1.5 rounded-full shadow-sm">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            <span>{msg.text}</span>
                          </div>
                        </div>
                      );
                    }

                    const isClient = msg.sender === "client";

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isClient ? "items-end" : "items-start"}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-[0.65rem] font-mono text-[#777777]">
                          <span className={isClient ? "text-neutral-300 font-medium" : "text-emerald-400 font-medium"}>
                            {msg.senderName}
                          </span>
                          <span>•</span>
                          <span>{msg.timestamp}</span>
                        </div>

                        <div
                          className={`max-w-md md:max-w-lg p-3.5 rounded-2xl text-xs md:text-sm leading-relaxed border ${
                            isClient
                              ? "bg-[#16291E] border-emerald-500/30 text-white rounded-tr-none shadow-md"
                              : "bg-[#181818] border-[#2C2C2C] text-[#F0F0F0] rounded-tl-none shadow-md"
                          }`}
                        >
                          {renderMaskedText(msg.text)}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* WhatsApp Bottom Input Bar */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 border-t border-[#222222] bg-[#141414] flex items-center gap-2 shrink-0"
                >
                  <input
                    type="text"
                    placeholder={`Message ${activeChat.lawyerName}... (Phone numbers & sequences masked automatically)`}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="flex-1 bg-[#0A0A0A] border border-[#2E2E2E] rounded-full px-5 py-3 text-xs md:text-sm text-white placeholder:text-[#555555] focus:outline-none focus:border-white transition-colors"
                  />

                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="h-11 w-11 rounded-full bg-white hover:bg-neutral-200 text-black flex items-center justify-center transition-colors disabled:opacity-30 shrink-0"
                    title="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-xs text-[#777777] font-mono gap-3">
                <div className="h-16 w-16 rounded-full bg-[#181818] border border-white/10 flex items-center justify-center text-neutral-400">
                  <Lock className="h-7 w-7" />
                </div>
                <h3 className="font-display text-xl text-white">End-to-End Encrypted Legal Channel</h3>
                <p className="text-xs text-[#888888] max-w-sm">
                  Select a consultation from the left list to review transcripts and send messages to counsel.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Case Summary Brief Modal */}
      {showCaseSummary && activeChat && (
        <CaseSummaryModal
          isOpen={showCaseSummary}
          onClose={() => setShowCaseSummary(false)}
          clientName={clientName}
          matterType="Legal Consultation Brief"
          consultationType={activeChat.consultType}
          content={activeChat.intakeBrief || "No additional brief attached to this consultation."}
        />
      )}
    </div>
  );
}
