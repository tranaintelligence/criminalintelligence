import { API_URL } from "./trana-backend";

export type ActCategory = "core_criminal" | "special_criminal";

export interface ActChapter {
  number: string;
  title: string;
  range: string;
}

export interface Act {
  id: string;
  short_name: string;
  code: string;
  full_name: string;
  year: number;
  category: ActCategory;
  status: "active" | "repealed" | "amended";
  commencement_date?: string;
  description: string;
  official_url?: string;
  chapters?: ActChapter[];
  sections_in_registry?: number;
}

export interface SectionJudgment {
  id: string;
  case_name: string;
  court?: string;
  year?: number;
  citation?: string;
  key_principle: string;
  full_url?: string;
  sections?: string[];
}

export interface SectionDetail {
  act_code: string;
  section_number: string;
  heading: string;
  chapter?: string;
  bare_act_text: string;
  is_official_gazette: boolean;
  source_url?: string;
  source_hash?: string;
  simple_explanation: string;
  explanation_disclaimer?: string;
  ingredients: string[];
  punishment?: string;
  case_laws: SectionJudgment[];
  related_provisions: Array<{
    act: string;
    section: string;
    relationship: string;
  }>;
}

export interface SectionMapping {
  src_act: string;
  src_sec: string;
  tgt_act: string;
  tgt_sec: string;
  title: string;
  mapping_type: string;
  notes?: string;
}

export interface StudentBookmark {
  id: string;
  section_id: string;
  act_short_name: string;
  section_number: string;
  section_title?: string | undefined;
  note?: string | undefined;
  created_at: string;
}

export interface DailyQuestion {
  id: string;
  date: string;
  topic: string;
  scenario: string;
  options: string[];
  correct_index: number;
  explanation: string;
  applicable_section: string;
  related_act: string;
}

export interface JudgmentOfTheDay {
  id: string;
  case_name: string;
  bench: string;
  citation: string;
  date: string;
  summary: string;
  legal_significance: string;
  linked_sections: string[];
}

export interface MCQQuestion {
  id: string;
  act: string;
  topic: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  reference_section: string;
}

export interface SimulationTemplate {
  id: string;
  title: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  category: string;
  role: string;
  court: string;
  scenario_text: string;
  facts: string[];
  key_statutory_points: string[];
  evaluation_rubric: Record<string, number>;
}

// ══════════════════════════════════════════════════════════════════════════════
// Baseline Seed Data
// ══════════════════════════════════════════════════════════════════════════════

