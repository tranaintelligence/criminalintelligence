import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createFileRoute, useNavigate, useLocation, useParams } from '@tanstack/react-router';
import {
  Send,
  Paperclip,
  FileText,
  Image as ImageIcon,
  X,
  Scale,
  AlertTriangle,
  Plus,
  Trash2,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react';
import { MessageBubble } from '@/components/Chat/MessageBubble';
import { SystemStatus } from '@/components/Sidebar/SystemStatus';
import { ConnectProfessionalOfferModal } from '@/components/ConnectProfessionalOfferModal';
import { supabase } from '@/integrations/supabase/client';
import type { ApplicableLaw, ChatMessage, ChatSession, StructuredAnalysis } from '@/lib/trana-types';
import { authFetch, authHeaders, notifyApiOnline, useTranaCredential, API_ONLINE_EVENT } from '@/lib/trana-auth';
import { API_URL } from '@/lib/trana-backend';

export const Route = createFileRoute('/_authenticated/dashboard/chat')({
  head: () => ({
    meta: [
      { title: 'Citizens Dashboard — TRANA' },
      { name: 'description', content: 'Statutory AI legal advisor with verified citations and legal document analysis.' },
      { property: 'og:title', content: 'Citizens Dashboard — TRANA' },
    ],
  }),
  component: ChatView,
});

const loadingSynonyms = ['Thinking...', 'Analyzing statutes...', 'Reviewing provisions...', 'Almost there...'];
const WELCOME_MESSAGE = "I am TRANA, an Indian criminal-law information and assistance platform designed to help ordinary people and families understand criminal law, their legal rights, and practical next steps under the BNS, BNSS, BSA, and related laws. How can I help you today?";
const CHAT_REQUEST_TIMEOUT_MS = 45_000;
const TEMPORARY_CHAT_STORAGE_KEY = 'trana.temporary-chat';

const readTemporaryChat = (): ChatMessage[] => {
  try {
    const saved = localStorage.getItem(TEMPORARY_CHAT_STORAGE_KEY);
    if (!saved) return [createWelcomeMessage()];
    const messages = JSON.parse(saved) as ChatMessage[];
    if (!Array.isArray(messages) || messages.length > 100) return [createWelcomeMessage()];
    return messages.filter(
      (message) =>
        message &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string' &&
        message.content.length <= 12000,
    );
  } catch {
    return [createWelcomeMessage()];
  }
};

const fetchChatRequest = async (
  input: RequestInfo | URL,
  credential: string,
  init: RequestInit,
  timeoutMessage: string,
): Promise<Response> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CHAT_REQUEST_TIMEOUT_MS);
  try {
    return await authFetch(input, credential, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error(timeoutMessage);
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
};

interface ChatAttachment {
  id: string;
  filename: string;
  content_type: string;
  size?: number;
  created_at?: string;
}

const isImageFile = (file: Pick<File, 'type' | 'name'>): boolean =>
  file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);

const readAttachments = (payload: unknown): ChatAttachment[] => {
  if (!payload || typeof payload !== 'object') return [];
  const attachments = (payload as { attachments?: unknown }).attachments;
  if (!Array.isArray(attachments)) return [];
  return attachments.filter(
    (item): item is ChatAttachment =>
      Boolean(
        item &&
          typeof item === 'object' &&
          typeof (item as ChatAttachment).id === 'string' &&
          typeof (item as ChatAttachment).filename === 'string' &&
          typeof (item as ChatAttachment).content_type === 'string',
      ),
  );
};

const createWelcomeMessage = (): ChatMessage => ({
  role: 'assistant',
  content: WELCOME_MESSAGE,
  created_at: new Date().toISOString(),
});

const isLawyerIntent = (text?: string | null): boolean => {
  if (!text) return false;
  const t = text.toLowerCase();
  return (
    /\b(lawyer|advocate|vakeel|vakil|attorney|counsel|counselor|bar\s*council)\b/i.test(t) ||
    /\b(legal\s*aid|nalsa|dlsa|tele-?law)\b/i.test(t) ||
    /\b(connect|reach|find|talk to|speak to|need|want|get|hire|call)\s+(?:an?\s+)?(?:lawyer|advocate|vakeel|vakil|attorney|counsel)\b/i.test(t) ||
    /\b(vakeel|vakil)\s*(?:chahiye|karo|batao|se baat|se milo)\b/i.test(t) ||
    /\b(?:reach a lawyer|connect with an? advocate|connect with a.*lawyer|verified advocate)\b/i.test(t)
  );
};

const formatSection = (section?: string | null, subsection?: string | null): string => {
  if (!section) return subsection ? `(${subsection})` : '';
  return subsection ? `${section}(${subsection})` : section;
};

const formatLegalLaw = (law: ApplicableLaw): string => {
  const title =
    [law.act ?? law.code, formatSection(law.section, law.subsection)].filter(Boolean).join(' — ') ||
    'Applicable law';
  const parts = [`### ${title}`];

  if (law.explanation?.trim()) {
    const explanation = law.explanation.trim().replace(/\s+/g, ' ');
    parts.push(`**Explanation**\n\n${explanation.length > 280 ? `${explanation.slice(0, 277)}…` : explanation}`);
  }

  return parts.join('\n\n');
};

