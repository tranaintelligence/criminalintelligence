import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/routes/founders";

export type UserRole = "citizen" | "lawyer" | "student" | "founder";

export interface StudentProfile {
  fullName?: string;
  university: string;
  degree: string;
  yearOfStudy: string;
  studentIdNumber?: string;
  city?: string;
  focus?: string;
  bio?: string;
  collegeIdUrl?: string; // Data URL or photo of College ID card
  collegeIdFileName?: string;
  verificationStatus?: "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";
  isIntern?: boolean; // If true, enables Case Tracker
  internFirmOrChamber?: string;
  enrolledAt?: string;
  decisionNotes?: string;
}

export function getStoredUserRole(userId?: string | null, email?: string | null): UserRole {
  if (!userId && !email) return "citizen";

  // 1. Founder check
  if (checkIsAdmin(email)) return "founder";

  if (typeof window === "undefined") return "citizen";

  // 2. Explicit role override stored in localStorage
  if (userId) {
    const explicit = localStorage.getItem(`trana_user_role_${userId}`);
    if (explicit === "founder" || explicit === "lawyer" || explicit === "student" || explicit === "citizen") {
      return explicit as UserRole;
    }

    // 3. Student enrollment check
    const studentData = localStorage.getItem(`trana_student_enrolled_${userId}`) || localStorage.getItem(`trana_student_profile_${userId}`);
    if (studentData) return "student";

    // 4. Lawyer check
    const isLawyerVerified = localStorage.getItem(`trana_lawyer_verified_${userId}`) === "true";
    if (isLawyerVerified) return "lawyer";
  }

  // 5. Check cached user object
  try {
    const rawUser = localStorage.getItem("trana_user");
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed.role === "lawyer" || parsed.role === "student" || parsed.role === "founder") {
        return parsed.role;
      }
    }
  } catch {}

  return "citizen";
}

export function getStoredStudentProfile(userId?: string | null): StudentProfile | null {
  if (typeof window === "undefined") return null;
  try {
    if (userId) {
      const raw = localStorage.getItem(`trana_student_enrolled_${userId}`) || localStorage.getItem(`trana_student_profile_${userId}`);
      if (raw) return JSON.parse(raw);
    }
    const globalRaw = localStorage.getItem("trana_student_profile");
    if (globalRaw) return JSON.parse(globalRaw);
  } catch {}
  return null;
}

