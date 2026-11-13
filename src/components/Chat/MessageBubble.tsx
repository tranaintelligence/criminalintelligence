import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  Scale,
  ChevronDown,
  ChevronUp,
  Clock,
  CalendarClock,
  ExternalLink,
  FileText,
  BookOpen,
} from 'lucide-react';
import { marked } from 'marked';
import type { ChatMessage, SourceChunk } from '@/lib/trana-types';

interface MessageBubbleProps {
  message: ChatMessage;
}

const formatMessageTime = (value: string): string | null => {
  // Older API records contain UTC timestamps without an offset.
  const normalizedValue = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) return null;

  return `${new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)} IST`;
};

const VERIFIED_QUOTE_STATUSES = new Set(['backend_verified', 'verified', 'source_verified']);

const OFFICIAL_ACT_URLS = {
  bns: 'https://www.mha.gov.in/sites/default/files/2024-04/250883_english_01042024.pdf',
  bnss: 'https://www.mha.gov.in/sites/default/files/2024-04/250884_2_english_01042024.pdf',
  bsa: 'https://www.mha.gov.in/sites/default/files/2024-04/250882_english_01042024_0.pdf',
} as const;

const isVerifiedSource = (source: SourceChunk): boolean => {
  const status = source.quote_status?.trim().toLowerCase();
  return source.verified === true && !!status && VERIFIED_QUOTE_STATUSES.has(status);
};

const getVerifiedText = (source: SourceChunk): string | null => {
  if (!isVerifiedSource(source)) return null;
  const text = source.exact_text ?? source.quote ?? source.content;
  return typeof text === 'string' && text.trim() ? text.trim() : null;
};

const formatDocName = (name?: string) => {
  if (!name) return 'Legal source';
  if (name.includes('::')) {
    const parts = name.split('::');
    return `Case Document: ${parts[parts.length - 1]}`;
  }
  return name;
};

const formatSection = (section?: string, subsection?: string | null): string => {
  if (!section) return subsection ? `(${subsection})` : '';
  return subsection ? `${section}(${subsection})` : section;
};

const formatActName = (source: SourceChunk): string =>
  source.act?.trim() || source.code?.trim() || formatDocName(source.document_name);

const formatSectionLabel = (source: SourceChunk): string =>
  formatSection(source.section, source.subsection) || 'General';

const formatQuoteStatus = (source: SourceChunk): string => {
  if (isVerifiedSource(source)) return 'Verified';
  if (source.quote_status?.trim().toLowerCase() === 'not_found') return 'Unavailable';
  return 'Not verified';
};

const getSourceText = (source: SourceChunk): string | null => {
  const text = source.exact_text ?? source.quote ?? source.content;
  return typeof text === 'string' && text.trim() ? text.trim() : null;
};

const getConciseExplanation = (source: SourceChunk): string | null => {
  const explanation = (source.explanation || source.quote || source.content)?.trim().replace(/\s+/g, ' ');
  if (!explanation) return null;
  return explanation.length > 260 ? `${explanation.slice(0, 257)}...` : explanation;
};

