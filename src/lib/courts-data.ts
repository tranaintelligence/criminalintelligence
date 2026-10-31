/**
 * Indian Judicial & Quasi-Judicial Courts Registry for Advocate Practice Profile.
 */

export const SUPREME_COURT = "Supreme Court of India";

export const ALL_HIGH_COURTS = [
  "Allahabad High Court",
  "Andhra Pradesh High Court",
  "Bombay High Court",
  "Calcutta High Court",
  "Chhattisgarh High Court",
  "Delhi High Court",
  "Gauhati High Court",
  "Gujarat High Court",
  "Himachal Pradesh High Court",
  "Jammu & Kashmir and Ladakh High Court",
  "Jharkhand High Court",
  "Karnataka High Court",
  "Kerala High Court",
  "Madhya Pradesh High Court",
  "Madras High Court",
  "Manipur High Court",
  "Meghalaya High Court",
  "Orissa High Court",
  "Patna High Court",
  "Punjab and Haryana High Court",
  "Rajasthan High Court",
  "Sikkim High Court",
  "Telangana High Court",
  "Tripura High Court",
  "Uttarakhand High Court",
] as const;

export const DISTRICT_COURTS_BY_STATE: Record<string, string[]> = {
  Delhi: [
    "Tis Hazari Courts (Central & West)",
    "Patiala House Courts (New Delhi)",
    "Saket Courts (South & South East)",
    "Karkardooma Courts (East, North East & Shahdara)",
    "Rohini Courts (North & North West)",
    "Dwarka Courts (South West)",
    "Rouse Avenue Court Complex (Special CBI & Corruption)",
  ],
  Maharashtra: [
    "City Civil & Sessions Court, Mumbai (Fort)",
    "Dindoshi Sessions Court (Mumbai Suburban)",
    "District & Sessions Court, Pune",
    "District & Sessions Court, Thane",
    "District & Sessions Court, Nagpur",
    "District & Sessions Court, Nashik",
    "District & Sessions Court, Aurangabad (Chhatrapati Sambhajinagar)",
    "District & Sessions Court, Navi Mumbai (Belapur)",
    "District & Sessions Court, Kolhapur",
    "District & Sessions Court, Solapur",
  ],
  "Uttar Pradesh": [
    "District & Sessions Court, Gautam Buddha Nagar (Noida)",
    "District & Sessions Court, Lucknow",
    "District & Sessions Court, Ghaziabad",
    "District & Sessions Court, Prayagraj (Allahabad)",
    "District & Sessions Court, Kanpur Nagar",
    "District & Sessions Court, Varanasi",
    "District & Sessions Court, Agra",
    "District & Sessions Court, Meerut",
    "District & Sessions Court, Aligarh",
    "District & Sessions Court, Gorakhpur",
  ],
  Karnataka: [
    "City Civil & Sessions Court, Bengaluru Urban",
    "District & Sessions Court, Bengaluru Rural",
    "District & Sessions Court, Mysuru",
    "District & Sessions Court, Mangaluru (Dakshina Kannada)",
    "District & Sessions Court, Dharwad / Hubballi",
    "District & Sessions Court, Belagavi",
    "District & Sessions Court, Kalaburagi",
  ],
  "Tamil Nadu": [
    "City Civil & Sessions Court, Chennai",
    "District & Sessions Court, Coimbatore",
    "District & Sessions Court, Madurai",
    "District & Sessions Court, Tiruchirappalli",
    "District & Sessions Court, Salem",
    "District & Sessions Court, Tirunelveli",
  ],
  "West Bengal": [
    "City Civil & Sessions Court, Kolkata",
    "Alipore District & Sessions Court (South 24 Parganas)",
    "Barasat District & Sessions Court (North 24 Parganas)",
    "District & Sessions Court, Howrah",
    "District & Sessions Court, Hooghly",
    "District & Sessions Court, Darjeeling / Siliguri",
  ],
  Telangana: [
    "City Civil & Sessions Court, Hyderabad",
    "District & Sessions Court, Ranga Reddy (L.B. Nagar)",
    "District & Sessions Court, Medchal-Malkajgiri",
    "District & Sessions Court, Warangal",
    "District & Sessions Court, Karimnagar",
  ],
  Gujarat: [
    "City Civil & Sessions Court, Ahmedabad (Bhadra)",
    "Rural District & Sessions Court, Ahmedabad (Mirzapur)",
    "District & Sessions Court, Surat",
    "District & Sessions Court, Vadodara",
    "District & Sessions Court, Rajkot",
    "District & Sessions Court, Gandhinagar",
  ],
  Haryana: [
    "District & Sessions Court, Gurugram",
    "District & Sessions Court, Faridabad",
    "District & Sessions Court, Panchkula",
    "District & Sessions Court, Ambala",
    "District & Sessions Court, Karnal",
    "District & Sessions Court, Rohtak",
    "District & Sessions Court, Sonipat",
    "District & Sessions Court, Panipat",
  ],
  Punjab: [
    "District & Sessions Court, SAS Nagar (Mohali)",
    "District & Sessions Court, Ludhiana",
    "District & Sessions Court, Amritsar",
    "District & Sessions Court, Jalandhar",
    "District & Sessions Court, Patiala",
    "District & Sessions Court, Bathinda",
  ],
  Rajasthan: [
    "Metropolitan Sessions Court, Jaipur",
    "District & Sessions Court, Jaipur Rural",
    "Metropolitan Sessions Court, Jodhpur",
    "District & Sessions Court, Udaipur",
    "District & Sessions Court, Kota",
    "District & Sessions Court, Ajmer",
  ],
  Kerala: [
    "District & Sessions Court, Ernakulam (Kochi)",
    "District & Sessions Court, Thiruvananthapuram",
    "District & Sessions Court, Kozhikode",
    "District & Sessions Court, Thrissur",
    "District & Sessions Court, Kollam",
  ],
  "Madhya Pradesh": [
    "District & Sessions Court, Bhopal",
    "District & Sessions Court, Indore",
    "District & Sessions Court, Jabalpur",
    "District & Sessions Court, Gwalior",
    "District & Sessions Court, Ujjain",
  ],
  Bihar: [
    "District & Sessions Court, Patna",
    "District & Sessions Court, Gaya",
    "District & Sessions Court, Muzaffarpur",
    "District & Sessions Court, Bhagalpur",
  ],
  "Andhra Pradesh": [
    "District & Sessions Court, Visakhapatnam",
    "District & Sessions Court, Vijayawada (NTR)",
    "District & Sessions Court, Guntur",
    "District & Sessions Court, Tirupati",
  ],
  Chandigarh: [
    "District & Sessions Court, Sector 43, Chandigarh",
  ],
};