export function useUserRole(userId?: string | null, email?: string | null) {
  const [role, setRoleState] = useState<UserRole>(() => getStoredUserRole(userId, email));
  const [studentProfile, setStudentProfileState] = useState<StudentProfile | null>(() =>
    getStoredStudentProfile(userId)
  );
  const [isLoading, setIsLoading] = useState(false);

  // Sync role and student profile from Supabase & localStorage
  const syncRole = useCallback(async () => {
    if (!userId && !email) return;

    // Always check and load studentProfile
    let student = getStoredStudentProfile(userId);
    if (!student) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user?.user_metadata?.student_profile) {
          student = authData.user.user_metadata.student_profile;
          if (userId && typeof window !== "undefined") {
            localStorage.setItem(`trana_student_enrolled_${userId}`, JSON.stringify(student));
            localStorage.setItem(`trana_student_profile_${userId}`, JSON.stringify(student));
          }
        }
      } catch {}
    }
    if (student) {
      setStudentProfileState(student);
    }

    if (checkIsAdmin(email)) {
      setRoleState("founder");
      return;
    }

    // Check lawyer enrollment in database
    try {
      const { data: lawyerRows } = await supabase
        .from("lawyers")
        .select("id, approved, verification_status")
        .or(`user_id.eq.${userId || ""},email.eq.${email || ""}`)
        .limit(1);

      if (lawyerRows && lawyerRows.length > 0) {
        const l = lawyerRows[0];
        if (l.approved || l.verification_status === "VERIFIED") {
          setRoleState("lawyer");
          if (userId && typeof window !== "undefined") {
            localStorage.setItem(`trana_user_role_${userId}`, "lawyer");
          }
          return;
        }
      }
    } catch {}

    // Check if enrolled as student
    if (student) {
      setRoleState("student");
      return;
    }

    // Check Supabase user metadata
    try {
      const { data: authData } = await supabase.auth.getUser();
      const meta = authData.user?.user_metadata;
      if (meta?.role === "student" || meta?.role === "lawyer" || meta?.role === "founder") {
        setRoleState(meta.role as UserRole);
        return;
      }
    } catch {}

    // Fallback to local storage or citizen
    setRoleState(getStoredUserRole(userId, email));
  }, [userId, email]);

  useEffect(() => {
    syncRole();

    const handleRoleUpdate = () => {
      syncRole();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("trana_role_updated", handleRoleUpdate);
      return () => window.removeEventListener("trana_role_updated", handleRoleUpdate);
    }
  }, [syncRole]);

  // Onboard as a Law Student
  const enrollAsStudent = useCallback(
    async (profile: StudentProfile) => {
      setIsLoading(true);
      try {
        const enriched: StudentProfile = {
          ...profile,
          enrolledAt: profile.enrolledAt || new Date().toISOString(),
        };

        if (typeof window !== "undefined") {
          if (userId) {
            localStorage.setItem(`trana_student_enrolled_${userId}`, JSON.stringify(enriched));
            localStorage.setItem(`trana_student_profile_${userId}`, JSON.stringify(enriched));
            localStorage.setItem(`trana_user_role_${userId}`, "student");
          }
          localStorage.setItem("trana_student_profile", JSON.stringify(enriched));
          if (enriched.isIntern !== undefined) {
            localStorage.setItem("trana_is_intern", enriched.isIntern ? "true" : "false");
          }
        }

        // Also persist in Supabase user metadata
        await supabase.auth.updateUser({
          data: {
            role: "student",
            student_profile: enriched,
          },
        }).catch(() => {});

        // Also register in central directory for networking & founders review
        try {
          const stored = JSON.parse(localStorage.getItem("trana_all_registered_students") || "[]");
          const entry = {
            id: userId || "student-" + Date.now(),
            name: enriched.fullName || "Law Student",
            role: "student",
            roleLabel: enriched.isIntern ? `Legal Intern (${enriched.degree})` : `Law Student (${enriched.degree})`,
            affiliation: enriched.university,
            city: enriched.city || "New Delhi",
            experienceOrYear: enriched.yearOfStudy,
            specialisationOrInterests: enriched.focus || "Constitutional Law, Criminal Procedure & Statutory AI Research",
            rollNo: enriched.studentIdNumber || "",
            bio: enriched.bio || "",
            collegeIdUrl: enriched.collegeIdUrl || null,
            collegeIdFileName: enriched.collegeIdFileName || null,
            verificationStatus: enriched.verificationStatus || "PENDING_VERIFICATION",
            isIntern: Boolean(enriched.isIntern),
            internFirmOrChamber: enriched.internFirmOrChamber || "",
            isVerified: enriched.verificationStatus === "VERIFIED",
            email: email,
            enrolledAt: enriched.enrolledAt,
          };
          const updated = stored.filter((s: any) => s.id !== (userId || entry.id));
          updated.push(entry);
          localStorage.setItem("trana_all_registered_students", JSON.stringify(updated));
        } catch {}

        setRoleState("student");
        setStudentProfileState(enriched);

        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("trana_role_updated"));
        }
      } finally {
        setIsLoading(false);
      }
    },
    [userId, email]
  );

  // Switch Role
  const switchRole = useCallback(
    async (newRole: UserRole) => {
      if (!userId) return;
      if (typeof window !== "undefined") {
        localStorage.setItem(`trana_user_role_${userId}`, newRole);
        window.dispatchEvent(new Event("trana_role_updated"));
      }
      setRoleState(newRole);

      await supabase.auth.updateUser({
        data: { role: newRole },
      }).catch(() => {});
    },
    [userId]
  );

  const isCitizen = role === "citizen";
  const isLawyer = role === "lawyer" || role === "founder";
  const isStudent = role === "student";
  const isFounder = role === "founder";

  // Strict Permissions Matrix:
  // - Citizen: citizen dashboard only
  // - Lawyer: citizen dashboard + lawyer dashboard
  // - Student: citizen dashboard + student dashboard (restricted lawyer tools)
  // - Founder: citizen dashboard + lawyer dashboard + student dashboard + founders workspace
  const canAccessCitizen = true;
  const canAccessLawyer = role === "lawyer" || role === "founder";
  const canAccessStudent = role === "student" || role === "lawyer" || role === "founder";
  const canAccessFounder = role === "founder";

  return {
    role,
    studentProfile,
    isLoading,
    isCitizen,
    isLawyer,
    isStudent,
    isFounder,
    canAccessCitizen,
    canAccessLawyer,
    canAccessStudent,
    canAccessFounder,
    enrollAsStudent,
    switchRole,
    refetchRole: syncRole,
  };
}

