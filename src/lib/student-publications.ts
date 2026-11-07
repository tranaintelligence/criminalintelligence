export type PublicationCategory =
  | "Research Paper"
  | "Moot Court Achievement"
  | "Article / Commentary"
  | "Academic Award"
  | "Case Note";

export interface StudentPublication {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string; // e.g. "5th Year B.A. LL.B. (Hons)" or "Legal Intern"
  authorCollege: string; // e.g. "National Law University Delhi"
  authorAvatar?: string;
  authorEmail?: string;
  title: string;
  category: PublicationCategory;
  abstract: string;
  fullContent?: string;
  tags: string[];
  externalLink?: string; // SSRN, SCC Online, LiveLaw, or DOI
  fileUrl?: string; // Uploaded PDF or Data URL
  fileName?: string;
  publishedAt: string;
  likesCount: number;
  likedBy: string[];
  citationsCount: number;
}

const STORAGE_KEY = "trana_student_publications_feed";

const SEED_PUBLICATIONS: StudentPublication[] = [
  {
    id: "pub-seed-1",
    authorId: "author-divya-sengupta",
    authorName: "Divya Sengupta",
    authorRole: "5th Year B.A. LL.B. (Hons)",
    authorCollege: "National Law University Delhi",
    authorEmail: "divya.sengupta@nludelhi.ac.in",
    title: "Decoupling Bail Jurisprudence under BNSS: A Critical Analysis of Section 479 & Statutory Incarceration",
    category: "Research Paper",
    abstract:
      "This paper critically examines the newly introduced Section 479 of the Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023, contrasting it with Section 436A of the Code of Criminal Procedure, 1973. Through an empirical assessment of undertrial demographics across Tihar and Arthur Road Central Jails, this work explores the practical implementation of maximum period detention rules for first-time offenders, highlighting constitutional friction against Article 21 guarantees.",
    fullContent: `Abstract & Working Thesis:
The transition from Section 436A CrPC to Section 479 BNSS represents one of the most contentious procedural overhauls in modern Indian criminal jurisprudence. While the proviso permitting release of first-time undertrial prisoners upon completion of one-third of the maximum sentence appears progressive on paper, the exclusionary clauses concerning multiple charges and heinous statutory offences introduce significant procedural bottlenecks.

Key Findings:
1. First-time offender classification: Section 479(1) Proviso 1 mandates release after one-third detention, yet judicial registries currently lack an automated pan-India database to certify absence of prior convictions or concurrent FIRs.
2. Judicial discretion vs. Statutory mandate: The use of the word 'may' versus 'shall' across the subsections continues to generate conflicting interpretations across various High Courts.
3. Comparative Benchmarking: Contrasting the Supreme Court's directives in In Re: Policy Strategy for Grant of Bail with the actual statutory text of Section 479 reveals urgent need for standard operating guidelines.`,
    tags: ["BNSS 2023", "Section 479", "Undertrial Rights", "Article 21", "Criminal Procedure"],
    externalLink: "https://ssrn.com/abstract=4829104",
    publishedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    likesCount: 28,
    likedBy: [],
    citationsCount: 12,
  },
  {
    id: "pub-seed-2",
    authorId: "author-ananya-sharma",
    authorName: "Ananya Sharma & Team",
    authorRole: "Legal Intern & Moot Court Convener",
    authorCollege: "National Law School of India University (NLSIU), Bengaluru",
    authorEmail: "ananyasharma@nls.ac.in",
    title: "Winners & Best Memorial: 18th K.K. Luthra Memorial National Criminal Law Moot Court Competition 2024",
    category: "Moot Court Achievement",
    abstract:
      "Honoured to announce that our delegation secured the Champion's Trophy and Best Written Memorial Award at the 18th K.K. Luthra Memorial Moot. The moot proposition centred upon algorithmic evidence in digital forensics, cross-border electronic seizure under Section 105 BNSS, and reverse burden clauses in economic offences.",
    fullContent: `Moot Court Competition Overview:
• Forum: Campus Law Centre & Delhi High Court Benches
• Bench Composition: Sitting High Court Justices and Senior Advocates
• Proposition Focus: State-sponsored algorithmic surveillance tools, warrantless decryption of peer-to-peer messaging under Section 94 BNSS, and evidentiary integrity of cryptographic hash verification under Section 63 Bharatiya Sakshya Adhiniyam (BSA).

Memorial Structure & Arguments:
- Maintainability: Admissibility of public interest writ petitions challenging automated penal algorithms before the Supreme Court under Article 32.
- Merits: Violations of Puttaswamy digital privacy doctrine and absence of algorithmic proportionality.
- Criminal Procedure: Non-compliance with chain of custody standards for digital hash identifiers.`,
    tags: ["Moot Court", "Best Memorial", "NLSIU", "Criminal Law", "BSA Section 63"],
    externalLink: "https://kkluthramoot.org/winners-2024",
    publishedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    likesCount: 44,
    likedBy: [],
    citationsCount: 9,
  },
  {
    id: "pub-seed-3",
    authorId: "author-rohan-deshmukh",
    authorName: "Rohan Deshmukh",
    authorRole: "Legal Intern at Chamber of Senior Advocate, Delhi High Court",
    authorCollege: "Faculty of Law, University of Delhi",
    authorEmail: "rohan.deshmukh@du.ac.in",
    title: "Evidentiary Admissibility of Electronic Records under Section 63 BSA 2023: Re-evaluating the Arjun Panditrao Ratio",
    category: "Article / Commentary",
    abstract:
      "A deep doctrinal commentary analyzing whether Section 63 of the Bharatiya Sakshya Adhiniyam, 2023 harmonizes or overrides the Supreme Court's three-judge bench ruling in Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal (2020) 7 SCC 1 concerning mandatory 65B certification.",
    fullContent: `Doctrinal Analysis:
The enactment of Section 63 of the Bharatiya Sakshya Adhiniyam, 2023 has generated immediate debate among trial litigators. By streamlining the conditions for secondary digital evidence and recognizing cloud repositories and hash values, the legislature attempted to simplify digital trials.

However, questions persist:
1. Is an accompanying certificate still indispensable where the original device is produced in court?
2. Does the omission of archaic terminology in Section 63(4) eliminate the need for intermediary custodian affidavits?
3. How do trial courts reconcile Section 63 BSA with contemporaneous WhatsApp chats extracted under Section 105 BNSS?`,
    tags: ["Evidence Law", "BSA Section 63", "Digital Forensics", "Arjun Panditrao", "Delhi High Court"],
    externalLink: "https://www.livelaw.in/columns/bsa-electronic-evidence",
    publishedAt: new Date(Date.now() - 11 * 86400000).toISOString(),
    likesCount: 35,
    likedBy: [],
    citationsCount: 16,
  },
  {
    id: "pub-seed-4",
    authorId: "author-priya-nair",
    authorName: "Priya Nair",
    authorRole: "4th Year Scholar (B.B.A. LL.B.)",
    authorCollege: "ILS Law College, Pune",
    authorEmail: "priya.nair@ilslaw.edu",
    title: "Corporate Criminal Liability & Sanctions under the Companies Act 2013 and BNS 2023: Emerging Jurisprudence",
    category: "Academic Award",
    abstract:
      "Awarded First Prize at the National Corporate & Securities Law Essay Competition organized by the Centre for Corporate Law. This study explores alter ego attribution, director indemnification, and the intersection between Section 316 BNS (Cheating) and Section 447 Companies Act.",
    fullContent: `Summary of Award-Winning Research:
Corporate criminal liability in India has evolved from the strict doctrine of mens rea impossibility to comprehensive alter ego attribution established in Iridium India Telecom. This paper evaluates the recent criminalization of misleading statements in corporate disclosures and investigates the procedural boundaries between SFIO investigations and police powers under Chapter XII BNSS.`,
    tags: ["Corporate Law", "Academic Award", "White Collar Crime", "BNS 2023", "ILS Pune"],
    publishedAt: new Date(Date.now() - 16 * 86400000).toISOString(),
    likesCount: 22,
    likedBy: [],
    citationsCount: 6,
  },
];

