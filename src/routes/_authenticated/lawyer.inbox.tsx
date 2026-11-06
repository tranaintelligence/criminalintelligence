import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  MessageSquare, Search, Phone, Lock, ShieldCheck, 
  Send, UserMinus, FileText, ChevronRight, AlertCircle, 
  Clock, CheckCircle2, User, Scale, Users 
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLawyerAuth } from "./lawyer";
import { maskConfidentialPatterns } from "@/lib/privacy-mask";
import type { ConsultationChatMessage } from "@/components/ConsultationChatModal";
import { CaseSummaryModal } from "@/components/CaseSummaryViewer";

interface LawyerInboxSearch {
  chat?: string;
}

export const Route = createFileRoute("/_authenticated/lawyer/inbox")({
  validateSearch: (search: Record<string, unknown>): LawyerInboxSearch => ({
    chat: typeof search.chat === "string" ? search.chat : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Case & Colleague Inbox — Legal Professional Workspace — TRANA" },
      { name: "description", content: "Direct case communications, client consultations, and verified peer advocate network inbox." },
      { property: "og:title", content: "Case & Colleague Inbox — Legal Professional Workspace — TRANA" },
    ],
  }),
  component: LawyerCaseInboxPage,
});

type CaseItem = {
  id: string;
  client: string;
  matterType: string;
  section?: string;
  consultationType: "Call" | "Chat" | "Peer";
  category: "client" | "peer";
  status: "New Request" | "Confirmed" | "Denied" | "Withdrawn" | "Completed";
  date: string;
  intakeBrief?: string;
  lastMessage?: string;
  timestampSort: number;
};

