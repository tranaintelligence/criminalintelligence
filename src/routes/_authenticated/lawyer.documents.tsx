import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { 
  FolderOpen, FileText, Download, Copy, Trash2, 
  ExternalLink, Sparkles, Check, ChevronRight 
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lawyer/documents")({
  head: () => ({
    meta: [
      { title: "Legal Professional Workspace — TRANA" },
      { name: "description", content: "Saved drafts, legal notices, and court pleadings repository." },
      { property: "og:title", content: "Legal Professional Workspace — TRANA" },
    ],
  }),
  component: LawyerDocumentsPage,
});

type SavedDoc = {
  id: string;
  title: string;
  type: string;
  section: string;
  content: string;
  date: string;
};

const sampleDocs: SavedDoc[] = [
  {
    id: "DOC-001",
    title: "Bail Application - Section 482 BNSS",
    type: "Bail Application",
    section: "Section 482 BNSS",
    content: "IN THE COURT OF THE PRINCIPAL SESSIONS JUDGE AT NEW DELHI\nCRIMINAL MISC. (BAIL) APPLICATION NO. 142 OF 2026\nIN THE MATTER OF: Rahul Verma v. State (NCT of Delhi)...",
    date: "24 Oct 2026",
  },
  {
    id: "DOC-002",
    title: "Statutory Demand Notice - Sec 138 NI Act",
    type: "Legal Notice",
    section: "Section 138 Negotiable Instruments Act",
    content: "LEGAL DEMAND NOTICE\nTO: M/s Alpha Logistics Pvt Ltd\nUNDER INSTRUCTIONS FROM: Our Client Mr. Ananya Roy...",
    date: "20 Oct 2026",
  },
  {
    id: "DOC-003",
    title: "Vakalatnama - High Court of Delhi",
    type: "Vakalatnama",
    section: "High Court Rules",
    content: "IN THE HIGH COURT OF DELHI AT NEW DELHI\nVAKALATNAMA\nI/We do hereby appoint and constitute Advocate...",
    date: "18 Oct 2026",
  },
];

function LawyerDocumentsPage() {
  const [docs, setDocs] = useState<SavedDoc[]>(sampleDocs);
  const [activeDoc, setActiveDoc] = useState<SavedDoc | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("trana_saved_documents");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDocs([...parsed, ...sampleDocs]);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Draft copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDelete(id: string) {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    try {
      const stored = localStorage.getItem("trana_saved_documents");
      if (stored) {
        const list = JSON.parse(stored).filter((d: SavedDoc) => d.id !== id);
        localStorage.setItem("trana_saved_documents", JSON.stringify(list));
      }
    } catch {
      // ignore
    }
    if (activeDoc?.id === id) setActiveDoc(null);
    toast.info("Document removed from workspace repository.");
  }

  return (
    <div className="space-y-8">
      <div className="border-b border-[#222222] pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl md:text-5xl font-medium text-white">
            My Documents
          </h1>
          <p className="mt-2 text-sm text-[#999999]">
            Repository of your generated court pleadings, bail applications, and notices.
          </p>
        </div>

        <Link
          to="/lawyer/drafter"
          className="bg-white text-black px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] hover:bg-neutral-200 transition-colors flex items-center gap-2 self-start"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>New AI Draft</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {docs.map((doc) => (
          <div
            key={doc.id}
            className="bg-[#1A1A1A] border border-[#2E2E2E] hover:border-white/50 transition-all p-6 flex flex-col justify-between shadow-lg"
          >
            <div>
              <div className="flex items-center justify-between border-b border-[#262626] pb-3 text-xs text-[#888888] font-mono">
                <span>{doc.type}</span>
                <span>{doc.date}</span>
              </div>
              <h3 className="mt-3 font-display text-xl font-medium text-white line-clamp-1">
                {doc.title}
              </h3>
              <p className="mt-1 text-xs text-amber-300 font-medium">{doc.section}</p>
              <p className="mt-3 text-xs text-[#888888] line-clamp-3 leading-relaxed font-mono bg-[#111111] p-2.5">
                {doc.content}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#262626] flex items-center justify-between gap-2">
              <button
                onClick={() => setActiveDoc(doc)}
                className="text-xs uppercase tracking-[0.1em] text-white hover:underline"
              >
                View Full
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(doc.content)}
                  aria-label="Copy document"
                  className="p-1.5 border border-[#333333] text-[#AAAAAA] hover:text-white"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  aria-label="Delete document"
                  className="p-1.5 border border-[#333333] text-[#AAAAAA] hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for full document */}
      {activeDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-[#1A1A1A] border border-white/30 p-6 md:p-8 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#282828] pb-4">
              <div>
                <span className="text-xs font-mono text-[#888888]">{activeDoc.type} • {activeDoc.date}</span>
                <h3 className="font-display text-2xl font-medium text-white">{activeDoc.title}</h3>
              </div>
              <button
                onClick={() => setActiveDoc(null)}
                className="border border-[#333333] px-3 py-1 text-xs text-white"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 p-4 bg-[#F5F5F0] text-black font-serif text-sm leading-relaxed whitespace-pre-wrap">
              {activeDoc.content}
            </div>

            <div className="mt-4 pt-4 border-t border-[#282828] flex justify-end gap-3">
              <button
                onClick={() => handleCopy(activeDoc.content)}
                className="border border-white/40 px-4 py-2 text-xs uppercase tracking-wider text-white hover:bg-white hover:text-black flex items-center gap-2"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
