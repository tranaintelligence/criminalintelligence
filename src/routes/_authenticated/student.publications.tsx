import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { 
  Award, BookOpen, Sparkles, Search, Plus, ExternalLink, 
  Share2, Heart, Copy, Check, FileText, GraduationCap, 
  Tag, Filter, ArrowUpRight, ShieldCheck, X, Upload
} from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/lib/user-role";
import { 
  StudentPublication, 
  PublicationCategory, 
  getStoredPublications, 
  savePublication, 
  toggleLikePublication, 
  generateBluebookCitation 
} from "@/lib/student-publications";

export const Route = createFileRoute("/_authenticated/student/publications")({
  head: () => ({
    meta: [
      { title: "Student Research & Achievements — TRANA" },
      { name: "description", content: "Publish and explore law student research papers, moot court awards, academic commentary, and achievements." },
      { property: "og:title", content: "Student Research & Achievements — TRANA" },
    ],
  }),
  component: StudentPublicationsPage,
});

const CATEGORIES: { label: string; value: PublicationCategory | "ALL" }[] = [
  { label: "All Works", value: "ALL" },
  { label: "Research Papers", value: "Research Paper" },
  { label: "Moot Court Awards", value: "Moot Court Achievement" },
  { label: "Articles & Commentary", value: "Article / Commentary" },
  { label: "Academic Awards", value: "Academic Award" },
  { label: "Case Notes", value: "Case Note" },
];

