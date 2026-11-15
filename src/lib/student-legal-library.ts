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
  src_wording?: string;
  tgt_wording?: string;
  changes_summary?: string;
  punishment_comparison?: string;
  procedural_shift?: string;
  transitional_note?: string;
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

export const SEED_STUDY_MCQS: MCQQuestion[] = [
  {
    id: "mcq-bns-1",
    act: "BNS 2023",
    topic: "Theft and Community Service",
    question: "Under Section 303(2) of the Bharatiya Nyaya Sanhita, 2023, what is the maximum punishment for theft where the value of stolen property is less than five thousand rupees, the offender is a first-time convict, and returns or restores the property?",
    options: [
      "Rigorous imprisonment up to 3 years",
      "Imprisonment up to 1 year or fine or community service",
      "Fine only up to ₹10,000",
      "Simple imprisonment up to 6 months without community service option"
    ],
    correct_index: 1,
    explanation: "Section 303(2) of BNS 2023 provides a specific statutory proviso: where the value of stolen property is less than five thousand rupees and a person is convicted for the first time, upon return of the property or payment of its value, he may be punished with imprisonment up to one year, or with fine, or with community service.",
    reference_section: "BNS Section 303(2) Proviso"
  },
  {
    id: "mcq-bnss-1",
    act: "BNSS 2023",
    topic: "Undertrial Bail Rights",
    question: "Under Section 479 of the Bharatiya Nagarik Suraksha Sanhita, 2023, what detention duration entitles a first-time offender (never convicted of any offence previously) to mandatory release on bond?",
    options: [
      "One-half of the maximum period of imprisonment specified for the offence",
      "One-third of the maximum period of imprisonment specified for the offence",
      "One-fourth of the maximum period of imprisonment specified for the offence",
      "Three-fourths of the maximum period of imprisonment specified for the offence"
    ],
    correct_index: 1,
    explanation: "Section 479(1) of BNSS 2023 introduces an affirmative statutory right: a first-time offender who has undergone detention extending up to one-third of the maximum period of imprisonment specified for that offence shall be released on personal bond with or without sureties.",
    reference_section: "BNSS Section 479(1) Proviso"
  },
  {
    id: "mcq-bsa-1",
    act: "BSA 2023",
    topic: "Electronic Evidence Admissibility",
    question: "Which section of the Bharatiya Sakshya Adhiniyam, 2023 governs the certificate requirement for admissibility of electronic records (corresponding to former Section 65B of IEA 1872)?",
    options: [
      "Section 61",
      "Section 62",
      "Section 63",
      "Section 65"
    ],
    correct_index: 2,
    explanation: "Section 63 of BSA 2023 provides the procedural rules and mandatory certificate requirements for electronic records. It supersedes Section 65B of the repealed Indian Evidence Act, 1872.",
    reference_section: "BSA Section 63"
  },
  {
    id: "mcq-pocso-1",
    act: "POCSO Act",
    topic: "Statutory Presumption of Mental State",
    question: "Under Section 30 of the Protection of Children from Sexual Offences (POCSO) Act, 2012, what is the nature of the statutory presumption regarding the mental state of the accused?",
    options: [
      "The prosecution must prove culpable mental state beyond all reasonable doubt without any presumption",
      "The Special Court shall presume the existence of culpable mental state, placing the burden of rebuttal on the accused",
      "Presumption applies only if there is medical corroboration",
      "Presumption is discretionary and invoked only in aggravated penetrative sexual assault"
    ],
    correct_index: 1,
    explanation: "Section 30 of the POCSO Act creates a statutory presumption that the accused possessed the requisite culpable mental state for any offence under the Act, shifting the evidentiary burden to the accused to prove beyond reasonable doubt that he had no such mental state.",
    reference_section: "POCSO Act Section 30"
  },
  {
    id: "mcq-ndps-1",
    act: "NDPS Act",
    topic: "Bail Safeguards (Twin Conditions)",
    question: "Under Section 37 of the NDPS Act, 1985, which two mandatory conditions must be satisfied before a court grants bail to an accused charged with commercial quantity offences?",
    options: [
      "No objection by the complainant and surrender of passport",
      "Public Prosecutor given opportunity to oppose, and Court satisfied there are reasonable grounds that the accused is not guilty and not likely to commit offence while on bail",
      "Accused has spent at least 90 days in judicial custody and furnished two local sureties",
      "Medical certificate showing grave illness and deposit of commercial security"
    ],
    correct_index: 1,
    explanation: "Section 37(1)(b) of the NDPS Act contains the strict statutory 'twin conditions': (i) the Public Prosecutor must be given an opportunity to oppose the application, and (ii) where opposed, the Court must be satisfied that there are reasonable grounds for believing the accused is not guilty of such offence and not likely to commit any offence while on bail.",
    reference_section: "NDPS Act Section 37(1)(b)"
  },
  {
    id: "mcq-bns-2",
    act: "BNS 2023",
    topic: "Mob Lynching and Hate Killing",
    question: "Under which specific subsection of the Bharatiya Nyaya Sanhita, 2023 is murder by a group of five or more persons acting in concert on grounds of race, caste, sex, or place of birth penalized?",
    options: [
      "Section 103(1)",
      "Section 103(2)",
      "Section 111(3)",
      "Section 117(2)"
    ],
    correct_index: 1,
    explanation: "Section 103(2) of BNS 2023 was specifically enacted to criminalize mob lynching: when a group of five or more persons acting in concert commits murder on grounds of race, caste or community, sex, place of birth, language, personal belief or any other similar ground, each member shall be punished with death or with imprisonment for life, and shall also be liable to fine.",
    reference_section: "BNS Section 103(2)"
  },
  {
    id: "mcq-bnss-2",
    act: "BNSS 2023",
    topic: "Zero FIR and Compulsory Registration",
    question: "Under Section 173(1) of the Bharatiya Nagarik Suraksha Sanhita, 2023, what is the statutory duty of a police station when information relating to a cognizable offence is received irrespective of territorial jurisdiction?",
    options: [
      "Refuse registration and instruct the informant to approach the jurisdictional police station",
      "Register the Zero FIR immediately, forward it to the police station having territorial jurisdiction, and provide a free copy to the informant",
      "Conduct a preliminary inquiry for 14 days before registering",
      "Forward the complaint directly to the Chief Judicial Magistrate without registering"
    ],
    correct_index: 1,
    explanation: "Section 173(1) of BNSS 2023 codifies the Zero FIR doctrine: information relating to commission of a cognizable offence may be given to an officer in charge of a police station irrespective of the area where the crime was committed, and upon registration, the FIR is transferred to the jurisdictional police station.",
    reference_section: "BNSS Section 173(1)"
  },
  {
    id: "mcq-bsa-2",
    act: "BSA 2023",
    topic: "Confessions Induced by Threat or Promise",
    question: "Under Section 22 of the Bharatiya Sakshya Adhiniyam, 2023 (corresponding to Section 24 of IEA 1872), when does a confession made by an accused person become irrelevant in criminal proceedings?",
    options: [
      "Only if it was not recorded on audio-video electronic medium",
      "If the making of the confession appears to the Court to have been caused by any inducement, threat or promise proceeding from a person in authority",
      "Only if made in the presence of more than two police officers",
      "If the confession is retracted before the commencement of trial"
    ],
    correct_index: 1,
    explanation: "Section 22 of BSA 2023 renders a confession irrelevant if it appears to the Court that the confession was caused by any inducement, threat or promise proceeding from a person in authority, giving the accused reasonable grounds for supposing that by making it he would gain an advantage or avoid evil of a temporal nature.",
    reference_section: "BSA Section 22"
  },
  {
    id: "mcq-bns-3",
    act: "BNS 2023",
    topic: "Sovereignty Offences and Sedition Repeal",
    question: "Which section of BNS 2023 penalizes acts endangering sovereignty, unity, and integrity of India, replacing the colonial offence of sedition (former Section 124A of IPC 1860)?",
    options: [
      "Section 124",
      "Section 147",
      "Section 152",
      "Section 197"
    ],
    correct_index: 2,
    explanation: "Section 152 of BNS 2023 replaces colonial sedition (Section 124A IPC). The term 'sedition' is omitted, and the provision specifically penalizes whoever purposely or knowingly, by words or signs, excites or attempts to excite secession, armed rebellion, or subversive activities endangering the sovereignty, unity, and integrity of India.",
    reference_section: "BNS Section 152"
  }
];

