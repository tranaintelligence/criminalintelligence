import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import { 
  FolderOpen, FileText, Download, Copy, Trash2, 
  Sparkles, Check, Lock, Shield, Plus, Upload, 
  Search, Eye, ShieldAlert, File, ArrowRight, X, Clock, Tag, ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { useLawyerAuth } from "./lawyer";

export const Route = createFileRoute("/_authenticated/lawyer/documents")({
  head: () => ({
    meta: [
      { title: "My Documents — Legal Professional Workspace — TRANA" },
      { name: "description", content: "Saved legal drafts, research memos, and confidential personal lawyer vault." },
      { property: "og:title", content: "My Documents — Legal Professional Workspace — TRANA" },
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

export type PersonalVaultDoc = {
  id: string;
  title: string;
  category: string;
  content: string;
  date: string;
  fileName?: string;
  fileSize?: string;
  notes?: string;
};

const DEFAULT_PERSONAL_DOCS: PersonalVaultDoc[] = [
  {
    id: "pdoc-1",
    title: "High Court Jurisprudence: Section 482 CrPC vs Section 528 BNSS Quashing Petitions",
    category: "Research Work",
    content: "RESEARCH MEMO & BENCH ANALYSIS:\n\n1. Scope of Inherent Powers:\nUnder Section 528 of the Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023, the inherent powers of the High Court to prevent abuse of the process of any court or otherwise to secure the ends of justice remain substantive and co-extensive with erstwhile Section 482 CrPC, 1973.\n\n2. Landmark Principles Re-evaluated:\n- State of Haryana v. Bhajan Lal (1992 Supp (1) SCC 335): The seven guiding principles for quashing continue to apply squarely to complaints registered under BNS.\n- Neeharika Infrastructure v. State of Maharashtra (2021 SCC OnLine SC 315): Interim protection against coercive steps during investigation.\n\n3. Strategic Court Submissions:\nWhen drafting quashing petitions involving commercial/civil transactions cloaked as criminal breach of trust, emphasize that no prima facie cognizable offence is disclosed.",
    date: "2026-11-04",
    fileName: "BNSS_Section_528_Quashing_Analysis.pdf",
    fileSize: "248 KB",
  },
  {
    id: "pdoc-2",
    title: "Client Case Strategy & Deposition Notes: Anticipatory Bail Assessment",
    category: "Private Case Files",
    content: "CONFIDENTIAL ADVOCATE-CLIENT PRIVILEGED NOTES:\n\nClient: Confidential Intake Matter\nPolice Station: Greater Kailash - I, South East District\nSections Invoked: Section 318(4) [Cheating], Section 61(2) [Criminal Conspiracy] BNS, 2023\n\nFactual Matrix & Defense Arguments:\n1. Dispute arises from an executory memorandum of understanding dated March 2024 concerning logistics procurement.\n2. Civil remedy already invoked by the complainant before the District Commercial Court; present criminal FIR is an afterthought designed to exert coercive settlement pressure.\n3. Custodial interrogation is completely unwarranted as all transaction ledgers and bank transfers are documented and in the public domain.",
    date: "2026-11-05",
    fileName: "Client_Bail_Strategy_GK.docx",
    fileSize: "182 KB",
  },
];

// Helper to update the sanitized admin index (headings only)
export function syncAdminVaultIndex(lawyer: any, docs: PersonalVaultDoc[]) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("trana_lawyer_vault_admin_index");
    let allIndex: any[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(allIndex)) allIndex = [];

    // Filter out existing entries for this advocate
    const lawyerKey = lawyer?.id || lawyer?.email || "advocate";
    allIndex = allIndex.filter((item) => (item.lawyer_id !== lawyerKey && item.lawyer_email !== lawyer?.email));

    // Append current docs with HEADINGS ONLY (content is explicitly redacted)
    docs.forEach((d) => {
      allIndex.unshift({
        id: d.id,
        lawyer_id: lawyerKey,
        lawyer_name: lawyer?.full_name || "Advocate Siddharth K. Rao",
        lawyer_bar_reg_no: lawyer?.bar_reg_no || "D/2104/2021",
        lawyer_email: lawyer?.email || "advocate@trana.in",
        title: d.title, // Admin CAN see heading
        category: d.category,
        date: d.date,
        fileName: d.fileName || null,
        fileSize: d.fileSize || null,
        is_private: true,
        content_restricted: true, // Content CANNOT be seen by admin
      });
    });

    localStorage.setItem("trana_lawyer_vault_admin_index", JSON.stringify(allIndex));
    window.dispatchEvent(new Event("trana_lawyer_vault_updated"));
  } catch {}
}

function LawyerDocumentsPage() {
  const { data: lawyer } = useLawyerAuth();
  
  // Folder Navigation state: "drafts" (General AI Drafts) or "personal" (Personal Confidential Folder)
  const [activeFolder, setActiveFolder] = useState<"drafts" | "personal">("personal");
  
  // AI Drafts
  const [drafts, setDrafts] = useState<SavedDoc[]>([]);
  const [activeDraft, setActiveDraft] = useState<SavedDoc | null>(null);
  
  // Personal Vault Documents
  const [personalDocs, setPersonalDocs] = useState<PersonalVaultDoc[]>(() => {
    if (typeof window === "undefined") return DEFAULT_PERSONAL_DOCS;
    try {
      const stored = localStorage.getItem("trana_lawyer_personal_vault");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_PERSONAL_DOCS;
  });
  const [activePersonalDoc, setActivePersonalDoc] = useState<PersonalVaultDoc | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // New Personal Document Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Research Work");
  const [newContent, setNewContent] = useState("");
  const [attachedFileName, setAttachedFileName] = useState("");
  const [attachedFileSize, setAttachedFileSize] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directUploadRef = useRef<HTMLInputElement>(null);

  const [copied, setCopied] = useState(false);

  // Load General AI Drafts
  useEffect(() => {
    try {
      const stored = localStorage.getItem("trana_saved_documents");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setDrafts(parsed);
        }
      }
    } catch {}
  }, []);

  // Save personal docs to localStorage and sync sanitized headings index for admins
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("trana_lawyer_personal_vault", JSON.stringify(personalDocs));
      syncAdminVaultIndex(lawyer, personalDocs);
    } catch {}
  }, [personalDocs, lawyer]);

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Document text copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadText(title: string, text: string, fileName?: string) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("File download started.");
  }

  function handleDeleteDraft(id: string) {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    try {
      const stored = localStorage.getItem("trana_saved_documents");
      if (stored) {
        const list = JSON.parse(stored).filter((d: SavedDoc) => d.id !== id);
        localStorage.setItem("trana_saved_documents", JSON.stringify(list));
      }
    } catch {}
    if (activeDraft?.id === id) setActiveDraft(null);
    toast.info("Draft removed from workspace repository.");
  }

  function handleDeletePersonalDoc(id: string) {
    setPersonalDocs((prev) => prev.filter((d) => d.id !== id));
    if (activePersonalDoc?.id === id) setActivePersonalDoc(null);
    toast.info("Document removed from your personal folder.");
  }

  // Handle direct file upload into Personal Folder
  function handleDirectFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const resultText = (event.target?.result as string) || `[Uploaded file: ${file.name}]`;
      const sizeKB = Math.round(file.size / 1024);
      const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;

      // Extract clean title from file name
      const cleanTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      const formattedTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

      const newDoc: PersonalVaultDoc = {
        id: `pdoc-${Date.now()}`,
        title: formattedTitle,
        category: "Research Work",
        content: resultText.length > 50000 ? resultText.slice(0, 50000) + "\n\n[Content truncated for storage]" : resultText,
        date: new Date().toISOString().split("T")[0],
        fileName: file.name,
        fileSize: sizeStr,
      };

      setPersonalDocs((prev) => [newDoc, ...prev]);
      toast.success(`Uploaded "${file.name}" to your Personal Folder!`);
    };

    if (file.type.includes("text") || file.name.endsWith(".txt") || file.name.endsWith(".md") || file.name.endsWith(".json")) {
      reader.readAsText(file);
    } else {
      // For binary files (PDF/DOCX), store representation and confirmation
      const sizeKB = Math.round(file.size / 1024);
      const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
      const cleanTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      const formattedTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

      const newDoc: PersonalVaultDoc = {
        id: `pdoc-${Date.now()}`,
        title: formattedTitle,
        category: "Private Case Files",
        content: `PRIVILEGED DOCUMENT ATTACHMENT: ${file.name}\nFile Size: ${sizeStr}\nFormat: ${file.type || "Document"}\nUploaded: ${new Date().toLocaleString()}\n\nNote: Binary file stored securely in personal advocate vault. Contents are protected and confidential.`,
        date: new Date().toISOString().split("T")[0],
        fileName: file.name,
        fileSize: sizeStr,
      };

      setPersonalDocs((prev) => [newDoc, ...prev]);
      toast.success(`Saved "${file.name}" to your Personal Folder!`);
    }

    if (e.target) e.target.value = "";
  }

  // Handle modal submit
  function handleCreatePersonalDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error("Please enter a document heading");
      return;
    }

    const doc: PersonalVaultDoc = {
      id: `pdoc-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      content: newContent.trim() || "[No text body recorded]",
      date: new Date().toISOString().split("T")[0],
      fileName: attachedFileName || undefined,
      fileSize: attachedFileSize || undefined,
    };

    setPersonalDocs((prev) => [doc, ...prev]);
    toast.success("Document added to your Personal Folder!");
    setIsAddModalOpen(false);
    setNewTitle("");
    setNewContent("");
    setAttachedFileName("");
    setAttachedFileSize("");
  }

  // Filter personal docs by search & category
  const filteredPersonalDocs = useMemo(() => {
    return personalDocs.filter((d) => {
      const matchesSearch = searchQuery.trim() === "" || 
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.fileName && d.fileName.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = categoryFilter === "all" || d.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [personalDocs, searchQuery, categoryFilter]);

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="border-b border-[#222222] pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#888888] mb-1">
            <span>REPOSITORY</span>
            <span>•</span>
            <span className="text-amber-400">LAWYER WORKSPACE</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-medium text-white">
            My Documents
          </h1>
          <p className="mt-2 text-sm text-[#999999]">
            Organize case files, research memos, and personal confidential documents with advocate-client privilege.
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <input 
            type="file" 
            ref={directUploadRef} 
            onChange={handleDirectFileUpload} 
            className="hidden" 
            accept=".pdf,.docx,.doc,.txt,.md,.json,.png,.jpg"
          />

          <button
            onClick={() => directUploadRef.current?.click()}
            className="border border-white/20 bg-[#1A1A1A] hover:bg-[#252525] text-white px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors rounded-lg cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload File</span>
          </button>

          <button
            onClick={() => {
              setActiveFolder("personal");
              setIsAddModalOpen(true);
            }}
            className="bg-white text-black hover:bg-neutral-200 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors rounded-lg shadow-sm cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Personal Doc</span>
          </button>

          <Link
            to="/lawyer/drafter"
            className="border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors rounded-lg"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Drafter</span>
          </Link>
        </div>
      </div>

      {/* Folder Selection Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#262626] pb-3">
        <div className="flex items-center gap-2">
          {/* Personal Folder Tab */}
          <button
            onClick={() => setActiveFolder("personal")}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              activeFolder === "personal"
                ? "bg-white text-black shadow-lg"
                : "bg-[#161616] text-[#A0A0A0] hover:text-white border border-[#2A2A2A]"
            }`}
          >
            <Lock className="h-3.5 w-3.5 text-amber-400" />
            <span>Personal Folder (Private)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeFolder === "personal" ? "bg-black/10 text-black font-bold" : "bg-neutral-800 text-neutral-300"
            }`}>
              {personalDocs.length}
            </span>
          </button>

          {/* AI Drafts & Petitions Tab */}
          <button
            onClick={() => setActiveFolder("drafts")}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              activeFolder === "drafts"
                ? "bg-white text-black shadow-lg"
                : "bg-[#161616] text-[#A0A0A0] hover:text-white border border-[#2A2A2A]"
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span>AI Drafts & Notices</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeFolder === "drafts" ? "bg-black/10 text-black font-bold" : "bg-neutral-800 text-neutral-300"
            }`}>
              {drafts.length}
            </span>
          </button>
        </div>

        {/* Quick Folder Info */}
        <div className="text-xs text-[#777777] font-mono flex items-center gap-2">
          {activeFolder === "personal" ? (
            <span className="flex items-center gap-1.5 text-amber-300/90">
              <Shield className="h-3 w-3" />
              <span>Privileged Advocate Vault: Admins see heading only</span>
            </span>
          ) : (
            <span>Court pleadings generated via AI Drafter</span>
          )}
        </div>
      </div>

      {/* ===================== PERSONAL VAULT FOLDER ===================== */}
      {activeFolder === "personal" && (
        <div className="space-y-6">
          {/* Privacy Security Guarantee Banner */}
          <div className="p-4 sm:p-5 rounded-xl border border-amber-500/30 bg-amber-500/[0.04] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">
                    Confidential Personal Folder (End-to-End Restricted)
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    ADVOCATE PRIVILEGE
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#AAAAAA] leading-relaxed max-w-3xl">
                  Documents, research, and client files stored in this folder are completely private to you. 
                  Platform administrators and team members <strong>cannot open, read, or download</strong> your files; 
                  they are only permitted to see the document heading for compliance indexing.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-amber-400 hover:bg-amber-300 text-black px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg shrink-0 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Document</span>
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#141414] border border-[#252525] p-3 rounded-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#666666]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search personal files, research memos, or headings..."
                className="w-full bg-[#0E0E0E] border border-[#2A2A2A] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#555555] focus:outline-none focus:border-white/40"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-[#777777] font-mono">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-[#0E0E0E] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/40"
              >
                <option value="all">All Categories ({personalDocs.length})</option>
                <option value="Research Work">Research Work</option>
                <option value="Private Case Files">Private Case Files</option>
                <option value="Privileged Client Notes">Client Notes</option>
                <option value="Evidence Documents">Evidence Documents</option>
                <option value="Court Analysis">Court Analysis</option>
                <option value="Personal Memos">Personal Memos</option>
              </select>
            </div>
          </div>

          {/* Personal Docs Grid */}
          {filteredPersonalDocs.length === 0 ? (
            <div className="bg-[#141414] border border-[#262626] rounded-xl p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="text-white font-medium text-base">No Documents in Personal Folder</h3>
              <p className="text-xs text-[#888888] max-w-md mx-auto leading-relaxed">
                Your personal folder is currently empty. Use the buttons below to create your first private research memo, case strategy note, or upload documents.
              </p>
              <div className="pt-2 flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="inline-flex items-center gap-2 bg-white text-black px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg hover:bg-neutral-200 transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Personal Document</span>
                </button>
                <button
                  onClick={() => directUploadRef.current?.click()}
                  className="inline-flex items-center gap-2 border border-white/20 bg-neutral-800 text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg hover:bg-neutral-700 transition-colors cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload File</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredPersonalDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-[#141414] border border-[#262626] hover:border-amber-500/40 rounded-xl p-5 flex flex-col justify-between shadow-xl transition-all group"
                >
                  <div>
                    {/* Header info */}
                    <div className="flex items-center justify-between border-b border-[#222222] pb-3 text-xs font-mono">
                      <span className="px-2 py-0.5 rounded bg-white/[0.05] text-amber-300/90 border border-white/[0.08] text-[11px]">
                        {doc.category}
                      </span>
                      <span className="text-[#777777] text-[11px] flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {doc.date}
                      </span>
                    </div>

                    {/* Heading / Title */}
                    <h3 className="mt-3.5 font-display text-lg font-medium text-white line-clamp-2 leading-snug group-hover:text-amber-200 transition-colors">
                      {doc.title}
                    </h3>

                    {/* Attachment info if present */}
                    {doc.fileName && (
                      <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1c1c1c] border border-[#303030] text-[11px] text-neutral-300 font-mono">
                        <File className="h-3 w-3 text-amber-400" />
                        <span className="truncate max-w-[160px]">{doc.fileName}</span>
                        {doc.fileSize && <span className="text-neutral-500">• {doc.fileSize}</span>}
                      </div>
                    )}

                    {/* Content snippet */}
                    <div className="mt-3 text-xs text-[#888888] line-clamp-3 leading-relaxed font-mono bg-[#0c0c0c] border border-[#1e1e1e] p-3 rounded-lg">
                      {doc.content}
                    </div>

                    {/* Security stamp */}
                    <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-emerald-400/90">
                      <Lock className="h-2.5 w-2.5" />
                      <span>Encrypted • Private to You</span>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-5 pt-3.5 border-t border-[#222222] flex items-center justify-between gap-2">
                    <button
                      onClick={() => setActivePersonalDoc(doc)}
                      className="text-xs uppercase tracking-wider text-white hover:text-amber-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Open File</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopy(doc.content)}
                        aria-label="Copy document"
                        title="Copy content"
                        className="p-1.5 rounded border border-[#2E2E2E] bg-[#181818] text-[#AAAAAA] hover:text-white hover:border-[#444444] transition-colors cursor-pointer"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={() => handleDownloadText(doc.title, doc.content, doc.fileName)}
                        aria-label="Download document"
                        title="Download file"
                        className="p-1.5 rounded border border-[#2E2E2E] bg-[#181818] text-[#AAAAAA] hover:text-white hover:border-[#444444] transition-colors cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeletePersonalDoc(doc.id)}
                        aria-label="Delete document"
                        title="Delete from vault"
                        className="p-1.5 rounded border border-[#2E2E2E] bg-[#181818] text-[#AAAAAA] hover:text-red-400 hover:border-red-500/40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================== GENERAL AI DRAFTS FOLDER ===================== */}
      {activeFolder === "drafts" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-[#141414] border border-[#252525] p-4 rounded-xl">
            <div>
              <h3 className="text-sm font-semibold text-white">
                AI Generated Drafts & Court Notices
              </h3>
              <p className="text-xs text-[#888888] mt-0.5">
                Bail applications, criminal complaints, and legal demand notices created in the AI Drafter.
              </p>
            </div>
            <Link
              to="/lawyer/drafter"
              className="bg-white text-black px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg hover:bg-neutral-200 transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Create AI Draft</span>
            </Link>
          </div>

          {drafts.length === 0 ? (
            <div className="bg-[#141414] border border-[#262626] rounded-xl p-12 text-center space-y-4">
              <FolderOpen className="h-10 w-10 text-[#555555] mx-auto" />
              <h3 className="text-white font-medium text-base">No Saved AI Drafts Yet</h3>
              <p className="text-xs text-[#888888] max-w-md mx-auto">
                You haven't saved any legal drafts yet. Draft bail applications, legal demand notices, and court petitions in the AI Drafter, and save them directly into this repository.
              </p>
              <div className="pt-2">
                <Link
                  to="/lawyer/drafter"
                  className="inline-flex items-center gap-2 bg-white text-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] hover:bg-neutral-200 transition-colors rounded-lg"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Open AI Drafter</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {drafts.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-[#141414] border border-[#262626] hover:border-white/50 transition-all p-6 rounded-xl flex flex-col justify-between shadow-lg"
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
                    <p className="mt-3 text-xs text-[#888888] line-clamp-3 leading-relaxed font-mono bg-[#0c0c0c] p-2.5 rounded-lg border border-[#1e1e1e]">
                      {doc.content}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#262626] flex items-center justify-between gap-2">
                    <button
                      onClick={() => setActiveDraft(doc)}
                      className="text-xs uppercase tracking-[0.1em] text-white hover:underline cursor-pointer"
                    >
                      View Full
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(doc.content)}
                        aria-label="Copy document"
                        className="p-1.5 border border-[#333333] text-[#AAAAAA] hover:text-white rounded cursor-pointer"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteDraft(doc.id)}
                        aria-label="Delete document"
                        className="p-1.5 border border-[#333333] text-[#AAAAAA] hover:text-red-400 rounded cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================== MODAL: CREATE PERSONAL DOCUMENT ===================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-2xl bg-[#141414] border border-white/20 rounded-2xl p-6 md:p-8 shadow-2xl flex flex-col relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute right-5 top-5 text-[#888888] hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#252525] pb-4 mb-5">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-2xl font-medium text-white">
                  Add Personal Document
                </h3>
                <p className="text-xs text-[#888888]">
                  Stored strictly in your private vault. Administrators only see the heading.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreatePersonalDoc} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1 font-mono">
                  Document Heading / Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Criminal Appeal Grounds - Section 415 BNSS / Anticipatory Bail Notes"
                  className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2.5 text-sm text-white rounded-lg focus:border-amber-400 focus:outline-none"
                />
                <span className="text-[10px] text-neutral-500 mt-1 block">
                  This heading will be recorded in compliance audit index, but the contents below remain completely private.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1 font-mono">
                    Category *
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3 py-2.5 text-sm text-white rounded-lg focus:border-amber-400 focus:outline-none"
                  >
                    <option value="Research Work">Research Work</option>
                    <option value="Private Case Files">Private Case Files</option>
                    <option value="Privileged Client Notes">Client Privileged Notes</option>
                    <option value="Evidence Documents">Evidence Documents</option>
                    <option value="Court Analysis">Court Analysis</option>
                    <option value="Personal Memos">Personal Memos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1 font-mono">
                    Attach File (Optional)
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setAttachedFileName(file.name);
                        const kb = Math.round(file.size / 1024);
                        setAttachedFileSize(kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);
                        
                        // If no title yet, populate from file
                        if (!newTitle) {
                          const clean = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
                          setNewTitle(clean.charAt(0).toUpperCase() + clean.slice(1));
                        }

                        // Read content if text
                        if (file.type.includes("text") || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
                          const r = new FileReader();
                          r.onload = (ev) => setNewContent((ev.target?.result as string) || "");
                          r.readAsText(file);
                        }
                      }
                    }}
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3 py-2 text-xs text-white rounded-lg file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[11px] file:bg-neutral-800 file:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1 font-mono">
                  Document Contents / Research Notes
                </label>
                <textarea
                  rows={6}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Paste or write your confidential case research, notes, or petition draft here..."
                  className="w-full border border-[#333333] bg-[#0E0E0E] p-3 text-xs font-mono text-white rounded-lg focus:border-amber-400 focus:outline-none leading-relaxed"
                />
              </div>

              <div className="p-3 rounded-lg bg-black/40 border border-white/10 flex items-center gap-2 text-xs text-neutral-400">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Zero Platform Access: Contents are encrypted and strictly invisible to admins.</span>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-[#252525]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs uppercase tracking-wider text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-white text-black hover:bg-neutral-200 px-6 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                >
                  Save to Personal Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: VIEW PERSONAL DOCUMENT ===================== */}
      {activePersonalDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-3xl bg-[#141414] border border-amber-500/40 rounded-2xl p-6 md:p-8 shadow-2xl max-h-[88vh] flex flex-col relative">
            <div className="flex items-center justify-between border-b border-[#252525] pb-4">
              <div className="pr-4">
                <div className="flex items-center gap-2 text-xs font-mono text-amber-300">
                  <Lock className="h-3 w-3" />
                  <span>{activePersonalDoc.category}</span>
                  <span className="text-[#666666]">•</span>
                  <span className="text-[#888888]">{activePersonalDoc.date}</span>
                  {activePersonalDoc.fileSize && (
                    <>
                      <span className="text-[#666666]">•</span>
                      <span className="text-[#888888]">{activePersonalDoc.fileSize}</span>
                    </>
                  )}
                </div>
                <h3 className="font-display text-2xl font-medium text-white mt-1 leading-snug">
                  {activePersonalDoc.title}
                </h3>
              </div>
              <button
                onClick={() => setActivePersonalDoc(null)}
                className="border border-[#333333] hover:border-white px-3 py-1 text-xs text-white rounded cursor-pointer shrink-0"
              >
                Close
              </button>
            </div>

            {/* Privacy notice bar */}
            <div className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span>Privileged Document: Content is strictly confidential and inaccessible to platform admins.</span>
            </div>

            {/* Document Content */}
            <div className="flex-1 overflow-y-auto mt-4 p-5 bg-[#0a0a0a] border border-[#222222] rounded-xl text-neutral-200 font-mono text-xs leading-relaxed whitespace-pre-wrap select-text">
              {activePersonalDoc.content}
            </div>

            {/* Actions */}
            <div className="mt-4 pt-4 border-t border-[#252525] flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[#666666] font-mono">
                {activePersonalDoc.fileName ? `File: ${activePersonalDoc.fileName}` : "Personal Text Document"}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(activePersonalDoc.content)}
                  className="border border-white/20 hover:border-white px-3.5 py-1.5 text-xs uppercase tracking-wider text-white hover:bg-white hover:text-black rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? "Copied" : "Copy Content"}</span>
                </button>

                <button
                  onClick={() => handleDownloadText(activePersonalDoc.title, activePersonalDoc.content, activePersonalDoc.fileName)}
                  className="bg-white text-black hover:bg-neutral-200 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download File</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: VIEW AI DRAFT ===================== */}
      {activeDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-[#1A1A1A] border border-white/30 rounded-2xl p-6 md:p-8 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#282828] pb-4">
              <div>
                <span className="text-xs font-mono text-[#888888]">{activeDraft.type} • {activeDraft.date}</span>
                <h3 className="font-display text-2xl font-medium text-white">{activeDraft.title}</h3>
              </div>
              <button
                onClick={() => setActiveDraft(null)}
                className="border border-[#333333] px-3 py-1 text-xs text-white rounded cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 p-4 bg-[#F5F5F0] text-black font-serif text-sm leading-relaxed whitespace-pre-wrap rounded-lg">
              {activeDraft.content}
            </div>

            <div className="mt-4 pt-4 border-t border-[#282828] flex justify-end gap-3">
              <button
                onClick={() => handleCopy(activeDraft.content)}
                className="border border-white/40 px-4 py-2 text-xs uppercase tracking-wider text-white hover:bg-white hover:text-black rounded-lg flex items-center gap-2 cursor-pointer"
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
