import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { 
  GraduationCap, Check, X, Search, RefreshCw, Eye, ShieldCheck, 
  ShieldAlert, Clock, Building2, MapPin, Sparkles, Filter, 
  Copy, ExternalLink, ZoomIn, ZoomOut, RotateCcw, Award, Scale,
  UserCheck, AlertCircle, FileText, ChevronRight, Briefcase
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/founders/students")({
  head: () => ({
    meta: [
      { title: "Founders Dashboard — Law Students & Interns" },
      { name: "description", content: "Review uploaded student College ID cards, verify credentials, grant workspace access, or decline applications." },
      { property: "og:title", content: "Law Students & Interns — TRANA Founders" },
    ],
  }),
  component: FoundersStudentsPage,
});

export interface RegisteredStudentEntry {
  id: string;
  name: string;
  role: "student";
  roleLabel: string;
  affiliation: string; // College or University
  city: string;
  experienceOrYear: string; // e.g. "3rd Year Scholar"
  specialisationOrInterests?: string;
  rollNo: string;
  bio?: string;
  collegeIdUrl?: string | null;
  collegeIdFileName?: string | null;
  verificationStatus: "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";
  isIntern: boolean;
  internFirmOrChamber?: string;
  isVerified: boolean;
  email?: string;
  enrolledAt?: string;
  decisionNotes?: string;
}