const formatAnalysis = (
  analysis: unknown,
  options: { includeLegacyLawSummary?: boolean } = {},
): string => {
  if (typeof analysis === 'string') return analysis;
  if (!analysis || typeof analysis !== 'object') return 'The backend returned an empty analysis.';

  const result = analysis as StructuredAnalysis;
  const sections: string[] = [];

  // 1. Conversational Reply
  if (result.conversational_reply?.trim()) {
    sections.push(result.conversational_reply.trim());
  }

  // 2. Problem/Scenario Breakdown Sequence vs Direct Informational Question
  const hasSituationMeaning = Boolean(result.situation_meaning?.trim());
  const hasGeneralAnalysis = Boolean(result.general_analysis?.trim());
  const hasLegalReasoning = Boolean(result.legal_reasoning?.trim());

  if (hasSituationMeaning) {
    // 1. Meaning (easy terms - flowing paragraph)
    const meaning = result.situation_meaning.trim();
    sections.push(meaning.startsWith('#') ? meaning : `### Meaning\n\n${meaning}`);

    // 2. Bail Status (Bailable or Non-Bailable)
    if (result.bail_status?.trim()) {
      const bail = result.bail_status.trim();
      const isApplicable = !/^(?:not applicable|none|n\/?a|unclear|no arrest|not arrested|not an arrest)$/i.test(bail);
      if (isApplicable) {
        sections.push(bail.startsWith('#') ? bail : `### Bail Status (Bailable / Non-Bailable)\n\n${bail}`);
      }
    }

    // 3. Immediate Steps (Next 24 Hours)
    if (result.next_24_hours?.length) {
      const validSteps = result.next_24_hours.filter((item) => item?.trim() && !/^(?:not applicable|none|n\/?a)$/i.test(item.trim()));
      if (validSteps.length > 0) {
        sections.push(`### Immediate Steps (Next 24 Hours)\n\n${validSteps.map((item) => `- ${item.trim()}`).join('\n')}`);
      }
    }

    // 4. Rights
    if (result.rights?.length) {
      const validRights = result.rights.filter((item) => item?.trim() && !/^(?:not applicable|none|n\/?a)$/i.test(item.trim()));
      if (validRights.length > 0) {
        sections.push(`### Your Legal Rights\n\n${validRights.map((item) => `- ${item.trim()}`).join('\n')}`);
      }
    }

    // 5. Court or Authority
    if (result.handling_authority?.trim() && !/^(?:none|not applicable|n\/?a|unclear)$/i.test(result.handling_authority.trim())) {
      const auth = result.handling_authority.trim();
      sections.push(auth.startsWith('#') ? auth : `### Competent Court & Authority\n\n${auth}`);
    }

    // 6. Legal Reasoning (at the end)
    if (hasLegalReasoning) {
      const reasoning = result.legal_reasoning.trim();
      sections.push(reasoning.startsWith('#') ? reasoning : `### Legal Reasoning\n\n${reasoning}`);
    } else if (hasGeneralAnalysis && !result.general_analysis?.includes(result.situation_meaning.trim())) {
      const general = result.general_analysis.trim();
      sections.push(general.startsWith('#') ? general : `### Legal Reasoning\n\n${general}`);
    }
  } else if (hasGeneralAnalysis) {
    // Normal / general informational questions: Answer directly without unnecessary crisis steps
    sections.push(result.general_analysis.trim());

    if (result.bail_status?.trim()) {
      const bail = result.bail_status.trim();
      const isApplicable = !/^(?:not applicable|none|n\/?a|unclear|no arrest|not arrested|not an arrest)$/i.test(bail);
      if (isApplicable && !result.general_analysis?.includes(bail)) {
        sections.push(bail.startsWith('#') ? bail : `### Bail Status\n\n${bail}`);
      }
    }

    if (result.next_24_hours?.length) {
      const validSteps = result.next_24_hours.filter((item) => item?.trim() && !/^(?:not applicable|none|n\/?a)$/i.test(item.trim()));
      if (validSteps.length > 0 && !result.general_analysis?.includes(validSteps[0].trim())) {
        sections.push(`### Immediate Steps (Next 24 Hours)\n\n${validSteps.map((item) => `- ${item.trim()}`).join('\n')}`);
      }
    }

    if (result.rights?.length) {
      const validRights = result.rights.filter((item) => item?.trim() && !/^(?:not applicable|none|n\/?a)$/i.test(item.trim()));
      if (validRights.length > 0 && !result.general_analysis?.includes(validRights[0].trim())) {
        sections.push(`### Your Legal Rights\n\n${validRights.map((item) => `- ${item.trim()}`).join('\n')}`);
      }
    }

    if (result.handling_authority?.trim() && !/^(?:none|not applicable|n\/?a|unclear)$/i.test(result.handling_authority.trim())) {
      const auth = result.handling_authority.trim();
      if (!result.general_analysis?.includes(auth)) {
        sections.push(auth.startsWith('#') ? auth : `### Competent Authority & Jurisdiction\n\n${auth}`);
      }
    }
  }

  // 7. Legacy Law Summary fallback (only if no interactive sources available)
  if (options.includeLegacyLawSummary && !hasGeneralAnalysis && result.applicable_laws?.length) {
    const laws = result.applicable_laws.filter((l) => l.act || l.code || l.section).map(formatLegalLaw);
    if (laws.length > 0) {
      sections.push(`### Applicable Laws & Sections\n\n${laws.join('\n\n')}`);
    }
  }

  // 8. Lawyer Recommendation (Only when genuinely needed)
  if (result.suggest_lawyer && !result.conversational_reply?.includes('NALSA')) {
    sections.push('> ⚖️ **Legal Note**: For formal court representation or filing bail applications, please consult a qualified advocate.');
  }

  let finalOutput = sections.join('\n\n').trim();
  if (!finalOutput) return 'The backend returned an analysis without readable content.';

  // Ensure mandatory legal first aid disclaimer is present on all substantive legal responses
  const isOutOfScope = finalOutput.includes("I'm only trained to help with criminal law situations");
  const isShortGreeting = Boolean(result.is_conversational && !hasGeneralAnalysis && !hasSituationMeaning);

  if (!isOutOfScope && !isShortGreeting && !finalOutput.toLowerCase().includes('not legal advice')) {
    finalOutput += '\n\n*This is general information, not legal advice.*';
  }

  return finalOutput;
};