export const ALL_TRIBUNALS = [
  "National Company Law Appellate Tribunal (NCLAT)",
  "National Company Law Tribunal (NCLT)",
  "National Green Tribunal (NGT)",
  "Central Administrative Tribunal (CAT)",
  "Armed Forces Tribunal (AFT)",
  "Debt Recovery Appellate Tribunal (DRAT)",
  "Debt Recovery Tribunal (DRT)",
  "Income Tax Appellate Tribunal (ITAT)",
  "Customs, Excise and Service Tax Appellate Tribunal (CESTAT)",
  "Appellate Tribunal for Electricity (APTEL)",
  "Telecom Disputes Settlement and Appellate Tribunal (TDSAT)",
  "Real Estate Regulatory Authority & Appellate Tribunal (RERA / REAT)",
  "Securities Appellate Tribunal (SAT)",
  "National Consumer Disputes Redressal Commission (NCDRC)",
] as const;

function normalizeCourtName(name: string): string {
  const clean = name.trim();
  if (clean.toLowerCase() === "supreme court") {
    return SUPREME_COURT;
  }
  return clean;
}

/**
 * Robustly parses courts field whether stored as JSON string, array, or legacy delimited string.
 */
export function parseCourtsList(courtsVal?: string | string[] | null): string[] {
  if (!courtsVal) return [];
  if (Array.isArray(courtsVal)) {
    return courtsVal.map((s) => normalizeCourtName(String(s))).filter(Boolean);
  }
  const trimmed = courtsVal.trim();
  if (!trimmed) return [];

  let result: string[] = [];

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        result = parsed.map((s) => String(s).trim()).filter(Boolean);
      }
    } catch {
      // fallback
    }
  }

  if (result.length === 0) {
    if (trimmed.includes(" · ")) {
      result = trimmed.split(" · ").map((s) => s.trim().replace(/^\+.*more$/, "")).filter(Boolean);
    } else if (trimmed.includes("•")) {
      result = trimmed.split("•").map((s) => s.trim()).filter(Boolean);
    } else if (trimmed.includes(" & ")) {
      result = trimmed.split(" & ").map((s) => s.trim()).filter(Boolean);
    } else if (trimmed.includes(",")) {
      result = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (trimmed.includes(";")) {
      result = trimmed.split(";").map((s) => s.trim()).filter(Boolean);
    } else {
      result = [trimmed];
    }
  }

  return result.map(normalizeCourtName).filter(Boolean);
}

/**
 * In the header, show the first two selected courts separated by ' · '.
 * If there are more, add '+N more'.
 */
export function formatCourtsHeader(courtsVal?: string | string[] | null): string {
  const list = parseCourtsList(courtsVal);
  if (list.length === 0) {
    return "Supreme Court of India · Delhi High Court";
  }
  if (list.length === 1) {
    return list[0];
  }
  if (list.length === 2) {
    return `${list[0]} · ${list[1]}`;
  }
  const remaining = list.length - 2;
  return `${list[0]} · ${list[1]} +${remaining} more`;
}
