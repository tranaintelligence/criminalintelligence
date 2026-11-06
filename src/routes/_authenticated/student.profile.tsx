import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { 
  GraduationCap, Sparkles, Building2, MapPin, Save, 
  ArrowLeft, CheckCircle2, ShieldCheck, BookOpen, User, Hash, Compass
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
    }
  }, [studentProfile]);

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
      };

      await enrollAsStudent(updated);
      toast.success("Student profile and roll number updated successfully!");
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
                STUDENT
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

