/**
 * lawyer-groups.ts
 * Utility to group advocates by practice area (specialisation) and city/state.
 * Used by the AI chat and complaint analyser to suggest relevant advocates.
 */

export type LawyerRecord = {
  id: string;
  full_name: string;
  specialisation: string;
  city: string;
  state?: string;
  bar_reg_no?: string;
  experience_years?: number;
  consultation_fee?: number;
  offers_call?: boolean;
  offers_chat?: boolean;
  offers_in_person?: boolean;
  phone?: string;
  email?: string;
};

export type AdvocateGroup = {
  practiceArea: string;
  city: string;
  state: string;
  advocates: LawyerRecord[];
};

/**
 * Group advocates by practice area and city/state.
 * Returns an array sorted alphabetically by practiceArea, then city.
 */
export function groupLawyersByPracticeAndCity(lawyers: LawyerRecord[]): AdvocateGroup[] {
  const map = new Map<string, AdvocateGroup>();

  for (const lawyer of lawyers) {
    const practiceArea = lawyer.specialisation?.trim() || "General Practice";
    const city = lawyer.city?.trim() || "Unknown";
    const state = lawyer.state?.trim() || "";
    const key = `${practiceArea}|||${city}`;

    if (!map.has(key)) {
      map.set(key, { practiceArea, city, state, advocates: [] });
    }
    map.get(key)!.advocates.push(lawyer);
  }

  return Array.from(map.values()).sort((a, b) => {
    const pa = a.practiceArea.localeCompare(b.practiceArea);
    if (pa !== 0) return pa;
    return a.city.localeCompare(b.city);
  });
}

/**
 * Find advocates whose specialisation overlaps with the given keywords.
 * Returns sorted alphabetically by name within each matching group.
 */
export function findMatchingAdvocates(
  lawyers: LawyerRecord[],
  keywords: string[]
): LawyerRecord[] {
  const lower = keywords.map((k) => k.toLowerCase());

  const matched = lawyers.filter((l) => {
    const spec = (l.specialisation || "").toLowerCase();
    return lower.some((kw) => spec.includes(kw));
  });

  // Alphabetical by name — neutral, no ranking by rating/recommendation
  return matched.sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/**
 * Extract broad legal keywords from a complaint or chat message.
 * This is a simple heuristic — no AI call needed.
 */
export function extractLegalKeywords(text: string): string[] {
  const lowerText = text.toLowerCase();
  const keywordMap: Record<string, string[]> = {
    criminal: ["criminal", "murder", "theft", "robbery", "assault", "cheating", "fraud", "bail", "fir", "police"],
    "family law": ["divorce", "custody", "matrimonial", "maintenance", "alimony", "adoption", "domestic violence", "marriage"],
    "property law": ["property", "land", "real estate", "lease", "rent", "tenant", "landlord", "eviction", "registry", "mutation"],
    "labour law": ["employment", "labour", "worker", "salary", "termination", "workplace", "pf", "gratuity"],
    "consumer law": ["consumer", "refund", "deficiency", "product", "ecommerce", "online fraud"],
    "cyber law": ["cyber", "hacking", "data breach", "online", "social media", "it act", "phishing"],
    constitutional: ["constitutional", "fundamental rights", "article", "petition", "writ", "habeas corpus"],
    "civil law": ["civil", "injunction", "damages", "contract", "breach", "recovery"],
    taxation: ["tax", "income tax", "gst", "tds", "it department", "refund"],
    "intellectual property": ["patent", "trademark", "copyright", "ip", "plagiarism"],
    "corporate law": ["company", "corporate", "mca", "shareholder", "board", "merger"],
    banking: ["bank", "loan", "cheque", "npa", "emi", "credit", "debt"],
    immigration: ["visa", "passport", "immigration", "nri", "overseas"],
  };

  const matched: string[] = [];
  for (const [area, triggers] of Object.entries(keywordMap)) {
    if (triggers.some((t) => lowerText.includes(t))) {
      matched.push(area);
    }
  }

  return matched.length > 0 ? matched : ["general practice", "civil law"];
}

/**
 * NALSA Free Legal Aid helpline details.
 */
export const NALSA_HELPLINE = {
  number: "15100",
  name: "National Legal Services Authority (NALSA)",
  whatsappDraft: (name = "[Your Name]", district = "[Your District]", issue = "[brief description of your legal issue]") =>
    `Hello,\n\nI am ${name} from ${district}. I require free legal assistance regarding ${issue}.\n\nI am unable to afford a private advocate at this time. Could you please help me connect with a Legal Aid Advocate in my district?\n\nThank you for your service.\n\nRegards,\n${name}`,
  emailDraft: (name = "[Your Name]", district = "[Your District]", state = "[Your State]", issue = "[brief description of your legal issue]") =>
    `Subject: Request for Free Legal Aid — ${district}, ${state}\n\nTo,\nThe Secretary,\nDistrict Legal Services Authority,\n${district}, ${state}\n\nRespected Sir/Madam,\n\nI, ${name}, a resident of ${district}, ${state}, am writing to request free legal assistance under the Legal Services Authorities Act, 1987.\n\nBrief description of my legal matter:\n${issue}\n\nI am unable to afford private legal representation and earnestly request that a legal aid advocate be appointed to assist me.\n\nI am available for further communication and can provide any documents required.\n\nYours faithfully,\n${name}\n[Address]\n[Contact Number]`,
};

