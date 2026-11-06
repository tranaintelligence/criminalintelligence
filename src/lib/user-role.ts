import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/routes/founders";

export type UserRole = "citizen" | "lawyer" | "student" | "founder";

export interface StudentProfile {
  university: string;
  degree: string;
  yearOfStudy: string;
  studentIdNumber?: string;
  city?: string;
  enrolledAt?: string;
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
    const studentData = localStorage.getItem(`trana_student_enrolled_${userId}`);
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
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`trana_student_enrolled_${userId}`);
    if (raw) return JSON.parse(raw);
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
    const student = getStoredStudentProfile(userId);
    if (student) {
      setRoleState("student");
      setStudentProfileState(student);
      return;
    }

    // Check Supabase user metadata
    try {
      const { data: authData } = await supabase.auth.getUser();
      const meta = authData.user?.user_metadata;
      if (meta?.role === "student" || meta?.role === "lawyer" || meta?.role === "founder") {
        setRoleState(meta.role as UserRole);
        if (meta.role === "student" && meta.student_profile) {
          setStudentProfileState(meta.student_profile);
          if (userId && typeof window !== "undefined") {
            localStorage.setItem(`trana_student_enrolled_${userId}`, JSON.stringify(meta.student_profile));
          }
        }
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
      if (!userId) return;
      setIsLoading(true);
      try {
        const enriched = {
          ...profile,
          enrolledAt: profile.enrolledAt || new Date().toISOString(),
        };

        if (typeof window !== "undefined") {
          localStorage.setItem(`trana_student_enrolled_${userId}`, JSON.stringify(enriched));
          localStorage.setItem(`trana_user_role_${userId}`, "student");
        }

        // Also persist in Supabase user metadata
        await supabase.auth.updateUser({
          data: {
            role: "student",
            student_profile: enriched,
          },
        }).catch(() => {});

        setRoleState("student");
        setStudentProfileState(enriched);

        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("trana_role_updated"));
        }
      } finally {
        setIsLoading(false);
      }
    },
    [userId]
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