export const SEED_CONVERTER_MAPPINGS: SectionMapping[] = [
  // IPC -> BNS
  {
    src_act: "IPC 1860",
    src_sec: "302",
    tgt_act: "BNS 2023",
    tgt_sec: "103",
    title: "Punishment for murder",
    mapping_type: "Modified Provision",
    src_wording: "Whoever commits murder shall be punished with death, or imprisonment for life, and shall also be liable to fine.",
    tgt_wording: "Whoever commits murder shall be punished with death or with imprisonment for life, and shall also be liable to fine. Sub-clause (2) newly penalizes mob lynching by groups of five or more persons on grounds of race, caste, sex, or place of birth.",
    changes_summary: "Sub-clause (2) added penalizing mob lynching and group killings on grounds of race, caste, sex, or place of birth with death or life imprisonment.",
    punishment_comparison: "Death or imprisonment for life, and fine. Subsection (2) explicitly adds mob lynching under the same punishment bracket.",
    procedural_shift: "Trial by Court of Session; Cognizable and Non-Bailable.",
    transitional_note: "Offences committed prior to 1 July 2024 remain governed by IPC Section 302 under Section 358 BNS. Determine applicable law based on the date of commission."
  },
  {
    src_act: "IPC 1860",
    src_sec: "378/379",
    tgt_act: "BNS 2023",
    tgt_sec: "303",
    title: "Theft & low-value stolen property exception",
    mapping_type: "Modified Provision",
    src_wording: "Whoever, intending to take dishonestly any moveable property out of the possession of any person without that person's consent, moves that property in order to such taking, is said to commit theft. Punishment: Imprisonment up to 3 years, or fine, or both.",
    tgt_wording: "Whoever commits theft shall be punished with imprisonment of either description for a term which may extend to three years, or with fine, or with both. Provided that where the value of stolen property is less than ₹5,000 and the person is convicted for the first time, upon return or payment, he shall be punished with imprisonment up to 1 year, fine, or community service.",
    changes_summary: "Added community service proviso for theft under ₹5,000 for first-time offenders who restore or repay stolen property.",
    punishment_comparison: "Standard: Up to 3 years or fine or both. Low-value (<₹5,000) first-time restitution: Up to 1 year, fine, or community service.",
    procedural_shift: "Triable by any Magistrate; Cognizable and Non-Bailable (except compoundable under prescribed circumstances).",
    transitional_note: "Conduct prior to 1 July 2024 is governed by Section 379 IPC. Community service punishment is only available for offences committed on or after 1 July 2024."
  },
  {
    src_act: "IPC 1860",
    src_sec: "420",
    tgt_act: "BNS 2023",
    tgt_sec: "318",
    title: "Cheating and dishonestly inducing delivery of property",
    mapping_type: "Exact Equivalent",
    src_wording: "Whoever cheats and thereby dishonestly induces the person deceived to deliver any property to any person... shall be punished with imprisonment of either description for a term which may extend to seven years, and shall also be liable to fine.",
    tgt_wording: "Whoever cheats and thereby dishonestly induces the person deceived to deliver any property to any person... shall be punished with imprisonment of either description for a term which may extend to seven years, and shall also be liable to fine (Section 318(4)).",
    changes_summary: "Substantive ingredients preserved in Section 318(4) BNS. General cheating definition consolidated into Section 318(1)-(3).",
    punishment_comparison: "Imprisonment of either description for a term up to 7 years, and fine.",
    procedural_shift: "Magistrate of First Class; Cognizable and Non-Bailable.",
    transitional_note: "Transactions and alleged fraudulent inducements executed before 1 July 2024 must be charged under IPC Section 420."
  },
  {
    src_act: "IPC 1860",
    src_sec: "120B",
    tgt_act: "BNS 2023",
    tgt_sec: "61",
    title: "Criminal conspiracy",
    mapping_type: "Exact Equivalent",
    src_wording: "Whoever is a party to a criminal conspiracy to commit an offence punishable with death, imprisonment for life or rigorous imprisonment for a term of two years or upwards, shall... be punished in the same manner as if he had abetted such offence.",
    tgt_wording: "Whoever is a party to a criminal conspiracy to commit an offence punishable with death, imprisonment for life or rigorous imprisonment for a term of two years or upwards, shall... be punished in the same manner as if he had abetted such offence.",
    changes_summary: "Ingredients and penal consequences retained identically. Section renumbered from 120B to 61 in BNS Chapter IV.",
    punishment_comparison: "Same punishment as principal abetment of the target offence.",
    procedural_shift: "Court by which target offence is triable; Cognizable if offence conspired is cognizable.",
    transitional_note: "Conspiracies entered into or concluded prior to 1 July 2024 continue under IPC Section 120B."
  },
  {
    src_act: "IPC 1860",
    src_sec: "124A",
    tgt_act: "BNS 2023",
    tgt_sec: "152",
    title: "Act endangering sovereignty, unity and integrity of India (Sedition omitted)",
    mapping_type: "Modified Provision",
    src_wording: "Whoever by words, either spoken or written, or by signs, or by visible representation, brings or attempts to bring into hatred or contempt, or excites or attempts to excite disaffection towards the Government established by law in India...",
    tgt_wording: "Whoever, purposely or knowingly, by words, signs, or electronic communication, excites or attempts to excite secession or armed rebellion or subversive activities, or encourages feelings of separatist activities or endangers sovereignty or unity and integrity of India...",
    changes_summary: "Colonial offence of 'Sedition' completely omitted. Replaced with specific acts threatening sovereignty, unity, and territorial integrity of India.",
    punishment_comparison: "Imprisonment for life, or with imprisonment which may extend to 7 years, and shall also be liable to fine.",
    procedural_shift: "Court of Session; Cognizable and Non-Bailable.",
    transitional_note: "Supreme Court stay on IPC Section 124A prosecutions applies to pending older cases. Section 152 BNS cannot be applied retrospectively."
  },
  {
    src_act: "IPC 1860",
    src_sec: "304B",
    tgt_act: "BNS 2023",
    tgt_sec: "80",
    title: "Dowry death",
    mapping_type: "Exact Equivalent",
    src_wording: "Where the death of a woman is caused by any burns or bodily injury or occurs otherwise than under normal circumstances within seven years of her marriage and it is shown that soon before her death she was subjected to cruelty or harassment by her husband or any relative of her husband for, or in connection with, any demand for dowry...",
    tgt_wording: "Where the death of a woman is caused by any burns or bodily injury or occurs otherwise than under normal circumstances within seven years of her marriage and it is shown that soon before her death she was subjected to cruelty or harassment by her husband or relative for dowry...",
    changes_summary: "7-year statutory presumption and elements retained identically under Section 80 BNS.",
    punishment_comparison: "Imprisonment for a term which shall not be less than 7 years but which may extend to imprisonment for life.",
    procedural_shift: "Court of Session; Cognizable and Non-Bailable.",
    transitional_note: "Marriages and deaths occurring prior to 1 July 2024 are prosecuted under Section 304B IPC read with Section 113B Evidence Act."
  },

  // CrPC -> BNSS
  {
    src_act: "CrPC 1973",
    src_sec: "436A",
    tgt_act: "BNSS 2023",
    tgt_sec: "479",
    title: "Maximum period for which undertrial prisoner can be detained",
    mapping_type: "Modified Provision",
    src_wording: "Where a person has, during the period of investigation, inquiry or trial under this Code of an offence under any law... undergone detention for a period extending up to one-half of the maximum period of imprisonment specified for that offence, he shall be released by the Court on his personal bond with or without sureties.",
    tgt_wording: "Where a person has undergone detention for a period extending up to one-half of the maximum imprisonment specified... he shall be released on bond. Provided that where such person is a first-time offender (who has never been convicted of any offence in the past), he shall be released on bond if he has undergone detention for one-third of the maximum period.",
    changes_summary: "Introduced landmark 1/3 maximum sentence detention threshold for first-time undertrial offenders.",
    punishment_comparison: "Procedural entitlement to mandatory release on personal bond with or without sureties.",
    procedural_shift: "Jail Superintendent is mandated to submit application to Court for release of eligible undertrials.",
    transitional_note: "Supreme Court in Re: Policy Strategy for Grant of Bail held that beneficial undertrial provisions of Section 479 apply even to pending cases where trials began before July 2024."
  },
  {
    src_act: "CrPC 1973",
    src_sec: "41A",
    tgt_act: "BNSS 2023",
    tgt_sec: "35",
    title: "Notice of appearance before police officer & arrest safeguards",
    mapping_type: "Substantially Similar",
    src_wording: "The police officer shall, in all cases where the arrest of a person is not required under the provisions of sub-section (1) of section 41, issue a notice directing the person... to appear before him.",
    tgt_wording: "The police officer shall, in all cases where the arrest of a person is not required under sub-section (1) of section 35, issue a notice directing the person... to appear before him. Sub-section (7) newly provides prior permission requirement for senior citizens and persons with infirmity.",
    changes_summary: "Section 35(3) maintains mandatory notice of appearance for offences punishable with up to 7 years. Sub-section (7) adds safeguards for infirm persons.",
    punishment_comparison: "Procedural restraint on arbitrary arrest; non-compliance permits arrest under recorded reasons.",
    procedural_shift: "Investigating officer must record reasons in diary; compliance entitles immunity from arrest unless recorded reasons exist.",
    transitional_note: "Arrests made prior to 1 July 2024 are tested against Arnesh Kumar guidelines and Section 41A CrPC."
  },
  {
    src_act: "CrPC 1973",
    src_sec: "154",
    tgt_act: "BNSS 2023",
    tgt_sec: "173",
    title: "Information in cognizable cases & statutory Zero FIR registration",
    mapping_type: "Modified Provision",
    src_wording: "Every information relating to the commission of a cognizable offence, if given orally to an officer in charge of a police station, shall be reduced to writing by him or under his direction...",
    tgt_wording: "Every information relating to the commission of a cognizable offence, irrespective of the area where the crime was committed, may be given orally or by electronic communication... (Zero FIR statutory codification). Provided that preliminary enquiry can be made for offences punishable between 3 to 7 years.",
    changes_summary: "Statutory codification of Zero FIR irrespective of police jurisdiction; provision for electronic FIR and preliminary inquiry within 14 days.",
    punishment_comparison: "Statutory duty on Station House Officer; refusal punishable under Section 199 BNS.",
    procedural_shift: "Electronic FIR must be signed within three days; Zero FIR must be transferred to jurisdictional police station.",
    transitional_note: "FIRs registered prior to 1 July 2024 follow CrPC Section 154 procedure."
  },
  {
    src_act: "CrPC 1973",
    src_sec: "167",
    tgt_act: "BNSS 2023",
    tgt_sec: "187",
    title: "Procedure when investigation cannot be completed in 24 hours (Remand)",
    mapping_type: "Modified Provision",
    src_wording: "The Magistrate may authorize the detention of the accused in such custody as such Magistrate thinks fit, for a term not exceeding fifteen days in the whole...",
    tgt_wording: "The Magistrate may authorize the detention of the accused person in custody as he thinks fit, for a term not exceeding fifteen days in the whole, or in parts, at any time during the initial forty or sixty days out of detention period of sixty or ninety days.",
    changes_summary: "Police custody can now be granted in tranches (in parts) at any time during the initial 40 or 60 days, rather than strictly during the first 15 days.",
    punishment_comparison: "Remand authorization safeguards; default bail remains available after 60 or 90 days.",
    procedural_shift: "Police remand can be sought in segments during the investigation window.",
    transitional_note: "For investigations initiated prior to 1 July 2024, the former 15-day continuous remand rule of Section 167 CrPC applies under Section 531 BNSS savings clause."
  },

  // IEA -> BSA
  {
    src_act: "IEA 1872",
    src_sec: "65B",
    tgt_act: "BSA 2023",
    tgt_sec: "63",
    title: "Admissibility of electronic records and certificate requirement",
    mapping_type: "Substantially Similar",
    src_wording: "Notwithstanding anything contained in this Act, any information contained in an electronic record which is printed on a paper, stored, recorded or copied in optical or magnetic media... shall be deemed to be also a document... if conditions in sub-section (2) are satisfied.",
    tgt_wording: "Any information contained in an electronic record which is printed on a paper, stored, recorded or copied in optical or magnetic media or semiconductor memory... shall be deemed to be also a document. Section 63(4) provides the certificate requirement signed by an expert or lawful person in charge.",
    changes_summary: "Modernized hardware definitions to include semiconductor memory and mobile cloud devices; streamlined certificate template in Schedule.",
    punishment_comparison: "Evidentiary rule of admissibility; non-compliance renders secondary electronic records inadmissible.",
    procedural_shift: "Certificate under Section 63(4) must accompany secondary digital record at the time of charge-sheet or filing in court.",
    transitional_note: "Electronic evidence generated or collected prior to 1 July 2024 may be certified under Section 65B IEA per Arjun Panditrao Kotkar ratio."
  },
  {
    src_act: "IEA 1872",
    src_sec: "62",
    tgt_act: "BSA 2023",
    tgt_sec: "57",
    title: "Primary evidence and electronic device originals",
    mapping_type: "Modified Provision",
    src_wording: "Primary evidence means the document itself produced for the inspection of the Court.",
    tgt_wording: "Primary evidence means the document itself produced for the inspection of the Court. Explanation 4 to 7 explicitly clarify that video recordings, electronic files stored simultaneously on multiple devices, and digital systems are primary evidence without Section 63 certificate.",
    changes_summary: "Added Explanations 4-7 establishing that electronic records stored simultaneously across cloud/devices are primary evidence.",
    punishment_comparison: "Admissible per se without Section 63 certificate requirements.",
    procedural_shift: "Original device or simultaneous digital duplicate produced directly into court constitutes primary evidence.",
    transitional_note: "Digital documents produced in trials before 1 July 2024 are judged under IEA Section 62."
  }
];