const getOfficialActUrl = (source: SourceChunk): string | null => {
  const identity = [source.act, source.code, source.document_name].filter(Boolean).join(' ').toLowerCase();
  // Always use the reachable official MHA copy for BNS/BNSS/BSA.
  if (identity.includes('bharatiya nyaya') || /\bbns\b/.test(identity)) return OFFICIAL_ACT_URLS.bns;
  if (identity.includes('bharatiya nagarik') || /\bbnss\b/.test(identity)) return OFFICIAL_ACT_URLS.bnss;
  if (identity.includes('bharatiya sakshya') || /\bbsa\b/.test(identity)) return OFFICIAL_ACT_URLS.bsa;
  if (identity.includes('motor vehicle') || /\bmva\b/.test(identity)) return 'https://www.indiacode.nic.in/handle/123456789/1798';

  const suppliedUrl = source.source_url?.trim();
  if (suppliedUrl) {
    try {
      const parsed = new URL(suppliedUrl);
      const hostname = parsed.hostname.toLowerCase();
      const isOfficialHost = hostname === 'mha.gov.in' || hostname.endsWith('.mha.gov.in') || hostname.includes('indiacode.nic.in');
      if (parsed.protocol === 'https:' && isOfficialHost) return parsed.toString();
    } catch {
      // No safe official URL was supplied.
    }
  }

  return 'https://www.indiacode.nic.in';
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const isUser = message.role === 'user';

  // Compute effective sources from message.sources or fallback to structured_content.applicable_laws
  const effectiveSources: SourceChunk[] = useMemo(() => {
    if (message.sources && message.sources.length > 0) {
      return message.sources;
    }
    const laws = message.structured_content?.applicable_laws;
    if (Array.isArray(laws) && laws.length > 0) {
      return laws.map((law) => {
        const actClean = (law.act || law.code || '').toLowerCase();
        let sourceUrl: string | null = null;
        if (actClean.includes('nyaya') || actClean.includes('bns')) {
          sourceUrl = OFFICIAL_ACT_URLS.bns;
        } else if (actClean.includes('nagarik') || actClean.includes('bnss')) {
          sourceUrl = OFFICIAL_ACT_URLS.bnss;
        } else if (actClean.includes('sakshya') || actClean.includes('bsa')) {
          sourceUrl = OFFICIAL_ACT_URLS.bsa;
        } else if (actClean.includes('motor vehicle') || actClean.includes('mva')) {
          sourceUrl = 'https://www.indiacode.nic.in/handle/123456789/1798';
        } else {
          sourceUrl = 'https://www.indiacode.nic.in';
        }
        return {
          content: law.explanation || `Statutory provision under ${law.act || law.code} Section ${law.section}.`,
          document_name: law.act || law.code || 'Indian Statute',
          act: law.act || law.code || 'Indian Statute',
          code: law.code || law.act || 'Statute',
          section: law.section || '',
          subsection: law.subsection || null,
          exact_text: law.exact_text || law.quote || null,
          quote: law.quote || '',
          explanation: law.explanation || null,
          verified: law.verified === true,
          source_url: law.source_url || sourceUrl,
          quote_status: law.quote_status || (law.verified ? 'backend_verified' : 'statutory_reference'),
        };
      });
    }
    return [];
  }, [message.sources, message.structured_content]);

  const [animatedContent, setAnimatedContent] = useState(isUser ? '' : message.content);

  useEffect(() => {
    if (isUser) {
      return;
    }

    // Only type out recent messages (created within the last 15s) to avoid lag on reload
    const isRecent = message.created_at ? (Date.now() - new Date(message.created_at).getTime()) < 15000 : false;
    if (!isRecent) {
      setAnimatedContent(message.content);
      return;
    }

    let index = 0;
    const interval = setInterval(() => {
      index += 20;
      if (index >= message.content.length) {
        setAnimatedContent(message.content);
        clearInterval(interval);
      } else {
        setAnimatedContent(message.content.substring(0, index));
      }
    }, 10);

    return () => clearInterval(interval);
  }, [message.content, isUser, message.created_at]);

  const displayedContent = isUser ? message.content : animatedContent;
  const cleanContent = displayedContent.replace(/\|\n\n\|/g, '|\n|');
  const htmlContent = marked.parse(cleanContent) as string;
  const formattedMessageTime = message.created_at
    ? formatMessageTime(message.created_at)
    : null;

  return (
    <div className={`message-bubble flex w-full mb-4 sm:mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`message-bubble__row flex max-w-[96%] sm:max-w-[90%] md:max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-2 sm:gap-3.5`}>
        {/* Avatar */}
        <div
          className={`message-bubble__avatar shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center mt-1 border ${
            isUser
              ? 'bg-[#1e1e1e] border-[#333333] text-white shadow-sm'
              : 'bg-[#111111] border-[#262626] text-amber-200/90 shadow-sm'
          }`}
        >
          {isUser ? <User size={13} className="sm:w-[15px] sm:h-[15px]" /> : <Scale size={13} className="sm:w-[15px] sm:h-[15px]" />}
        </div>

        {/* Bubble */}
        <div className={`message-bubble__content flex flex-col ${isUser ? 'items-end' : 'items-start'} min-w-0 w-full`}>
          <div
            className={`message-bubble__bubble px-3.5 py-3 sm:px-5 sm:py-4 rounded-2xl shadow-sm text-xs sm:text-sm leading-relaxed break-words [overflow-wrap:anywhere] ${
              isUser
                ? 'bg-[#1c1c1c] text-[#f2f2f2] border border-[#2e2e2e] rounded-tr-none'
                : 'bg-[#121214] text-[#e0e0e0] border border-[#222226] rounded-tl-none'
            }`}
          >
            <div
              className={`prose prose-sm max-w-none ${
                isUser
                  ? 'prose-invert text-[#f0f0f0]'
                  : 'prose-invert text-[#e0e0e0] prose-headings:text-amber-100/90 prose-a:text-sky-400 hover:prose-a:underline'
              }`}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>

          {/* ChatGPT-style Interactive Sources Accordion for AI Messages */}
          {!isUser && effectiveSources.length > 0 && (
            <div className="message-sources mt-3 w-full border-t border-white/[0.08] pt-2.5">
              <button
                type="button"
                aria-expanded={sourcesOpen}
                onClick={() => setSourcesOpen(!sourcesOpen)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-neutral-300 hover:text-white transition-all cursor-pointer shadow-sm group select-none"
              >
                <BookOpen size={13} className="text-amber-300 group-hover:scale-110 transition-transform" />
                <span>
                  Sources & Statutory References ({effectiveSources.length})
                </span>
                <ChevronDown
                  size={13}
                  className={`text-neutral-400 transition-transform duration-200 ${sourcesOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {sourcesOpen && (
                <div className="message-sources__list mt-3 w-full grid grid-cols-1 md:grid-cols-2 gap-3 animate-fade-in">
                  {effectiveSources.map((source, idx) => {
                    const verified = isVerifiedSource(source);
                    const officialUrl = getOfficialActUrl(source);
                    const explanation = getConciseExplanation(source);
                    const sourceText = getVerifiedText(source) ?? getSourceText(source);

                    return (
                      <article
                        key={idx}
                        className="bg-[#141416] hover:bg-[#18181c] border border-white/10 hover:border-amber-400/40 rounded-xl p-3.5 flex flex-col justify-between transition-all shadow-md group"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <FileText size={14} className="text-amber-300 shrink-0" />
                              <span className="font-mono text-[10px] uppercase font-bold text-amber-200 tracking-wider truncate">
                                {formatActName(source)}
                              </span>
                            </div>
                            <span
                              className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-mono font-medium border ${
                                verified
                                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
                                  : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                              }`}
                            >
                              {verified ? 'Source text matched' : 'Statute Ref'}
                            </span>
                          </div>

                          {verified && (
                            <p className="text-[10px] text-neutral-500 mb-1.5 leading-relaxed">
                              This confirms the source text only; it does not verify that the provision applies to these facts.
                            </p>
                          )}

                          <h4 className="text-xs font-semibold text-white group-hover:text-amber-100 transition-colors">
                            Section {formatSectionLabel(source)}
                          </h4>

                          {explanation && (
                            <p className="text-[11px] text-neutral-300 mt-1.5 leading-relaxed bg-[#0d0d0f] p-2 rounded-lg border border-white/5">
                              {explanation}
                            </p>
                          )}

                          {sourceText && (
                            <details className="mt-2 text-[11px] group/details">
                              <summary className="cursor-pointer text-neutral-400 hover:text-neutral-200 select-none py-0.5 flex items-center gap-1">
                                <span>{verified ? 'Verbatim statutory text' : 'Provision excerpt'}</span>
                              </summary>
                              <div className="mt-1.5 p-2 rounded-lg bg-[#0a0a0c] border border-white/5 text-neutral-300 font-mono text-[10px] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar">
                                {sourceText}
                              </div>
                            </details>
                          )}
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                          {officialUrl ? (
                            <a
                              href={officialUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 font-medium transition-colors"
                            >
                              <span>Official Text & Gazette</span>
                              <ExternalLink size={11} />
                            </a>
                          ) : (
                            <span className="text-[10px] text-neutral-500 font-mono">India Code Reference</span>
                          )}
                          <span className="text-[9px] text-neutral-500 font-mono">Ref #{idx + 1}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Message metadata */}
          {(formattedMessageTime || (!isUser && message.processing_time_seconds !== undefined)) && (
            <div className="message-bubble__metadata flex flex-wrap gap-x-4 gap-y-1 mt-2 ml-1 text-[11px] text-neutral-500 font-medium">
              {!isUser && message.processing_time_seconds !== undefined && message.processing_time_seconds !== null && (
                <span className="flex items-center gap-1.5">
                  <Clock size={11} /> {message.processing_time_seconds.toFixed(2)}s processing
                </span>
              )}
              {formattedMessageTime && (
                <span className="flex items-center gap-1.5">
                  <CalendarClock size={11} /> {isUser ? 'Prompt' : 'Sent'} {formattedMessageTime}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
