import React, { useState, useEffect, useRef } from "react";
import { 
  X, Send, Lock, MessageSquare, Phone, ShieldCheck, 
  UserMinus, UserPlus, AlertCircle 
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { maskConfidentialPatterns } from "@/lib/privacy-mask";

export type ConsultationChatMessage = {
  id: string;
  sender: "client" | "lawyer" | "system";
  senderName: string;
  text: string;
  timestamp: string;
};

interface ConsultationChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  consultationId: string;
  consultationType: "Call" | "Chat" | string;
  currentParty: "client" | "lawyer";
  clientName: string;
  lawyerName: string;
}

export function ConsultationChatModal({
  isOpen,
  onClose,
  consultationId,
  consultationType,
  currentParty,
  clientName,
  lawyerName,
}: ConsultationChatModalProps) {
  const [messages, setMessages] = useState<ConsultationChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const storageKey = `trana_consult_chat_${consultationId || "default"}`;
  const peerName = currentParty === "client" ? lawyerName : clientName;
  const myName = currentParty === "client" ? clientName : lawyerName;
  const normalizedType = consultationType?.toLowerCase().includes("call") ? "Call" : "Chat";

  // Load and listen to messages for real-time synchronization between client and counsel
  useEffect(() => {
    if (!isOpen) return;

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
        const bareId = consultationId.replace(/^REF-/, "");
        if (bareId && bareId !== "default") {
          const { data } = await supabase
            .from("consultations")
            .select("id, note")
            .or(`id.eq.${bareId},id.ilike.${bareId}%`)
            .maybeSingle();

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

        // Default initial system notice if new conversation
        const initialSystem: ConsultationChatMessage[] = [
          {
            id: `msg-sys-${Date.now()}`,
            sender: "system",
            senderName: "TRANA Secure Relay",
            text: `Confidential consultation channel opened between ${clientName} and ${lawyerName} (Mode: ${normalizedType}). Contact particulars, phone numbers, and numbers are strictly masked (XXXXX) for privacy.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ];
        localStorage.setItem(storageKey, JSON.stringify(initialSystem));
        setMessages(initialSystem);

        // Update central chat index for Founders Desk and Case Inbox
        registerChatInIndex(initialSystem[0]?.text || "Chat opened");
      } catch (err) {
        console.warn("Failed to load consultation messages:", err);
      }
    }

    loadMessages();

    // Poll Supabase consultation note every 4s while modal is active
    const pollInterval = window.setInterval(async () => {
      const bareId = consultationId.replace(/^REF-/, "");
      if (!bareId || bareId === "default") return;
      try {
        const { data } = await supabase
          .from("consultations")
          .select("note")
          .or(`id.eq.${bareId},id.ilike.${bareId}%`)
          .maybeSingle();

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
  }, [isOpen, storageKey, clientName, lawyerName, normalizedType, consultationId]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  function registerChatInIndex(lastMessageText: string) {
    try {
      const rawIndex = localStorage.getItem("trana_all_consultation_chats_index");
      const chatIndex: Record<string, any> = rawIndex ? JSON.parse(rawIndex) : {};
      chatIndex[consultationId] = {
        consultationId,
        clientName,
        lawyerName,
        consultationType: normalizedType,
        lastMessage: lastMessageText,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem("trana_all_consultation_chats_index", JSON.stringify(chatIndex));
    } catch {
      // ignore
    }
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const rawText = inputText.trim();
    if (!rawText) return;

    // Apply strict privacy masking: phone numbers, Morse code, number sequences are masked to XXXXX
    const maskedText = maskConfidentialPatterns(rawText);

    const newMessage: ConsultationChatMessage = {
      id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      sender: currentParty,
      senderName: myName,
      text: maskedText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updated = [...messages, newMessage];
    setMessages(updated);
    setInputText("");

    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
      registerChatInIndex(maskedText);
      // Dispatch notification events for cross-tab or same-window real-time chat sync
      window.dispatchEvent(new Event("trana_consult_chat_update"));
      window.dispatchEvent(new StorageEvent("storage", { key: storageKey }));

      // Persist to Supabase so advocate and founders monitor receive real messages
      const bareId = consultationId.replace(/^REF-/, "");
      if (bareId && bareId !== "default") {
        supabase
          .from("consultations")
          .update({ note: JSON.stringify(updated) })
          .or(`id.eq.${bareId},id.ilike.${bareId}%`)
          .then(({ error }) => {
            if (error) console.warn("Supabase chat sync notice:", error);
          });
      }
    } catch (err) {
      console.warn("Failed to save message:", err);
    }
  }

  // Client Action: Consult Another Lawyer if not satisfied
  async function handleConsultAnotherLawyer() {
    const confirmed = window.confirm(
      `Would you like to connect with another lawyer for this matter? This will unlock the directory so you can select new counsel.`
    );
    if (!confirmed) return;

    const systemNotice: ConsultationChatMessage = {
      id: `msg-reassign-${Date.now()}`,
      sender: "system",
      senderName: "TRANA Secure Relay",
      text: `Client ${clientName} opted to consult another legal professional from the directory. Representation with ${lawyerName} concluded.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updated = [...messages, systemNotice];
    setMessages(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));

    // Update status in local referrals and Supabase
    const dbId = consultationId.replace(/^REF-/, "");
    try {
      await supabase.from("consultations").update({ status: "cancelled" }).or(`id.eq.${dbId},id.ilike.${dbId}%`);
    } catch (e) {
      console.warn("Supabase update error:", e);
    }

    try {
      const local = JSON.parse(localStorage.getItem("trana_client_referrals") || "[]");
      const updatedLocal = local.map((r: any) =>
        r.id === consultationId ? { ...r, status: "Cancelled", clientSatisfied: false } : r
      );
      localStorage.setItem("trana_client_referrals", JSON.stringify(updatedLocal));

      // Unlock lawyer directory by removing requested markers
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("trana_requested_lawyers_")) {
          const arr = JSON.parse(localStorage.getItem(k) || "[]");
          const filtered = arr.filter((item: any) => {
            const id = typeof item === "string" ? item : item?.id;
            const name = typeof item === "object" ? item?.name : "";
            return id !== consultationId && (!lawyerName || !name.toLowerCase().includes(lawyerName.toLowerCase()));
          });
          localStorage.setItem(k, JSON.stringify(filtered));
        }
      });
    } catch {
      // ignore
    }

    window.dispatchEvent(new Event("trana_consult_chat_update"));
    toast.info("Navigating to Lawyer Directory to select alternative counsel.");
    onClose();
    if (typeof window !== "undefined") {
      window.location.href = "/dashboard/lawyers";
    }
  }

  // Lawyer Action: Leave Case if they can no longer represent the client
  async function handleLeaveCase() {
    const confirmed = window.confirm(
      `Are you sure you want to withdraw from this case? The client will be notified and given the option to consult another lawyer.`
    );
    if (!confirmed) return;

    const systemNotice: ConsultationChatMessage = {
      id: `msg-leave-${Date.now()}`,
      sender: "system",
      senderName: "TRANA Secure Relay",
      text: `Advocate ${lawyerName} has withdrawn from this matter. Client is now free to consult another lawyer from the directory.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updated = [...messages, systemNotice];
    setMessages(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));

    const dbId = consultationId.replace(/^REF-/, "");
    try {
      await supabase.from("consultations").update({ status: "denied" }).or(`id.eq.${dbId},id.ilike.${dbId}%`);
    } catch (e) {
      console.warn("Supabase update error:", e);
    }

    try {
      const local = JSON.parse(localStorage.getItem("trana_client_referrals") || "[]");
      const updatedLocal = local.map((r: any) =>
        r.id === consultationId ? { ...r, status: "Denied", lawyerWithdrawn: true } : r
      );
      localStorage.setItem("trana_client_referrals", JSON.stringify(updatedLocal));

      // Unlock directory
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("trana_requested_lawyers_")) {
          const arr = JSON.parse(localStorage.getItem(k) || "[]");
          const filtered = arr.filter((item: any) => {
            const id = typeof item === "string" ? item : item?.id;
            const name = typeof item === "object" ? item?.name : "";
            return id !== consultationId && (!lawyerName || !name.toLowerCase().includes(lawyerName.toLowerCase()));
          });
          localStorage.setItem(k, JSON.stringify(filtered));
        }
      });
    } catch {
      // ignore
    }

    window.dispatchEvent(new Event("trana_consult_chat_update"));
    toast.warning(`You have withdrawn from this matter. Case status updated to Denied/Relinquished.`);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#141414] border border-[#333333] shadow-2xl flex flex-col h-[85vh] max-h-[720px] overflow-hidden">
        {/* Header with Privacy Masking Notice */}
        <div className="border-b border-[#262626] bg-[#181818] p-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[0.65rem] font-mono uppercase tracking-widest text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                <Lock className="h-3 w-3" /> Masked Channel
              </span>
              <span className="flex items-center gap-1 text-[0.65rem] font-mono uppercase tracking-wider text-[#AAAAAA] bg-[#222222] border border-[#333333] px-2 py-0.5 rounded">
                {normalizedType === "Call" ? <Phone className="h-3 w-3 text-sky-400" /> : <MessageSquare className="h-3 w-3 text-purple-400" />}
                Mode: {normalizedType}
              </span>
            </div>
            <h2 className="mt-1 font-display text-xl sm:text-2xl font-medium text-white">
              {peerName}
            </h2>
            <p className="text-[0.7rem] text-[#888888] font-mono mt-0.5">
              Role: {currentParty === "client" ? "Advocate Counsel" : "Client"} • Confidential Direct Session
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Client Option: Consult Another Lawyer */}
            {currentParty === "client" && (
              <button
                type="button"
                onClick={handleConsultAnotherLawyer}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-[0.65rem] uppercase tracking-wider border border-amber-500/50 bg-amber-950/30 text-amber-300 hover:bg-amber-900/40 font-mono transition-colors rounded"
                title="Not satisfied with counsel? Connect with another lawyer"
              >
                <UserPlus className="h-3 w-3" />
                <span>Consult Another Lawyer</span>
              </button>
            )}

            {/* Lawyer Option: Leave Case */}
            {currentParty === "lawyer" && (
              <button
                type="button"
                onClick={handleLeaveCase}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-[0.65rem] uppercase tracking-wider border border-red-500/50 bg-red-950/30 text-red-300 hover:bg-red-900/40 font-mono transition-colors rounded"
                title="Withdraw/leave this matter"
              >
                <UserMinus className="h-3 w-3" />
                <span>Leave Case</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 border border-[#333333] text-[#AAAAAA] hover:text-white hover:bg-[#252525] transition-colors"
              title="Close Chat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Privacy Guard Notice */}
        <div className="bg-[#111111] border-b border-[#222222] px-4 py-2 text-[0.7rem] text-[#888888] flex items-center justify-between gap-2 font-mono">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              Strict Privacy Protected: Only names & consultation type disclosed. Phone numbers & Morse code masked (XXXXX).
            </span>
          </div>

          {/* Mobile responsive buttons for Consult Another Lawyer / Leave Case */}
          <div className="sm:hidden">
            {currentParty === "client" ? (
              <button
                type="button"
                onClick={handleConsultAnotherLawyer}
                className="text-[0.65rem] text-amber-300 underline"
              >
                Consult Another Lawyer
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLeaveCase}
                className="text-[0.65rem] text-red-300 underline"
              >
                Leave Case
              </button>
            )}
          </div>
        </div>

        {/* Chat Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#0F0F0F]">
          {messages.map((m) => {
            if (m.sender === "system") {
              return (
                <div key={m.id} className="text-center my-2">
                  <div className="inline-block max-w-[90%] border border-[#2A2A2A] bg-[#161616] px-3.5 py-2 text-[0.75rem] text-[#AAAAAA] rounded font-mono leading-relaxed">
                    {m.text}
                  </div>
                </div>
              );
            }

            const isMe = m.sender === currentParty;

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
                  className={`max-w-[85%] rounded px-3.5 py-2.5 text-sm leading-relaxed ${
                    isMe
                      ? "bg-white text-black font-sans shadow-md"
                      : "bg-[#1E1E1E] text-white border border-[#2E2E2E]"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar with Privacy Anti-Evasion Engine */}
        <form onSubmit={handleSend} className="border-t border-[#262626] bg-[#161616] p-3 flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Message ${peerName}... (Phone numbers & sequences masked automatically)`}
            className="flex-1 border border-[#333333] bg-[#0A0A0A] px-3.5 py-2.5 text-sm text-white placeholder:text-[#666666] focus:border-white focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="bg-white text-black px-4 py-2.5 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-200 transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