function StudentPublicationsPage() {
  const { user } = Route.useRouteContext();
  const { studentProfile } = useUserRole(user?.id, user?.email);

  const [publications, setPublications] = useState<StudentPublication[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<PublicationCategory | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [readingPub, setReadingPub] = useState<StudentPublication | null>(null);

  // Form states for new publication
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<PublicationCategory>("Research Paper");
  const [newAbstract, setNewAbstract] = useState("");
  const [newFullContent, setNewFullContent] = useState("");
  const [newTags, setNewTags] = useState("");
  const [newExternalLink, setNewExternalLink] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load publications
  useEffect(() => {
    function load() {
      setPublications(getStoredPublications());
    }
    load();
    window.addEventListener("trana_publications_changed", load);
    return () => window.removeEventListener("trana_publications_changed", load);
  }, []);

  // Filtered publications
  const filteredPubs = useMemo(() => {
    return publications.filter((p) => {
      const matchCategory = selectedCategory === "ALL" || p.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.authorName.toLowerCase().includes(q) ||
        p.authorCollege.toLowerCase().includes(q) ||
        p.abstract.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q));

      return matchCategory && matchSearch;
    });
  }, [publications, selectedCategory, searchQuery]);

  // Handle like toggle
  function handleLike(pubId: string) {
    const userId = user?.id || "guest-user";
    const res = toggleLikePublication(pubId, userId);
    setPublications((prev) =>
      prev.map((p) => {
        if (p.id !== pubId) return p;
        const likedBy = p.likedBy || [];
        const isCurrentlyLiked = likedBy.includes(userId);
        return {
          ...p,
          likesCount: res.likesCount,
          likedBy: isCurrentlyLiked ? likedBy.filter((id) => id !== userId) : [...likedBy, userId],
        };
      })
    );
    toast.success(res.isLiked ? "Applauded publication!" : "Removed applause");
  }

  // Handle copy citation
  function handleCopyCitation(pub: StudentPublication) {
    const citation = generateBluebookCitation(pub);
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(citation);
      setCopiedId(pub.id);
      toast.success("Bluebook / Academic citation copied to clipboard!");
      setTimeout(() => setCopiedId(null), 3000);
    }
  }

  // Handle form submit
  function handleSubmitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error("Please enter a title for your paper or achievement.");
      return;
    }
    if (!newAbstract.trim()) {
      toast.error("Please provide an abstract or summary.");
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedTags = newTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const authorName =
        studentProfile?.fullName || user?.name || user?.email?.split("@")[0] || "Law Student";
      const authorCollege =
        studentProfile?.university || "National Law University";
      const authorRole = studentProfile?.isIntern
        ? `Legal Intern (${studentProfile?.degree || "LL.B Scholar"})`
        : `${studentProfile?.yearOfStudy || "Law Scholar"} • ${studentProfile?.degree || "LL.B"}`;

      savePublication({
        authorId: user?.id || "student-" + Date.now(),
        authorName,
        authorRole,
        authorCollege,
        authorEmail: user?.email,
        title: newTitle.trim(),
        category: newCategory,
        abstract: newAbstract.trim(),
        fullContent: newFullContent.trim() || undefined,
        tags: parsedTags.length > 0 ? parsedTags : ["Legal Scholarship", "TRANA Research"],
        externalLink: newExternalLink.trim() || undefined,
        fileName: newFileName || undefined,
      });

      toast.success("Research paper / achievement published successfully! Visible across student and advocate networks.");
      setIsModalOpen(false);
      // Reset form
      setNewTitle("");
      setNewAbstract("");
      setNewFullContent("");
      setNewTags("");
      setNewExternalLink("");
      setNewFileName("");
    } catch {
      toast.error("Failed to publish entry. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function getCategoryColor(cat: PublicationCategory) {
    switch (cat) {
      case "Research Paper":
        return "border-purple-500/40 text-purple-300 bg-purple-950/20";
      case "Moot Court Achievement":
        return "border-amber-500/40 text-amber-300 bg-amber-950/20";
      case "Article / Commentary":
        return "border-emerald-500/40 text-emerald-300 bg-emerald-950/20";
      case "Academic Award":
        return "border-sky-500/40 text-sky-300 bg-sky-950/20";
      case "Case Note":
        return "border-rose-500/40 text-rose-300 bg-rose-950/20";
      default:
        return "border-neutral-500/40 text-neutral-300 bg-neutral-900";
    }
  }

  return (
    <div className="space-y-8 md:space-y-10">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-neutral-400 font-mono">
            <span>Scholarly Repository</span>
            <span>•</span>
            <span className="text-purple-400 font-semibold">Peer Reviewed & Open Archive</span>
          </div>
          <h1 className="mt-2 font-display text-3xl md:text-5xl font-medium text-white">
            Research & Achievements
          </h1>
          <p className="mt-2 text-xs md:text-sm text-neutral-300 max-w-2xl leading-relaxed">
            A dedicated scholarly platform where law students publish research papers, constitutional critiques, moot court awards, and academic commentary visible to fellow scholars, practicing advocates, and chambers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-white text-black hover:bg-neutral-200 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-[0.15em] transition-all flex items-center gap-2 shadow-md hover:shadow-[0_0_20px_rgba(255,255,255,0.25)] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Publish Work</span>
          </button>
        </div>
      </div>

      {/* SEARCH AND CATEGORY FILTER BAR */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, author, university, provision (e.g. BNSS 479, Moot Court, BSA)..."
              className="w-full apple-glass-input pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 pt-1">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`apple-glass-pill px-3.5 py-1.5 text-xs font-mono transition-all cursor-pointer ${
                  isActive
                    ? "text-white font-semibold border-purple-500/50 bg-purple-500/20 shadow-[0_0_12px_rgba(168,85,247,0.2)]"
                    : "text-neutral-400 hover:text-white hover:bg-white/[0.08]"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* PUBLICATIONS FEED */}
      <div className="space-y-5">
        {filteredPubs.length === 0 ? (
          <div className="apple-glass-card p-12 text-center">
            <Award className="h-10 w-10 text-neutral-500 mx-auto mb-3 opacity-60" />
            <p className="text-white font-medium text-sm">No publications or achievements found</p>
            <p className="text-neutral-400 text-xs mt-1">
              Be the first to publish a research paper, article, or moot court milestone!
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 bg-white text-black px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider hover:bg-neutral-200 transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Publish Work Now</span>
            </button>
          </div>
        ) : (
          filteredPubs.map((pub) => {
            const isLiked = pub.likedBy?.includes(user?.id || "guest-user");
            const isCopied = copiedId === pub.id;

            return (
              <div
                key={pub.id}
                className="apple-glass-card p-6 md:p-7 relative transition-all hover:border-white/20 group"
              >
                {/* Header: Author + Category */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#14121d] border border-white/15 flex items-center justify-center text-purple-300 font-serif font-bold text-sm shadow-sm shrink-0">
                      {pub.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">
                          {pub.authorName}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.08] text-neutral-300 border border-white/10">
                          {pub.authorRole}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 flex items-center gap-1.5 mt-0.5 font-mono">
                        <GraduationCap className="h-3.5 w-3.5 text-neutral-500" />
                        <span>{pub.authorCollege}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border ${getCategoryColor(
                        pub.category
                      )}`}
                    >
                      {pub.category}
                    </span>
                    <span className="text-[11px] text-neutral-500 font-mono">
                      {new Date(pub.publishedAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {/* Body: Title & Abstract */}
                <div className="mt-4">
                  <h2
                    onClick={() => setReadingPub(pub)}
                    className="font-display text-xl md:text-2xl text-white font-medium hover:text-purple-300 transition-colors cursor-pointer"
                  >
                    {pub.title}
                  </h2>
                  <p className="mt-2.5 text-xs md:text-sm text-neutral-300 leading-relaxed font-light">
                    {pub.abstract}
                  </p>

                  {/* Read More button if full content or long text */}
                  {pub.fullContent && (
                    <button
                      onClick={() => setReadingPub(pub)}
                      className="mt-2 text-xs text-purple-400 hover:text-purple-300 font-mono inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Read Complete Paper / Memorial Points</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Tags */}
                {pub.tags && pub.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {pub.tags.map((tag) => (
                      <span
                        key={tag}
                        className="apple-glass-pill px-2.5 py-0.5 text-[10px] font-mono text-neutral-400 hover:text-white"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions Footer */}
                <div className="mt-6 pt-4 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                  <div className="flex items-center gap-4">
                    {/* Applaud / Like */}
                    <button
                      onClick={() => handleLike(pub.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                        isLiked
                          ? "bg-rose-500/20 border border-rose-500/40 text-rose-300"
                          : "apple-glass-pill text-neutral-400 hover:text-rose-400"
                      }`}
                    >
                      <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-rose-400 text-rose-400" : ""}`} />
                      <span>{pub.likesCount || 0} Applauds</span>
                    </button>

                    {/* Copy Citation */}
                    <button
                      onClick={() => handleCopyCitation(pub)}
                      className="apple-glass-pill px-3 py-1.5 text-neutral-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
                      title="Copy standard academic citation"
                    >
                      {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{isCopied ? "Citation Copied" : "Cite Work"}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    {pub.externalLink && (
                      <a
                        href={pub.externalLink}
                        target="_blank"
                        rel="noreferrer"
                        className="apple-glass-pill px-3 py-1.5 text-purple-300 hover:text-white flex items-center gap-1.5 hover:border-purple-400/50"
                      >
                        <span>SSRN / Repository</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}

                    <button
                      onClick={() => setReadingPub(pub)}
                      className="text-neutral-400 hover:text-white px-2 py-1 text-xs cursor-pointer"
                    >
                      View Details →
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* PUBLISH WORK MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="apple-glass-card w-full max-w-2xl p-6 md:p-8 relative my-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-white/[0.08] pb-4">
              <div className="h-10 w-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-xl font-medium text-white">
                  Publish Research or Achievement
                </h3>
                <p className="text-[11px] text-neutral-400 font-mono">
                  Visible to students, advocates, and chambers on TRANA
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitNew} className="mt-6 space-y-4">
              <div>
                <label className="block text-[0.7rem] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
                  Title of Paper / Achievement / Article *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Constitutional Critique of Section 479 BNSS or Winner of Moot Court"
                  className="w-full apple-glass-input px-3.5 py-2.5 text-xs text-white placeholder-neutral-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[0.7rem] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
                    Category *
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as PublicationCategory)}
                    className="w-full apple-glass-input px-3 py-2.5 text-xs text-white"
                  >
                    <option value="Research Paper" className="bg-[#121216] text-white">Research Paper</option>
                    <option value="Moot Court Achievement" className="bg-[#121216] text-white">Moot Court Achievement</option>
                    <option value="Article / Commentary" className="bg-[#121216] text-white">Article / Commentary</option>
                    <option value="Academic Award" className="bg-[#121216] text-white">Academic Award</option>
                    <option value="Case Note" className="bg-[#121216] text-white">Case Note</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[0.7rem] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
                    SSRN / External Repository Link (Optional)
                  </label>
                  <input
                    type="url"
                    value={newExternalLink}
                    onChange={(e) => setNewExternalLink(e.target.value)}
                    placeholder="https://ssrn.com/abstract=... or LiveLaw link"
                    className="w-full apple-glass-input px-3.5 py-2.5 text-xs text-white placeholder-neutral-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[0.7rem] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
                  Abstract / Executive Summary *
                </label>
                <textarea
                  rows={4}
                  required
                  value={newAbstract}
                  onChange={(e) => setNewAbstract(e.target.value)}
                  placeholder="Summarize the core thesis, key findings, statutory provisions analyzed, or moot competition highlights..."
                  className="w-full apple-glass-input px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-[0.7rem] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
                  Full Text / Memorial Points / Findings (Optional)
                </label>
                <textarea
                  rows={6}
                  value={newFullContent}
                  onChange={(e) => setNewFullContent(e.target.value)}
                  placeholder="Paste complete arguments, ratio citations, methodology, or contest proposition details..."
                  className="w-full apple-glass-input px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 resize-none leading-relaxed font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-[0.7rem] uppercase tracking-wider text-neutral-400 font-mono mb-1.5 flex items-center gap-1">
                  <Tag className="h-3 w-3 text-purple-400" />
                  <span>Key Provisions & Topics (Comma separated)</span>
                </label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="e.g. BNSS 2023, Article 21, Digital Evidence, Moot Court, Bail"
                  className="w-full apple-glass-input px-3.5 py-2.5 text-xs text-white placeholder-neutral-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="apple-glass-pill px-4 py-2 text-xs text-neutral-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-white text-black hover:bg-neutral-200 px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-[0.15em] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{isSubmitting ? "Publishing..." : "Publish to TRANA Archive"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* READING MODAL */}
      {readingPub && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="apple-glass-card w-full max-w-3xl p-6 md:p-8 relative my-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setReadingPub(null)}
              className="absolute right-4 top-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="border-b border-white/[0.08] pb-4">
              <span
                className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border inline-block mb-3 ${getCategoryColor(
                  readingPub.category
                )}`}
              >
                {readingPub.category}
              </span>
              <h2 className="font-display text-2xl md:text-3xl text-white font-medium">
                {readingPub.title}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-400 font-mono">
                <span className="text-white font-semibold">{readingPub.authorName}</span>
                <span>•</span>
                <span>{readingPub.authorRole}</span>
                <span>•</span>
                <span>{readingPub.authorCollege}</span>
              </div>
            </div>

            <div className="mt-6 space-y-6 text-sm text-neutral-200 leading-relaxed font-light">
              <div>
                <h4 className="text-[0.7rem] uppercase tracking-wider text-purple-300 font-mono mb-2">
                  Abstract & Overview
                </h4>
                <p className="bg-white/[0.03] p-4 rounded-xl border border-white/[0.06] text-neutral-300">
                  {readingPub.abstract}
                </p>
              </div>

              {readingPub.fullContent && (
                <div>
                  <h4 className="text-[0.7rem] uppercase tracking-wider text-neutral-400 font-mono mb-2">
                    Detailed Paper / Argument Points
                  </h4>
                  <div className="apple-glass-input p-4 rounded-xl text-neutral-200 whitespace-pre-wrap font-sans text-xs md:text-sm leading-relaxed">
                    {readingPub.fullContent}
                  </div>
                </div>
              )}

              {/* Tags */}
              {readingPub.tags && readingPub.tags.length > 0 && (
                <div>
                  <h4 className="text-[0.7rem] uppercase tracking-wider text-neutral-400 font-mono mb-2">
                    Subject Matter & Provisions
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {readingPub.tags.map((t) => (
                      <span key={t} className="apple-glass-pill px-3 py-1 text-xs font-mono text-neutral-300">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Academic Citation Box */}
              <div className="bg-purple-950/20 border border-purple-500/30 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[0.7rem] uppercase tracking-wider text-purple-300 font-mono flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>Academic Citation (Bluebook Standard)</span>
                  </span>
                  <button
                    onClick={() => handleCopyCitation(readingPub)}
                    className="apple-glass-pill px-2.5 py-1 text-[11px] font-mono text-purple-200 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copy</span>
                  </button>
                </div>
                <p className="text-xs font-mono text-neutral-300 select-all">
                  {generateBluebookCitation(readingPub)}
                </p>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-white/[0.08] flex items-center justify-between gap-4">
              <button
                onClick={() => handleLike(readingPub.id)}
                className="apple-glass-pill px-4 py-2 text-xs font-mono text-rose-300 hover:bg-rose-500/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Heart className="h-3.5 w-3.5 fill-rose-400 text-rose-400" />
                <span>{readingPub.likesCount || 0} Applauds</span>
              </button>

              <div className="flex items-center gap-3">
                {readingPub.externalLink && (
                  <a
                    href={readingPub.externalLink}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-white text-black hover:bg-neutral-200 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all"
                  >
                    <span>External Link</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  onClick={() => setReadingPub(null)}
                  className="apple-glass-pill px-4 py-2 text-xs font-mono text-neutral-300 hover:text-white cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