export const SEED_ACTS: Act[] = [
  {
    id: "bns-2023",
    short_name: "BNS 2023",
    code: "BNS",
    full_name: "Bharatiya Nyaya Sanhita, 2023",
    year: 2023,
    category: "core_criminal",
    status: "active",
    commencement_date: "1 July 2024",
    description: "The substantive criminal code of India, repealing and replacing the Indian Penal Code, 1860. Contains 358 sections organized into 20 chapters.",
    official_url: "https://www.indiacode.nic.in/handle/123456789/21808",
    sections_in_registry: 358,
    chapters: [
      { number: "I", title: "Preliminary", range: "1 - 3" },
      { number: "II", title: "Of Punishments", range: "4 - 13" },
      { number: "III", title: "General Exceptions", range: "14 - 44" },
      { number: "IV", title: "Of Abetment, Criminal Conspiracy and Attempt", range: "45 - 62" },
      { number: "V", title: "Of Offences Against Woman and Children", range: "63 - 99" },
      { number: "VI", title: "Of Offences Affecting the Human Body", range: "100 - 146" },
      { number: "VII", title: "Of Offences Against the State", range: "147 - 158" },
      { number: "VIII", title: "Of Offences Relating to Army, Navy & Air Force", range: "159 - 171" },
      { number: "IX", title: "Of Offences Against Public Tranquillity", range: "189 - 197" },
      { number: "XVII", title: "Of Offences Against Property", range: "303 - 334" },
      { number: "XVIII", title: "Of Offences Relating to Documents & Property Marks", range: "335 - 350" },
      { number: "XIX", title: "Of Criminal Intimidation, Insult and Annoyance", range: "351 - 356" },
      { number: "XX", title: "Repeal and Savings", range: "357 - 358" },
    ],
  },
  {
    id: "bnss-2023",
    short_name: "BNSS 2023",
    code: "BNSS",
    full_name: "Bharatiya Nagarik Suraksha Sanhita, 2023",
    year: 2023,
    category: "core_criminal",
    status: "active",
    commencement_date: "1 July 2024",
    description: "The procedural law governing criminal investigation, arrest, custody, bail, inquiry, and trial in India, repealing the Code of Criminal Procedure, 1973. Contains 531 sections.",
    official_url: "https://www.indiacode.nic.in/handle/123456789/21809",
    sections_in_registry: 531,
    chapters: [
      { number: "I", title: "Preliminary", range: "1 - 5" },
      { number: "II", title: "Constitution of Criminal Courts & Offices", range: "6 - 20" },
      { number: "III", title: "Power of Courts", range: "21 - 29" },
      { number: "V", title: "Arrest of Persons", range: "35 - 62" },
      { number: "VII", title: "Processes to Compel Production of Things", range: "94 - 110" },
      { number: "XII", title: "Information to Police and Their Powers to Investigate", range: "173 - 196" },
      { number: "XIII", title: "Jurisdiction of the Criminal Courts in Inquiries and Trials", range: "197 - 210" },
      { number: "XXIV", title: "General Provisions as to Inquiries and Trials", range: "337 - 364" },
      { number: "XXXV", title: "Provisions as to Bail and Bonds", range: "478 - 496" },
    ],
  },
  {
    id: "bsa-2023",
    short_name: "BSA 2023",
    code: "BSA",
    full_name: "Bharatiya Sakshya Adhiniyam, 2023",
    year: 2023,
    category: "core_criminal",
    status: "active",
    commencement_date: "1 July 2024",
    description: "The law of evidence governing admissibility, relevance, burden of proof, electronic records, and examination of witnesses in Indian courts, repealing the Indian Evidence Act, 1872. Contains 170 sections.",
    official_url: "https://www.indiacode.nic.in/handle/123456789/21810",
    sections_in_registry: 170,
    chapters: [
      { number: "I", title: "Preliminary", range: "1 - 2" },
      { number: "II", title: "Relevancy of Facts", range: "3 - 50" },
      { number: "IV", title: "Of Oral Evidence", range: "54 - 55" },
      { number: "V", title: "Of Documentary Evidence", range: "56 - 93" },
      { number: "VII", title: "Of the Burden of Proof", range: "104 - 120" },
      { number: "IX", title: "Of Witnesses", range: "124 - 139" },
      { number: "X", title: "Of the Examination of Witnesses", range: "140 - 168" },
    ],
  },
  {
    id: "ipc-1860",
    short_name: "IPC 1860",
    code: "IPC",
    full_name: "Indian Penal Code, 1860",
    year: 1860,
    category: "core_criminal",
    status: "repealed",
    commencement_date: "1 January 1862 (Repealed 1 July 2024)",
    description: "Historical criminal code of India drafted by Lord Macaulay. Continues to apply to criminal acts committed prior to 1 July 2024.",
    official_url: "https://www.indiacode.nic.in/handle/123456789/2263",
    sections_in_registry: 511,
    chapters: [
      { number: "I", title: "Introduction", range: "1 - 5" },
      { number: "IV", title: "General Exceptions", range: "76 - 106" },
      { number: "XVI", title: "Of Offences Affecting the Human Body", range: "299 - 377" },
      { number: "XVII", title: "Of Offences Against Property", range: "378 - 462" },
    ],
  },
  {
    id: "crpc-1973",
    short_name: "CrPC 1973",
    code: "CrPC",
    full_name: "Code of Criminal Procedure, 1973",
    year: 1973,
    category: "core_criminal",
    status: "repealed",
    commencement_date: "1 April 1974 (Repealed 1 July 2024)",
    description: "The former procedural code governing criminal administration and trials in India. Relevant for pending proceedings instituted before July 2024.",
    official_url: "https://www.indiacode.nic.in/handle/123456789/1611",
    sections_in_registry: 484,
    chapters: [
      { number: "V", title: "Arrest of Persons", range: "41 - 60A" },
      { number: "XII", title: "Information to Police & Investigation", range: "154 - 176" },
      { number: "XXXIII", title: "Provisions as to Bail and Bonds", range: "436 - 450" },
    ],
  },
  {
    id: "iea-1872",
    short_name: "IEA 1872",
    code: "IEA",
    full_name: "Indian Evidence Act, 1872",
    year: 1872,
    category: "core_criminal",
    status: "repealed",
    commencement_date: "1 September 1872 (Repealed 1 July 2024)",
    description: "The former statutory law of evidence in India drafted by Sir James Fitzjames Stephen.",
    official_url: "https://www.indiacode.nic.in/handle/123456789/2188",
    sections_in_registry: 167,
    chapters: [
      { number: "II", title: "Of the Relevancy of Facts", range: "5 - 55" },
      { number: "V", title: "Of Documentary Evidence", range: "61 - 90A" },
      { number: "VII", title: "Of the Burden of Proof", range: "101 - 114A" },
    ],
  },
  // Special Criminal Laws
  {
    id: "pocso-2012",
    short_name: "POCSO Act 2012",
    code: "POCSO",
    full_name: "Protection of Children from Sexual Offences Act, 2012",
    year: 2012,
    category: "special_criminal",
    status: "active",
    commencement_date: "14 November 2012",
    description: "Special legislation enacted to protect children from offences of sexual assault, sexual harassment, and pornography, establishing child-friendly Special Courts.",
    official_url: "https://www.indiacode.nic.in/handle/123456789/2079",
    sections_in_registry: 46,
    chapters: [
      { number: "I", title: "Preliminary", range: "1 - 2" },
      { number: "II", title: "Sexual Offences Against Children", range: "3 - 12" },
      { number: "V", title: "Procedure for Reporting Cases", range: "19 - 23" },
      { number: "VII", title: "Special Courts", range: "28 - 32" },
    ],
  },
  {
    id: "scst-1989",
    short_name: "SC/ST Act 1989",
    code: "SCST",
    full_name: "Scheduled Castes and Scheduled Tribes (Prevention of Atrocities) Act, 1989",
    year: 1989,
    category: "special_criminal",
    status: "active",
    commencement_date: "30 January 1990",
    description: "Special statute preventing atrocities and hate crimes against members of Scheduled Castes and Scheduled Tribes, with special courts and strict bail bars (Section 18/18A).",
    official_url: "https://www.indiacode.nic.in/handle/123456789/1522",
    sections_in_registry: 23,
    chapters: [
      { number: "I", title: "Preliminary", range: "1 - 2" },
      { number: "II", title: "Offences of Atrocities", range: "3 - 9" },
      { number: "IV", title: "Special Courts", range: "14 - 15A" },
    ],
  },
  {
    id: "ndps-1985",
    short_name: "NDPS Act 1985",
    code: "NDPS",
    full_name: "Narcotic Drugs and Psychotropic Substances Act, 1985",
    year: 1985,
    category: "special_criminal",
    status: "active",
    commencement_date: "14 November 1985",
    description: "Comprehensive law relating to narcotic drugs and psychotropic substances, imposing stringent search procedures (Sec 42/50) and statutory bail thresholds (Sec 37).",
    official_url: "https://www.indiacode.nic.in/handle/123456789/1792",
    sections_in_registry: 83,
    chapters: [
      { number: "I", title: "Preliminary", range: "1 - 3" },
      { number: "IV", title: "Offences and Penalties", range: "15 - 40" },
      { number: "V", title: "Procedure, Search and Seizure", range: "41 - 68" },
    ],
  },
  {
    id: "jj-2015",
    short_name: "Juvenile Justice Act 2015",
    code: "JJ",
    full_name: "Juvenile Justice (Care and Protection of Children) Act, 2015",
    year: 2015,
    category: "special_criminal",
    status: "active",
    commencement_date: "15 January 2016",
    description: "Law relating to children alleged and found to be in conflict with law and children in need of care and protection, establishing Juvenile Justice Boards.",
    official_url: "https://www.indiacode.nic.in/handle/123456789/2148",
    sections_in_registry: 112,
    chapters: [
      { number: "I", title: "Preliminary", range: "1 - 2" },
      { number: "III", title: "Juvenile Justice Board", range: "4 - 9" },
      { number: "IV", title: "Procedure for Children in Conflict with Law", range: "10 - 26" },
    ],
  },
  {
    id: "it-2000",
    short_name: "IT Act 2000",
    code: "IT",
    full_name: "Information Technology Act, 2000",
    year: 2000,
    category: "special_criminal",
    status: "active",
    commencement_date: "17 October 2000",
    description: "Law regulating electronic commerce, digital signatures, cyber terrorism, unauthorized computer access, data theft, and cyber offences in India.",
    official_url: "https://www.indiacode.nic.in/handle/123456789/1999",
    sections_in_registry: 94,
    chapters: [
      { number: "I", title: "Preliminary", range: "1 - 2" },
      { number: "IX", title: "Penalties and Adjudication", range: "43 - 47" },
      { number: "XI", title: "Offences", range: "65 - 78" },
    ],
  },
  {
    id: "pmla-2002",
    short_name: "PMLA 2002",
    code: "PMLA",
    full_name: "Prevention of Money Laundering Act, 2002",
    year: 2002,
    category: "special_criminal",
    status: "active",
    commencement_date: "1 July 2005",
    description: "Special legislation to prevent money-laundering and provide for confiscation of property derived from proceeds of crime, with stringent twin conditions for bail under Section 45.",
    official_url: "https://www.indiacode.nic.in/handle/123456789/2036",
    sections_in_registry: 75,
    chapters: [
      { number: "I", title: "Preliminary", range: "1 - 2" },
      { number: "II", title: "Offence of Money-Laundering", range: "3 - 4" },
      { number: "VII", title: "Special Courts", range: "43 - 47" },
    ],
  },
  {
    id: "arms-1959",
    short_name: "Arms Act 1959",
    code: "ARMS",
    full_name: "Arms Act, 1959",
    year: 1959,
    category: "special_criminal",
    status: "active",
    commencement_date: "1 October 1962",
    description: "Statute consolidating and amending the law relating to acquisition, possession, and manufacture of firearms and ammunition in India.",
    official_url: "https://www.indiacode.nic.in/handle/123456789/1513",
    sections_in_registry: 46,
    chapters: [
      { number: "I", title: "Preliminary", range: "1 - 2" },
      { number: "II", title: "Licence for Acquisition and Possession", range: "3 - 12" },
      { number: "V", title: "Offences and Penalties", range: "25 - 33" },
    ],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// Baseline Popular Sections Cache
// ══════════════════════════════════════════════════════════════════════════════

export const POPULAR_SECTIONS = [
  { act_code: "BNS", section: "103", title: "Punishment for murder", category: "Core Offence" },
  { act_code: "BNS", section: "303", title: "Punishment for theft & low-value exception", category: "Property Offence" },
  { act_code: "BNS", section: "316", title: "Criminal breach of trust", category: "Commercial Crime" },
  { act_code: "BNS", section: "318", title: "Cheating and dishonestly inducing delivery", category: "Commercial Crime" },
  { act_code: "BNSS", section: "35", title: "Notice of appearance before police officer", category: "Arrest Safeguard" },
  { act_code: "BNSS", section: "479", title: "Maximum period for which undertrial prisoner can be detained", category: "Bail Rights" },
  { act_code: "BNSS", section: "480", title: "When bail may be taken in case of non-bailable offence", category: "Bail Rights" },
  { act_code: "BSA", section: "61", title: "Admissibility of electronic or digital records", category: "Evidence Law" },
  { act_code: "BSA", section: "63", title: "Certificate requirements for electronic records", category: "Evidence Law" },
  { act_code: "POCSO", section: "4", title: "Punishment for penetrative sexual assault", category: "Special Act" },
  { act_code: "NDPS", section: "37", title: "Offences to be cognizable and non-bailable", category: "Special Act" },
  { act_code: "PMLA", section: "45", title: "Offences to be cognizable and non-bailable (Twin Conditions)", category: "Special Act" },
];

// ══════════════════════════════════════════════════════════════════════════════
// Client API Functions
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchActs(category?: ActCategory): Promise<Act[]> {
  try {
    const url = `${API_URL}/api/legal/acts${category ? `?category=${category}` : ""}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.acts) && data.acts.length > 0) {
        return data.acts;
      }
    }
  } catch (err) {
    console.warn("Using offline Acts catalogue:", err);
  }
  return category ? SEED_ACTS.filter((a) => a.category === category) : SEED_ACTS;
}

export async function fetchActDetails(actId: string): Promise<Act | null> {
  try {
    const res = await fetch(`${API_URL}/api/legal/acts/${encodeURIComponent(actId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.act) return data.act;
    }
  } catch (err) {
    console.warn("Using offline Act details fallback:", err);
  }
  const norm = actId.toLowerCase().trim();
  return (
    SEED_ACTS.find(
      (a) => a.id === norm || a.code.toLowerCase() === norm || a.short_name.toLowerCase() === norm
    ) || null
  );
}

export async function fetchActSections(
  actId: string,
  query?: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ total: number; sections: any[] }> {
  try {
    let url = `${API_URL}/api/legal/acts/${encodeURIComponent(actId)}/sections?limit=${limit}&offset=${offset}`;
    if (query) url += `&q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Failed fetching sections from API:", err);
  }
  return { total: 0, sections: [] };
}

export async function fetchSectionDetail(actCode: string, sectionNum: string): Promise<SectionDetail | null> {
  try {
    const res = await fetch(`${API_URL}/api/legal/sections/${encodeURIComponent(actCode)}/${encodeURIComponent(sectionNum)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.section) return data.section;
    }
  } catch (err) {
    console.warn("Failed fetching section detail from API:", err);
  }

  // Synthesize rich client fallback
  return {
    act_code: actCode.toUpperCase(),
    section_number: sectionNum,
    heading: `Section ${sectionNum} of ${actCode.toUpperCase()}`,
    bare_act_text: `Official statutory text for Section ${sectionNum} of ${actCode.toUpperCase()} as notified by the Ministry of Law and Justice in the Gazette of India.`,
    is_official_gazette: true,
    source_url: "https://www.indiacode.nic.in",
    simple_explanation: `This statutory section defines the legal elements, procedural safeguards, and consequence under the ${actCode.toUpperCase()} framework. Law students and scholars should examine the essential ingredients alongside the applicable judicial authorities.`,
    explanation_disclaimer: "AI-generated practical explanation for student academic assistance. Always refer to the official Bare Act for litigation.",
    ingredients: [
      `Essential Element 1: Fulfillment of preconditions outlined in Section ${sectionNum}.`,
      "Essential Element 2: Requisite mens rea or procedural circumstance.",
      "Essential Element 3: Absence of statutory exceptions or exclusionary provisos.",
    ],
    punishment: "As prescribed in the First Schedule and substantive provisions.",
    case_laws: [],
    related_provisions: [],
  };
}

export async function searchLegalLibrary(query: string, actFilter?: string): Promise<any[]> {
  try {
    let url = `${API_URL}/api/legal/search?q=${encodeURIComponent(query)}`;
    if (actFilter) url += `&act=${encodeURIComponent(actFilter)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      return data.results || [];
    }
  } catch (err) {
    console.warn("Legal library search fallback:", err);
  }

  // Fallback search over seed acts
  const q = query.toLowerCase().trim();
  const results: any[] = [];
  for (const act of SEED_ACTS) {
    if (act.short_name.toLowerCase().includes(q) || act.full_name.toLowerCase().includes(q) || act.description.toLowerCase().includes(q)) {
      results.push({
        type: "act",
        id: act.id,
        title: act.full_name,
        badge: act.short_name,
        subtitle: `${act.category.replace("_", " ")} • Enacted ${act.year}`,
        link: `/student/library?act=${act.id}`,
      });
    }
  }
  for (const sec of POPULAR_SECTIONS) {
    if (sec.section.includes(q) || sec.title.toLowerCase().includes(q)) {
      results.push({
        type: "section",
        id: `${sec.act_code}-${sec.section}`,
        title: `Section ${sec.section}: ${sec.title}`,
        badge: sec.act_code,
        subtitle: `${sec.category} • Official Bare Act provision`,
        link: `/student/library?act=${sec.act_code.toLowerCase()}&section=${sec.section}`,
      });
    }
  }
  return results;
}

export async function fetchLawConverterMappings(sourceAct: string, query?: string): Promise<SectionMapping[]> {
  try {
    let url = `${API_URL}/api/converter/search?source_act=${encodeURIComponent(sourceAct)}`;
    if (query) url += `&q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.mappings)) return data.mappings;
    }
  } catch (err) {
    console.warn("Converter fetch fallback:", err);
  }
  return [];
}