const ThinkingAnimation: React.FC = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % loadingSynonyms.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex gap-3 animate-fade-in items-start">
      <div className="w-8 h-8 rounded-full bg-[#181818] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0 text-amber-200">
        <Scale className="w-4 h-4" />
      </div>
      <div className="bg-[#141414] border border-[#242424] rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-3 w-fit shadow-md">
        <div className="flex gap-1.5 items-center justify-center h-5">
          <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 bg-amber-300 rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
          <div className="w-1.5 h-1.5 bg-amber-200 rounded-full animate-pulse" style={{ animationDelay: '400ms' }} />
        </div>
        <div className="relative h-5 overflow-hidden min-w-[130px]">
          {loadingSynonyms.map((synonym, i) => {
            let positionClass = 'translate-y-full opacity-0';
            if (i === index) {
              positionClass = 'translate-y-0 opacity-100';
            } else if (i === (index - 1 + loadingSynonyms.length) % loadingSynonyms.length) {
              positionClass = '-translate-y-full opacity-0';
            }

            return (
              <span
                key={synonym}
                className={`absolute inset-0 flex items-center transition-all duration-500 ease-in-out text-xs font-mono text-neutral-300 whitespace-nowrap ${positionClass}`}
              >
                {synonym}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const ChatLoadingScreen: React.FC = () => (
  <div className="h-full flex flex-col items-center justify-center text-neutral-400 animate-fade-in py-12">
    <div className="w-10 h-10 rounded-full border-2 border-[#2a2a2a] border-t-amber-300 animate-spin mb-4" />
    <p className="text-sm font-medium text-neutral-200">Loading chat history...</p>
    <p className="mt-1 text-xs text-neutral-500 text-center max-w-xs">
      Connecting to the TRANA statutory engine.
    </p>
  </div>
);

function PortalModal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

export function ChatView() {
  const { credential } = useTranaCredential();
  return <ChatViewContent key={credential ? 'signed-in' : 'guest'} />;
}

export function ChatViewContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = (useParams({ strict: false }) as { id?: string }) || {};
  const routeChatId = params.id;
  const { credential, user } = useTranaCredential();
  const navState = location.state as { preloadedMessages?: ChatMessage[]; forChatId?: string } | null;
  const preloadedMessages = navState?.forChatId === routeChatId ? navState?.preloadedMessages : undefined;
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    preloadedMessages ?? (routeChatId ? [createWelcomeMessage()] : credential ? [createWelcomeMessage()] : readTemporaryChat()),
  );
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [quickUnavailable, setQuickUnavailable] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [chatAttachments, setChatAttachments] = useState<ChatAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState('');
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return false;
  });
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [modalInitialView, setModalInitialView] = useState<'notice' | 'directory' | 'free_aid'>('notice');
  const [userRequestedLawyerRecently, setUserRequestedLawyerRecently] = useState(false);
  const [hasOfferedConnection, setHasOfferedConnection] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('trana_offered_advocate_connect') === 'true';
    }
    return false;
  });
  const [dismissedOffer, setDismissedOffer] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [health, setHealth] = useState<{ status: 'checking' | 'online' | 'offline'; sourceRegistryReady: boolean }>({
    status: 'checking',
    sourceRegistryReady: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pendingChatIdRef = useRef<string | null>(null);

  // Health polling & status events
  useEffect(() => {
    let active = true;
    let requestInFlight = false;
    let consecutiveFailures = 0;

    const handleApiOnline = (event: Event) => {
      const sourceRegistryReady = (event as CustomEvent<{ sourceRegistryReady?: boolean }>).detail?.sourceRegistryReady;
      if (active) {
        setHealth((current) => ({
          status: 'online',
          sourceRegistryReady: sourceRegistryReady ? true : current.sourceRegistryReady,
        }));
      }
    };

    window.addEventListener(API_ONLINE_EVENT, handleApiOnline);

    const checkHealth = async () => {
      if (requestInFlight) return;
      requestInFlight = true;

      try {
        const response = await fetch(`${API_URL}/health?ts=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
        const data = await response.json();
        if (active) {
          setHealth({
            status: data.status === 'healthy' ? 'online' : 'offline',
            sourceRegistryReady: data.source_registry_ready !== false,
          });
          consecutiveFailures = 0;
        }
      } catch {
        consecutiveFailures += 1;
        if (active && consecutiveFailures >= 2) {
          setHealth((current) => ({ ...current, status: 'offline' }));
        }
      } finally {
        requestInFlight = false;
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener(API_ONLINE_EVENT, handleApiOnline);
    };
  }, []);

  // Load chat session list
  useEffect(() => {
    let active = true;

    const loadChats = async () => {
      if (!credential) {
        if (active) setChats([]);
        return;
      }
      try {
        const response = await authFetch(`${API_URL}/api/chats`, credential, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Chat history failed: ${response.status}`);
        const data = (await response.json()) as ChatSession[];
        if (active) setChats(Array.isArray(data) ? data : []);
      } catch {
        // Keep previous chats during network glitches
      }
    };

    loadChats();

    const handleChatCreated = (event: Event) => {
      const chat = (event as CustomEvent<ChatSession>).detail;
      if (!chat?.id) return;
      setChats((current) => [chat, ...current.filter((c) => c.id !== chat.id)]);
    };

    const handleHistoryUpdated = () => {
      void loadChats();
    };

    window.addEventListener('chat-created', handleChatCreated);
    window.addEventListener('chat-history-updated', handleHistoryUpdated);
    return () => {
      active = false;
      window.removeEventListener('chat-created', handleChatCreated);
      window.removeEventListener('chat-history-updated', handleHistoryUpdated);
    };
  }, [credential]);

  // Persist guest chat
  useEffect(() => {
    if (!credential && !routeChatId) {
      try {
        localStorage.setItem(TEMPORARY_CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-100)));
      } catch {
        console.warn('Could not save temporary chat in browser storage.');
      }
    }
  }, [credential, messages, routeChatId]);

  // Clipboard paste handler
  const handleChatPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const clipboard = event.clipboardData;
    const images = Array.from(clipboard.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    const text = clipboard.getData('text/plain');
    const composerFocused = event.target === chatInputRef.current;
    if (!images.length && composerFocused) return;
    if (images.length) {
      event.preventDefault();
      const namedImages = images.map(
        (file, index) =>
          new File(
            [file],
            file.name || `clipboard-image-${Date.now()}-${index + 1}.${file.type.split('/')[1] || 'png'}`,
            { type: file.type, lastModified: Date.now() },
          ),
      );
      setPendingFiles((files) => [...files, ...namedImages]);
      setAttachmentError('');
    }
    if (text && (!composerFocused || images.length > 0)) {
      event.preventDefault();
      setInput((current) => {
        if (!current) return text;
        if (!composerFocused) return `${current}\n${text}`;
        const inputElement = chatInputRef.current;
        const start = inputElement?.selectionStart ?? current.length;
        const end = inputElement?.selectionEnd ?? start;
        return `${current.slice(0, start)}${text}${current.slice(end)}`;
      });
    }
  };

  useEffect(() => {
    const urls: Record<string, string> = {};
    pendingFiles.forEach((file) => {
      if (isImageFile(file)) urls[`${file.name}:${file.size}:${file.lastModified}`] = URL.createObjectURL(file);
    });
    setPreviewUrls(urls);
    return () => Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
  }, [pendingFiles]);

  // Load attachments for current chat
  useEffect(() => {
    let active = true;
    if (!routeChatId || !credential) {
      setChatAttachments([]);
      return () => {
        active = false;
      };
    }
    const loadAttachments = async () => {
      try {
        const response = await authFetch(
          `${API_URL}/api/chats/${encodeURIComponent(routeChatId)}/attachments`,
          credential,
          { cache: 'no-store' },
        );
        if (!response.ok) throw new Error(`Attachment list failed: ${response.status}`);
        const payload: unknown = await response.json();
        if (active) setChatAttachments(readAttachments(payload));
      } catch (error) {
        console.error('Failed to load chat attachments', error);
        if (active) setAttachmentError('Could not load this chat’s attachments.');
      }
    };
    setAttachmentError('');
    loadAttachments();
    return () => {
      active = false;
    };
  }, [credential, routeChatId]);

  // Load messages for current routeChatId
  useEffect(() => {
    let active = true;

    if (!routeChatId || !credential) {
      return () => {
        active = false;
      };
    }

    if (preloadedMessages && preloadedMessages.length > 0) {
      return () => {
        active = false;
      };
    }

    const loadChat = async () => {
      setQuickUnavailable(false);
      setIsChatLoading(true);
      setMessages([]);
      try {
        const response = await authFetch(`${API_URL}/api/chats/${encodeURIComponent(routeChatId)}`, credential, {
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Chat history failed: ${response.status}`);

        const chat = (await response.json()) as ChatSession;
        if (!active) return;

        const loadedMessages: ChatMessage[] = (chat.messages ?? []).map((message) => {
          const sources = message.sources ?? undefined;
          return {
            role: message.role,
            content:
              message.role === 'assistant' && message.structured_content
                ? formatAnalysis(message.structured_content, { includeLegacyLawSummary: !sources?.length })
                : message.content,
            sources,
            structured_content: message.structured_content,
            model_used: message.model_used ?? undefined,
            processing_time_seconds: message.processing_time_seconds ?? undefined,
            created_at: message.created_at,
          };
        });

        // Ensure TRANA introduces itself at the start of every chatbox
        if (loadedMessages.length === 0) {
          setMessages([createWelcomeMessage()]);
        } else if (loadedMessages[0].role !== 'assistant' || !loadedMessages[0].content.includes('TRANA')) {
          setMessages([createWelcomeMessage(), ...loadedMessages]);
        } else {
          setMessages(loadedMessages);
        }
      } catch (error) {
        console.error('Failed to load chat history', error);
      } finally {
        if (active) setIsChatLoading(false);
      }
    };

    loadChat();
    return () => {
      active = false;
    };
  }, [credential, routeChatId, preloadedMessages]);

  const shouldShowChatLoading = Boolean(routeChatId && credential && isChatLoading);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNewChat = () => {
    if (!credential) localStorage.removeItem(TEMPORARY_CHAT_STORAGE_KEY);
    pendingChatIdRef.current = null;
    setMessages([createWelcomeMessage()]);
    setChatAttachments([]);
    setPendingFiles([]);
    setInput('');
    setQuickUnavailable(false);
    navigate({ to: '/dashboard/chat' });
  };

  const handleDeleteChat = async (event: React.MouseEvent, chat: ChatSession) => {
    event.stopPropagation();
    if (!credential || !window.confirm(`Delete “${chat.title || 'New Chat'}”? This will remove it from your chat history.`)) return;

    try {
      const response = await authFetch(`${API_URL}/api/chats/${chat.id}`, credential, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(`Chat deletion failed: ${response.status}`);

      setChats((current) => current.filter((c) => c.id !== chat.id));
      if (routeChatId === chat.id) {
        handleNewChat();
      }
    } catch {
      window.alert('Could not delete this chat. Please try again.');
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && pendingFiles.length === 0) || isLoading || shouldShowChatLoading) return;
    if (!credential && pendingFiles.length > 0) {
      setAttachmentError('Sign in to attach PDFs or photos. Temporary chats support text only.');
      return;
    }

    const trimmedInput = input.trim();
    const isAskingLawyer = isLawyerIntent(trimmedInput) || (
      messages.length > 0 &&
      isLawyerIntent(messages[messages.length - 1]?.content || '') &&
      /^(?:yes|yep|yeah|sure|please|haan|ha|connect|ok|okay)/i.test(trimmedInput)
    );

    if (isAskingLawyer) {
      setUserRequestedLawyerRecently(true);
      setDismissedOffer(false);
    }

    setIsLoading(true);
    const newMessage: ChatMessage = { role: 'user', content: input, created_at: new Date().toISOString() };
    setAttachmentError('');
    let uploadComplete = pendingFiles.length === 0;

    try {
      let activeChatId = routeChatId ?? pendingChatIdRef.current;
      if (credential && !activeChatId) {
        const createResponse = await fetchChatRequest(
          `${API_URL}/api/chats`,
          credential,
          {
            method: 'POST',
            headers: { ...authHeaders(credential), 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: input.slice(0, 32) || 'New Inquiry' }),
          },
          'Creating this chat took too long. Please try sending again.',
        );
        if (!createResponse.ok) throw new Error('Could not create a chat session.');
        const createdChat = (await createResponse.json()) as ChatSession;
        activeChatId = createdChat.id;
        pendingChatIdRef.current = activeChatId;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('chat-created', { detail: createdChat }));
        }
      }

      if (credential && pendingFiles.length > 0 && activeChatId) {
        setIsUploadingAttachments(true);
        const formData = new FormData();
        pendingFiles.forEach((file) => formData.append('files', file, file.name));
        const uploadResponse = await fetchChatRequest(
          `${API_URL}/api/chats/${encodeURIComponent(activeChatId)}/attachments`,
          credential,
          {
            method: 'POST',
            body: formData,
          },
          'Saving the attachment took too long. It is still selected; please retry.',
        );
        if (!uploadResponse.ok) {
          let detail = 'The files could not be uploaded. Your selected files are still here; please try again.';
          try {
            const body = (await uploadResponse.json()) as { detail?: unknown };
            if (typeof body.detail === 'string') detail = body.detail;
          } catch {
            /* Keep fallback */
          }
          throw new Error(detail);
        }
        const uploaded: unknown = await uploadResponse.json();
        const uploadedAttachments = readAttachments(uploaded);
        if (uploadedAttachments.length !== pendingFiles.length) {
          throw new Error('The server did not confirm every attachment. Your selected files are still here; please retry.');
        }
        setChatAttachments((current) => {
          const ids = new Set(current.map((attachment) => attachment.id));
          return [...current, ...uploadedAttachments.filter((attachment) => !ids.has(attachment.id))];
        });
        setPendingFiles([]);
        uploadComplete = true;
      }

      setMessages((prev) => [...prev, newMessage]);
      setInput('');

      const priorHistory = messages
        .filter((message) => message.content !== WELCOME_MESSAGE)
        .slice(-20)
        .map(({ role, content }) => ({ role, content: content.slice(-8000) }));
      const res = await fetchChatRequest(
        `${API_URL}${credential ? '/api/analyze' : '/api/analyze/temporary'}`,
        credential ?? '',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: newMessage.content || 'Analyze the attached document.',
            model_preference: 'quick',
            ...(credential ? { chat_id: activeChatId } : { conversation_history: priorHistory }),
          }),
        },
        'Analysis took too long. Please try sending your question again.',
      );

      if (res.ok) {
        notifyApiOnline(true);
        const data = await res.json();
        const sources = Array.isArray(data.sources) ? data.sources : undefined;
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: formatAnalysis(data.analysis, { includeLegacyLawSummary: !sources?.length }),
          sources,
          structured_content: data.analysis,
          model_used: data.model_used,
          processing_time_seconds: data.processing_time_seconds,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        if (data.analysis?.suggest_lawyer || isLawyerIntent(assistantMessage.content) || isAskingLawyer) {
          setUserRequestedLawyerRecently(true);
          setDismissedOffer(false);
        }
        if (credential && !routeChatId && activeChatId) {
          const messagesForNavigation = messages.length > 0 ? messages : [createWelcomeMessage()];
          navigate({
            to: '/dashboard/chat/$id',
            params: { id: activeChatId },
            replace: true,
            state: {
              forChatId: activeChatId,
              preloadedMessages: [...messagesForNavigation, newMessage, assistantMessage],
            } as any,
          });
          pendingChatIdRef.current = null;
        }
      } else {
        let detail = 'The backend could not complete the analysis.';
        let errorCode = '';
        try {
          const err = (await res.json()) as { detail?: unknown };
          if (typeof err.detail === 'string') {
            detail = err.detail;
          } else if (Array.isArray(err.detail)) {
            detail = err.detail.map((d: any) => d?.msg || JSON.stringify(d)).join(', ');
          } else if (err.detail && typeof err.detail === 'object') {
            const structuredDetail = err.detail as { code?: unknown; message?: unknown };
            errorCode = typeof structuredDetail.code === 'string' ? structuredDetail.code : '';
            if (typeof structuredDetail.message === 'string') detail = structuredDetail.message;
          }
        } catch {
          // Keep fallback
        }

        const quickIsUnavailable =
          res.status === 429 &&
          (errorCode === 'QUICK_MODEL_UNAVAILABLE' || detail.toLowerCase().includes('quick thinking'));
        if (quickIsUnavailable) {
          setQuickUnavailable(true);
          detail =
            'Quick Thinking is temporarily unavailable because all configured Quick Thinking providers are rate-limited.';
        }
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `I couldn't complete that analysis. ${detail} Please try again in a moment.`,
          },
        ]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'I couldn’t send this message. Please try again.';
      if (!uploadComplete) {
        setAttachmentError(message);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `${message} Your message${
              credential ? ' and saved attachments are still in this chat' : ' is still in this temporary chat'
            }.`,
          },
        ]);
      }
    } finally {
      setIsUploadingAttachments(false);
      setIsLoading(false);
    }
  };

  const currentChatTitle =
    (routeChatId && chats.find((c) => c.id === routeChatId)?.title) || 'Legal Analysis & RAG Chat';

  return (
    <div
      className="chat-view flex h-full w-full bg-[#0a0a0c] overflow-hidden relative"
      onPaste={handleChatPaste}
    >
      {/* ── Mobile Sessions Drawer (Portal to document.body) ───────────── */}
      {mounted && isSidebarOpen && (
        <PortalModal>
          <div className="fixed inset-0 z-[9999] lg:hidden flex">
            {/* Full-screen tap-to-dismiss Backdrop */}
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
              onClick={() => setIsSidebarOpen(false)}
              aria-hidden="true"
            />
            {/* Mobile Drawer panel */}
            <div className="relative z-10 w-[300px] max-w-[85vw] h-full bg-[#0e0e11] border-r border-white/10 flex flex-col shadow-2xl pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-in slide-in-from-left duration-200">
              {/* Header with Title and Prominent Close Button */}
              <div className="p-3.5 border-b border-white/[0.08] space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-wider text-neutral-300 font-semibold flex items-center gap-2">
                    <MessageSquare size={14} className="text-amber-400" />
                    Chat Sessions
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white transition-colors cursor-pointer"
                    title="Close sidebar"
                    aria-label="Close chat sessions"
                  >
                    <X size={18} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsSidebarOpen(false);
                    handleNewChat();
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-amber-400/10 hover:bg-amber-400/20 text-amber-200 hover:text-white border border-amber-400/30 px-3.5 py-2.5 rounded-xl transition-all text-xs font-medium shadow-sm active:scale-[0.99] cursor-pointer"
                >
                  <Plus size={15} className="text-amber-300" />
                  <span>New Chat</span>
                </button>
              </div>

              {/* Sessions List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {chats.map((chat) => {
                  const isActive = chat.id === routeChatId;
                  return (
                    <div
                      key={chat.id}
                      className={`group relative flex items-center w-full rounded-xl transition-colors ${
                        isActive
                          ? 'bg-white/[0.12] text-white font-medium border border-white/20'
                          : 'text-neutral-300 hover:text-white hover:bg-white/[0.06]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setIsSidebarOpen(false);
                          navigate({ to: '/dashboard/chat/$id', params: { id: chat.id }, state: {} as any });
                        }}
                        className="w-full text-left px-3 py-3 pr-8 text-xs truncate cursor-pointer"
                        title={chat.title}
                      >
                        {chat.title || 'Untitled Session'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => void handleDeleteChat(e, chat)}
                        className="absolute right-2 p-2 rounded text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete chat"
                        aria-label={`Delete ${chat.title || 'chat'}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
                {credential && chats.length === 0 && (
                  <div className="px-3 py-6 text-center text-xs text-neutral-500 font-mono">
                    No saved chats yet.
                  </div>
                )}
                {!credential && (
                  <div className="px-3 py-6 text-center text-xs text-neutral-500 font-mono">
                    Temporary guest mode. Sign in to save chats.
                  </div>
                )}
              </div>

              {/* System Health Status in Sidebar Footer */}
              <div className="p-3 border-t border-white/[0.08] shrink-0 bg-[#0e0e11]">
                <SystemStatus
                  status={health.status}
                  sourceRegistryReady={health.sourceRegistryReady}
                  onRetry={() => {
                    setHealth((c) => ({ ...c, status: 'checking' }));
                    void fetch(`${API_URL}/health?ts=${Date.now()}`)
                      .then((r) => r.json())
                      .then((data) =>
                        setHealth({
                          status: data.status === 'healthy' ? 'online' : 'offline',
                          sourceRegistryReady: data.source_registry_ready !== false,
                        }),
                      )
                      .catch(() => setHealth((c) => ({ ...c, status: 'offline' })));
                  }}
                />
              </div>
            </div>
          </div>
        </PortalModal>
      )}

      {/* ── Desktop Sessions Sidebar (In-flow) ─────────────────────────── */}
      <aside
        className={`
          hidden lg:flex flex-col shrink-0 select-none border-r border-white/[0.08] bg-[#0e0e11] h-full transition-all duration-200 ease-in-out
          ${isSidebarOpen ? 'w-72' : 'w-0 overflow-hidden border-r-0'}
        `}
      >
        {/* Sidebar Header & New Chat button */}
        <div className="p-3.5 border-b border-white/[0.08] space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-400 font-semibold flex items-center gap-1.5">
              <MessageSquare size={13} className="text-amber-300" />
              Chat Sessions
            </span>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="text-neutral-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/[0.08] cursor-pointer"
              title="Close sidebar"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 bg-white/[0.07] hover:bg-white/[0.12] text-neutral-100 hover:text-white border border-white/10 px-3.5 py-2.5 rounded-xl transition-all text-xs font-medium shadow-sm active:scale-[0.99] cursor-pointer"
          >
            <Plus size={15} className="text-amber-300" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Saved Sessions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {chats.map((chat) => {
            const isActive = chat.id === routeChatId;
            return (
              <div
                key={chat.id}
                className={`group relative flex items-center w-full rounded-xl transition-colors ${
                  isActive
                    ? 'bg-white/[0.1] text-white font-medium border border-white/15'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    navigate({ to: '/dashboard/chat/$id', params: { id: chat.id }, state: {} as any });
                  }}
                  className="w-full text-left px-3 py-2.5 pr-8 text-xs truncate cursor-pointer"
                  title={chat.title}
                >
                  {chat.title || 'Untitled Session'}
                </button>
                <button
                  type="button"
                  onClick={(e) => void handleDeleteChat(e, chat)}
                  className="absolute right-2 p-1 rounded text-neutral-500 hover:text-rose-400 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                  title="Delete chat"
                  aria-label={`Delete ${chat.title || 'chat'}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
          {credential && chats.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-neutral-500 font-mono">
              No saved chats yet.
            </div>
          )}
          {!credential && (
            <div className="px-3 py-6 text-center text-xs text-neutral-500 font-mono">
              Temporary guest mode. Sign in to save chats.
            </div>
          )}
        </div>

        {/* System Health Status in Sidebar Footer */}
        <div className="p-3 border-t border-white/[0.08] shrink-0 bg-[#0e0e11]">
          <SystemStatus
            status={health.status}
            sourceRegistryReady={health.sourceRegistryReady}
            onRetry={() => {
              setHealth((c) => ({ ...c, status: 'checking' }));
              void fetch(`${API_URL}/health?ts=${Date.now()}`)
                .then((r) => r.json())
                .then((data) =>
                  setHealth({
                    status: data.status === 'healthy' ? 'online' : 'offline',
                    sourceRegistryReady: data.source_registry_ready !== false,
                  }),
                )
                .catch(() => setHealth((c) => ({ ...c, status: 'offline' })));
            }}
          />
        </div>
      </aside>

      {/* ── Main Conversation Area ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#0a0a0c]">
        {/* Header */}
        <header className="chat-view__header h-13 md:h-14 border-b border-white/[0.08] flex items-center justify-between px-3 sm:px-5 shrink-0 z-10 bg-[#0e0e11]/80 backdrop-blur-xl">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-neutral-400 hover:text-neutral-200 transition-colors p-1.5 rounded-lg hover:bg-white/[0.06] cursor-pointer flex items-center gap-1 shrink-0"
              title={isSidebarOpen ? "Close history" : "Open history"}
              aria-label="Toggle chat history"
            >
              <PanelLeft size={16} />
              <span className="text-[11px] font-mono hidden xs:inline text-neutral-400">Chats</span>
            </button>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-semibold tracking-tight text-neutral-100 truncate">
                {currentChatTitle}
              </h2>
              {!credential && (
                <p className="text-[9px] sm:text-[10px] text-neutral-500 font-mono truncate">
                  Temporary browser chat · Clears on reset
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {quickUnavailable && (
              <div
                className="chat-view__alert flex items-center gap-1 text-[10px] sm:text-xs text-amber-300 bg-amber-950/40 border border-amber-800/60 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full font-mono"
                role="status"
              >
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span className="hidden sm:inline">Quick Thinking rate-limited</span>
                <span className="sm:hidden">Busy</span>
              </div>
            )}
            {routeChatId && (
              <button
                type="button"
                onClick={(e) => {
                  const targetChat = chats.find((c) => c.id === routeChatId) || ({ id: routeChatId, title: currentChatTitle } as any);
                  void handleDeleteChat(e, targetChat);
                }}
                className="text-xs text-rose-400 hover:text-rose-300 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-rose-900/40 hover:bg-rose-950/30 transition-colors flex items-center gap-1 cursor-pointer"
                title="Delete this chat session"
              >
                <Trash2 size={13} />
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleNewChat}
              className="text-xs text-neutral-300 hover:text-white px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-white/10 hover:bg-white/[0.08] transition-colors cursor-pointer flex items-center gap-1"
            >
              <Plus size={13} className="text-amber-300" />
              <span>New</span>
            </button>
          </div>
        </header>

        {/* Messages list - Center aligned, spacious, comfortable */}
        <div className="chat-view__messages flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 py-4 sm:py-6">
          <div className="max-w-4xl mx-auto w-full space-y-4 sm:space-y-5">
            {shouldShowChatLoading ? (
              <ChatLoadingScreen />
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-neutral-500 py-16 sm:py-24">
                <Scale className="w-10 h-10 sm:w-12 sm:h-12 mb-3 opacity-30 text-amber-200" />
                <p className="text-xs sm:text-sm font-serif">Start a new legal inquiry...</p>
              </div>
            ) : null}
            {messages.map((msg, idx) => (
              <MessageBubble key={idx} message={msg} />
            ))}
            {messages.length === 1 && messages[0].content === WELCOME_MESSAGE && (
              <div className="flex flex-wrap gap-2 pt-1 pb-2">
                <button
                  type="button"
                  onClick={() => navigate({ to: '/dashboard/analyse' })}
                  className="text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer font-medium shadow-sm hover:scale-[1.01]"
                >
                  <FileText size={13} className="text-emerald-400" />
                  <span>Analyse an FIR / Complaint →</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInput("What are the rules for bail under BNSS?")}
                  className="text-xs bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white border border-white/10 px-3 py-2 rounded-xl transition-all cursor-pointer"
                >
                  Bail rules under BNSS
                </button>
                <button
                  type="button"
                  onClick={() => setInput("What are my rights if police come to question me or search my home?")}
                  className="text-xs bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white border border-white/10 px-3 py-2 rounded-xl transition-all cursor-pointer"
                >
                  Police questioning & search rights
                </button>
                <button
                  type="button"
                  onClick={() => setInput("What is Section 318 BNS?")}
                  className="text-xs bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white border border-white/10 px-3 py-2 rounded-xl transition-all cursor-pointer"
                >
                  Section 318 BNS (Cheating)
                </button>
              </div>
            )}
            {isLoading && <ThinkingAnimation />}

            {/* Offer to Connect with a Legal Professional */}
            {!isLoading && messages.some((m) => m.role === 'assistant' && m.content !== WELCOME_MESSAGE) && !dismissedOffer && (
              userRequestedLawyerRecently ||
              isLawyerIntent(messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || '') ||
              isLawyerIntent(messages.filter((m) => m.role === 'assistant').slice(-1)[0]?.content || '') ||
              !hasOfferedConnection
            ) && (
              <div className="rounded-xl border border-emerald-500/35 bg-gradient-to-r from-emerald-500/15 via-[#0e1712] to-emerald-950/30 p-3.5 sm:p-4 text-xs shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Scale className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span className="font-semibold text-emerald-300 tracking-tight text-xs sm:text-sm">
                        Would you like to connect with a verified legal professional?
                      </span>
                    </div>
                    <p className="text-neutral-300 leading-relaxed text-[11px] sm:text-xs">
                      Legal professional consultations are chargeable professional services. TRANA provides a neutral, unranked list so you can choose independently. If you cannot afford legal fees, free legal aid is available via NALSA / DLSA.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      sessionStorage.setItem('trana_offered_advocate_connect', 'true');
                      setHasOfferedConnection(true);
                      setDismissedOffer(true);
                      setUserRequestedLawyerRecently(false);
                    }}
                    className="text-neutral-400 hover:text-white p-1.5 text-xs shrink-0 cursor-pointer rounded-lg hover:bg-white/[0.08] transition-colors"
                    title="Dismiss"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="mt-3.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      sessionStorage.setItem('trana_offered_advocate_connect', 'true');
                      setHasOfferedConnection(true);
                      setModalInitialView('notice');
                      setIsConnectModalOpen(true);
                    }}
                    className="w-full sm:w-auto text-xs font-bold px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black border border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-colors cursor-pointer text-center active:scale-95"
                  >
                    View Legal Professionals (Chargeable)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sessionStorage.setItem('trana_offered_advocate_connect', 'true');
                      setHasOfferedConnection(true);
                      setModalInitialView('free_aid');
                      setIsConnectModalOpen(true);
                    }}
                    className="w-full sm:w-auto text-xs font-mono text-emerald-300 hover:text-emerald-200 px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors cursor-pointer text-center active:scale-95"
                  >
                    Free Legal Aid (15100)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sessionStorage.setItem('trana_offered_advocate_connect', 'true');
                      setHasOfferedConnection(true);
                      setDismissedOffer(true);
                      setUserRequestedLawyerRecently(false);
                    }}
                    className="w-full sm:w-auto text-xs font-mono text-neutral-400 hover:text-neutral-200 px-3 py-2 transition-colors cursor-pointer text-center"
                  >
                    No, thank you
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Composer - Pinned cleanly to bottom */}
        <div className="chat-view__composer p-2.5 sm:p-4 bg-[#0e0e11]/95 backdrop-blur-xl border-t border-white/[0.08] shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-4xl mx-auto w-full">
            {(chatAttachments.length > 0 || pendingFiles.length > 0) && (
              <div className="mb-2 sm:mb-3 flex flex-wrap gap-2" aria-label="Chat attachments">
                {chatAttachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-2 bg-white/[0.05] border border-white/10 text-xs py-1.5 px-2.5 rounded-lg max-w-full text-neutral-300"
                    title={`${attachment.filename} (saved in this chat)`}
                  >
                    {attachment.content_type.startsWith('image/') ? (
                      <ImageIcon className="w-4 h-4 text-amber-300 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                    )}
                    <span className="font-medium truncate max-w-[140px] sm:max-w-[180px]">{attachment.filename}</span>
                    <span className="text-neutral-500 text-[10px]">Saved</span>
                  </div>
                ))}
                {pendingFiles.map((file, index) => {
                  const key = `${file.name}:${file.size}:${file.lastModified}`;
                  const preview = previewUrls[key];
                  return (
                    <div
                      key={`${key}:${index}`}
                      className="flex items-center gap-2 bg-white/[0.05] border border-white/10 text-xs py-1.5 px-2.5 rounded-lg max-w-full text-neutral-300"
                    >
                      {preview ? (
                        <img src={preview} alt="" className="w-6 h-6 sm:w-7 sm:h-7 object-cover rounded" />
                      ) : (
                        <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                      )}
                      <span className="font-medium truncate max-w-[140px] sm:max-w-[180px]">{file.name}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => setPendingFiles((files) => files.filter((_, i) => i !== index))}
                        disabled={isLoading}
                        className="text-neutral-500 hover:text-neutral-300 disabled:opacity-40 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {attachmentError && <p role="alert" className="mb-2 text-xs text-rose-400">{attachmentError}</p>}
            {isUploadingAttachments && (
              <p role="status" className="mb-2 text-xs text-neutral-400">Saving attachments to this chat…</p>
            )}

            <div className="chat-view__input-shell flex items-center gap-2 sm:gap-3 bg-white/[0.05] border border-white/15 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 shadow-sm focus-within:border-amber-400/80 focus-within:ring-1 focus-within:ring-amber-400/50 transition-all">
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  const chosen = Array.from(e.target.files ?? []);
                  if (chosen.length) {
                    setPendingFiles((files) => {
                      const existing = new Set(files.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
                      return [
                        ...files,
                        ...chosen.filter((file) => !existing.has(`${file.name}:${file.size}:${file.lastModified}`)),
                      ];
                    });
                    setAttachmentError('');
                  }
                  e.currentTarget.value = '';
                }}
                className="hidden"
                accept="application/pdf,.pdf,image/*,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif"
                multiple
              />
              <button
                className="chat-view__attach-button text-neutral-400 hover:text-neutral-200 transition-colors p-1.5 shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={!user || shouldShowChatLoading}
                title="Attach PDFs or photos to this chat"
                type="button"
              >
                <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <input
                ref={chatInputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={user ? 'Ask a legal question or attach documents...' : 'Ask a legal question...'}
                disabled={shouldShowChatLoading}
                className="flex-1 bg-transparent border-0 outline-none text-neutral-100 placeholder-neutral-500 text-[16px] sm:text-sm min-w-0 p-0 shadow-none ring-0 focus:ring-0 focus:outline-none"
              />

              <button
                className="chat-view__send-button bg-neutral-200 text-neutral-900 hover:bg-white p-2 rounded-lg disabled:opacity-40 transition-colors cursor-pointer shrink-0"
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && pendingFiles.length === 0)}
                type="button"
                aria-label="Send inquiry"
              >
                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
            <p className="text-center text-[10px] sm:text-[11px] text-neutral-500 mt-1.5 sm:mt-2 font-mono">
              Statutory verification powered by official BNS, BNSS, and BSA source registries.
            </p>
          </div>
        </div>
      </div>

      {/* Connect with Advocate Offer Modal */}
      <ConnectProfessionalOfferModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        initialView={modalInitialView}
        initialTopic={messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || 'Legal First-Aid Consultation'}
      />
    </div>
  );
}
