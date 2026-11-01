import React, { useState, useEffect, useRef } from "react";
import { X, Send, Lock, MessageSquare, Phone, ShieldCheck } from "lucide-react";

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
  const normalizedType = consultationType.toLowerCase().includes("call") ? "Call" : "Chat";

  // Load and listen to messages for real-time synchronization between client and counsel
  useEffect(() => {
    if (!isOpen) return;

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

        // Default initial system notice if new conversation
        const initialSystem: ConsultationChatMessage[] = [
          {
            id: `msg-sys-${Date.now()}`,
            sender: "system",
            senderName: "TRANA Secure Relay",
            text: `Confidential consultation channel opened between ${clientName} and ${lawyerName} (Mode: ${normalizedType}). To preserve confidentiality, personal contact details and phone numbers are masked.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ];
        localStorage.setItem(storageKey, JSON.stringify(initialSystem));
        setMessages(initialSystem);
      } catch (err) {
        console.warn("Failed to load consultation messages:", err);
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
  }, [isOpen, storageKey, clientName, lawyerName, normalizedType]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    const newMessage: ConsultationChatMessage = {
      id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      sender: currentParty,
      senderName: myName,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updated = [...messages, newMessage];
    setMessages(updated);
    setInputText("");

    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
      // Dispatch notification events for cross-tab or same-window real-time chat sync
      window.dispatchEvent(new Event("trana_consult_chat_update"));
      window.dispatchEvent(new StorageEvent("storage", { key: storageKey }));
    } catch (err) {
      console.warn("Failed to save message:", err);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#141414] border border-[#333333] shadow-2xl flex flex-col h-[85vh] max-h-[700px] overflow-hidden">
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

          <button
            onClick={onClose}
            className="p-1.5 border border-[#333333] text-[#AAAAAA] hover:text-white hover:bg-[#252525] transition-colors"
            title="Close Chat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Privacy Guard Notice */}
        <div className="bg-[#111111] border-b border-[#222222] px-4 py-2 text-[0.7rem] text-[#888888] flex items-center gap-2 font-mono">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>
            Strict Privacy Protected: Only party names and consultation type are disclosed. Contact particulars remain confidential.
          </span>
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

        {/* Input Bar */}
        <form onSubmit={handleSend} className="border-t border-[#262626] bg-[#161616] p-3 flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Message ${peerName}...`}
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
