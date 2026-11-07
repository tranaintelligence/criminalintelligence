import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { 
  GraduationCap, Sparkles, Building2, MapPin, Save, 
  ArrowLeft, CheckCircle2, ShieldCheck, BookOpen, User, Hash, Compass,
  Upload, Image as ImageIcon, Trash2, Scale, Clock, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { useUserRole, StudentProfile } from "@/lib/user-role";

export const Route = createFileRoute("/_authenticated/student/profile")({
  head: () => ({
    meta: [
      { title: "Student Profile — TRANA" },
      { name: "description", content: "Manage your law student scholar credentials, university enrollment, and roll number." },
      { property: "og:title", content: "Student Profile — TRANA" },
    ],
  }),
  component: StudentProfilePage,
});

function StudentProfilePage() {
  const { user } = Route.useRouteContext();
  const { studentProfile, enrollAsStudent } = useUserRole(user?.id, user?.email);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fullName, setFullName] = useState(
    studentProfile?.fullName || user?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || ""
  );
  const [university, setUniversity] = useState(studentProfile?.university || "");
  const [studentId, setStudentId] = useState(studentProfile?.studentIdNumber || "");
  const [degree, setDegree] = useState(studentProfile?.degree || "5-Year B.A. LL.B. (Hons)");
  const [yearOfStudy, setYearOfStudy] = useState(studentProfile?.yearOfStudy || "3rd Year Scholar");
  const [city, setCity] = useState(studentProfile?.city || "New Delhi");
  const [focus, setFocus] = useState(
    studentProfile?.focus || "Constitutional Law, Criminal Procedure (BNSS), Moot Court"
  );
  const [bio, setBio] = useState(studentProfile?.bio || "");
  const [collegeIdUrl, setCollegeIdUrl] = useState(studentProfile?.collegeIdUrl || "");
  const [collegeIdFileName, setCollegeIdFileName] = useState(studentProfile?.collegeIdFileName || "");
  const [isInternProfile, setIsInternProfile] = useState(
    studentProfile?.isIntern || (typeof window !== "undefined" && localStorage.getItem("trana_is_intern") === "true")
  );
  const [internFirm, setInternFirm] = useState(studentProfile?.internFirmOrChamber || "");
  const [isSaving, setIsSaving] = useState(false);

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
      if (studentProfile.isIntern !== undefined) setIsInternProfile(studentProfile.isIntern);
      if (studentProfile.internFirmOrChamber) setInternFirm(studentProfile.internFirmOrChamber);
    }
  }, [studentProfile]);

  function handleCollegeIdUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error("Please upload an image (PNG, JPG, WebP) or PDF of your student ID card.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) return;

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
            toast.success(`College ID photo uploaded: ${file.name}`);
          } else {
            setCollegeIdUrl(rawDataUrl);
            setCollegeIdFileName(file.name);
          }
        };
        img.src = rawDataUrl;
      } else {
        setCollegeIdUrl(rawDataUrl);
        setCollegeIdFileName(file.name);
        toast.success(`College ID file selected: ${file.name}`);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (!university.trim()) {
      toast.error("Please enter your law university or college name.");
      return;
    }
    if (!studentId.trim()) {
      toast.error("Please enter your student ID or college roll number.");
      return;
    }

    setIsSaving(true);
    try {
      const updated: StudentProfile = {
        fullName: fullName.trim() || user?.name || "Law Student",
        university: university.trim(),
        studentIdNumber: studentId.trim(),
        degree: degree.trim(),
        yearOfStudy: yearOfStudy.trim(),
        city: city.trim() || "New Delhi",
        focus: focus.trim(),
        bio: bio.trim(),
        collegeIdUrl,
        collegeIdFileName: collegeIdFileName || "college_id.jpg",
        isIntern: Boolean(isInternProfile),
        internFirmOrChamber: isInternProfile ? internFirm.trim() : undefined,
        verificationStatus: studentProfile?.verificationStatus || "PENDING_VERIFICATION",
      };

      await enrollAsStudent(updated);
      if (typeof window !== "undefined") {
        localStorage.setItem("trana_is_intern", isInternProfile ? "true" : "false");
        window.dispatchEvent(new Event("trana_role_updated"));
      }
      toast.success("Student profile, College ID & intern credentials updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save student profile.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <Link
            to="/student"
            className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors font-mono mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Student Workspace</span>
          </Link>
          <h1 className="font-display text-3xl md:text-4xl font-medium text-white">
            Student Scholar Profile
          </h1>
          <p className="mt-1 text-xs md:text-sm text-neutral-400">
            Manage your university affiliation, degree program, roll number, and research focus.
          </p>
        </div>

        <div className="apple-glass-pill px-3 py-1.5 flex items-center gap-2 self-start sm:self-auto">
          <GraduationCap className="h-4 w-4 text-purple-300" />
          <span className="text-xs font-mono text-purple-200">
            {studentProfile?.studentIdNumber ? `Roll No: ${studentProfile.studentIdNumber}` : "Scholar ID"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form */}
        <form onSubmit={handleSave} className="lg:col-span-2 space-y-6">
          <div className="apple-glass-card p-6 md:p-8 space-y-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300 font-mono flex items-center gap-2">
              <User className="h-4 w-4 text-purple-400" />
              <span>Academic Enrollment Particulars</span>
            </h2>

            {/* Full Name */}
            <div>
              <label className="block text-[0.7rem] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
                Full Legal Name *
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

            {/* University & Campus City */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[0.7rem] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
                  Law University / College *
                </label>
                <input
                  type="text"
                  required
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  placeholder="e.g. National Law University, Delhi"
                  className="w-full apple-glass-input px-3.5 py-2.5 text-xs text-white placeholder-neutral-500"
                />
              </div>

              <div>
                <label className="block text-[0.7rem] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
                  Campus City / State *
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

            {/* Student ID / Roll Number & Degree */}
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
                  placeholder="e.g. 2023/BALLB/042"
                  className="w-full apple-glass-input px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 font-mono uppercase"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Official roll number inscribed on college identity card
                </span>
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

            {/* Year of Study */}
            <div>
              <label className="block text-[0.7rem] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
                Current Year of Study *
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

            {/* Research Focus */}
            <div>
              <label className="block text-[0.7rem] uppercase tracking-wider text-neutral-400 font-mono mb-1.5 flex items-center gap-1">
                <Compass className="h-3 w-3 text-purple-400" />
                <span>Academic Focus & Research Interests</span>
              </label>
              <input
                type="text"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="e.g. Constitutional Writs, BNSS Bail Jurisprudence, Moot Court & Cyber Law"
                className="w-full apple-glass-input px-3.5 py-2.5 text-xs text-white placeholder-neutral-500"
              />
            </div>

            {/* Bio / Experience */}
            <div>
              <label className="block text-[0.7rem] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
                Bio & Academic Summary (Optional)
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="e.g. Student editor at Law Journal; moot court researcher in criminal appeals and procedural rights under BNSS."
                className="w-full apple-glass-input px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 rounded-2xl resize-none"
              />
            </div>

            {/* College ID Photo Upload & Verification Status */}
            <div className="pt-2 border-t border-white/[0.06]">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[0.7rem] uppercase tracking-wider text-purple-300 font-mono flex items-center gap-1.5">
                  <Upload className="h-3.5 w-3.5 text-purple-400" />
                  <span>College ID Card (For Founders Verification)</span>
                </label>
                {studentProfile?.verificationStatus === "VERIFIED" ? (
                  <span className="apple-glass-pill px-2.5 py-0.5 text-[10px] font-mono text-emerald-400 border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>ID Verified</span>
                  </span>
                ) : studentProfile?.verificationStatus === "REJECTED" ? (
                  <span className="apple-glass-pill px-2.5 py-0.5 text-[10px] font-mono text-rose-400 border-rose-500/30 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    <span>Rejected - Re-upload</span>
                  </span>
                ) : (
                  <span className="apple-glass-pill px-2.5 py-0.5 text-[10px] font-mono text-amber-300 border-amber-500/30 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Pending Founders Review</span>
                  </span>
                )}
              </div>

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
                        className="w-16 h-12 object-cover rounded-lg border border-white/20 shrink-0 shadow-sm"
                      />
                    ) : (
                      <div className="w-16 h-12 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-purple-300 shrink-0">
                        <BookOpen className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">
                        {collegeIdFileName || "College_ID_Card.jpg"}
                      </p>
                      <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                        Uploaded for student verification
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="apple-glass-pill px-3 py-1 text-[11px] font-mono text-neutral-300 hover:text-white cursor-pointer"
                    >
                      Update ID
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
                    Upload or Update College ID Card
                  </p>
                  <p className="text-[10px] text-neutral-400 font-mono mt-1">
                    Visible to Founders for verification. JPG, PNG or PDF.
                  </p>
                </div>
              )}
            </div>

            {/* Legal Intern Checkbox */}
            <div className="pt-2 border-t border-white/[0.06]">
              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-all cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={isInternProfile}
                  onChange={(e) => setIsInternProfile(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/30 bg-black text-purple-500 accent-purple-500 focus:ring-1 focus:ring-purple-400 cursor-pointer shrink-0"
                />
                <div className="text-xs">
                  <span className="font-semibold text-white group-hover:text-purple-300 transition-colors block">
                    Legal Intern Mode (Enables Litigation Case Tracker)
                  </span>
                  <span className="text-neutral-400 leading-relaxed block mt-0.5">
                    Check this if you are actively interning with an advocate or chamber to track real eCourts litigation proceedings.
                  </span>
                </div>
              </label>

              {isInternProfile && (
                <div className="mt-3 pl-7">
                  <label className="block text-[0.7rem] uppercase tracking-wider text-purple-300 font-mono mb-1">
                    Senior Advocate / Chamber / Firm Name
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

            <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between">
              <span className="text-[11px] text-neutral-400 font-mono">
                Email: {user.email}
              </span>
              <button
                type="submit"
                disabled={isSaving}
                className="bg-white text-black hover:bg-neutral-200 px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-[0.15em] transition-all flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isSaving ? "Saving..." : "Save Profile"}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Right 1 Col: Live Identity Preview Card */}
        <div className="space-y-4">
          <div className="apple-glass-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
                Network ID Card
              </span>
              <span className="apple-glass-pill text-[9px] px-2 py-0.5 text-purple-300 font-mono">
                {isInternProfile ? "LEGAL INTERN" : "STUDENT"}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-purple-500/30 via-white/40 to-purple-500/20 p-[1px] shadow-sm">
                  <div className="w-full h-full rounded-2xl bg-[#121216] flex items-center justify-center font-display text-white text-lg font-bold">
                    {(fullName || "S").slice(0, 2).toUpperCase()}
                  </div>
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-lg text-white font-medium truncate">
                    {fullName || "Student Name"}
                  </h3>
                  <p className="text-xs text-purple-300 font-mono truncate">
                    {degree}
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-white/[0.05] p-3 border border-white/[0.08] space-y-1.5 text-xs">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-neutral-400 font-mono block">
                    College / University
                  </span>
                  <span className="text-white font-medium line-clamp-1">
                    {university || "Your Law University"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/[0.06]">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-neutral-400 font-mono block">
                      Roll Number
                    </span>
                    <span className="text-purple-300 font-mono text-xs">
                      {studentId || "Not set"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-neutral-400 font-mono block">
                      Year
                    </span>
                    <span className="text-neutral-300 font-mono text-xs">
                      {yearOfStudy}
                    </span>
                  </div>
                </div>

                {city && (
                  <div className="pt-1 border-t border-white/[0.06] flex items-center gap-1 text-[11px] text-neutral-400 font-mono">
                    <MapPin className="h-3 w-3 text-neutral-500" />
                    <span>{city}</span>
                  </div>
                )}

                {isInternProfile && internFirm && (
                  <div className="pt-1 border-t border-white/[0.06] text-[11px] text-purple-300 font-mono flex items-center gap-1">
                    <Scale className="h-3 w-3 text-purple-400 shrink-0" />
                    <span className="truncate">{internFirm}</span>
                  </div>
                )}

                {collegeIdUrl && (
                  <div className="pt-2 border-t border-white/[0.06]">
                    <span className="text-[9px] uppercase tracking-wider text-neutral-400 font-mono block mb-1">
                      College ID Document
                    </span>
                    <div className="rounded-lg overflow-hidden border border-white/10 bg-black/40">
                      {collegeIdUrl.startsWith("data:image/") ? (
                        <img
                          src={collegeIdUrl}
                          alt="ID Card"
                          className="w-full h-24 object-cover"
                        />
                      ) : (
                        <div className="p-3 text-xs text-neutral-300 flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-purple-400" />
                          <span className="truncate">{collegeIdFileName || "College ID File"}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {focus && (
                <div className="text-xs text-neutral-300">
                  <span className="text-[9px] uppercase tracking-wider text-neutral-400 font-mono block mb-0.5">
                    Focus & Research
                  </span>
                  <p className="line-clamp-2 leading-relaxed text-neutral-300 text-[11px]">
                    {focus}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="apple-glass-card p-4 text-xs text-neutral-400 flex items-start gap-3">
            <ShieldCheck className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Your roll number and university affiliation are securely stored and verified within the TRANA network.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