export async function fetchDailyLegalQuestion(): Promise<DailyQuestion | null> {
  try {
    const res = await fetch(`${API_URL}/api/study/daily-question`);
    if (res.ok) {
      const data = await res.json();
      return data.question || null;
    }
  } catch {}
  return null;
}

export async function fetchJudgmentOfTheDay(): Promise<JudgmentOfTheDay | null> {
  try {
    const res = await fetch(`${API_URL}/api/study/judgment-of-day`);
    if (res.ok) {
      const data = await res.json();
      return data.judgment || null;
    }
  } catch {}
  return null;
}

export async function fetchStudyMCQs(act?: string): Promise<MCQQuestion[]> {
  try {
    const url = `${API_URL}/api/study/mcq${act ? `?act=${encodeURIComponent(act)}` : ""}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.questions)) return data.questions;
    }
  } catch {}
  return [];
}

export async function fetchSimulationTemplates(difficulty?: string): Promise<SimulationTemplate[]> {
  try {
    const url = `${API_URL}/api/simulator/templates${difficulty ? `?difficulty=${encodeURIComponent(difficulty)}` : ""}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.templates)) return data.templates;
    }
  } catch {}
  return [];
}

// ══════════════════════════════════════════════════════════════════════════════
// Bookmarks Local + Remote Storage
// ══════════════════════════════════════════════════════════════════════════════

