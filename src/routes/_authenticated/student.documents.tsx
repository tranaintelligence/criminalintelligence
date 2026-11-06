import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { FolderOpen, Sparkles, Copy, Trash2, Check, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/student/documents")({
  head: () => ({
    meta: [
      { title: "My Research Documents — TRANA Student" },
      { name: "description", content: "Repository of saved moot court memorials, research memos, and pleadings." },
      { property: "og:title", content: "My Research Documents — TRANA Student" },
    ],
  }),
  component: StudentDocumentsPage,
});

type SavedDoc = {
  id: string;
  title: string;
  type: string;
  section: string;
  content: string;
  date: string;
};

function StudentDocumentsPage() {
  const [docs, setDocs] = useState<SavedDoc[]>([]);
  const [activeDoc, setActiveDoc] = useState<SavedDoc | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("trana_saved_documents");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setDocs(parsed);
        }
      }
    } catch {}
  }, []);

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Document copied to clipboard!");
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
    } catch {}
    if (activeDoc?.id === id) setActiveDoc(null);
    toast.info("Document removed from workspace repository.");
  }

  return (
    <div className="space-y-8">
      <div className="border-b border-[#222222] pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-medium text-white">
            My Documents & Research Memos
          </h1>
          <p className="mt-2 text-xs md:text-sm text-[#999999]">
            Repository of your generated moot court pleadings, bail applications, and statutory opinions.
          </p>
        </div>

        <Link
          to="/student/drafter"
          className="bg-white text-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] hover:bg-neutral-200 transition-colors flex items-center gap-2 self-start"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>New AI Draft</span>
        </Link>
      </div>

      {docs.length === 0 ? (
        <div className="bg-[#141414] border border-[#262626] p-12 text-center space-y-4">
          <FolderOpen className="h-10 w-10 text-[#555555] mx-auto" />
          <h3 className="text-white font-medium text-base">No Saved Documents Yet</h3>
          <p className="text-xs text-[#888888] max-w-md mx-auto">
            You haven't saved any legal drafts yet. Draft moot court memorials, bail applications, and petitions in the AI Drafter, and save them directly into this repository.
          </p>
          <div className="pt-2">
            <Link
              to="/student/drafter"
              className="inline-flex items-center gap-2 bg-white text-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] hover:bg-neutral-200 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Open AI Drafter</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="bg-[#141414] border border-[#262626] hover:border-purple-400/60 transition-all p-6 flex flex-col justify-between shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between border-b border-[#222222] pb-3 text-xs text-[#888888] font-mono">
                  <span>{doc.type}</span>
                  <span>{doc.date}</span>
                </div>
                <h3 className="mt-3 font-display text-lg font-medium text-white line-clamp-1">
                  {doc.title}
                </h3>
                <p className="mt-1 text-xs text-purple-300 font-mono">{doc.section}</p>
                <p className="mt-3 text-xs text-[#888888] line-clamp-3 leading-relaxed font-mono bg-[#0D0D0D] p-2.5">
                  {doc.content}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#222222] flex items-center justify-between gap-2">
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
      )}

      {/* Modal for full document */}
      {activeDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-[#141414] border border-white/30 p-6 md:p-8 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#242424] pb-4">
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

            <div className="mt-4 pt-4 border-t border-[#242424] flex justify-end gap-3">
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

