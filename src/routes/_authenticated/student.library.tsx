import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Library,
  Search,
  BookOpen,
  Scale,
  Sparkles,
  Bookmark,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  Copy,
  Check,
  FileText,
  Landmark,
  ShieldCheck,
  AlertCircle,
  Tag,
  Clock,
  Layers,
  HelpCircle,
  Award,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import {
  Act,
  SectionDetail,
  StudentBookmark,
  fetchActs,
  fetchActDetails,
  fetchActSections,
  fetchSectionDetail,
  searchLegalLibrary,
  getStoredBookmarks,
  saveLocalBookmark,
  removeLocalBookmark,
  SEED_ACTS,
  POPULAR_SECTIONS,
} from "@/lib/student-legal-library";

export const Route = createFileRoute("/_authenticated/student/library")({
  head: () => ({
    meta: [
      { title: "Criminal Law Library — TRANA Student" },
      {
        name: "description",
        content:
          "Authoritative criminal law statutory database containing BNS, BNSS, BSA, IPC, CrPC, IEA and special penal statutes.",
      },
    ],
  }),
  component: StudentLibraryPage,
});

type LibraryTab = "bare_act" | "explanation" | "ingredients" | "caselaw" | "related";

function StudentLibraryPage() {
  const [selectedCategory, setSelectedCategory] = useState<"all" | "core_criminal" | "special_criminal">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Selected Act & Section State
  const [selectedAct, setSelectedAct] = useState<Act | null>(null);
  const [actSections, setActSections] = useState<any[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [selectedSection, setSelectedSection] = useState<SectionDetail | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<LibraryTab>("bare_act");
  const [copied, setCopied] = useState(false);

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<StudentBookmark[]>([]);
  const [showBookmarksDrawer, setShowBookmarksDrawer] = useState(false);
  const [noteInput, setNoteInput] = useState("");

  useEffect(() => {
    setBookmarks(getStoredBookmarks());
  }, []);

  // Search debouncing
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchLegalLibrary(searchQuery);
        setSearchResults(results);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load sections when an Act is selected
  useEffect(() => {
    if (!selectedAct) {
      setActSections([]);
      return;
    }
    let isCancelled = false;
    async function loadSections() {
      setLoadingSections(true);
      const data = await fetchActSections(selectedAct!.code, undefined, 80);
      if (!isCancelled) {
        setActSections(data.sections || []);
        setLoadingSections(false);
      }
    }
    loadSections();
    return () => {
      isCancelled = true;
    };
  }, [selectedAct]);

  const filteredActs = useMemo(() => {
    if (selectedCategory === "all") return SEED_ACTS;
    return SEED_ACTS.filter((a) => a.category === selectedCategory);
  }, [selectedCategory]);

  async function handleOpenSection(actCode: string, secNumber: string) {
    const detail = await fetchSectionDetail(actCode, secNumber);
    if (detail) {
      setSelectedSection(detail);
      setActiveDetailTab("bare_act");
      // Check existing note
      const existingBm = bookmarks.find(
        (b) => b.act_short_name === actCode && b.section_number === secNumber
      );
      setNoteInput(existingBm?.note || "");
    }
  }

  function handleCopyReference() {
    if (!selectedSection) return;
    const ref = `Section ${selectedSection.section_number}, ${selectedSection.act_code} (${selectedSection.heading})`;
    navigator.clipboard.writeText(ref);
    setCopied(true);
    toast.success("Statutory citation copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleToggleBookmark() {
    if (!selectedSection) return;
    const isBookmarked = bookmarks.some(
      (b) =>
        b.act_short_name === selectedSection.act_code &&
        b.section_number === selectedSection.section_number
    );

    if (isBookmarked) {
      removeLocalBookmark(`${selectedSection.act_code}-${selectedSection.section_number}`);
      setBookmarks(getStoredBookmarks());
      toast.success("Bookmark removed.");
    } else {
      saveLocalBookmark({
        section_id: `${selectedSection.act_code}-${selectedSection.section_number}`,
        act_short_name: selectedSection.act_code,
        section_number: selectedSection.section_number,
        section_title: selectedSection.heading,
        note: noteInput.trim() || undefined,
      });
      setBookmarks(getStoredBookmarks());
      toast.success("Section bookmarked with personal notes.");
    }
  }

  const isCurrentBookmarked = Boolean(
    selectedSection &&
      bookmarks.some(
        (b) =>
          b.act_short_name === selectedSection.act_code &&
          b.section_number === selectedSection.section_number
      )
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner / Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <Library className="h-4 w-4" />
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-semibold text-white tracking-wide">
              Criminal Law Library
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
              Statutory Corpus
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
            Authoritative, structured database of core and special Indian criminal legislation with official Gazette text, AI conceptual breakdowns, legal ingredients, and landmark precedents.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowBookmarksDrawer(!showBookmarksDrawer)}
            className="apple-glass-pill px-3.5 py-1.5 text-xs text-neutral-200 hover:text-white flex items-center gap-2 cursor-pointer border-white/15"
          >
            <Bookmark className="h-3.5 w-3.5 text-purple-400" />
            <span>Saved Provisions ({bookmarks.length})</span>
          </button>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-4 h-4 w-4 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search Acts, section numbers, or legal offences (e.g. 'BNS 303', 'undertrial bail', 'electronic evidence', 'POCSO 4')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-24 py-3 text-xs md:text-sm text-white placeholder-neutral-500 bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.08] border border-white/15 focus:border-purple-400/50 rounded-2xl shadow-lg transition-all outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 text-xs font-mono text-neutral-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Live Search Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-[#121118]/95 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl p-2 z-50 max-h-96 overflow-y-auto space-y-1">
            <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-neutral-400 border-b border-white/10 flex items-center justify-between">
              <span>Matching Provisions & Legislation</span>
              <span>{searchResults.length} results</span>
            </div>
            {searchResults.map((res, i) => (
              <div
                key={i}
                onClick={() => {
                  if (res.type === "act") {
                    const act = SEED_ACTS.find((a) => a.id === res.id);
                    if (act) {
                      setSelectedAct(act);
                      setSelectedSection(null);
                    }
                  } else {
                    const [actCode, sec] = res.id.split("-");
                    handleOpenSection(actCode, sec);
                  }
                  setSearchQuery("");
                }}
                className="p-2.5 rounded-xl hover:bg-white/[0.08] cursor-pointer transition-colors flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {res.badge}
                    </span>
                    <p className="text-xs font-semibold text-white group-hover:text-purple-300 truncate">
                      {res.title}
                    </p>
                  </div>
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                    {res.subtitle}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-500 group-hover:text-white shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bookmarks Drawer Overlay */}
      {showBookmarksDrawer && (
        <div className="apple-glass-card border-purple-500/30 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-white">Your Bookmarked Provisions & Notes</h3>
            </div>
            <button
              onClick={() => setShowBookmarksDrawer(false)}
              className="text-xs font-mono text-neutral-400 hover:text-white"
            >
              Close ✕
            </button>
          </div>
          {bookmarks.length === 0 ? (
            <p className="text-xs text-neutral-400 py-4 text-center">
              No saved sections yet. Click "Bookmark Provision" on any section page to save provisions and personal study notes.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto">
              {bookmarks.map((bm) => (
                <div
                  key={bm.id}
                  onClick={() => {
                    handleOpenSection(bm.act_short_name, bm.section_number);
                    setShowBookmarksDrawer(false);
                  }}
                  className="p-3 rounded-xl bg-white/[0.04] border border-white/10 hover:border-purple-400/40 cursor-pointer transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      {bm.act_short_name} Sec. {bm.section_number}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLocalBookmark(bm.id);
                        setBookmarks(getStoredBookmarks());
                      }}
                      className="text-[10px] text-rose-400 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="text-[11px] text-neutral-300 line-clamp-1">{bm.section_title || "Statutory Provision"}</p>
                  {bm.note && (
                    <p className="text-[10px] font-mono text-purple-300 bg-purple-950/40 p-1.5 rounded border border-purple-500/20 line-clamp-2">
                      Note: {bm.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main View Router: Section Detail OR Act Overview OR Home Catalog */}
      {selectedSection ? (
        /* ══════════════════════════════════════════════════════════════════
           VIEW 1: FULL SECTION DETAILS (5 TABS)
           ══════════════════════════════════════════════════════════════════ */
        <div className="apple-glass-card border-white/15 p-6 md:p-8 space-y-6">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div className="space-y-1.5">
              <button
                onClick={() => setSelectedSection(null)}
                className="text-xs font-mono text-purple-300 hover:text-white flex items-center gap-1.5 mb-2 transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to {selectedSection.act_code} sections</span>
              </button>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                  {selectedSection.act_code}
                </span>
                <h2 className="font-display text-2xl md:text-3xl font-semibold text-white">
                  Section {selectedSection.section_number}: {selectedSection.heading}
                </h2>
              </div>
              <p className="text-xs text-neutral-400 font-mono">
                {selectedSection.chapter || "Statutory Code Chapter"}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopyReference}
                className="apple-glass-pill px-3 py-1.5 text-xs text-neutral-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "Copied" : "Copy Citation"}</span>
              </button>
              <button
                onClick={handleToggleBookmark}
                className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all ${
                  isCurrentBookmarked
                    ? "bg-purple-600 text-white border border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                    : "apple-glass-pill text-neutral-300 hover:text-white"
                }`}
              >
                <Bookmark className="h-3.5 w-3.5" />
                <span>{isCurrentBookmarked ? "Bookmarked" : "Bookmark"}</span>
              </button>
            </div>
          </div>

          {/* 5 Section Tabs */}
          <div className="flex items-center gap-2 border-b border-white/10 overflow-x-auto pb-1 text-xs">
            {[
              { id: "bare_act", label: "Bare Act Text", icon: FileText },
              { id: "explanation", label: "Simple Explanation", icon: Sparkles },
              { id: "ingredients", label: "Essential Ingredients", icon: Layers },
              { id: "caselaw", label: `Case Laws (${selectedSection.case_laws.length})`, icon: Landmark },
              { id: "related", label: "Related Sections", icon: Scale },
            ].map((t) => {
              const Icon = t.icon;
              const active = activeDetailTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveDetailTab(t.id as LibraryTab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-t-xl font-medium transition-all whitespace-nowrap cursor-pointer ${
                    active
                      ? "text-white border-b-2 border-purple-400 bg-white/[0.06]"
                      : "text-neutral-400 hover:text-white hover:bg-white/[0.02]"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${active ? "text-purple-300" : "text-neutral-400"}`} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="pt-2">
            {activeDetailTab === "bare_act" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-neutral-400 bg-white/[0.02] p-2.5 rounded-xl border border-white/10">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-300 font-semibold">Official Gazette Statutory Record</span>
                  </div>
                  {selectedSection.source_url && (
                    <a
                      href={selectedSection.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:underline flex items-center gap-1"
                    >
                      <span>India Code Source</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="p-5 md:p-6 rounded-2xl bg-[#0a0a0d] border border-white/15 text-sm md:text-base font-mono text-neutral-200 leading-relaxed whitespace-pre-wrap select-text">
                  {selectedSection.bare_act_text}
                </div>
              </div>
            )}

            {activeDetailTab === "explanation" && (
              <div className="space-y-4">
                <div className="bg-purple-950/20 border border-purple-500/30 p-3 rounded-xl flex items-center gap-2.5 text-xs text-purple-300">
                  <Sparkles className="h-4 w-4 shrink-0 text-purple-400" />
                  <span>
                    TRANA AI Plain Explanation — synthesizes statutory language into practical academic concepts for law scholars.
                  </span>
                </div>
                <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 text-sm md:text-base text-neutral-200 leading-relaxed space-y-3 font-sans">
                  <p>{selectedSection.simple_explanation}</p>
                  {selectedSection.punishment && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <h4 className="text-xs uppercase font-mono tracking-wider text-amber-300 font-bold mb-1">
                        Statutory Punishment / Legal Consequence:
                      </h4>
                      <p className="text-xs md:text-sm text-neutral-300 font-mono">
                        {selectedSection.punishment}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeDetailTab === "ingredients" && (
              <div className="space-y-4">
                <div className="text-xs text-neutral-400">
                  To establish liability or procedural compliance under this provision, the following ingredients must be established:
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  {selectedSection.ingredients.map((ing, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex items-start gap-3 text-xs md:text-sm text-neutral-200"
                    >
                      <span className="h-5 w-5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                        {i + 1}
                      </span>
                      <p className="leading-relaxed">{ing}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeDetailTab === "caselaw" && (
              <div className="space-y-4">
                {selectedSection.case_laws.length === 0 ? (
                  <p className="text-xs text-neutral-400 py-6 text-center">
                    No connected landmark rulings tagged for this section yet. Additional High Court and Supreme Court precedents are indexed continuously.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {selectedSection.case_laws.map((j) => (
                      <div
                        key={j.id}
                        className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2 hover:border-purple-400/30 transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                            <span>{j.case_name}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              {j.court}
                            </span>
                          </h4>
                          <span className="text-xs font-mono text-amber-300">{j.citation}</span>
                        </div>
                        <p className="text-xs text-neutral-300 leading-relaxed font-sans">
                          {j.key_principle}
                        </p>
                        {j.full_url && (
                          <div className="pt-1">
                            <a
                              href={j.full_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-mono text-purple-400 hover:underline flex items-center gap-1"
                            >
                              <span>View Full Judgment on Indian Kanoon</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeDetailTab === "related" && (
              <div className="space-y-4">
                <div className="text-xs text-neutral-400">
                  Cross-references between old codes (IPC/CrPC/IEA) and the newly enacted 2023 criminal statutes:
                </div>
                {selectedSection.related_provisions.length === 0 ? (
                  <p className="text-xs text-neutral-400 py-6 text-center">
                    No direct statutory mappings mapped for this section. Check the Law Converters tab for comprehensive concordance tables.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedSection.related_provisions.map((rel, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-1"
                      >
                        <span className="text-xs font-bold text-white">
                          {rel.act} Section {rel.section}
                        </span>
                        <p className="text-xs text-neutral-300">{rel.relationship}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Personal Note Box */}
          <div className="mt-6 pt-5 border-t border-white/10 space-y-2">
            <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400">
              Personal Study Note / Case References:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add your personal notes for this section..."
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                className="flex-1 apple-glass-input px-3 py-2 text-xs text-white placeholder-neutral-500"
              />
              <button
                onClick={handleToggleBookmark}
                className="bg-white text-black hover:bg-neutral-200 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      ) : selectedAct ? (
        /* ══════════════════════════════════════════════════════════════════
           VIEW 2: ACT OVERVIEW & CHAPTERS TABLE OF CONTENTS
           ══════════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          <div className="apple-glass-card border-white/15 p-6 md:p-8 space-y-4">
            <button
              onClick={() => setSelectedAct(null)}
              className="text-xs font-mono text-purple-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to all legislation</span>
            </button>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                    {selectedAct.short_name}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase ${
                      selectedAct.status === "active"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    {selectedAct.status === "active" ? "In Force" : "Repealed / Historic"}
                  </span>
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-semibold text-white mt-1.5">
                  {selectedAct.full_name}
                </h2>
                <p className="text-xs text-neutral-400 mt-1 max-w-3xl leading-relaxed">
                  {selectedAct.description}
                </p>
              </div>

              {selectedAct.official_url && (
                <a
                  href={selectedAct.official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="apple-glass-pill px-4 py-2 text-xs text-neutral-200 hover:text-white flex items-center gap-1.5 shrink-0 self-start md:self-auto"
                >
                  <span>India Code Portal</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            {/* Chapters arrangement */}
            {selectedAct.chapters && selectedAct.chapters.length > 0 && (
              <div className="pt-4 border-t border-white/10 space-y-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-400">
                  Chapter Arrangement:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {selectedAct.chapters.map((ch, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs flex items-center justify-between"
                    >
                      <span className="font-bold text-white">Ch. {ch.number}: {ch.title}</span>
                      <span className="font-mono text-[10px] text-purple-300">Sec. {ch.range}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sections List in Act */}
          <div className="apple-glass-card border-white/15 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-purple-400" />
                <span>Statutory Sections in {selectedAct.short_name}</span>
              </h3>
              <span className="text-xs font-mono text-neutral-400">
                {actSections.length} sections loaded
              </span>
            </div>

            {loadingSections ? (
              <div className="text-center py-8 text-xs text-neutral-400 font-mono">
                Loading sections from statutory corpus...
              </div>
            ) : actSections.length === 0 ? (
              <div className="text-center py-8 text-xs text-neutral-400">
                No sections indexed for this Act yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
                {actSections.map((sec, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleOpenSection(selectedAct.code, sec.section)}
                    className="p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-purple-400/40 cursor-pointer transition-all space-y-1 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white group-hover:text-purple-300">
                        Section {sec.section}: {sec.heading}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-neutral-500 group-hover:text-white" />
                    </div>
                    <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed font-mono">
                      {sec.snippet}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════════
           VIEW 3: LIBRARY HOMEPAGE (ACTS CATALOG + POPULAR SECTIONS)
           ══════════════════════════════════════════════════════════════════ */
        <div className="space-y-8">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                selectedCategory === "all"
                  ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                  : "apple-glass-pill text-neutral-300 hover:text-white"
              }`}
            >
              All Legislation (13 Acts)
            </button>
            <button
              onClick={() => setSelectedCategory("core_criminal")}
              className={`px-4 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                selectedCategory === "core_criminal"
                  ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                  : "apple-glass-pill text-neutral-300 hover:text-white"
              }`}
            >
              Core Criminal Laws (BNS, BNSS, BSA, IPC, CrPC, IEA)
            </button>
            <button
              onClick={() => setSelectedCategory("special_criminal")}
              className={`px-4 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                selectedCategory === "special_criminal"
                  ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                  : "apple-glass-pill text-neutral-300 hover:text-white"
              }`}
            >
              Special Criminal Laws (POCSO, NDPS, SC/ST, JJ, IT, PMLA, Arms)
            </button>
          </div>

          {/* Acts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredActs.map((act) => (
              <div
                key={act.id}
                onClick={() => setSelectedAct(act)}
                className="apple-glass-card p-5 hover:border-purple-400/50 hover:bg-white/[0.06] transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {act.short_name}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded-full uppercase ${
                        act.status === "active"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-neutral-800 text-neutral-400 border border-neutral-700"
                      }`}
                    >
                      {act.status === "active" ? "Active" : "Repealed"}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-white group-hover:text-purple-300 transition-colors">
                    {act.full_name}
                  </h3>

                  <p className="text-[11px] text-neutral-400 line-clamp-3 leading-relaxed">
                    {act.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono text-neutral-400">
                  <span>Enacted {act.year}</span>
                  <span className="text-purple-300 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    Explore <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Popular & Trending Sections */}
          <div className="apple-glass-card border-white/15 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">Popular & Crucial Statutory Provisions</h3>
              </div>
              <span className="text-xs font-mono text-neutral-400">Frequently Examined in Moot Courts & Academics</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {POPULAR_SECTIONS.map((sec, i) => (
                <div
                  key={i}
                  onClick={() => handleOpenSection(sec.act_code, sec.section)}
                  className="p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-purple-400/40 cursor-pointer transition-all space-y-1 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-purple-300">
                      {sec.act_code} Sec. {sec.section}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-neutral-300">
                      {sec.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 line-clamp-1">{sec.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