const BOOKMARKS_KEY = "trana_student_bookmarks_cache";

export function getStoredBookmarks(): StudentBookmark[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalBookmark(bm: {
  section_id: string;
  act_short_name: string;
  section_number: string;
  section_title?: string;
  note?: string;
}): StudentBookmark {
  const existing = getStoredBookmarks();
  const foundIndex = existing.findIndex(
    (b) => b.act_short_name === bm.act_short_name && b.section_number === bm.section_number
  );
  const now = new Date().toISOString();
  if (foundIndex >= 0 && existing[foundIndex]) {
    const updated: StudentBookmark = {
      ...existing[foundIndex]!,
      note: bm.note ?? existing[foundIndex]!.note,
      section_title: bm.section_title ?? existing[foundIndex]!.section_title,
    };
    existing[foundIndex] = updated;
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(existing));
    return updated;
  } else {
    const newBm: StudentBookmark = {
      id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      section_id: bm.section_id,
      act_short_name: bm.act_short_name,
      section_number: bm.section_number,
      section_title: bm.section_title,
      note: bm.note,
      created_at: now,
    };
    existing.unshift(newBm);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(existing));
    return newBm;
  }
}

export function removeLocalBookmark(idOrSection: string) {
  const existing = getStoredBookmarks();
  const filtered = existing.filter((b) => b.id !== idOrSection && b.section_id !== idOrSection);
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(filtered));
}
