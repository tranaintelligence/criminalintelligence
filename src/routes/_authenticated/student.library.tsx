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
  Tag,
  Layers,
  ChevronDown,
  Filter,
  Eye,
  AlignLeft,
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
  validateSearch: (search: Record<string, unknown>): { act?: string; section?: string } => {
    return {
      act: typeof search.act === "string" ? search.act : undefined,
      section: typeof search.section === "string" ? search.section : undefined,
    };
  },
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
type ReaderMode = "grid" | "reader";

function StudentLibraryPage() {
  const searchParams = Route.useSearch();
  const queryAct = searchParams.act;
  const querySection = searchParams.section;

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

  // Whole Act View Features
  const [actSearchQuery, setActSearchQuery] = useState("");
  const [selectedChapterFilter, setSelectedChapterFilter] = useState<string>("all");
  const [readerMode, setReaderMode] = useState<ReaderMode>("grid");

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<StudentBookmark[]>([]);
  const [showBookmarksDrawer, setShowBookmarksDrawer] = useState(false);
  const [noteInput, setNoteInput] = useState("");

  useEffect(() => {
    setBookmarks(getStoredBookmarks());
  }, []);

  // Reactively open act and section when URL parameters are passed (e.g. from "View Act" in converters)
  useEffect(() => {
    if (queryAct) {
      const norm = queryAct.toLowerCase().trim();
      const found = SEED_ACTS.find(
        (a) =>
          a.id.toLowerCase() === norm ||
          a.code.toLowerCase() === norm ||
          a.short_name.toLowerCase() === norm ||
          a.short_name.toLowerCase().replace(/\s+/g, "-") === norm
      );
      if (found) {
        setSelectedAct(found);
        if (querySection) {
          handleOpenSection(found.code, querySection);
        } else {
          setSelectedSection(null);
        }
      }
    }
  }, [queryAct, querySection]);

  // Global search debouncing
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

  // Load all sections when an Act is selected (loads the whole Act up to 600 provisions)
  useEffect(() => {
    if (!selectedAct) {
      setActSections([]);
      return;
    }
    let isCancelled = false;
    async function loadSections() {
      setLoadingSections(true);
      const data = await fetchActSections(selectedAct!.code, undefined, 600);
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

  // Filter sections within the active Act
  const filteredActSections = useMemo(() => {
    let list = actSections;
    if (actSearchQuery.trim()) {
      const q = actSearchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.section.toLowerCase().includes(q) ||
          s.heading.toLowerCase().includes(q) ||
          (s.snippet && s.snippet.toLowerCase().includes(q))
      );
    }
    if (selectedChapterFilter !== "all" && selectedAct?.chapters) {
      const ch = selectedAct.chapters.find((c) => c.number === selectedChapterFilter);
      if (ch && ch.range) {
        const parts = ch.range.split("-").map((p) => parseInt(p.trim(), 10));
        if (parts.length === 2 && !isNaN(parts[0]!) && !isNaN(parts[1]!)) {
          const start = parts[0]!;
          const end = parts[1]!;
          list = list.filter((s) => {
            const num = parseInt(s.section, 10);
            return !isNaN(num) && num >= start && num <= end;
          });
        }
      }
    }
    return list;
  }, [actSections, actSearchQuery, selectedChapterFilter, selectedAct]);

  async function handleOpenSection(actCode: string, secNumber: string) {
    const detail = await fetchSectionDetail(actCode, secNumber);
    if (detail) {
      setSelectedSection(detail);
      setActiveDetailTab("bare_act");
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
    <div className="relative min-h-screen space-y-6 max-w-7xl mx-auto pb-16">
      {/* ══════════════════════════════════════════════════════════════════
          AUTHENTIC LAW LIBRARY BACKGROUND (LEATHER BOOKS & WOODEN SHELVES)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none">
        {/* Ambient library reading lamp glow */}
        <div className="absolute top-[-100px] left-1/3 w-[650px] h-[450px] bg-amber-500/[0.08] blur-[150px] rounded-full" />
        <div className="absolute top-1/2 right-0 w-[550px] h-[550px] bg-purple-900/[0.12] blur-[160px] rounded-full" />
        
        {/* Dark mahogany library book stacks texture */}
        <div
          className="absolute inset-0 opacity-25 mix-blend-screen bg-repeat-y bg-contain"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='360' viewBox='0 0 800 360'%3E%3Cdefs%3E%3ClinearGradient id='shelfWood' x1='0%25' y1='0%25' x2='100%25' y2='0%25'%3E%3Cstop offset='0%25' stop-color='%23190f09'/%3E%3Cstop offset='25%25' stop-color='%232c1b11'/%3E%3Cstop offset='50%25' stop-color='%231f130b'/%3E%3Cstop offset='75%25' stop-color='%23362115'/%3E%3Cstop offset='100%25' stop-color='%23190f09'/%3E%3C/linearGradient%3E%3ClinearGradient id='goldFoil' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23e6c665'/%3E%3Cstop offset='50%25' stop-color='%23d4af37'/%3E%3Cstop offset='100%25' stop-color='%23997715'/%3E%3C/linearGradient%3E%3C/defs%3E%3C!-- Bookshelf Backdrop Row 1 --%3E%3Crect x='0' y='0' width='800' height='160' fill='%230d0805'/%3E%3C!-- Book Spines --%3E%3Crect x='20' y='18' width='36' height='140' rx='2' fill='%234a121a'/%3E%3Crect x='22' y='30' width='32' height='3' fill='url(%23goldFoil)' opacity='0.7'/%3E%3Crect x='22' y='135' width='32' height='3' fill='url(%23goldFoil)' opacity='0.7'/%3E%3Crect x='58' y='12' width='44' height='146' rx='2' fill='%23122238'/%3E%3Crect x='60' y='28' width='40' height='3' fill='url(%23goldFoil)' opacity='0.7'/%3E%3Crect x='104' y='24' width='38' height='134' rx='2' fill='%23122d1d'/%3E%3Crect x='144' y='10' width='50' height='148' rx='2' fill='%2338210e'/%3E%3Crect x='196' y='20' width='34' height='138' rx='2' fill='%23331429'/%3E%3Crect x='232' y='14' width='42' height='144' rx='2' fill='%234a121a'/%3E%3Crect x='276' y='18' width='48' height='140' rx='2' fill='%23122238'/%3E%3Crect x='326' y='22' width='36' height='136' rx='2' fill='%23122d1d'/%3E%3Crect x='364' y='10' width='52' height='148' rx='2' fill='%2338210e'/%3E%3Crect x='418' y='16' width='40' height='142' rx='2' fill='%234a121a'/%3E%3Crect x='460' y='24' width='36' height='134' rx='2' fill='%23122238'/%3E%3Crect x='498' y='12' width='46' height='146' rx='2' fill='%23122d1d'/%3E%3Crect x='546' y='18' width='40' height='140' rx='2' fill='%23331429'/%3E%3Crect x='588' y='14' width='48' height='144' rx='2' fill='%2338210e'/%3E%3Crect x='638' y='20' width='38' height='138' rx='2' fill='%234a121a'/%3E%3Crect x='678' y='10' width='44' height='148' rx='2' fill='%23122238'/%3E%3Crect x='724' y='16' width='56' height='142' rx='2' fill='%23122d1d'/%3E%3C!-- Wooden Shelf Beam 1 --%3E%3Crect x='0' y='158' width='800' height='16' fill='url(%23shelfWood)'/%3E%3Crect x='0' y='158' width='800' height='2' fill='url(%23goldFoil)' opacity='0.5'/%3E%3C!-- Row 2 Books --%3E%3Crect x='25' y='190' width='44' height='150' rx='2' fill='%23122238'/%3E%3Crect x='71' y='182' width='40' height='158' rx='2' fill='%234a121a'/%3E%3Crect x='113' y='194' width='48' height='146' rx='2' fill='%2338210e'/%3E%3Crect x='163' y='186' width='38' height='154' rx='2' fill='%23122d1d'/%3E%3Crect x='203' y='192' width='42' height='148' rx='2' fill='%23331429'/%3E%3Crect x='247' y='180' width='50' height='160' rx='2' fill='%234a121a'/%3E%3Crect x='299' y='188' width='40' height='152' rx='2' fill='%23122238'/%3E%3Crect x='341' y='194' width='36' height='146' rx='2' fill='%23122d1d'/%3E%3Crect x='379' y='184' width='48' height='156' rx='2' fill='%2338210e'/%3E%3Crect x='429' y='190' width='44' height='150' rx='2' fill='%234a121a'/%3E%3Crect x='475' y='182' width='38' height='158' rx='2' fill='%23122238'/%3E%3Crect x='515' y='192' width='46' height='148' rx='2' fill='%23122d1d'/%3E%3Crect x='563' y='186' width='40' height='154' rx='2' fill='%23331429'/%3E%3Crect x='605' y='188' width='44' height='152' rx='2' fill='%2338210e'/%3E%3Crect x='651' y='180' width='46' height='160' rx='2' fill='%234a121a'/%3E%3Crect x='699' y='192' width='40' height='148' rx='2' fill='%23122238'/%3E%3Crect x='741' y='184' width='42' height='156' rx='2' fill='%23122d1d'/%3E%3C!-- Wooden Shelf Beam 2 --%3E%3Crect x='0' y='340' width='800' height='16' fill='url(%23shelfWood)'/%3E%3Crect x='0' y='340' width='800' height='2' fill='url(%23goldFoil)' opacity='0.5'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Top Banner / Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-5 backdrop-blur-md bg-black/40 p-4 rounded-2xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300 shadow-md">
              <Library className="h-5 w-5" />
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-semibold text-white tracking-wide">
              Criminal Law Library
            </h1>
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase font-semibold">
              Gazette & Commentary Corpus
            </span>
          </div>
          <p className="text-xs text-neutral-300 mt-1 max-w-2xl">
            Authoritative, structured database of core and special Indian criminal legislation with official Gazette text, AI conceptual breakdowns, legal ingredients, and landmark precedents.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowBookmarksDrawer(!showBookmarksDrawer)}
            className="apple-glass-pill px-3.5 py-1.5 text-xs text-neutral-200 hover:text-white flex items-center gap-2 cursor-pointer border-amber-500/30 bg-black/50"
          >
            <Bookmark className="h-3.5 w-3.5 text-amber-400" />
            <span>Saved Provisions ({bookmarks.length})</span>
          </button>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-4 h-4 w-4 text-amber-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search Acts, section numbers, or legal offences (e.g. 'BNS 303', 'undertrial bail', 'electronic evidence', 'POCSO 4')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-24 py-3 text-xs md:text-sm text-white placeholder-neutral-400 bg-black/60 backdrop-blur-xl hover:bg-black/75 focus:bg-black/80 border border-amber-500/30 focus:border-amber-400 rounded-2xl shadow-xl transition-all outline-none"
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
          <div className="absolute left-0 right-0 top-full mt-2 bg-[#120f18]/95 backdrop-blur-2xl border border-amber-500/30 rounded-2xl shadow-2xl p-2 z-50 max-h-96 overflow-y-auto space-y-1">
            <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-amber-300 border-b border-white/10 flex items-center justify-between">
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
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {res.badge}
                    </span>
                    <p className="text-xs font-semibold text-white group-hover:text-amber-300 truncate">
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
        <div className="apple-glass-card border-amber-500/40 p-5 space-y-4 bg-black/75 backdrop-blur-2xl shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-amber-400" />
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
                  className="p-3 rounded-xl bg-white/[0.04] border border-white/10 hover:border-amber-400/50 cursor-pointer transition-all space-y-1.5"
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
                    <p className="text-[10px] font-mono text-amber-300 bg-amber-950/40 p-1.5 rounded border border-amber-500/20 line-clamp-2">
                      Note: {bm.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main View Router: Section Detail OR Whole Act Overview OR Library Catalog */}
      {selectedSection ? (
        /* ══════════════════════════════════════════════════════════════════
           VIEW 1: FULL SECTION DETAILS (5 TABS)
           ══════════════════════════════════════════════════════════════════ */
        <div className="apple-glass-card border-amber-500/30 bg-black/70 backdrop-blur-2xl p-6 md:p-8 space-y-6 shadow-2xl">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div className="space-y-1.5">
              <button
                onClick={() => setSelectedSection(null)}
                className="text-xs font-mono text-amber-300 hover:text-white flex items-center gap-1.5 mb-2 transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Return to whole {selectedSection.act_code} Act</span>
              </button>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
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
                className="apple-glass-pill px-3 py-1.5 text-xs text-neutral-300 hover:text-white flex items-center gap-1.5 cursor-pointer border-amber-500/30"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "Copied" : "Copy Citation"}</span>
              </button>
              <button
                onClick={handleToggleBookmark}
                className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all ${
                  isCurrentBookmarked
                    ? "bg-amber-500 text-black font-semibold border border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                    : "apple-glass-pill text-neutral-300 hover:text-white border-white/20"
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
                      ? "text-white border-b-2 border-amber-400 bg-white/[0.08]"
                      : "text-neutral-400 hover:text-white hover:bg-white/[0.02]"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${active ? "text-amber-300" : "text-neutral-400"}`} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="pt-2">
            {activeDetailTab === "bare_act" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-neutral-300 bg-black/40 p-3 rounded-xl border border-white/10">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-300 font-semibold">Official Gazette Statutory Record</span>
                  </div>
                  {selectedSection.source_url && (
                    <a
                      href={selectedSection.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400 hover:underline flex items-center gap-1 font-mono"
                    >
                      <span>India Code Portal</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="p-6 md:p-7 rounded-2xl bg-[#08070b] border border-amber-500/25 text-sm md:text-base font-mono text-neutral-200 leading-relaxed whitespace-pre-wrap select-text shadow-inner">
                  {selectedSection.bare_act_text}
                </div>
              </div>
            )}

            {activeDetailTab === "explanation" && (
              <div className="space-y-4">
                <div className="bg-purple-950/30 border border-purple-500/30 p-3 rounded-xl flex items-center gap-2.5 text-xs text-purple-300">
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
                <div className="text-xs text-neutral-300">
                  To establish liability or procedural compliance under this provision, the following ingredients must be established:
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  {selectedSection.ingredients.map((ing, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex items-start gap-3 text-xs md:text-sm text-neutral-200"
                    >
                      <span className="h-5 w-5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center text-xs font-mono font-bold shrink-0">
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
                        className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2 hover:border-amber-400/30 transition-all"
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
                              className="text-[11px] font-mono text-amber-400 hover:underline flex items-center gap-1"
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
            <label className="block text-xs font-mono uppercase tracking-wider text-amber-300">
              Personal Study Note / Case References:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add your personal notes for this section..."
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                className="flex-1 apple-glass-input px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 rounded-xl"
              />
              <button
                onClick={handleToggleBookmark}
                className="bg-amber-400 hover:bg-amber-300 text-black px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-md"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      ) : selectedAct ? (
        /* ══════════════════════════════════════════════════════════════════
           VIEW 2: WHOLE ACT VIEW (ENTIRE ACT PROPERLY DISPLAYED)
           ══════════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          {/* Act Grand Header */}
          <div className="apple-glass-card border-amber-500/30 bg-black/75 backdrop-blur-2xl p-6 md:p-8 space-y-5 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSelectedAct(null)}
                className="text-xs font-mono text-amber-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to all legislation catalog</span>
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                  {actSections.length} Total Sections
                </span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-mono px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                    {selectedAct.short_name}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border uppercase font-bold ${
                      selectedAct.status === "active"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    }`}
                  >
                    {selectedAct.status === "active" ? "In Force • Law of the Land" : "Repealed / Historic Law"}
                  </span>
                  {selectedAct.commencement_date && (
                    <span className="text-[10px] font-mono text-neutral-400">
                      Commenced: {selectedAct.commencement_date}
                    </span>
                  )}
                </div>

                <h2 className="font-display text-2xl md:text-4xl font-bold text-white mt-2 tracking-wide font-serif">
                  {selectedAct.full_name}
                </h2>
                <p className="text-xs md:text-sm text-neutral-300 mt-2 max-w-4xl leading-relaxed">
                  {selectedAct.description}
                </p>
              </div>

              {selectedAct.official_url && (
                <a
                  href={selectedAct.official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="apple-glass-pill px-4 py-2 text-xs text-amber-300 hover:text-white flex items-center gap-2 shrink-0 self-start md:self-auto border-amber-500/30 bg-black/60 shadow-lg"
                >
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>India Code Gazette Portal</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            {/* Chapters Table of Contents */}
            {selectedAct.chapters && selectedAct.chapters.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-amber-300 font-bold flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    <span>Table of Contents • Chapter Arrangement:</span>
                  </h4>
                  <span className="text-[11px] font-mono text-neutral-400">
                    Click chapter to filter sections
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 text-xs">
                  <button
                    onClick={() => setSelectedChapterFilter("all")}
                    className={`px-3 py-1.5 rounded-xl font-mono text-[11px] transition-all cursor-pointer whitespace-nowrap ${
                      selectedChapterFilter === "all"
                        ? "bg-amber-400 text-black font-bold shadow-md"
                        : "bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08] border border-white/10"
                    }`}
                  >
                    All Chapters ({actSections.length})
                  </button>
                  {selectedAct.chapters.map((ch, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedChapterFilter(ch.number)}
                      className={`px-3 py-1.5 rounded-xl font-mono text-[11px] transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        selectedChapterFilter === ch.number
                          ? "bg-amber-400 text-black font-bold shadow-md"
                          : "bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08] border border-white/10"
                      }`}
                    >
                      <span className="font-bold">Ch. {ch.number}:</span>
                      <span className="truncate max-w-[120px]">{ch.title}</span>
                      <span className="text-[10px] opacity-70">({ch.range})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Search within Act & View Mode Switcher */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 apple-glass-card border-white/15 p-3.5 bg-black/60 backdrop-blur-xl">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 h-3.5 w-3.5 text-amber-400 pointer-events-none" />
              <input
                type="text"
                placeholder={`Search inside ${selectedAct.short_name} by section number, title, or offence (e.g. '303', 'theft', 'bail')...`}
                value={actSearchQuery}
                onChange={(e) => setActSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs text-white placeholder-neutral-400 bg-white/[0.04] border border-white/15 focus:border-amber-400 rounded-xl outline-none"
              />
              {actSearchQuery && (
                <button
                  onClick={() => setActSearchQuery("")}
                  className="absolute right-3 text-xs text-neutral-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <span className="text-xs font-mono text-neutral-400 mr-1">
                Showing {filteredActSections.length} sections
              </span>
              <button
                onClick={() => setReaderMode("grid")}
                className={`p-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer ${
                  readerMode === "grid"
                    ? "bg-amber-400 text-black font-bold"
                    : "apple-glass-pill text-neutral-300"
                }`}
                title="Grid Card View"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Grid View</span>
              </button>
              <button
                onClick={() => setReaderMode("reader")}
                className={`p-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer ${
                  readerMode === "reader"
                    ? "bg-amber-400 text-black font-bold"
                    : "apple-glass-pill text-neutral-300"
                }`}
                title="Continuous Bare Act Reader"
              >
                <AlignLeft className="h-3.5 w-3.5" />
                <span>Continuous Reader</span>
              </button>
            </div>
          </div>

          {/* Sections Rendering */}
          {loadingSections ? (
            <div className="text-center py-16 text-xs text-amber-300 font-mono bg-black/60 rounded-2xl border border-amber-500/20">
              <Sparkles className="h-5 w-5 animate-spin mx-auto mb-2 text-amber-400" />
              <span>Loading complete statutory text from Gazette corpus...</span>
            </div>
          ) : filteredActSections.length === 0 ? (
            <div className="text-center py-16 text-xs text-neutral-400 bg-black/60 rounded-2xl border border-white/10 space-y-2">
              <p>No sections match "{actSearchQuery}" in {selectedAct.short_name}.</p>
              <button
                onClick={() => {
                  setActSearchQuery("");
                  setSelectedChapterFilter("all");
                }}
                className="text-amber-400 underline cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          ) : readerMode === "grid" ? (
            /* Grid View of Sections */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredActSections.map((sec, idx) => (
                <div
                  key={idx}
                  onClick={() => handleOpenSection(selectedAct.code, sec.section)}
                  className="p-4 rounded-2xl bg-black/60 hover:bg-black/85 border border-white/10 hover:border-amber-400/60 cursor-pointer transition-all space-y-2 group shadow-lg flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Sec. {sec.section}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-400 group-hover:text-amber-300 flex items-center gap-1">
                        <span>Details</span>
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>

                    <h4 className="text-xs font-semibold text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                      {sec.heading}
                    </h4>

                    <p className="text-[11px] text-neutral-300 line-clamp-3 leading-relaxed font-mono">
                      {sec.snippet}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-neutral-400">
                    <span>{selectedAct.short_name}</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      <span>Gazette</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Continuous Reader Mode (Reads entire Bare Act like a book) */
            <div className="apple-glass-card border-amber-500/20 bg-black/85 p-6 md:p-10 space-y-8 divide-y divide-white/10 max-w-4xl mx-auto shadow-2xl">
              <div className="text-center pb-6 space-y-2">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-amber-300 font-bold block">
                  Official Gazette Bare Act Reader
                </span>
                <h3 className="font-display text-2xl font-bold text-white font-serif">
                  {selectedAct.full_name}
                </h3>
                <p className="text-xs text-neutral-400 font-mono">
                  Continuous Statutory Provisions Text
                </p>
              </div>

              {filteredActSections.map((sec, idx) => (
                <div key={idx} className="pt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        Section {sec.section}
                      </span>
                      <h4 className="text-sm font-bold text-white font-serif">
                        {sec.heading}
                      </h4>
                    </div>
                    <button
                      onClick={() => handleOpenSection(selectedAct.code, sec.section)}
                      className="apple-glass-pill px-2.5 py-1 text-[11px] text-amber-300 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <span>5-Tab Breakdown</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 font-mono text-xs text-neutral-200 leading-relaxed whitespace-pre-wrap select-text">
                    {sec.snippet}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════════
           VIEW 3: LIBRARY HOMEPAGE (AUTHENTIC LAW BOOK VOLUMES ON SHELVES)
           ══════════════════════════════════════════════════════════════════ */
        <div className="space-y-10">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-2 rounded-full font-medium transition-all cursor-pointer ${
                selectedCategory === "all"
                  ? "bg-amber-400 text-black font-bold shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                  : "apple-glass-pill text-neutral-300 hover:text-white border-amber-500/20 bg-black/60"
              }`}
            >
              All Statutory Volumes (13 Acts)
            </button>
            <button
              onClick={() => setSelectedCategory("core_criminal")}
              className={`px-4 py-2 rounded-full font-medium transition-all cursor-pointer ${
                selectedCategory === "core_criminal"
                  ? "bg-amber-400 text-black font-bold shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                  : "apple-glass-pill text-neutral-300 hover:text-white border-amber-500/20 bg-black/60"
              }`}
            >
              Core Criminal Laws (BNS, BNSS, BSA, IPC, CrPC, IEA)
            </button>
            <button
              onClick={() => setSelectedCategory("special_criminal")}
              className={`px-4 py-2 rounded-full font-medium transition-all cursor-pointer ${
                selectedCategory === "special_criminal"
                  ? "bg-amber-400 text-black font-bold shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                  : "apple-glass-pill text-neutral-300 hover:text-white border-amber-500/20 bg-black/60"
              }`}
            >
              Special Criminal Laws (POCSO, NDPS, SC/ST, JJ, IT, PMLA, Arms)
            </button>
          </div>

          {/* Authentic Law Volumes Shelf */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
                  Official Legislative Treatises & Codes
                </h3>
              </div>
              <span className="text-xs font-mono text-neutral-400">
                Click any volume to inspect the entire Act
              </span>
            </div>

            {/* Grid of Leather-Bound Law Books */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredActs.map((act) => {
                // Realistic leather volume spine tint based on Act
                const isBNS = act.code === "BNS";
                const isBNSS = act.code === "BNSS";
                const isBSA = act.code === "BSA";
                const isRepealed = act.status === "repealed";

                const leatherStyle = isBNS
                  ? "from-[#2e0e13] via-[#1a0a0d] to-[#0d0507] border-rose-900/60"
                  : isBNSS
                  ? "from-[#0c182a] via-[#09111c] to-[#050a10] border-blue-900/60"
                  : isBSA
                  ? "from-[#0d2417] via-[#08170e] to-[#040d07] border-emerald-900/60"
                  : isRepealed
                  ? "from-[#26170d] via-[#1a1009] to-[#0e0804] border-amber-900/60"
                  : "from-[#23132a] via-[#160b1b] to-[#0d0710] border-purple-900/60";

                return (
                  <div
                    key={act.id}
                    onClick={() => setSelectedAct(act)}
                    className={`relative rounded-2xl bg-gradient-to-br ${leatherStyle} border-2 hover:border-amber-400/80 p-6 flex flex-col justify-between space-y-4 transition-all duration-300 cursor-pointer group shadow-[0_10px_25px_rgba(0,0,0,0.85)] hover:shadow-[0_15px_35px_rgba(245,158,11,0.2)] hover:-translate-y-1 overflow-hidden select-none`}
                  >
                    {/* Gold Foil Spine Band on the Left Edge */}
                    <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-700 opacity-90 shadow-md" />

                    {/* Ribbon Bookmark visual accent */}
                    <div className="absolute top-0 right-7 w-3.5 h-7 bg-red-600 shadow-md rounded-b" />

                    <div className="pl-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-black/60 text-amber-300 border border-amber-500/40 shadow-sm">
                          {act.short_name}
                        </span>
                        <span
                          className={`text-[9px] font-mono px-2 py-0.5 rounded-full uppercase font-bold ${
                            act.status === "active"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {act.status === "active" ? "In Force" : "Repealed"}
                        </span>
                      </div>

                      <h3 className="font-serif text-base font-bold text-white group-hover:text-amber-300 transition-colors leading-snug">
                        {act.full_name}
                      </h3>

                      <p className="text-[11px] text-neutral-300 line-clamp-3 leading-relaxed font-sans">
                        {act.description}
                      </p>
                    </div>

                    {/* Book Footing with Enactment & Section Count */}
                    <div className="pl-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono text-neutral-400">
                      <span>Enacted {act.year}</span>
                      <span className="text-amber-300 group-hover:translate-x-1 transition-transform flex items-center gap-1 font-bold">
                        <span>Open Whole Act</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Handsome Wooden Bookshelf Ledge underneath */}
            <div className="h-4 rounded-full bg-gradient-to-r from-[#1f130b] via-[#3a2214] to-[#1f130b] border-t-2 border-amber-500/40 shadow-[0_8px_20px_rgba(0,0,0,0.9)] mt-2" />
          </div>

          {/* Popular & Crucial Sections */}
          <div className="apple-glass-card border-amber-500/30 bg-black/75 backdrop-blur-2xl p-6 md:p-8 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Popular & Crucial Statutory Provisions</h3>
              </div>
              <span className="text-xs font-mono text-neutral-400">
                Frequently Examined in Moot Courts & Academics
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {POPULAR_SECTIONS.map((sec, i) => (
                <div
                  key={i}
                  onClick={() => handleOpenSection(sec.act_code, sec.section)}
                  className="p-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-amber-400/50 cursor-pointer transition-all space-y-1.5 group shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-amber-300 font-mono">
                      {sec.act_code} Sec. {sec.section}
                    </span>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/10 text-neutral-300">
                      {sec.category}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-300 line-clamp-1">{sec.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
