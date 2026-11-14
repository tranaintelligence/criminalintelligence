/**
 * Partnered Law Firms & Student Internship Applications Engine
 * 
 * Supports:
 * - Law students selecting partnered firms and uploading their CV.
 * - Lawyers viewing student internship applications and reviewing/downloading their CVs.
 * - Founders reviewing and auditing all student internship applications and CVs.
 */

export interface InternshipApplication {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  university: string;
  yearOfStudy: string;
  phone?: string;
  partneredFirm: string;
  practiceArea: string;
  coverNote: string;
  cvFileName: string;
  cvFileUrl: string; // base64 data url or download link
  appliedAt: string;
  status: "PENDING_REVIEW" | "SHORTLISTED" | "ACCEPTED" | "REJECTED";
}

export interface PartneredFirm {
  id: string;
  name: string;
  location: string;
  practiceAreas: string;
  openings: string;
  description: string;
}

export const PARTNERED_FIRMS: PartneredFirm[] = [
  {
    id: "firm-sam",
    name: "Shardul Amarchand Mangaldas & Co",
    location: "New Delhi & Mumbai",
    practiceAreas: "White-Collar Crime, Corporate Litigation & BNSS Trial Procedure",
    openings: "Winter / Summer Litigation Internships",
    description: "Premier Indian law firm representing landmark appellate and trial disputes before Supreme Court and High Courts.",
  },
  {
    id: "firm-trilegal",
    name: "Trilegal",
    location: "New Delhi & Bengaluru",
    practiceAreas: "Regulatory Disputes, Enforcement Directorate & Criminal Proceedings",
    openings: "Litigation & Enforcement Division",
    description: "Top-tier full-service Indian firm with extensive dispute resolution, white-collar defense, and trial advisory practices.",
  },
  {
    id: "firm-azb",
    name: "AZB & Partners",
    location: "Mumbai & New Delhi",
    practiceAreas: "Litigation, Bail Applications & Corporate Crime Investigation",
    openings: "Court Practice Internship",
    description: "Leading dispute resolution chambers handling high-stakes judicial litigation and statutory enforcement matters.",
  },
  {
    id: "firm-khaitan",
    name: "Khaitan & Co",
    location: "New Delhi & Kolkata",
    practiceAreas: "Appellate Criminal Defense, Statutory Review & Economic Offences",
    openings: "Dispute Resolution Chambers",
    description: "One of India's oldest and most prestigious law firms with nationwide judicial representation and court practice.",
  },
  {
    id: "firm-mehra",
    name: "Chambers of Adv. Rajesh Mehra",
    location: "New Delhi (Supreme Court & Delhi High Court)",
    practiceAreas: "Trial Advocacy, Anticipatory Bail under BNSS & Special Statutes",
    openings: "Chambers Litigation Intern",
    description: "Senior criminal defense chambers focusing on Sessions trial proceedings, cross-examination, and appellate revision.",
  },
  {
    id: "firm-sen",
    name: "Chambers of Adv. Vikramaditya Sen",
    location: "New Delhi",
    practiceAreas: "Criminal Writs, Statutory Quashing Petitions & Cyber Litigation",
    openings: "High Court Practice Internship",
    description: "Litigation practice dedicated to constitutional fundamental rights, habeas corpus, and trial safeguards under BNS/BNSS.",
  },
  {
    id: "firm-dsk",
    name: "DSK Legal",
    location: "New Delhi & Mumbai",
    practiceAreas: "Criminal Litigation, Trial Procedure & Prevention of Corruption",
    openings: "Criminal Litigation Division",
    description: "Renowned dispute resolution team representing individuals and institutions before trial courts and High Courts.",
  },
];

const STORAGE_KEY = "trana_student_internship_applications";
const UPDATE_EVENT = "trana_internships_updated";

const SEED_APPLICATIONS: InternshipApplication[] = [
  {
    id: "app-seed-1",
    studentId: "student-aarav-du",
    studentName: "Aarav Sharma",
    studentEmail: "aarav.sharma@fol.du.ac.in",
    university: "Faculty of Law, University of Delhi",
    yearOfStudy: "4th Year B.A. LL.B.",
    phone: "9811042918",
    partneredFirm: "Shardul Amarchand Mangaldas & Co",
    practiceArea: "White-Collar Crime & BNSS Trial Procedure",
    coverNote: "Researched bail jurisprudence under BNSS Section 480 and assisted in trial brief drafting. Seeking chamber exposure in appellate criminal matters.",
    cvFileName: "Aarav_Sharma_CV_Legal_Internship.pdf",
    cvFileUrl: "data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgNjEyIDc5Ml0+PmVuZG9iagp0cmFpbGVyPDwvUm9vdCAxIDAgUj4+CiUlRU9G",
    appliedAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
    status: "PENDING_REVIEW",
  },
  {
    id: "app-seed-2",
    studentId: "student-meera-nludelhi",
    studentName: "Meera Krishnan",
    studentEmail: "meera.krishnan@nludelhi.ac.in",
    university: "National Law University, Delhi",
    yearOfStudy: "3rd Year B.A. LL.B. (Hons)",
    phone: "9820154820",
    partneredFirm: "Chambers of Adv. Rajesh Mehra",
    practiceArea: "Trial Advocacy & Anticipatory Bail under BNSS",
    coverNote: "Passionate about criminal defense and evidence law under BSA 2023. Published paper on police custody guidelines under BNSS Section 57.",
    cvFileName: "Meera_Krishnan_Resume_NLU.pdf",
    cvFileUrl: "data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgNjEyIDc5Ml0+PmVuZG9iagp0cmFpbGVyPDwvUm9vdCAxIDAgUj4+CiUlRU9G",
    appliedAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
    status: "SHORTLISTED",
  },
];

export function getStoredInternshipApplications(): InternshipApplication[] {
  if (typeof window === "undefined") return SEED_APPLICATIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_APPLICATIONS));
      return SEED_APPLICATIONS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return SEED_APPLICATIONS;
  } catch {
    return SEED_APPLICATIONS;
  }
}

export function saveInternshipApplication(app: InternshipApplication): void {
  if (typeof window === "undefined") return;
  try {
    const current = getStoredInternshipApplications();
    const updated = [app, ...current.filter((x) => x.id !== app.id)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event(UPDATE_EVENT));
  } catch (err) {
    console.warn("Failed to persist internship application:", err);
  }
}

export function updateInternshipApplicationStatus(id: string, status: InternshipApplication["status"]): void {
  if (typeof window === "undefined") return;
  try {
    const current = getStoredInternshipApplications();
    const updated = current.map((x) => (x.id === id ? { ...x, status } : x));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event(UPDATE_EVENT));
  } catch (err) {
    console.warn("Failed to update status:", err);
  }
}