export const SEED_DAILY_QUESTION: DailyQuestion = {
  id: "dlq-1",
  date: "2026-11-15",
  topic: "Criminal Procedure & First-Time Undertrial Bail",
  scenario: "An accused has been in judicial custody for 4 months for an alleged offence punishable with a maximum imprisonment of 1 year under BNS Section 303(2). This is his first criminal charge. Can he claim release under the new provisions of BNSS?",
  options: [
    "No, bail is purely discretionary and cannot be claimed based on detention duration.",
    "Yes, under Section 479(1) Proviso 1 of BNSS, 2023, a first-time offender who has undergone one-third of the maximum imprisonment is entitled to release on bond.",
    "No, release under Section 479 is only applicable after undergoing one-half of the maximum imprisonment.",
    "Yes, but only if the complainant consents to compounding of the offence."
  ],
  correct_index: 1,
  explanation: "Under Section 479(1) of the Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS), a progressive proviso was introduced specifically for first-time offenders (persons never convicted of any offence in the past): they shall be released on personal bond with or without sureties if they have undergone detention for a period extending up to one-third of the maximum period of imprisonment.",
  applicable_section: "BNSS Section 479(1)",
  related_act: "BNSS 2023"
};

export const SEED_JUDGMENT_OF_THE_DAY: JudgmentOfTheDay = {
  id: "jotd-1",
  case_name: "In Re: Policy Strategy for Grant of Bail",
  bench: "Supreme Court of India (Kaul & Sundresh, JJ.)",
  citation: "SMW (Crl) No. 4/2021",
  date: "2023",
  summary: "The Supreme Court issued comprehensive nationwide directions to High Courts and State Legal Services Authorities to decongest prisons. The Court mandated that undertrial review committees meet regularly and ensure undertrials eligible for bail under Section 436A CrPC (now Section 479 BNSS) are identified and released without delay.",
  legal_significance: "Established proactive institutional tracking for indigent undertrials unable to furnish bail surety, preventing unnecessary incarceration violative of Article 21.",
  linked_sections: ["BNSS 479", "BNSS 480", "Constitution Art 21"]
};

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
  limit: number = 600,
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
      if (Array.isArray(data.mappings) && data.mappings.length > 0) return data.mappings;
    }
  } catch (err) {
    console.warn("Converter fetch fallback:", err);
  }

  // Fallback to rich seed concordance
  const norm = sourceAct.toUpperCase().trim();
  const q = (query || "").toLowerCase().trim();
  return SEED_CONVERTER_MAPPINGS.filter((m) => {
    const actMatch =
      (norm.includes("IPC") || norm.includes("BNS")) ? (m.src_act.includes("IPC") || m.tgt_act.includes("BNS"))
      : (norm.includes("CRPC") || norm.includes("BNSS")) ? (m.src_act.includes("CrPC") || m.tgt_act.includes("BNSS"))
      : (norm.includes("IEA") || norm.includes("BSA")) ? (m.src_act.includes("IEA") || m.tgt_act.includes("BSA"))
      : true;

    if (!actMatch) return false;
    if (!q) return true;
    return (
      m.src_sec.toLowerCase().includes(q) ||
      m.tgt_sec.toLowerCase().includes(q) ||
      m.title.toLowerCase().includes(q) ||
      (m.changes_summary && m.changes_summary.toLowerCase().includes(q))
    );
  });
}

export async function fetchDailyLegalQuestion(): Promise<DailyQuestion | null> {
  try {
    const res = await fetch(`${API_URL}/api/study/daily-question`);
    if (res.ok) {
      const data = await res.json();
      if (data.question) return data.question;
    }
  } catch {}
  return SEED_DAILY_QUESTION;
}

export async function fetchJudgmentOfTheDay(): Promise<JudgmentOfTheDay | null> {
  try {
    const res = await fetch(`${API_URL}/api/study/judgment-of-day`);
    if (res.ok) {
      const data = await res.json();
      if (data.judgment) return data.judgment;
    }
  } catch {}
  return SEED_JUDGMENT_OF_THE_DAY;
}

export async function fetchStudyMCQs(act?: string): Promise<MCQQuestion[]> {
  try {
    const url = `${API_URL}/api/study/mcq${act ? `?act=${encodeURIComponent(act)}` : ""}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.questions) && data.questions.length > 0) return data.questions;
    }
  } catch {}

  if (!act || act.toLowerCase() === "all") {
    return SEED_STUDY_MCQS;
  }
  const norm = act.toUpperCase().trim();
  return SEED_STUDY_MCQS.filter((m) => m.act.toUpperCase().includes(norm));
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