function LawyerCaseInboxPage() {
  const { data: lawyer } = useLawyerAuth();
  const searchParams = Route.useSearch();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "client" | "peer">("all");
  const [selectedCaseId, setSelectedCaseId] = useState<string>(searchParams.chat || "");
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

  // Reconcile live consultations, local referrals, and peer advocate chats
  const cases: CaseItem[] = useMemo(() => {
    const list: CaseItem[] = [];
    const myName = (lawyer?.full_name || "").toLowerCase().replace(/^adv\.?\s*/i, "").trim();
    const myId = (lawyer?.id || "").toLowerCase().trim();

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
        if (myId || myName) {
          const rLawyerId = (r.lawyerId || r.lawyer_id || "").toLowerCase().trim();
          const rLawyerName = (r.lawyerName || r.lawyer_name || "").toLowerCase().replace(/^adv\.?\s*/i, "").trim();
          const matchesId = myId && rLawyerId === myId;
          const matchesName = myName && rLawyerName.includes(myName);
          if (rLawyerId || rLawyerName) {
            if (!matchesId && !matchesName) return;
          }
        }

        list.push({
          id: r.id,
          client: r.client || "Citizen Client",
          matterType: r.matterType || "Legal Consultation Request",
          section: r.section || "Applicable Statutes",
          consultationType: r.consultationType === "Chat" ? "Chat" : "Call",
          category: "client",
          status: (r.status as CaseItem["status"]) || "Confirmed",
          date: r.date || "Today",
          intakeBrief: r.intakeBrief,
          lastMessage: r.summary || "Consultation channel active",
          timestampSort: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
        });
      }
    });

    // 2. Add from Supabase consultations table
    (dbConsults || []).forEach((row) => {
      const rowId = row.id;
      if (list.some((existing) => existing.id === rowId)) return;

      const briefText = row.intake_brief || row.note || "";

      // Ensure this consultation is relevant to the logged-in counsel
      if (myId || myName) {
        const rowLawyerId = (row.lawyer_id || "").toLowerCase().trim();
        const rowUserId = (row.user_id || "").toLowerCase().trim();
        const rowLawyerName = (row.lawyer_name || "").toLowerCase().replace(/^adv\.?\s*/i, "").trim();
        const briefLower = (briefText || "").toLowerCase();

        const matchesId = myId && (rowLawyerId === myId || rowUserId === myId);
        const matchesName = myName && (rowLawyerName.includes(myName) || briefLower.includes(myName));

        if (!matchesId && !matchesName) return;
      }

      const isPeer = row.consult_type === "peer" || 
        briefText.includes("Peer Legal Collaboration") || 
        briefText.includes("Peer Collaboration") ||
        briefText.includes("Client Referral from Advocate");

      let matter = "Legal Consultation Request";
      let sectionStr = "Applicable Statutes";
      let clientName = "Citizen Client";

      if (isPeer) {
        let initiatorName = "Advocate Colleague";
        const initMatch = briefText.match(/\*\*Initiating Advocate\*\*:\s*([^\n(]+)/) ||
                          briefText.match(/\*\*Referring Advocate\*\*:\s*([^\n(]+)/) ||
                          briefText.match(/between\s+(Adv\.[^and]+)\s+and/i);
        if (initMatch) initiatorName = initMatch[1].trim();

        let interlocutorName = row.lawyer_name || "Advocate Colleague";
        const rowLawyerNorm = (row.lawyer_name || "").toLowerCase().replace(/^adv\.?\s*/i, "").trim();

        // If current logged-in lawyer is the recipient, the interlocutor is the initiator
        if (rowLawyerNorm && myName && rowLawyerNorm === myName) {
          interlocutorName = initiatorName;
        }

        clientName = interlocutorName;

        if (briefText.includes("Client Referral")) {
          const clientRefMatch = briefText.match(/\*\*Client Name \/ Matter\*\*:\s*([^\n]+)/) || briefText.match(/\*\*Client\*\*:\s*([^\n]+)/);
          matter = `Client Referral: ${clientRefMatch ? clientRefMatch[1].trim() : "Case Representation"}`;
        } else {
          matter = "Inter-Advocate Peer Collaboration";
        }
        sectionStr = "Bar Council / High Court Peer Channel";
      } else {
        if (briefText) {
          const matterMatch = briefText.match(/\*\*Matter\*\*:\s*([^\n]+)/);
          if (matterMatch) matter = matterMatch[1].trim();
          const sectionMatch =
            briefText.match(/\*\*Applicable Statutes\*\*:\s*([^\n]+)/) ||
            briefText.match(/\*\*Sections Identified\*\*:\s*([^\n]+)/);
          if (sectionMatch) sectionStr = sectionMatch[1].trim();
        }

        const clientMatch = briefText.match(/\*\*Client\*\*:\s*([^(•\n]+)/);
        if (clientMatch && clientMatch[1].trim() && clientMatch[1].trim() !== "Citizen Client") {
          clientName = clientMatch[1].trim();
        } else if (row.user_id) {
          clientName = `Citizen (${row.user_id.slice(0, 8)})`;
        }
      }

      // Check last message from note if available
      let lastMsgText = briefText || "Channel opened.";
      if (row.note) {
        try {
          const parsed = JSON.parse(row.note);
          if (Array.isArray(parsed) && parsed.length > 0) {
            lastMsgText = parsed[parsed.length - 1].text || lastMsgText;
          }
        } catch {}
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

      const sortTime = row.created_at ? new Date(row.created_at).getTime() : 0;

      list.push({
        id: rowId,
        client: clientName,
        matterType: matter,
        section: sectionStr,
        consultationType: isPeer ? "Peer" : row.consult_type === "call" ? "Call" : "Chat",
        category: isPeer ? "peer" : "client",
        status: statusLabel,
        date: row.created_at
          ? new Date(row.created_at).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "Today",
        intakeBrief: briefText,
        lastMessage: lastMsgText,
        timestampSort: sortTime,
      });
    });

    return list.sort((a, b) => b.timestampSort - a.timestampSort);
  }, [dbConsults, lawyer]);

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

    async function loadMessages() {
      try {
        let initialList: ConsultationChatMessage[] | null = null;
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            initialList = parsed;
            setMessages(parsed);
          }
        }

        // Try syncing from Supabase database note field
        if (activeCase.id && activeCase.id !== "default") {
          const bareId = activeCase.id.replace(/^REF-/, "");
          let q = supabase.from("consultations").select("id, note");
          if (activeCase.id.startsWith("REF-")) {
            q = q.or(`id.eq.${activeCase.id},id.eq.${bareId}`);
          } else {
            q = q.eq("id", activeCase.id);
          }
          const { data } = await q.maybeSingle();

          if (data?.note) {
            try {
              const parsedNote = JSON.parse(data.note);
              if (Array.isArray(parsedNote) && parsedNote.length > 0) {
                setMessages(parsedNote);
                localStorage.setItem(storageKey, JSON.stringify(parsedNote));
                return;
              }
            } catch {
              // Not stored as JSON messages yet
            }
          }
        }

        if (initialList && initialList.length > 0) return;

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

    // Poll Supabase consultation note every 4s while case is open
    const pollInterval = window.setInterval(async () => {
      if (!activeCase?.id || activeCase.id === "default") return;
      try {
        const bareId = activeCase.id.replace(/^REF-/, "");
        let q = supabase.from("consultations").select("note");
        if (activeCase.id.startsWith("REF-")) {
          q = q.or(`id.eq.${activeCase.id},id.eq.${bareId}`);
        } else {
          q = q.eq("id", activeCase.id);
        }
        const { data } = await q.maybeSingle();

        if (data?.note) {
          try {
            const parsedNote = JSON.parse(data.note);
            if (Array.isArray(parsedNote) && parsedNote.length > 0) {
              setMessages((prev) => {
                if (prev.length !== parsedNote.length || JSON.stringify(prev) !== JSON.stringify(parsedNote)) {
                  localStorage.setItem(storageKey, JSON.stringify(parsedNote));
                  return parsedNote;
                }
                return prev;
              });
            }
          } catch {}
        }
      } catch {}
    }, 4000);

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
      window.clearInterval(pollInterval);
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

      // Persist to Supabase database so client and founders monitor receive it online
      if (activeCase.id && activeCase.id !== "default") {
        const bareId = activeCase.id.replace(/^REF-/, "");
        let q = supabase.from("consultations").update({ note: JSON.stringify(updated) });
        if (activeCase.id.startsWith("REF-")) {
          q = q.or(`id.eq.${activeCase.id},id.eq.${bareId}`);
        } else {
          q = q.eq("id", activeCase.id);
        }
        q.then(({ error }) => {
          if (error) console.warn("Supabase chat update notice:", error);
        });
      }
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
      let q = supabase.from("consultations").update({ status: "denied" });
      if (activeCase.id.startsWith("REF-")) {
        q = q.or(`id.eq.${activeCase.id},id.eq.${dbId}`);
      } else {
        q = q.eq("id", activeCase.id);
      }
      await q;
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

  const clientCasesCount = cases.filter((c) => c.category === "client").length;
  const peerCasesCount = cases.filter((c) => c.category === "peer").length;

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (categoryFilter === "client" && c.category !== "client") return false;
      if (categoryFilter === "peer" && c.category !== "peer") return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.client.toLowerCase().includes(q) ||
        c.matterType.toLowerCase().includes(q) ||
        (c.section && c.section.toLowerCase().includes(q))
      );
    });
  }, [cases, categoryFilter, search]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="border-b border-[#222222] pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[0.65rem] uppercase tracking-widest text-[#888888] font-mono block">
            CONFIDENTIAL CASE & PEER NETWORK INBOX
          </span>
          <h1 className="font-display text-4xl md:text-5xl font-medium text-white mt-1">
            Case & Colleague Inbox
          </h1>
          <p className="mt-1.5 text-xs text-[#999999]">
            Active client consultations, peer advocate collaboration channels, and transmitted case referrals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/lawyer/network"
            className="border border-white/20 bg-[#1A1A1A] hover:bg-[#252525] px-3.5 py-1.5 text-xs font-mono text-white rounded transition-colors"
          >
            + Connect With Colleagues
          </Link>
        </div>
      </div>

      {/* Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px] bg-[#141414] border border-[#2E2E2E] rounded-xl overflow-hidden shadow-2xl">
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
                placeholder="Search clients, colleagues, or matter..."
                className="w-full border border-[#333333] bg-[#0A0A0A] py-2 pl-9 pr-3 text-xs text-white placeholder:text-[#555555] focus:border-white focus:outline-none rounded"
              />
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 mt-2.5 font-mono text-[0.68rem]">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={`px-2.5 py-1 rounded transition-colors ${
                  categoryFilter === "all"
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "text-[#888888] hover:text-white hover:bg-[#1E1E1E]"
                }`}
              >
                All ({cases.length})
              </button>

              <button
                type="button"
                onClick={() => setCategoryFilter("client")}
                className={`px-2.5 py-1 rounded transition-colors ${
                  categoryFilter === "client"
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "text-[#888888] hover:text-white hover:bg-[#1E1E1E]"
                }`}
              >
                Clients ({clientCasesCount})
              </button>

              <button
                type="button"
                onClick={() => setCategoryFilter("peer")}
                className={`px-2.5 py-1 rounded transition-colors ${
                  categoryFilter === "peer"
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "text-[#888888] hover:text-white hover:bg-[#1E1E1E]"
                }`}
              >
                Colleagues ({peerCasesCount})
              </button>
            </div>
          </div>

          {/* Cases Feed */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#202020] max-h-[580px]">
            {filteredCases.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#777777] font-mono">
                {search ? "No matches found." : "No conversations found in this category."}
              </div>
            ) : (
              filteredCases.map((c) => {
                const isSelected = c.id === activeCase?.id;
                const isConfirmed = c.status === "Confirmed";
                const isDenied = c.status === "Denied";
                const isPeer = c.category === "peer";

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
                        <div
                          className={`h-7 w-7 rounded-full border flex items-center justify-center text-[0.65rem] font-bold uppercase ${
                            isPeer
                              ? "bg-sky-950/60 border-sky-500/40 text-sky-300"
                              : "bg-[#2A2A2A] border-white/10 text-white"
                          }`}
                        >
                          {isPeer ? <Scale className="h-3.5 w-3.5" /> : c.client.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-white text-sm truncate max-w-[140px]">
                              {c.client}
                            </span>
                            {isPeer ? (
                              <span className="border border-sky-500/40 bg-sky-950/50 text-[0.55rem] font-mono text-sky-300 px-1 py-0.2 rounded uppercase">
                                Colleague
                              </span>
                            ) : (
                              <span className="border border-emerald-500/40 bg-emerald-950/50 text-[0.55rem] font-mono text-emerald-400 px-1 py-0.2 rounded uppercase">
                                Client
                              </span>
                            )}
                          </div>
                        </div>
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
                        {isPeer ? (
                          <Users className="h-2.5 w-2.5 text-sky-400" />
                        ) : c.consultationType === "Call" ? (
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
                  {activeCase.category === "peer" ? (
                    <span className="text-[0.65rem] font-mono uppercase tracking-widest text-sky-400 bg-sky-950/60 border border-sky-500/30 px-2 py-0.5 rounded">
                      <Users className="h-3 w-3 inline mr-1" />
                      Peer Collaboration
                    </span>
                  ) : (
                    <span className="text-[0.65rem] font-mono uppercase tracking-widest text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                      <Lock className="h-3 w-3 inline mr-1" />
                      Masked Relay
                    </span>
                  )}
                  <span className="text-[0.65rem] font-mono uppercase text-[#AAAAAA] bg-[#222222] border border-[#333333] px-2 py-0.5 rounded">
                    {activeCase.consultationType === "Call" ? "Phone Consultation" : activeCase.category === "peer" ? "Colleague P2P Stream" : "Secure In-App Chat"}
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
