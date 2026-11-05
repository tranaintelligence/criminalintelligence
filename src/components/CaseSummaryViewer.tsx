import React, { useState } from "react";
import { FileText, Copy, Check, X, ShieldCheck, Scale, Printer } from "lucide-react";
import { toast } from "sonner";

interface CaseSummaryViewerProps {
  content: string;
  clientName?: string;
  lawyerName?: string;
  matterType?: string;
  className?: string;
}

/**
 * Strips raw markdown syntax (####, ***, etc.) and converts intake terminology to "Case Summary"
 */
export function sanitizeRawSummaryText(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*\*(.*?)\*\*\*/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/(^|[^\\])\*(.*?)\*/g, "$1$2")
    .replace(/###/g, "")
    .replace(/####/g, "")
    .replace(/CLIENT INTAKE BRIEF/gi, "CASE SUMMARY")
    .replace(/Client Intake Summary/gi, "Case Summary")
    .replace(/Intake Brief/gi, "Case Summary");
}

/**
 * Parses and renders structured case summary with bold & underlined headings/subheadings,
 * zero raw markdown hashes or asterisks, and professional advocate-grade typography.
 */
export function CaseSummaryContent({ content, className = "" }: CaseSummaryViewerProps) {
  const sanitized = sanitizeRawSummaryText(content);
  const lines = sanitized.split("\n");

  const elements: React.ReactNode[] = [];
  let metaItems: { key: string; value: string }[] = [];
  let currentBullets: string[] = [];

  function flushBullets(keyPrefix: string) {
    if (currentBullets.length > 0) {
      elements.push(
        <ul key={`${keyPrefix}-bullets`} className="space-y-2 my-2.5 pl-1">
          {currentBullets.map((bullet, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-xs md:text-sm text-[#D4D4D4] leading-relaxed">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-2 shrink-0" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      );
      currentBullets = [];
    }
  }

  function flushMeta() {
    if (metaItems.length > 0) {
      elements.push(
        <div
          key={`meta-grid-${elements.length}`}
          className="my-3 p-3.5 bg-[#0C0C0C] border border-[#222222] rounded space-y-2 font-mono text-xs"
        >
          {metaItems.map((item, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
              <span className="font-bold underline decoration-white/40 text-white shrink-0 tracking-wide">
                {item.key}:
              </span>
              <span className="text-[#C0C0C0] font-sans text-xs md:text-sm leading-normal">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      );
      metaItems = [];
    }
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushBullets(`empty-${index}`);
      return;
    }

    // Check for title header lines e.g. "CASE SUMMARY (TRANA AI FIRST-AID)"
    if (
      trimmed.toUpperCase().startsWith("CASE SUMMARY") ||
      trimmed.toUpperCase().startsWith("FIR ANALYSER") ||
      trimmed.toUpperCase().startsWith("COMPLAINT ANALYSER")
    ) {
      flushBullets(`title-${index}`);
      flushMeta();
      elements.push(
        <div key={`header-${index}`} className="border-b border-[#2A2A2A] pb-2.5 mb-3">
          <h3 className="font-bold underline decoration-emerald-500/60 text-emerald-400 text-sm md:text-base tracking-[0.15em] uppercase font-mono">
            {trimmed}
          </h3>
        </div>
      );
      return;
    }

    // Check for Key-Value metadata lines like "Matter: ...", "Client: ...", "Applicable Statutes: ...", "Bail / Jeopardy Position: ..."
    const metaMatch = trimmed.match(
      /^(Matter|Client|Target Counsel|Counsel|Applicable Statutes|Sections Identified|Bail \/ Jeopardy Position|Bail \/ Custody Outlook|Procedural Posture|Jurisdiction|Date|Mode):\s*(.+)$/i
    );

    if (metaMatch) {
      flushBullets(`meta-${index}`);
      metaItems.push({
        key: metaMatch[1].trim(),
        value: metaMatch[2].trim(),
      });
      return;
    }

    // Flush any pending metadata before major section headings
    if (metaItems.length > 0) {
      flushMeta();
    }

    // Check for major numbered or named Section Headings
    const headingMatch = trimmed.match(
      /^(\d+\.|\b)(Factual Matrix|Factual Summary|Statutory Assessment|Statutory Framework|Key Rights Identified|Constitutional & Procedural Safeguards|Recommended Actions|Recommended Urgent Actions|Recommended Next Steps|Strategic Legal Action Plan|Custodial Assessment|Matter Overview|Recommended Preliminary Steps)\b.*$/i
    );

    const isExplicitHeading =
      headingMatch ||
      (/^(\d+\.\s+[A-Za-z]+.*)$/.test(trimmed) && trimmed.length < 80) ||
      (trimmed.endsWith(":") && trimmed.length < 50 && !trimmed.includes("."));

    if (isExplicitHeading) {
      flushBullets(`head-${index}`);
      flushMeta();
      const headingText = trimmed.replace(/:$/, "");
      elements.push(
        <h4
          key={`heading-${index}`}
          className="font-bold underline decoration-white/50 text-white text-sm md:text-base mt-5 mb-2.5 tracking-wide uppercase font-sans flex items-center gap-2"
        >
          <span>{headingText}</span>
        </h4>
      );
      return;
    }

    // Check for bullet items starting with •, -, or *
    if (trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*")) {
      const bulletContent = trimmed.replace(/^[•\-\*]\s*/, "");
      currentBullets.push(bulletContent);
      return;
    }

    // Regular paragraph
    flushBullets(`para-${index}`);
    flushMeta();
    elements.push(
      <p
        key={`para-${index}`}
        className="text-xs md:text-sm text-[#CCCCCC] leading-relaxed my-2 font-sans"
      >
        {trimmed}
      </p>
    );
  });

  flushBullets("end");
  flushMeta();

  return <div className={`space-y-1 ${className}`}>{elements}</div>;
}

interface CaseSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  clientName?: string;
  matterType?: string;
  consultationType?: string;
  content: string;
}

export function CaseSummaryModal({
  isOpen,
  onClose,
  title = "Case Summary",
  clientName,
  matterType,
  consultationType,
  content,
}: CaseSummaryModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  function handleCopy() {
    const cleanText = sanitizeRawSummaryText(content);
    navigator.clipboard.writeText(cleanText);
    setCopied(true);
    toast.success("Case summary copied to clipboard.");
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-[#141414] border border-[#333333] shadow-2xl flex flex-col max-h-[88vh] overflow-hidden rounded">
        {/* Modal Header */}
        <div className="border-b border-[#262626] bg-[#181818] p-4 sm:p-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[0.65rem] uppercase tracking-[0.2em] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                Case Summary
              </span>
              <span className="text-xs text-[#888888] font-mono">• Structured Analysis</span>
            </div>
            <h3 className="mt-1.5 font-display text-xl sm:text-2xl font-semibold text-white">
              {clientName ? `Case Summary — ${clientName}` : title}
            </h3>
            {(matterType || consultationType) && (
              <p className="text-xs text-[#999999] font-mono mt-0.5">
                {matterType && <span>Matter: {matterType}</span>}
                {matterType && consultationType && <span> • </span>}
                {consultationType && <span>Mode: {consultationType}</span>}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="border border-[#333333] hover:border-white bg-[#0E0E0E] hover:bg-[#202020] px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-[#F0F0F0] flex items-center gap-1.5 transition-colors rounded"
              title="Copy clean case summary"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 border border-[#333333] text-[#AAAAAA] hover:text-white hover:bg-[#252525] transition-colors rounded"
              title="Close Case Summary"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-[#101010]">
          <div className="bg-[#141414] border border-[#262626] p-4 sm:p-6 rounded">
            <CaseSummaryContent content={content} />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-[#262626] bg-[#161616] p-3 sm:p-4 flex items-center justify-between font-mono text-[0.7rem] text-[#888888]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Privileged Advocate-Client Intake Record • TRANA Legal Intelligence</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-white text-black px-4 py-1.5 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-200 transition-colors rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