function escapeXml(unsafe: string): string {
  return (unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function generateStudentIdSvg(options: {
  university: string;
  name: string;
  rollNo: string;
  degree: string;
  validThrough: string;
  headerColor?: string;
  isIntern?: boolean;
}): string {
  const { university, name, rollNo, degree, validThrough, headerColor = "#0f172a", isIntern } = options;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 380" width="600" height="380">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#090d16" />
        <stop offset="100%" stop-color="#16152b" />
      </linearGradient>
      <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#f59e0b" />
        <stop offset="100%" stop-color="#fbbf24" />
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <!-- Card Base with border -->
    <rect width="600" height="380" rx="20" fill="url(#grad)" stroke="#334155" stroke-width="2"/>
    
    <!-- Top Header Banner -->
    <rect width="600" height="74" rx="20" fill="${headerColor}"/>
    <rect y="54" width="600" height="20" fill="${headerColor}"/>
    <line x1="0" y1="74" x2="600" y2="74" stroke="#d97706" stroke-width="2"/>
    
    <!-- Institution Typography -->
    <text x="300" y="32" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">${escapeXml(university.toUpperCase())}</text>
    <text x="300" y="54" font-family="system-ui, -apple-system, sans-serif" font-size="10.5" font-weight="600" fill="#fbbf24" text-anchor="middle" letter-spacing="2">STUDENT IDENTITY CARD • ACADEMIC SESSION</text>
    
    <!-- Photo Frame -->
    <rect x="36" y="98" width="132" height="162" rx="14" fill="#0c111d" stroke="#475569" stroke-width="1.5"/>
    <circle cx="102" cy="154" r="36" fill="#1e293b"/>
    <circle cx="102" cy="144" r="18" fill="#64748b"/>
    <path d="M 78 180 C 78 165, 126 165, 126 180 Z" fill="#64748b"/>
    <rect x="48" y="224" width="108" height="22" rx="6" fill="#1e293b" stroke="#334155"/>
    <text x="102" y="239" font-family="system-ui, -apple-system, sans-serif" font-size="9" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="1">COLLEGE SCHOLAR</text>
    
    <!-- Details Column -->
    <text x="190" y="122" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" fill="#94a3b8" letter-spacing="1.2">NAME OF SCHOLAR</text>
    <text x="190" y="146" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700" fill="#ffffff">${escapeXml(name)}</text>
    
    <text x="190" y="180" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" fill="#94a3b8" letter-spacing="1.2">STUDENT ROLL / ENROLLMENT NO.</text>
    <text x="190" y="202" font-family="monospace" font-size="15" font-weight="700" fill="#38bdf8">${escapeXml(rollNo)}</text>
    
    <text x="190" y="234" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" fill="#94a3b8" letter-spacing="1.2">DEGREE / PROGRAMME</text>
    <text x="190" y="253" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600" fill="#e2e8f0">${escapeXml(degree)}</text>
    
    <!-- Right side metadata -->
    <text x="430" y="180" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" fill="#94a3b8" letter-spacing="1.2">VALID UPTO</text>
    <text x="430" y="202" font-family="monospace" font-size="13" font-weight="700" fill="#e2e8f0">${escapeXml(validThrough)}</text>
    
    <text x="430" y="234" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" fill="#94a3b8" letter-spacing="1.2">PLATFORM TRACK</text>
    <text x="430" y="253" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="${isIntern ? "#c084fc" : "#38bdf8"}">${isIntern ? "LEGAL INTERN" : "LAW STUDENT"}</text>
    
    <!-- Divider -->
    <line x1="36" y1="288" x2="564" y2="288" stroke="#334155" stroke-width="1" stroke-dasharray="4,4"/>
    
    <!-- Barcode simulation -->
    <g transform="translate(36, 308)">
      <rect x="0" y="0" width="3" height="34" fill="#94a3b8"/>
      <rect x="5" y="0" width="1" height="34" fill="#94a3b8"/>
      <rect x="8" y="0" width="4" height="34" fill="#94a3b8"/>
      <rect x="15" y="0" width="2" height="34" fill="#94a3b8"/>
      <rect x="20" y="0" width="5" height="34" fill="#94a3b8"/>
      <rect x="28" y="0" width="2" height="34" fill="#94a3b8"/>
      <rect x="33" y="0" width="3" height="34" fill="#94a3b8"/>
      <rect x="39" y="0" width="1" height="34" fill="#94a3b8"/>
      <rect x="43" y="0" width="4" height="34" fill="#94a3b8"/>
      <rect x="50" y="0" width="2" height="34" fill="#94a3b8"/>
      <rect x="55" y="0" width="5" height="34" fill="#94a3b8"/>
      <rect x="63" y="0" width="1" height="34" fill="#94a3b8"/>
      <rect x="67" y="0" width="4" height="34" fill="#94a3b8"/>
      <rect x="74" y="0" width="2" height="34" fill="#94a3b8"/>
      <rect x="79" y="0" width="3" height="34" fill="#94a3b8"/>
      <rect x="85" y="0" width="2" height="34" fill="#94a3b8"/>
      <text x="0" y="47" font-family="monospace" font-size="9" fill="#64748b">${escapeXml(rollNo)}</text>
    </g>
    
    <!-- Registrar Stamp Seal -->
    <circle cx="494" cy="328" r="27" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="3,2"/>
    <text x="494" y="325" font-family="system-ui, -apple-system, sans-serif" font-size="8" font-weight="700" fill="#f59e0b" text-anchor="middle">REGISTRAR</text>
    <text x="494" y="337" font-family="system-ui, -apple-system, sans-serif" font-size="7" font-weight="600" fill="#fbbf24" text-anchor="middle">SEAL &amp; SIGN</text>
    
    <text x="300" y="364" font-family="system-ui, -apple-system, sans-serif" font-size="9" fill="#64748b" text-anchor="middle">TRANA ACADEMIC REGISTRY VERIFICATION • OFFICIAL PREVIEW</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const DEFAULT_SEEDS: RegisteredStudentEntry[] = [
  {
    id: "seed-student-1",
    name: "Aarav Sharma",
    role: "student",
    roleLabel: "Legal Intern (5-Year B.A. LL.B. Hons)",
    affiliation: "National Law University, Delhi",
    city: "New Delhi",
    experienceOrYear: "3rd Year Scholar",
    specialisationOrInterests: "Constitutional Law, Criminal Procedure & Statutory AI Research",
    rollNo: "2023/BALLB/042",
    bio: "Legal intern focused on Section 482 CrPC / 528 BNSS quashing petitions and High Court litigation research.",
    collegeIdUrl: generateStudentIdSvg({
      university: "National Law University, Delhi",
      name: "Aarav Sharma",
      rollNo: "2023/BALLB/042",
      degree: "5-Year B.A. LL.B. (Hons)",
      validThrough: "2028-06-30",
      headerColor: "#1e1b4b",
      isIntern: true,
    }),
    collegeIdFileName: "NLUD_Aarav_Sharma_ID.jpg",
    verificationStatus: "PENDING_VERIFICATION",
    isIntern: true,
    internFirmOrChamber: "Chambers of Adv. Siddharth K. Rao, Delhi High Court",
    isVerified: false,
    email: "aarav.sharma@nludelhi.ac.in",
    enrolledAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
  },
  {
    id: "seed-student-2",
    name: "Riya Mukherjee",
    role: "student",
    roleLabel: "Law Student (5-Year B.A. LL.B. Hons)",
    affiliation: "National Law School of India University (NLSIU), Bengaluru",
    city: "Bengaluru",
    experienceOrYear: "4th Year Scholar",
    specialisationOrInterests: "Corporate Governance, Competition Law, Technology Regulations",
    rollNo: "NLSIU-2022-108",
    bio: "Editor at NLS Student Law Review. Researching DPDP Act 2023 compliance frameworks.",
    collegeIdUrl: generateStudentIdSvg({
      university: "National Law School of India University, Bengaluru",
      name: "Riya Mukherjee",
      rollNo: "NLSIU-2022-108",
      degree: "5-Year B.A. LL.B. (Hons)",
      validThrough: "2027-06-30",
      headerColor: "#064e3b",
      isIntern: false,
    }),
    collegeIdFileName: "NLSIU_Student_ID_2022_108.png",
    verificationStatus: "VERIFIED",
    isIntern: false,
    isVerified: true,
    email: "riya.mukherjee@nls.ac.in",
    enrolledAt: new Date(Date.now() - 3600 * 1000 * 120).toISOString(),
  },
  {
    id: "seed-student-3",
    name: "Aditya Vikram Singh",
    role: "student",
    roleLabel: "Legal Intern (3-Year LL.B.)",
    affiliation: "Faculty of Law, University of Delhi",
    city: "New Delhi",
    experienceOrYear: "2nd Year Scholar",
    specialisationOrInterests: "Arbitration & Conciliation, Commercial Contracts, Intellectual Property",
    rollNo: "FOL/DU/2024/077",
    bio: "Litigation intern preparing petitions and memorial briefs for commercial arbitration disputes.",
    collegeIdUrl: generateStudentIdSvg({
      university: "Faculty of Law, University of Delhi",
      name: "Aditya Vikram Singh",
      rollNo: "FOL/DU/2024/077",
      degree: "3-Year LL.B.",
      validThrough: "2027-05-31",
      headerColor: "#450a0a",
      isIntern: true,
    }),
    collegeIdFileName: "DU_FacultyOfLaw_ID.jpeg",
    verificationStatus: "PENDING_VERIFICATION",
    isIntern: true,
    internFirmOrChamber: "Trilegal / Corporate Litigation Division",
    isVerified: false,
    email: "aditya.singh@lawfaculty.du.ac.in",
    enrolledAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
  },
  {
    id: "seed-student-4",
    name: "Ananya Iyer",
    role: "student",
    roleLabel: "Law Student (5-Year B.B.A. LL.B. Hons)",
    affiliation: "Symbiosis Law School, Pune",
    city: "Pune",
    experienceOrYear: "5th Year Scholar",
    specialisationOrInterests: "Insolvency & Bankruptcy Code, Banking Law, Financial Regulations",
    rollNo: "SLS/P/2021/309",
    bio: "Final year student scholar focusing on IBC Section 7 & 9 admission trends before NCLT.",
    collegeIdUrl: generateStudentIdSvg({
      university: "Symbiosis Law School, Pune",
      name: "Ananya Iyer",
      rollNo: "SLS/P/2021/309",
      degree: "5-Year B.B.A. LL.B. (Hons)",
      validThrough: "2026-06-30",
      headerColor: "#172554",
      isIntern: false,
    }),
    collegeIdFileName: "SLS_Pune_ID_Card.jpg",
    verificationStatus: "REJECTED",
    isIntern: false,
    isVerified: false,
    email: "ananya.iyer@symlaw.ac.in",
    enrolledAt: new Date(Date.now() - 3600 * 1000 * 180).toISOString(),
    decisionNotes: "College ID image was partially obscured; please re-upload a clear scan with visible roll number.",
  },
];

function FoundersStudentsPage() {
  const [students, setStudents] = useState<RegisteredStudentEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "verified" | "interns" | "rejected">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "student" | "intern">("all");
  
  // Inspection modal state
  const [inspectingStudent, setInspectingStudent] = useState<RegisteredStudentEntry | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [declineReasonModal, setDeclineReasonModal] = useState<RegisteredStudentEntry | null>(null);
  const [declineNotes, setDeclineNotes] = useState("");

  // Load students from storage + active profile + seeds
  const loadStudents = () => {
    try {
      const stored = localStorage.getItem("trana_all_registered_students");
      let list: RegisteredStudentEntry[] = stored ? JSON.parse(stored) : [];

      // Check current active student profile in storage
      const activeRaw = localStorage.getItem("trana_student_profile");
      if (activeRaw) {
        try {
          const p = JSON.parse(activeRaw);
          if (p.university || p.studentIdNumber) {
            const activeId = p.id || "current-active-student";
            const exists = list.some((s) => s.id === activeId || (p.studentIdNumber && s.rollNo === p.studentIdNumber));
            if (!exists) {
              list.unshift({
                id: activeId,
                name: p.fullName || "Current Law Student",
                role: "student",
                roleLabel: p.isIntern ? `Legal Intern (${p.degree || "B.A. LL.B."})` : `Law Student (${p.degree || "B.A. LL.B."})`,
                affiliation: p.university || "Faculty of Law",
                city: p.city || "New Delhi",
                experienceOrYear: p.yearOfStudy || "3rd Year Scholar",
                specialisationOrInterests: p.focus || "Statutory Precedent & Memorial Drafting",
                rollNo: p.studentIdNumber || "STUDENT-REG-ACTIVE",
                bio: p.bio || "Active enrolled scholar on TRANA Academic Workspace.",
                collegeIdUrl: p.collegeIdUrl || generateStudentIdSvg({
                  university: p.university || "Faculty of Law",
                  name: p.fullName || "Current Law Student",
                  rollNo: p.studentIdNumber || "STUDENT-REG-ACTIVE",
                  degree: p.degree || "B.A. LL.B.",
                  validThrough: "2027-06-30",
                  isIntern: Boolean(p.isIntern),
                }),
                collegeIdFileName: p.collegeIdFileName || "College_ID.jpg",
                verificationStatus: p.verificationStatus || "PENDING_VERIFICATION",
                isIntern: Boolean(p.isIntern),
                internFirmOrChamber: p.internFirmOrChamber || undefined,
                isVerified: p.verificationStatus === "VERIFIED",
                email: p.email || "student@trana.in",
                enrolledAt: p.enrolledAt || new Date().toISOString(),
              });
            }
          }
        } catch {}
      }

      // Merge with default seed data if needed
      if (list.length === 0) {
        list = [...DEFAULT_SEEDS];
        localStorage.setItem("trana_all_registered_students", JSON.stringify(list));
      } else {
        // Ensure default seeds exist for realistic multi-status demonstrations
        DEFAULT_SEEDS.forEach((seed) => {
          if (!list.some((s) => s.rollNo === seed.rollNo || s.id === seed.id)) {
            list.push(seed);
          }
        });
      }

      setStudents(list);
    } catch {
      setStudents([...DEFAULT_SEEDS]);
    }
  };

  useEffect(() => {
    loadStudents();

    const handleUpdate = () => loadStudents();
    window.addEventListener("trana_role_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("trana_role_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // Save changes helper
  const updateStudentInStorage = (updatedList: RegisteredStudentEntry[], targetStudent: RegisteredStudentEntry) => {
    localStorage.setItem("trana_all_registered_students", JSON.stringify(updatedList));

    // Update active student profile if matching
    try {
      const activeRaw = localStorage.getItem("trana_student_profile");
      if (activeRaw) {
        const activeProfile = JSON.parse(activeRaw);
        if (
          activeProfile.studentIdNumber === targetStudent.rollNo ||
          activeProfile.fullName === targetStudent.name ||
          activeProfile.id === targetStudent.id
        ) {
          activeProfile.verificationStatus = targetStudent.verificationStatus;
          activeProfile.isVerified = targetStudent.isVerified;
          localStorage.setItem("trana_student_profile", JSON.stringify(activeProfile));
        }
      }

      // User-scoped profiles
      if (targetStudent.id) {
        const scopedProfileRaw = localStorage.getItem(`trana_student_profile_${targetStudent.id}`);
        if (scopedProfileRaw) {
          const sp = JSON.parse(scopedProfileRaw);
          sp.verificationStatus = targetStudent.verificationStatus;
          sp.isVerified = targetStudent.isVerified;
          localStorage.setItem(`trana_student_profile_${targetStudent.id}`, JSON.stringify(sp));
        }
      }
    } catch {}

    window.dispatchEvent(new Event("trana_role_updated"));
    setStudents(updatedList);
  };

  // Actions
  const handleGrantAccess = (student: RegisteredStudentEntry) => {
    const updated = students.map((s) => {
      if (s.id === student.id || s.rollNo === student.rollNo) {
        return {
          ...s,
          verificationStatus: "VERIFIED" as const,
          isVerified: true,
          decisionNotes: undefined,
        };
      }
      return s;
    });

    const target = updated.find((s) => s.id === student.id || s.rollNo === student.rollNo) || {
      ...student,
      verificationStatus: "VERIFIED" as const,
      isVerified: true,
    };

    updateStudentInStorage(updated, target);
    if (inspectingStudent && (inspectingStudent.id === student.id || inspectingStudent.rollNo === student.rollNo)) {
      setInspectingStudent(target);
    }
    toast.success(`Access granted! ${student.name} is now verified as ${student.isIntern ? "Legal Intern" : "Law Student"}.`);
  };

  const handleOpenDeclineModal = (student: RegisteredStudentEntry) => {
    setDeclineReasonModal(student);
    setDeclineNotes(
      student.decisionNotes ||
      "College ID image was unclear or invalid. Please re-upload a clear photograph with your institutional roll number."
    );
  };

  const handleConfirmDecline = () => {
    if (!declineReasonModal) return;
    const student = declineReasonModal;

    const updated = students.map((s) => {
      if (s.id === student.id || s.rollNo === student.rollNo) {
        return {
          ...s,
          verificationStatus: "REJECTED" as const,
          isVerified: false,
          decisionNotes: declineNotes.trim() || undefined,
        };
      }
      return s;
    });

    const target = updated.find((s) => s.id === student.id || s.rollNo === student.rollNo) || {
      ...student,
      verificationStatus: "REJECTED" as const,
      isVerified: false,
      decisionNotes: declineNotes.trim() || undefined,
    };

    updateStudentInStorage(updated, target);
    if (inspectingStudent && (inspectingStudent.id === student.id || inspectingStudent.rollNo === student.rollNo)) {
      setInspectingStudent(target);
    }
    setDeclineReasonModal(null);
    toast.error(`Access declined for ${student.name}. Status updated to REJECTED.`);
  };

  const handleResetToPending = (student: RegisteredStudentEntry) => {
    const updated = students.map((s) => {
      if (s.id === student.id || s.rollNo === student.rollNo) {
        return {
          ...s,
          verificationStatus: "PENDING_VERIFICATION" as const,
          isVerified: false,
          decisionNotes: undefined,
        };
      }
      return s;
    });

    const target = updated.find((s) => s.id === student.id || s.rollNo === student.rollNo) || {
      ...student,
      verificationStatus: "PENDING_VERIFICATION" as const,
      isVerified: false,
    };

    updateStudentInStorage(updated, target);
    if (inspectingStudent && (inspectingStudent.id === student.id || inspectingStudent.rollNo === student.rollNo)) {
      setInspectingStudent(target);
    }
    toast.info(`Status reset to Pending Verification for ${student.name}.`);
  };

  // Metrics
  const totalCount = students.length;
  const verifiedCount = students.filter((s) => s.verificationStatus === "VERIFIED" || s.isVerified).length;
  const pendingCount = students.filter((s) => s.verificationStatus === "PENDING_VERIFICATION").length;
  const internsCount = students.filter((s) => s.isIntern).length;
  const rejectedCount = students.filter((s) => s.verificationStatus === "REJECTED").length;

  // Filtering
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Tab filter
      if (activeTab === "pending" && s.verificationStatus !== "PENDING_VERIFICATION") return false;
      if (activeTab === "verified" && s.verificationStatus !== "VERIFIED" && !s.isVerified) return false;
      if (activeTab === "interns" && !s.isIntern) return false;
      if (activeTab === "rejected" && s.verificationStatus !== "REJECTED") return false;

      // Role filter
      if (roleFilter === "student" && s.isIntern) return false;
      if (roleFilter === "intern" && !s.isIntern) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesRoll = s.rollNo.toLowerCase().includes(q);
        const matchesAffiliation = s.affiliation.toLowerCase().includes(q);
        const matchesCity = (s.city || "").toLowerCase().includes(q);
        const matchesEmail = (s.email || "").toLowerCase().includes(q);
        const matchesFirm = (s.internFirmOrChamber || "").toLowerCase().includes(q);
        return matchesName || matchesRoll || matchesAffiliation || matchesCity || matchesEmail || matchesFirm;
      }

      return true;
    });
  }, [students, activeTab, roleFilter, searchQuery]);

  return (
    <div className="space-y-8 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="apple-glass-pill px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-widest text-purple-300 border-purple-500/30 flex items-center gap-1.5">
              <GraduationCap className="h-3 w-3" />
              <span>Academic &amp; Intern Registry</span>
            </span>
            <span className="text-[10px] font-mono text-neutral-400">
              {pendingCount > 0 ? `• ${pendingCount} Action Required` : "• All Reviewed"}
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-medium text-white tracking-tight">
            Law Students &amp; Interns Verification
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-neutral-400 max-w-3xl leading-relaxed">
            Review uploaded institutional College ID cards, roll numbers, and chamber affiliations. Grant or decline platform access for legal scholars and interns across India.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              loadStudents();
              toast.success("Student registry refreshed.");
            }}
            className="apple-glass-pill px-3.5 py-2 text-xs font-mono text-neutral-300 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Registered */}
        <div className="apple-glass-card p-5 relative overflow-hidden">
          <p className="text-[11px] uppercase tracking-wider text-neutral-400 font-mono">Total Scholars</p>
          <div className="flex items-baseline justify-between mt-2">
            <p className="font-display text-3xl font-semibold text-white">{totalCount}</p>
            <div className="h-9 w-9 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-neutral-300">
              <GraduationCap className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10px] text-neutral-400 font-mono mt-1">Law Students &amp; Legal Interns</p>
        </div>

        {/* Pending Verifications */}
        <div className={`apple-glass-card p-5 relative overflow-hidden ${pendingCount > 0 ? "border-amber-500/40 bg-amber-500/[0.04]" : ""}`}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold font-mono">
              Pending ID Review
            </p>
            {pendingCount > 0 && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
            )}
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <p className="font-display text-3xl font-semibold text-amber-300">{pendingCount}</p>
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10px] text-amber-300/80 font-mono mt-1">Awaiting ID card authentication</p>
        </div>

        {/* Verified & Active */}
        <div className="apple-glass-card p-5 border-emerald-500/30 relative overflow-hidden">
          <p className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold font-mono">
            Verified &amp; Active Access
          </p>
          <div className="flex items-baseline justify-between mt-2">
            <p className="font-display text-3xl font-semibold text-emerald-300">{verifiedCount}</p>
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10px] text-emerald-400/80 font-mono mt-1">Workspace access granted</p>
        </div>

        {/* Chamber Interns */}
        <div className="apple-glass-card p-5 border-purple-500/30 relative overflow-hidden">
          <p className="text-[11px] uppercase tracking-wider text-purple-300 font-semibold font-mono">
            Chamber Interns
          </p>
          <div className="flex items-baseline justify-between mt-2">
            <p className="font-display text-3xl font-semibold text-purple-200">{internsCount}</p>
            <div className="h-9 w-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <Scale className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10px] text-purple-300/80 font-mono mt-1">Case Tracker privileges enabled</p>
        </div>
      </div>

      {/* Tabs and Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 font-mono">
          <button
            onClick={() => setActiveTab("pending")}
            className={`apple-glass-pill px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === "pending"
                ? "bg-amber-400 text-black shadow-md border-amber-400"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <span>Pending Review</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === "pending" ? "bg-black/20 text-black font-bold" : "bg-amber-500/20 text-amber-300"
            }`}>
              {pendingCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("verified")}
            className={`apple-glass-pill px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === "verified"
                ? "bg-emerald-400 text-black shadow-md border-emerald-400"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <span>Verified &amp; Active</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === "verified" ? "bg-black/20 text-black font-bold" : "bg-emerald-500/20 text-emerald-300"
            }`}>
              {verifiedCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("interns")}
            className={`apple-glass-pill px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === "interns"
                ? "bg-purple-400 text-black shadow-md border-purple-400"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <span>Legal Interns</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === "interns" ? "bg-black/20 text-black font-bold" : "bg-purple-500/20 text-purple-300"
            }`}>
              {internsCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("rejected")}
            className={`apple-glass-pill px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === "rejected"
                ? "bg-rose-400 text-black shadow-md border-rose-400"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <span>Declined</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === "rejected" ? "bg-black/20 text-black font-bold" : "bg-rose-500/20 text-rose-300"
            }`}>
              {rejectedCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("all")}
            className={`apple-glass-pill px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === "all"
                ? "bg-white text-black shadow-md border-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            All Scholars ({totalCount})
          </button>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search scholar, college, roll no..."
              className="w-full pl-9 pr-3 py-1.5 text-xs apple-glass-input text-white placeholder-neutral-500"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="apple-glass-input px-3 py-1.5 text-xs text-white cursor-pointer font-mono"
          >
            <option value="all" className="bg-[#121216] text-white">All Tracks</option>
            <option value="student" className="bg-[#121216] text-white">Law Students Only</option>
            <option value="intern" className="bg-[#121216] text-white">Legal Interns Only</option>
          </select>
        </div>
      </div>

      {/* Student Registry Table & Cards */}
      {filteredStudents.length === 0 ? (
        <div className="apple-glass-card p-12 text-center">
          <GraduationCap className="h-10 w-10 text-neutral-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-white">No scholars found matching your criteria</p>
          <p className="text-xs text-neutral-400 font-mono mt-1">
            Try adjusting your search query or switching tabs.
          </p>
        </div>
      ) : (
        <div className="apple-glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[0.08] bg-white/[0.02] text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                <tr>
                  <th className="py-3.5 px-4 font-medium">Scholar Name &amp; Contact</th>
                  <th className="py-3.5 px-4 font-medium">Track &amp; Chamber</th>
                  <th className="py-3.5 px-4 font-medium">Institution &amp; Roll No.</th>
                  <th className="py-3.5 px-4 font-medium text-center">College ID Card</th>
                  <th className="py-3.5 px-4 font-medium">Status</th>
                  <th className="py-3.5 px-4 font-medium text-right">Founder Decisions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredStudents.map((student) => {
                  const isVerified = student.verificationStatus === "VERIFIED" || student.isVerified;
                  const isPending = student.verificationStatus === "PENDING_VERIFICATION";
                  const isRejected = student.verificationStatus === "REJECTED";

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-white/[0.03] transition-colors group"
                    >
                      {/* Scholar Info */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300 font-semibold text-xs shrink-0 shadow-sm">
                            {student.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-white text-sm truncate flex items-center gap-2">
                              <span>{student.name}</span>
                              {student.isIntern && (
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  INTERN
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] font-mono text-neutral-400 truncate mt-0.5">
                              {student.email || "No email recorded"}
                            </p>
                            <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                              Enrolled: {new Date(student.enrolledAt || Date.now()).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Track & Chamber */}
                      <td className="py-4 px-4 max-w-[200px]">
                        <div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono ${
                            student.isIntern
                              ? "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                              : "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                          }`}>
                            {student.isIntern ? <Briefcase className="h-3 w-3" /> : <GraduationCap className="h-3 w-3" />}
                            <span>{student.isIntern ? "Legal Intern" : "Law Student"}</span>
                          </span>

                          {student.isIntern && student.internFirmOrChamber ? (
                            <p className="text-[11px] text-neutral-300 mt-1.5 line-clamp-2 font-sans" title={student.internFirmOrChamber}>
                              <span className="text-neutral-500 text-[10px] font-mono uppercase block">Chamber / Firm:</span>
                              {student.internFirmOrChamber}
                            </p>
                          ) : (
                            <p className="text-[10px] text-neutral-500 font-mono mt-1">
                              General Academic Track
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Institution & Roll No */}
                      <td className="py-4 px-4">
                        <div>
                          <p className="text-neutral-200 font-medium truncate max-w-[220px]" title={student.affiliation}>
                            {student.affiliation}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-mono bg-white/[0.06] px-2 py-0.5 rounded text-amber-300/90 border border-white/10 font-semibold tracking-wider">
                              {student.rollNo}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(student.rollNo);
                                toast.success(`Roll No. ${student.rollNo} copied.`);
                              }}
                              className="text-neutral-400 hover:text-white transition-colors"
                              title="Copy roll number"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                          <p className="text-[10px] text-neutral-400 font-mono mt-1">
                            {student.experienceOrYear} • {student.city}
                          </p>
                        </div>
                      </td>

                      {/* College ID Card Preview */}
                      <td className="py-4 px-4 text-center">
                        {student.collegeIdUrl ? (
                          <div className="flex flex-col items-center gap-1.5">
                            <div
                              onClick={() => {
                                setInspectingStudent(student);
                                setZoomLevel(1);
                              }}
                              className="relative w-20 h-13 rounded-lg overflow-hidden border border-white/20 hover:border-purple-400/80 bg-black/40 group-hover:scale-105 transition-all cursor-pointer shadow-md"
                              title="Click to inspect College ID"
                            >
                              <img
                                src={student.collegeIdUrl}
                                alt="ID preview"
                                className="w-full h-full object-cover object-center"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Eye className="h-4 w-4 text-white drop-shadow" />
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setInspectingStudent(student);
                                setZoomLevel(1);
                              }}
                              className="text-[10px] font-mono text-purple-300 hover:text-purple-200 flex items-center gap-1 cursor-pointer"
                            >
                              <span>Inspect ID</span>
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-[11px] font-mono text-neutral-500 italic">
                            No ID uploaded
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {isVerified && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Verified</span>
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <Clock className="h-3.5 w-3.5 text-amber-400" />
                            <span>Pending Review</span>
                          </span>
                        )}
                        {isRejected && (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30">
                              <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                              <span>Access Declined</span>
                            </span>
                            {student.decisionNotes && (
                              <p className="text-[9px] text-rose-300/80 font-mono line-clamp-1 max-w-[140px]" title={student.decisionNotes}>
                                {student.decisionNotes}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setInspectingStudent(student);
                              setZoomLevel(1);
                            }}
                            className="apple-glass-pill px-3 py-1.5 text-[11px] font-mono text-neutral-300 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                            title="Inspect ID Document & Application"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Inspect</span>
                          </button>

                          {!isVerified && (
                            <button
                              onClick={() => handleGrantAccess(student)}
                              className="bg-emerald-400 hover:bg-emerald-300 text-black px-3 py-1.5 rounded-full text-[11px] font-semibold font-mono tracking-wider flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                              title="Verify student and grant workspace access"
                            >
                              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                              <span>Verify</span>
                            </button>
                          )}

                          {!isRejected && (
                            <button
                              onClick={() => handleOpenDeclineModal(student)}
                              className="apple-glass-pill px-3 py-1.5 text-[11px] font-mono text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 border-rose-500/30 flex items-center gap-1 transition-colors cursor-pointer"
                              title="Decline workspace access"
                            >
                              <X className="h-3.5 w-3.5 stroke-[2.5]" />
                              <span>Decline</span>
                            </button>
                          )}

                          {isVerified && (
                            <button
                              onClick={() => handleResetToPending(student)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors cursor-pointer"
                              title="Reset status back to Pending Review"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FULL COLLEGE ID INSPECTION & VERIFICATION MODAL */}
      {inspectingStudent && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="apple-glass-card w-full max-w-4xl p-6 sm:p-8 relative border border-white/20 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl sm:text-2xl font-semibold text-white">
                      College ID &amp; Credentials Inspection
                    </h2>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase ${
                      inspectingStudent.verificationStatus === "VERIFIED"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : inspectingStudent.verificationStatus === "REJECTED"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}>
                      {inspectingStudent.verificationStatus === "VERIFIED"
                        ? "Verified"
                        : inspectingStudent.verificationStatus === "REJECTED"
                        ? "Declined"
                        : "Pending Review"}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 font-mono mt-0.5">
                    Authenticating credentials for {inspectingStudent.name} ({inspectingStudent.affiliation})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setInspectingStudent(null)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body: Left ID Card View, Right Student Details */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: ID Card Lightbox Preview */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-mono">
                    Official College ID Card Image
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 2.5))}
                      className="apple-glass-pill p-1.5 text-neutral-300 hover:text-white cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.75))}
                      className="apple-glass-pill p-1.5 text-neutral-300 hover:text-white cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setZoomLevel(1)}
                      className="apple-glass-pill px-2 py-1 text-[10px] font-mono text-neutral-300 hover:text-white cursor-pointer"
                      title="Reset Zoom"
                    >
                      {Math.round(zoomLevel * 100)}%
                    </button>
                    {inspectingStudent.collegeIdUrl && (
                      <button
                        onClick={() => setLightboxUrl(inspectingStudent.collegeIdUrl || null)}
                        className="apple-glass-pill p-1.5 text-purple-300 hover:text-white cursor-pointer"
                        title="Fullscreen Lightbox"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative rounded-2xl border border-white/15 bg-black/60 overflow-hidden flex items-center justify-center p-4 min-h-[300px] shadow-inner">
                  {inspectingStudent.collegeIdUrl ? (
                    <div
                      style={{
                        transform: `scale(${zoomLevel})`,
                        transition: "transform 0.15s ease-out",
                      }}
                      className="w-full flex items-center justify-center origin-center cursor-zoom-in"
                      onClick={() => setLightboxUrl(inspectingStudent.collegeIdUrl || null)}
                    >
                      <img
                        src={inspectingStudent.collegeIdUrl}
                        alt="College ID Full Preview"
                        className="max-h-[380px] w-auto max-w-full rounded-xl object-contain shadow-2xl border border-white/10"
                      />
                    </div>
                  ) : (
                    <div className="text-center p-8 text-neutral-400 font-mono text-xs">
                      <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      No College ID uploaded for this applicant.
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 px-1">
                  <span>File: {inspectingStudent.collegeIdFileName || "college_id_card.jpg"}</span>
                  <span className="text-purple-300">Click image for fullscreen view</span>
                </div>
              </div>

              {/* Right Column: Student Particulars & Verification Assessment */}
              <div className="lg:col-span-5 space-y-4">
                <div className="apple-glass-card p-4 space-y-3.5 border-white/10">
                  <h3 className="text-xs uppercase font-mono tracking-wider text-purple-300 border-b border-white/[0.08] pb-2 flex items-center justify-between">
                    <span>Applicant Particulars</span>
                    <span className="text-neutral-400 font-normal">Cross-Check Data</span>
                  </h3>

                  <div className="space-y-2.5 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-mono text-neutral-400 block">Full Legal Name</span>
                      <p className="font-semibold text-white text-sm">{inspectingStudent.name}</p>
                    </div>

                    <div className="bg-white/[0.04] p-2.5 rounded-xl border border-white/10 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] uppercase font-mono text-amber-300 block font-semibold">
                          College Roll / Registration No.
                        </span>
                        <p className="font-mono text-sm font-bold text-white tracking-wider mt-0.5">
                          {inspectingStudent.rollNo}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(inspectingStudent.rollNo);
                          toast.success("Roll number copied to clipboard.");
                        }}
                        className="apple-glass-pill px-2.5 py-1 text-[10px] font-mono text-neutral-300 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </button>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-mono text-neutral-400 block">University / Law College</span>
                      <p className="font-medium text-neutral-200">{inspectingStudent.affiliation}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-mono text-neutral-400 block">Year of Study</span>
                        <p className="text-neutral-300">{inspectingStudent.experienceOrYear}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-mono text-neutral-400 block">Campus City</span>
                        <p className="text-neutral-300">{inspectingStudent.city}</p>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-mono text-neutral-400 block">Platform Track</span>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          inspectingStudent.isIntern
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        }`}>
                          {inspectingStudent.isIntern ? "Legal Intern" : "Law Student"}
                        </span>
                        {inspectingStudent.isIntern && (
                          <span className="text-[10px] font-mono text-emerald-400">
                            (Case Tracker Enabled)
                          </span>
                        )}
                      </div>
                    </div>

                    {inspectingStudent.isIntern && inspectingStudent.internFirmOrChamber && (
                      <div className="bg-purple-500/[0.08] border border-purple-500/25 p-2.5 rounded-xl">
                        <span className="text-[9px] uppercase font-mono text-purple-300 font-semibold block">
                          Chamber / Law Firm Affiliation
                        </span>
                        <p className="text-xs text-white font-medium mt-0.5">
                          {inspectingStudent.internFirmOrChamber}
                        </p>
                      </div>
                    )}

                    {inspectingStudent.bio && (
                      <div>
                        <span className="text-[10px] uppercase font-mono text-neutral-400 block">Academic Bio / Focus</span>
                        <p className="text-neutral-300 text-[11px] leading-relaxed italic bg-white/[0.02] p-2 rounded-lg border border-white/5 mt-0.5">
                          "{inspectingStudent.bio}"
                        </p>
                      </div>
                    )}

                    {inspectingStudent.decisionNotes && (
                      <div className="bg-rose-500/10 border border-rose-500/25 p-2.5 rounded-xl">
                        <span className="text-[9px] uppercase font-mono text-rose-300 font-semibold block">
                          Previous Founder Note
                        </span>
                        <p className="text-xs text-rose-200 mt-0.5">
                          {inspectingStudent.decisionNotes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Founder Verification Actions Box */}
                <div className="apple-glass-card p-4 space-y-3 border-white/10 bg-white/[0.03]">
                  <span className="text-xs uppercase font-mono tracking-wider text-neutral-300 block font-semibold">
                    Founders Decision
                  </span>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Granting access authorizes the student to use AI Drafter, Citation Finder, Statutory Precedents, and network tools. Legal Interns also gain access to the Litigation Case Tracker.
                  </p>

                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      onClick={() => handleGrantAccess(inspectingStudent)}
                      className="w-full bg-emerald-400 hover:bg-emerald-300 text-black py-2.5 px-4 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer font-mono"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>Verify ID &amp; Grant Access</span>
                    </button>

                    <button
                      onClick={() => handleOpenDeclineModal(inspectingStudent)}
                      className="w-full apple-glass-pill py-2.5 px-4 text-xs font-mono uppercase tracking-wider text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 border-rose-500/30 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <ShieldAlert className="h-4 w-4" />
                      <span>Decline Access</span>
                    </button>

                    {inspectingStudent.verificationStatus !== "PENDING_VERIFICATION" && (
                      <button
                        onClick={() => handleResetToPending(inspectingStudent)}
                        className="w-full text-center py-1 text-[10px] font-mono text-neutral-400 hover:text-neutral-200 cursor-pointer"
                      >
                        Reset Status to Pending Review
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DECLINE ACCESS REASON MODAL */}
      {declineReasonModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="apple-glass-card w-full max-w-md p-6 relative border border-rose-500/30 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 border-b border-white/[0.08] pb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-xl font-semibold text-white">Decline Scholar Access</h3>
                <p className="text-xs text-neutral-400 font-mono">
                  {declineReasonModal.name} • {declineReasonModal.rollNo}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs uppercase font-mono tracking-wider text-neutral-300">
                Reason for Declining / Feedback for Student
              </label>
              <textarea
                rows={3}
                value={declineNotes}
                onChange={(e) => setDeclineNotes(e.target.value)}
                placeholder="e.g. Uploaded ID was illegible or expired. Please upload a clear photo of your current college ID."
                className="w-full apple-glass-input p-3 text-xs text-white placeholder-neutral-500 rounded-xl"
              />
              <p className="text-[10px] text-neutral-400 font-mono">
                This note will be shown to the student on their workspace login screen so they can rectify and re-upload.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setDeclineReasonModal(null)}
                className="apple-glass-pill px-4 py-2 text-xs font-mono text-neutral-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDecline}
                className="bg-rose-500 hover:bg-rose-600 text-white px-5 py-2 rounded-full text-xs font-semibold uppercase tracking-wider font-mono cursor-pointer shadow-md"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN LIGHTBOX MODAL */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 cursor-zoom-out select-none"
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-5 right-5 p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white cursor-pointer z-50"
            title="Close Lightbox"
          >
            <X className="h-6 w-6" />
          </button>
          <div className="max-w-[92vw] max-h-[92vh] flex items-center justify-center">
            <img
              src={lightboxUrl}
              alt="College ID Fullscreen"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl border border-white/20"
            />
          </div>
        </div>
      )}
    </div>
  );
}

