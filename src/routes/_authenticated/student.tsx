import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { 
  GraduationCap, BookOpen, Scale, Search, FileText, 
  Sparkles, Users, ArrowUpRight, LogOut, ChevronRight, Menu, X, Landmark, ShieldCheck, User, Hash, Compass,
  Award, Upload, Image as ImageIcon, CheckCircle2, Lock, Trash2, ShieldAlert, Clock, AlertCircle
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole, StudentProfile } from "@/lib/user-role";

export const Route = createFileRoute("/_authenticated/student")({
  component: StudentLayout,
});

function StudentLayout() {
  const { user } = Route.useRouteContext();
  const { role, studentProfile, enrollAsStudent, isStudent, isLawyer, isFounder } = useUserRole(
    user?.id,
    user?.email
  );
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [isResubmittingAfterRejection, setIsResubmittingAfterRejection] = useState(false);

  // Intern status detection (from profile or explicit login checkbox)
  const isIntern = Boolean(
    studentProfile?.isIntern ||
    (typeof window !== "undefined" && localStorage.getItem("trana_is_intern") === "true")
  );

  // Dynamic Navigation based on Intern status
  const navItems = useMemo(() => {
    return [
      { to: "/student", label: "Overview", icon: BookOpen, exact: true },
      { to: "/student/drafter", label: "AI Drafter", icon: Sparkles },
      ...(isIntern ? [{ to: "/student/cases", label: "Case Tracker", icon: Scale }] : []),
      { to: "/student/publications", label: "Research & Achievements", icon: Award },
      { to: "/student/citations", label: "Citation Finder", icon: Search },
      { to: "/student/research", label: "Case Research", icon: Landmark },
      { to: "/student/documents", label: "My Documents", icon: FileText },
      { to: "/student/network", label: "Professional Network", icon: Users },
      { to: "/student/profile", label: "My Profile", icon: User },
    ];
  }, [isIntern]);

  // Filter items by search query if user types in search
  const filteredNav = searchQuery.trim()
    ? navItems.filter((item) =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : navItems;

  // Find active route index
  const activeRouteIndex = filteredNav.findIndex((item) => {
    if (item.exact) {
      return location.pathname === item.to || location.pathname === `${item.to}/`;
    }
    return location.pathname.startsWith(item.to);
  });

  // Student Enrollment Form states
  const [fullName, setFullName] = useState(
    studentProfile?.fullName || user?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || ""
  );
  const [university, setUniversity] = useState(studentProfile?.university || "");
  const [degree, setDegree] = useState(studentProfile?.degree || "5-Year B.A. LL.B. (Hons)");
  const [yearOfStudy, setYearOfStudy] = useState(studentProfile?.yearOfStudy || "3rd Year Scholar");
  const [city, setCity] = useState(studentProfile?.city || "New Delhi");
  const [studentId, setStudentId] = useState(studentProfile?.studentIdNumber || "");
  const [focus, setFocus] = useState(studentProfile?.focus || "");
  const [bio, setBio] = useState(studentProfile?.bio || "");
  const [collegeIdUrl, setCollegeIdUrl] = useState(studentProfile?.collegeIdUrl || "");
  const [collegeIdFileName, setCollegeIdFileName] = useState(studentProfile?.collegeIdFileName || "");
  const [isInternEnroll, setIsInternEnroll] = useState(
    studentProfile?.isIntern || (typeof window !== "undefined" && localStorage.getItem("trana_is_intern") === "true")
  );
  const [internFirm, setInternFirm] = useState(studentProfile?.internFirmOrChamber || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.title = isIntern ? "Legal Intern Workspace — TRANA" : "Law Student Workspace — TRANA";
  }, [location.pathname, isIntern]);

  useEffect(() => {
    if (studentProfile) {
      if (studentProfile.fullName) setFullName(studentProfile.fullName);
      if (studentProfile.university) setUniversity(studentProfile.university);
      if (studentProfile.studentIdNumber) setStudentId(studentProfile.studentIdNumber);
      if (studentProfile.degree) setDegree(studentProfile.degree);
      if (studentProfile.yearOfStudy) setYearOfStudy(studentProfile.yearOfStudy);
      if (studentProfile.city) setCity(studentProfile.city);
      if (studentProfile.focus) setFocus(studentProfile.focus);
      if (studentProfile.bio) setBio(studentProfile.bio);
      if (studentProfile.collegeIdUrl) setCollegeIdUrl(studentProfile.collegeIdUrl);
      if (studentProfile.collegeIdFileName) setCollegeIdFileName(studentProfile.collegeIdFileName);
      if (studentProfile.isIntern !== undefined) setIsInternEnroll(studentProfile.isIntern);
      if (studentProfile.internFirmOrChamber) setInternFirm(studentProfile.internFirmOrChamber);
    }
  }, [studentProfile]);

  const isEnrolled = Boolean(
    studentProfile &&
    studentProfile.university &&
    studentProfile.university.trim() &&
    studentProfile.studentIdNumber &&
    studentProfile.studentIdNumber.trim() &&
    studentProfile.collegeIdUrl
  );
  const isProfileRoute = location.pathname.startsWith("/student/profile");

  // Handle College ID File Upload
  function handleCollegeIdUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error("Please upload a valid image (PNG, JPG, WebP) or PDF of your student ID.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) return;

      // If image, compress via canvas to avoid blowing localStorage quota
      if (file.type.startsWith("image/")) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const maxDim = 1200;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL("image/jpeg", 0.82);
            setCollegeIdUrl(compressed);
            setCollegeIdFileName(file.name);
            toast.success(`College ID photo loaded: ${file.name}`);
          } else {
            setCollegeIdUrl(rawDataUrl);
            setCollegeIdFileName(file.name);
          }
        };
        img.src = rawDataUrl;
      } else {
        setCollegeIdUrl(rawDataUrl);
        setCollegeIdFileName(file.name);
        toast.success(`College ID document attached: ${file.name}`);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleEnrollSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!university.trim()) {
      toast.error("Please enter your law university or college name.");
      return;
    }
    if (!studentId.trim()) {
      toast.error("Please enter your student ID or college roll number.");
      return;
    }
    if (!collegeIdUrl) {
      toast.error("Please upload a clear photograph or scan of your College ID card for verification.");
      return;
    }

    setIsSubmitting(true);
    try {
      const profile: StudentProfile = {
        fullName: fullName.trim() || user?.name || "Law Student",
        university: university.trim(),
        degree: degree.trim(),
        yearOfStudy: yearOfStudy.trim(),
        studentIdNumber: studentId.trim(),
        city: city.trim() || "New Delhi",
        focus: focus.trim(),
        bio: bio.trim(),
        collegeIdUrl,
        collegeIdFileName: collegeIdFileName || "college_id_card.jpg",
        isIntern: Boolean(isInternEnroll),
        internFirmOrChamber: isInternEnroll ? internFirm.trim() : undefined,
        verificationStatus: "PENDING_VERIFICATION",
      };

      await enrollAsStudent(profile);
      if (typeof window !== "undefined") {
        localStorage.setItem("trana_is_intern", isInternEnroll ? "true" : "false");
      }
      toast.success("Student credentials & College ID submitted for verification! Welcome to TRANA.");
    } catch (err: any) {
      toast.error(err.message || "Failed to complete student enrollment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("trana_session_token");
      localStorage.removeItem("trana_user");
    }
    await supabase.auth.signOut().catch(() => {});
    navigate({ to: "/auth", replace: true });
  }

  // Access Declined Gate: Founders reviewed and declined access
  if (studentProfile?.verificationStatus === "REJECTED" && !isResubmittingAfterRejection && !isProfileRoute) {
    return (
      <div className="founders-canvas apple-glass-canvas relative min-h-screen text-[#F0F0F0] py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center selection:bg-white selection:text-black">
        <Toaster />
        <div className="fixed top-[-80px] left-[5%] w-[550px] h-[550px] rounded-full bg-rose-500/[0.04] blur-[140px] pointer-events-none -z-10" />
        <div className="fixed top-[30%] right-[-80px] w-[550px] h-[550px] rounded-full bg-white/[0.02] blur-[150px] pointer-events-none -z-10" />

        <div className="w-full max-w-xl apple-glass-card p-8 md:p-10 relative z-10 border border-rose-500/30 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-sm">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <span className="font-display text-2xl font-semibold tracking-[0.15em] text-white">TRANA</span>
                <p className="text-[0.7rem] text-rose-300 font-mono tracking-widest uppercase">Academic Verification</p>
              </div>
            </div>
            <div className="apple-glass-pill px-3 py-1 text-xs text-rose-300 font-mono border-rose-500/30 flex items-center gap-1.5">
              <span>Access Declined</span>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <h1 className="font-display text-2xl md:text-3xl font-medium text-white">
              Scholar Access Declined
            </h1>
            <p className="text-xs md:text-sm text-neutral-300 leading-relaxed">
              Your student registration and uploaded College ID document were reviewed by TRANA platform administrators and access was not approved.
            </p>

            {studentProfile?.decisionNotes && (
              <div className="bg-rose-500/10 border border-rose-500/25 p-3.5 rounded-xl space-y-1 mt-3">
                <span className="text-[10px] uppercase font-mono text-rose-300 font-semibold block">
                  Founders Feedback / Reason:
                </span>
                <p className="text-xs text-rose-200">
                  {studentProfile.decisionNotes}
                </p>
              </div>
            )}

            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-2 mt-4 text-xs font-mono text-neutral-300">
              <div className="flex justify-between">
                <span className="text-neutral-500">Institution:</span>
                <span className="text-white font-medium">{studentProfile.university || "Faculty of Law"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Roll Number:</span>
                <span className="text-amber-300 font-bold">{studentProfile.studentIdNumber || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Uploaded File:</span>
                <span className="text-neutral-300">{studentProfile.collegeIdFileName || "college_id.jpg"}</span>
              </div>
            </div>

            <p className="text-[11px] text-neutral-400 font-mono pt-2">
              Common reasons include illegible photos, expired academic session, or roll number discrepancies. You may re-upload a clear College ID card now to re-apply.
            </p>
          </div>

          <div className="mt-8 pt-5 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3">
            <Link
              to="/dashboard"
              className="text-xs font-mono uppercase tracking-wider text-neutral-400 hover:text-white transition-colors"
            >
              ← Return to Citizen Dashboard
            </Link>

            <button
              type="button"
              onClick={() => setIsResubmittingAfterRejection(true)}
              className="w-full sm:w-auto bg-white text-black hover:bg-neutral-200 px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all shadow-md cursor-pointer font-mono flex items-center justify-center gap-2"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Re-upload Valid ID Card</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mandatory Student Enrollment Gate: requires roll no, college, etc.
  if ((!isEnrolled || isResubmittingAfterRejection) && !isProfileRoute) {
    return (
      <div className="founders-canvas apple-glass-canvas relative min-h-screen text-[#F0F0F0] py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center selection:bg-white selection:text-black">
        <Toaster />
        {/* Ambient background subtle monochrome white glow */}
        <div className="fixed top-[-80px] left-[5%] w-[550px] h-[550px] rounded-full bg-white/[0.025] blur-[140px] pointer-events-none -z-10" />
        <div className="fixed top-[30%] right-[-80px] w-[550px] h-[550px] rounded-full bg-white/[0.02] blur-[150px] pointer-events-none -z-10" />

        <div className="w-full max-w-2xl apple-glass-card p-8 md:p-10 relative z-10">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-white/[0.12] border border-white/20 flex items-center justify-center text-purple-300 shadow-sm">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <span className="font-display text-2xl font-semibold tracking-[0.15em] text-white">TRANA</span>
                <p className="text-[0.7rem] text-neutral-400 tracking-widest uppercase">Student Scholar Enrollment</p>
              </div>
            </div>
            <div className="apple-glass-pill px-3 py-1 text-xs text-purple-300 font-mono flex items-center gap-1.5 border-purple-500/30">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Academic Edition</span>
            </div>
          </div>

          <div className="mt-6">
            <h1 className="font-display text-2xl md:text-3xl font-medium text-white">
              Law Student Enrollment Form
            </h1>
            <p className="mt-2 text-xs md:text-sm text-neutral-300 leading-relaxed">
              Please enter your law college details and roll number to initialize your student academic workspace: AI Drafter for moot court memorials, Case Tracker, Statutory Precedent Search, and Student Network.
            </p>
          </div>

          <form onSubmit={handleEnrollSubmit} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[0.7rem] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  className="w-full apple-glass-input px-3.5 py-2.5 text-xs text-white placeholder-neutral-500"
                />
              </div>

              <div>
                <label className="block text-[0.7rem] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
                  Campus City / Location *
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. New Delhi"
                  className="w-full apple-glass-input px-3.5 py-2.5 text-xs text-white placeholder-neutral-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[0.7rem] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
                Law University / College / Faculty of Law *
              </label>
              <input
                type="text"
                required
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                placeholder="e.g. National Law University Delhi, NLSIU, Faculty of Law DU, ILS Pune"
                className="w-full apple-glass-input px-3.5 py-2.5 text-xs text-white placeholder-neutral-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[0.7rem] uppercase tracking-wider text-purple-300 font-mono mb-1.5 flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  <span>Student ID / College Roll No. *</span>
                </label>
                <input
                  type="text"
                  required
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. 2023/BALLB/042, NLU-D-21-098"
                  className="w-full apple-glass-input px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-[0.7rem] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
                  Degree Program *
                </label>
                <select
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                  className="w-full apple-glass-input px-3 py-2.5 text-xs text-white"
                >
                  <option value="5-Year B.A. LL.B. (Hons)" className="bg-[#121216] text-white">5-Year B.A. LL.B. (Hons)</option>
                  <option value="5-Year B.B.A. LL.B. (Hons)" className="bg-[#121216] text-white">5-Year B.B.A. LL.B. (Hons)</option>
                  <option value="3-Year LL.B. Degree" className="bg-[#121216] text-white">3-Year LL.B. Degree</option>
                  <option value="LL.M. Postgraduate Scholar" className="bg-[#121216] text-white">LL.M. Postgraduate Scholar</option>
                  <option value="Ph.D. Legal Scholar" className="bg-[#121216] text-white">Ph.D. Legal Scholar</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[0.7rem] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
                  Year of Study *
                </label>
                <select
                  value={yearOfStudy}
                  onChange={(e) => setYearOfStudy(e.target.value)}
                  className="w-full apple-glass-input px-3 py-2.5 text-xs text-white"
                >
                  <option value="1st Year Undergrad" className="bg-[#121216] text-white">1st Year Undergrad</option>
                  <option value="2nd Year Undergrad" className="bg-[#121216] text-white">2nd Year Undergrad</option>
                  <option value="3rd Year Scholar" className="bg-[#121216] text-white">3rd Year Scholar</option>
                  <option value="4th Year Pre-Final" className="bg-[#121216] text-white">4th Year Pre-Final</option>
                  <option value="5th Year Finalist" className="bg-[#121216] text-white">5th Year Finalist</option>
                  <option value="Postgraduate LL.M." className="bg-[#121216] text-white">Postgraduate LL.M.</option>
                  <option value="Doctoral Scholar" className="bg-[#121216] text-white">Doctoral Scholar</option>
                </select>
              </div>

              <div>
                <label className="block text-[0.7rem] uppercase tracking-wider text-neutral-400 font-mono mb-1.5 flex items-center gap-1">
                  <Compass className="h-3 w-3 text-purple-400" />
                  <span>Academic Focus (Optional)</span>
                </label>
                <input
                  type="text"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  placeholder="e.g. Constitutional Law, BNSS, Moot Court"
                  className="w-full apple-glass-input px-3.5 py-2.5 text-xs text-white placeholder-neutral-500"
                />
              </div>
            </div>

            {/* College ID Photo Upload (Required for Founders Verification) */}
            <div className="pt-2">
              <label className="block text-[0.7rem] uppercase tracking-wider text-purple-300 font-mono mb-1.5 flex items-center gap-1.5">
                <Upload className="h-3.5 w-3.5 text-purple-400" />
                <span>Upload College ID Card (Photo / Scan) *</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleCollegeIdUpload}
                className="hidden"
              />

              {collegeIdUrl ? (
                <div className="p-3.5 rounded-xl border border-purple-500/40 bg-purple-950/20 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {collegeIdUrl.startsWith("data:image/") ? (
                      <img
                        src={collegeIdUrl}
                        alt="College ID Preview"
                        className="w-14 h-10 object-cover rounded-lg border border-white/20 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-10 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-purple-300 shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">
                        {collegeIdFileName || "Student_College_ID.jpg"}
                      </p>
                      <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Ready for Founders ID Verification</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="apple-glass-pill px-3 py-1 text-[11px] font-mono text-neutral-300 hover:text-white cursor-pointer"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCollegeIdUrl("");
                        setCollegeIdFileName("");
                      }}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                      title="Remove file"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-5 rounded-xl border-2 border-dashed border-white/20 hover:border-purple-400/60 bg-white/[0.02] hover:bg-white/[0.05] transition-all cursor-pointer text-center group"
                >
                  <div className="h-10 w-10 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-300 mx-auto mb-2 group-hover:scale-105 transition-transform">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-medium text-white group-hover:text-purple-300 transition-colors">
                    Click to browse and upload College ID Photo
                  </p>
                  <p className="text-[10px] text-neutral-400 font-mono mt-1">
                    Supports JPG, PNG, WebP or PDF. Verified by TRANA Founders.
                  </p>
                </div>
              )}
            </div>

            {/* Legal Intern Status Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-all cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={isInternEnroll}
                  onChange={(e) => setIsInternEnroll(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/30 bg-black text-purple-500 accent-purple-500 focus:ring-1 focus:ring-purple-400 cursor-pointer shrink-0"
                />
                <div className="text-xs">
                  <span className="font-semibold text-white group-hover:text-purple-300 transition-colors block">
                    I am interning with an Advocate, Chamber, or Law Firm
                  </span>
                  <span className="text-neutral-400 leading-relaxed block mt-0.5">
                    Enables the litigation eCourts Case Tracker in your workspace. (Standard law students have access to AI Drafter, Citation Finder, Case Research, and Research & Achievements).
                  </span>
                </div>
              </label>

              {isInternEnroll && (
                <div className="mt-3 pl-7">
                  <label className="block text-[0.7rem] uppercase tracking-wider text-purple-300 font-mono mb-1">
                    Chamber / Law Firm / Senior Advocate Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={internFirm}
                    onChange={(e) => setInternFirm(e.target.value)}
                    placeholder="e.g. Chamber of Senior Advocate, Delhi High Court"
                    className="w-full apple-glass-input px-3.5 py-2 text-xs text-white placeholder-neutral-500"
                  />
                </div>
              )}
            </div>

            <div className="pt-4 flex items-center justify-between gap-4 border-t border-white/[0.08]">
              <Link
                to="/dashboard"
                className="text-xs uppercase tracking-wider text-neutral-400 hover:text-white transition-colors"
              >
                ← Return to Citizen Dashboard
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-white text-black hover:bg-neutral-200 px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-[0.15em] transition-all flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{isSubmitting ? "Enrolling..." : "Submit Verification & Launch"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const studentDisplayName = studentProfile?.fullName || fullName || user?.name || user?.email?.split("@")[0] || "Law Student";
  const studentCollege = studentProfile?.university || "National Law University";

  const sidebarContent = (
    <div className="flex h-full flex-col text-[#F0F0F0] relative overflow-hidden select-none">
      {/* Brand Header */}
      <div className="p-4 pb-3 flex items-center justify-between relative border-b border-white/[0.08]">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            className="w-9 h-9 rounded-xl bg-black border border-white/20 flex items-center justify-center shadow-md text-white font-bold font-serif text-lg shrink-0 hover:scale-105 hover:border-white/40 transition-all overflow-hidden"
            title="TRANA Home"
          >
            <img src="/favicon.svg" alt="TRANA" className="w-full h-full object-cover" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                to="/"
                className="font-display font-bold text-base text-white tracking-wide hover:text-neutral-200 transition-colors truncate"
              >
                TRANA
              </Link>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {isIntern ? "LEGAL INTERN" : "STUDENT"}
              </span>
              {studentProfile?.verificationStatus === "VERIFIED" && (
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  <span>VERIFIED</span>
                </span>
              )}
              {studentProfile?.verificationStatus === "PENDING_VERIFICATION" && (
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  <span>UNDER REVIEW</span>
                </span>
              )}
            </div>
            <div className="text-[11px] text-neutral-400 font-sans truncate leading-none mt-0.5">
              {isIntern ? "Legal Intern Workspace" : "Law Student Workspace"}
            </div>
          </div>
        </div>
      </div>

      {/* Pill Search Bar */}
      <div className="px-3 pt-3 pb-1">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search scholar workspace..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-12 py-1.5 text-xs text-white placeholder-neutral-400/60 bg-white/[0.07] hover:bg-white/[0.12] focus:bg-white/[0.14] border border-white/15 focus:border-white/40 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] transition-all outline-none"
          />
          <span className="absolute right-2.5 px-1.5 py-0.5 text-[9px] font-mono font-medium rounded-full bg-white/10 border border-white/20 text-neutral-300 pointer-events-none shadow-sm">
            ⌘K
          </span>
        </div>
      </div>

      {/* Navigation Area */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3">
        <nav className="relative select-none space-y-0.5">
          {filteredNav.map((item, idx) => {
            const Icon = item.icon;
            const isActive = idx === activeRouteIndex;

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2 my-0.5 rounded-full text-xs font-sans transition-all relative cursor-pointer ${
                  isActive
                    ? "text-white font-semibold border border-purple-500/30 bg-purple-500/10 shadow-[0_0_12px_rgba(168,85,247,0.15)]"
                    : "text-neutral-300 hover:text-white hover:font-semibold hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-purple-300" : "text-neutral-400"}`} />
                  <span className="tracking-normal truncate">{item.label}</span>
                </div>
                {isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / User Badge */}
      <div className="p-3 border-t border-white/[0.08] bg-black/25 backdrop-blur-xl mt-auto space-y-2">
        <div className="relative overflow-hidden rounded-2xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/15 p-2 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.3),0_8px_20px_rgba(0,0,0,0.35)] transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-400/40 via-white/50 to-purple-400/20 p-[1px] shadow-sm">
                  <div className="w-full h-full rounded-full bg-[#121216] flex items-center justify-center text-xs font-semibold text-white">
                    {studentDisplayName.slice(0, 2).toUpperCase()}
                  </div>
                </div>
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-purple-400 border border-[#121216] shadow-[0_0_6px_rgba(168,85,247,0.9)]" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-white leading-tight">{studentDisplayName}</p>
                <p className="truncate text-[10px] font-mono text-neutral-400 leading-tight mt-0.5">{studentCollege}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1 pt-1 text-[11px] font-mono">
          <Link
            to="/dashboard"
            className="flex items-center justify-between text-neutral-300 hover:text-white px-2 py-1 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <span>Citizen Dashboard</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full text-center py-1.5 text-[10px] uppercase tracking-wider text-neutral-400 hover:text-red-400 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="founders-canvas apple-glass-canvas relative min-h-screen text-[#F0F0F0] selection:bg-white selection:text-black">
      <Toaster />

      {/* Ambient background subtle monochrome white glow */}
      <div className="fixed top-[-80px] left-[5%] w-[550px] h-[550px] rounded-full bg-purple-500/[0.03] blur-[140px] pointer-events-none -z-10 animate-ambient-pulse" />
      <div className="fixed top-[30%] right-[-80px] w-[550px] h-[550px] rounded-full bg-white/[0.02] blur-[150px] pointer-events-none -z-10 animate-ambient-pulse-reverse" />

      {/* Desktop Left Sidebar: Fixed Floating Apple Glass */}
      <aside className="hidden md:flex flex-col fixed top-0 left-0 bottom-0 w-[280px] p-3 lg:p-4 z-40 select-none">
        <div className="apple-floating-sidebar w-full h-full flex flex-col relative overflow-hidden">
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="flex items-center justify-between border-b border-white/10 bg-[#0d0b14]/80 backdrop-blur-2xl px-4 py-3 md:hidden sticky top-0 z-40 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-black border border-white/20 flex items-center justify-center shadow-md overflow-hidden shrink-0">
            <img src="/favicon.svg" alt="TRANA" className="w-full h-full object-cover" />
          </div>
          <span className="font-display text-base tracking-[0.15em] text-[#F0F0F0]">TRANA</span>
          <span className="apple-glass-pill text-[9px] px-1.5 py-0.5 text-neutral-300 font-mono">
            {isIntern ? "LEGAL INTERN" : "STUDENT"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1.5 apple-glass-pill text-[#F0F0F0] cursor-pointer"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </header>

      {/* Mobile Sidebar Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md md:hidden flex p-3">
          <div className="apple-floating-sidebar w-[280px] h-full flex flex-col relative overflow-hidden shadow-2xl">
            <button
              aria-label="Close menu"
              className="absolute right-3.5 top-3.5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/25 text-neutral-300 hover:text-white z-50 transition-all cursor-pointer"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="md:ml-[280px] min-h-screen text-[#F0F0F0] p-4 md:p-6 lg:p-8 relative z-10">
        <div className="max-w-7xl mx-auto space-y-6">
          {studentProfile?.verificationStatus === "PENDING_VERIFICATION" && (
            <div className="apple-glass-card border-amber-500/30 bg-amber-500/[0.04] p-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <div>
                  <span className="font-semibold text-amber-300 font-mono uppercase text-[10px] tracking-wider block sm:inline sm:mr-2">
                    ID Verification Pending
                  </span>
                  <span className="text-neutral-300">
                    Your College ID card is being reviewed by TRANA founders. You have provisional access to student drafting and research tools.
                  </span>
                </div>
              </div>
              <div className="text-[10px] font-mono text-neutral-400 shrink-0">
                File: {studentProfile.collegeIdFileName || "college_id.jpg"}
              </div>
            </div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}