export function getStoredPublications(): StudentPublication[] {
  if (typeof window === "undefined") return SEED_PUBLICATIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_PUBLICATIONS));
      return SEED_PUBLICATIONS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_PUBLICATIONS));
    return SEED_PUBLICATIONS;
  } catch {
    return SEED_PUBLICATIONS;
  }
}

export function savePublication(
  pub: Omit<StudentPublication, "id" | "publishedAt" | "likesCount" | "likedBy" | "citationsCount">
): StudentPublication {
  const current = getStoredPublications();
  const newRecord: StudentPublication = {
    ...pub,
    id: "pub-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
    publishedAt: new Date().toISOString(),
    likesCount: 0,
    likedBy: [],
    citationsCount: 0,
  };
  const updated = [newRecord, ...current];
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("trana_publications_changed"));
  }
  return newRecord;
}

export function toggleLikePublication(pubId: string, userId: string): { likesCount: number; isLiked: boolean } {
  const current = getStoredPublications();
  let result = { likesCount: 0, isLiked: false };

  const updated = current.map((p) => {
    if (p.id !== pubId) return p;
    const liked = p.likedBy || [];
    const hasLiked = liked.includes(userId);
    let newLiked: string[];
    let newCount = p.likesCount || 0;

    if (hasLiked) {
      newLiked = liked.filter((id) => id !== userId);
      newCount = Math.max(0, newCount - 1);
      result = { likesCount: newCount, isLiked: false };
    } else {
      newLiked = [...liked, userId];
      newCount += 1;
      result = { likesCount: newCount, isLiked: true };
    }

    return {
      ...p,
      likesCount: newCount,
      likedBy: newLiked,
    };
  });

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("trana_publications_changed"));
  }
  return result;
}

export function generateBluebookCitation(pub: StudentPublication): string {
  const author = pub.authorName;
  const title = pub.title;
  const year = new Date(pub.publishedAt).getFullYear();
  const college = pub.authorCollege;
  return `${author}, "${title}", TRANA Legal Research Archive (${year}), affiliated with ${college}. Available at: ${pub.externalLink || "TRANA Scholar Network"}.`;
}

