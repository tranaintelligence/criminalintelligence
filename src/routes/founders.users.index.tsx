import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Search, Download, RefreshCw, MessageSquare, ChevronRight, User as UserIcon, Shield,
  GraduationCap, CheckCircle2, XCircle, Clock, Eye, X, Image as ImageIcon, ExternalLink, Check, Scale
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTranaCredential } from "@/lib/trana-auth";
import { getAdminUsers, type AdminUser } from "@/lib/trana-admin-api";
import { downloadCSV } from "@/lib/csv-export";
import { toast } from "sonner";

export const Route = createFileRoute("/founders/users/")({
  head: () => ({
    meta: [
      { title: "Founders Dashboard — TRANA" },
      { name: "description", content: "Comprehensive user registry, citizen queries, and engagement telemetry." },
      { property: "og:title", content: "Founders Dashboard — TRANA" },
    ],
  }),
  component: FoundersUsersPage,
});

export type MergedPlatformUser = {
  id: string;
  name: string;
  email: string;
  dateJoined: string;
  city: string;
  userType: "Citizen" | "Lawyer" | "Law Student";
  chatsCount: number;
  messagesCount: number;
  lastActive: string;
  status: "Active" | "Inactive";
  studentData?: {
    university?: string;
    degree?: string;
    yearOfStudy?: string;
    studentIdNumber?: string;
    collegeIdUrl?: string;
    collegeIdFileName?: string;
    verificationStatus?: "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";
    isIntern?: boolean;
    internFirmOrChamber?: string;
    enrolledAt?: string;
  };
};

function FoundersUsersPage() {
  const navigate = useNavigate();
  const { credential } = useTranaCredential();
  const [searchTerm, setSearchTerm] = useState("");
  const [userTypeFilter, setUserTypeFilter] = useState("All");
  const [cityFilter, setCityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Student verification states
  const [selectedStudentForVerification, setSelectedStudentForVerification] = useState<MergedPlatformUser | null>(null);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [zoomIdImage, setZoomIdImage] = useState<string | null>(null);
  const [verificationUpdateTrigger, setVerificationUpdateTrigger] = useState(0);

  function handleApproveStudentId(studentUser: MergedPlatformUser) {
    try {
      if (typeof window !== "undefined") {
        const stored = JSON.parse(localStorage.getItem("trana_all_registered_students") || "[]");
        const updated = stored.map((s: any) => {
          if (s.id === studentUser.id || (s.email && studentUser.email && s.email.toLowerCase() === studentUser.email.toLowerCase())) {
            return {
              ...s,
              verificationStatus: "VERIFIED",
              isVerified: true,
            };
          }
          return s;
        });
        localStorage.setItem("trana_all_registered_students", JSON.stringify(updated));

        // Update current student profile if matching
        const curProfile = localStorage.getItem("trana_student_profile");
        if (curProfile) {
          try {
            const p = JSON.parse(curProfile);
            if (p.fullName === studentUser.name || p.studentIdNumber === studentUser.studentData?.studentIdNumber) {
              p.verificationStatus = "VERIFIED";
              localStorage.setItem("trana_student_profile", JSON.stringify(p));
            }
          } catch {}
        }
        window.dispatchEvent(new Event("trana_role_updated"));
      }

      setVerificationUpdateTrigger((prev) => prev + 1);
      if (selectedStudentForVerification && selectedStudentForVerification.id === studentUser.id) {
        setSelectedStudentForVerification({
          ...selectedStudentForVerification,
          studentData: {
            ...selectedStudentForVerification.studentData,
            verificationStatus: "VERIFIED",
          },
        });
      }
      toast.success(`Student College ID for ${studentUser.name} has been APPROVED & VERIFIED!`);
    } catch {
      toast.error("Failed to approve student verification.");
    }
  }

  function handleRejectStudentId(studentUser: MergedPlatformUser) {
    try {
      if (typeof window !== "undefined") {
        const stored = JSON.parse(localStorage.getItem("trana_all_registered_students") || "[]");
        const updated = stored.map((s: any) => {
          if (s.id === studentUser.id || (s.email && studentUser.email && s.email.toLowerCase() === studentUser.email.toLowerCase())) {
            return {
              ...s,
              verificationStatus: "REJECTED",
              isVerified: false,
            };
          }
          return s;
        });
        localStorage.setItem("trana_all_registered_students", JSON.stringify(updated));

        const curProfile = localStorage.getItem("trana_student_profile");
        if (curProfile) {
          try {
            const p = JSON.parse(curProfile);
            if (p.fullName === studentUser.name || p.studentIdNumber === studentUser.studentData?.studentIdNumber) {
              p.verificationStatus = "REJECTED";
              localStorage.setItem("trana_student_profile", JSON.stringify(p));
            }
          } catch {}
        }
        window.dispatchEvent(new Event("trana_role_updated"));
      }

      setVerificationUpdateTrigger((prev) => prev + 1);
      if (selectedStudentForVerification && selectedStudentForVerification.id === studentUser.id) {
        setSelectedStudentForVerification({
          ...selectedStudentForVerification,
          studentData: {
            ...selectedStudentForVerification.studentData,
            verificationStatus: "REJECTED",
          },
        });
      }
      toast.error(`Student College ID for ${studentUser.name} marked as REJECTED.`);
    } catch {
      toast.error("Failed to reject student verification.");
    }
  }

  // 1. Fetch real chat database users via admin API
  const { data: adminUsers = [], refetch: refetchAdminUsers, isFetching: isFetchingAdmin } = useQuery({
    queryKey: ["founders-real-users", credential],
    queryFn: async () => {
      if (!credential) return [];
      try {
        return await getAdminUsers(credential);
      } catch (err) {
        console.warn("Could not fetch admin users endpoint, falling back to Supabase profiles:", err);
        return [];
      }
    },
    enabled: Boolean(credential),
    staleTime: 30000,
  });

  // 2. Query Supabase profiles to merge any additional profiles
  const { data: dbProfiles = [], refetch: refetchProfiles } = useQuery({
    queryKey: ["founders-db-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*");
      return data || [];
    },
    staleTime: 30000,
  });

  // 3. Query Supabase lawyers table
  const { data: dbLawyers = [], refetch: refetchLawyers } = useQuery({
    queryKey: ["founders-db-lawyers-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("lawyers").select("*");
      return data || [];
    },
    staleTime: 30000,
  });

  // 4. Query Supabase advocate_disclaimers (all signed-in users who acknowledged terms)
  const { data: dbDisclaimers = [], refetch: refetchDisclaimers } = useQuery({
    queryKey: ["founders-db-disclaimers-lookup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("advocate_disclaimers")
        .select("*")
        .order("accepted_at", { ascending: false });
      return data || [];
    },
    staleTime: 30000,
  });

  // 5. Query Supabase consultations (all citizen consultation requests & peer connections)
  const { data: dbConsults = [], refetch: refetchConsults } = useQuery({
    queryKey: ["founders-db-consults-lookup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("consultations")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
    staleTime: 30000,
  });

  // Combine real database records with zero dummy mock data
  const usersList: MergedPlatformUser[] = useMemo(() => {
    const list: MergedPlatformUser[] = [];
    const seenEmails = new Set<string>();
    const seenIds = new Set<string>();

    function addOrUpdateUser(entry: MergedPlatformUser) {
      const normEmail = entry.email ? entry.email.trim().toLowerCase() : "";
      const normId = entry.id ? entry.id.trim().toLowerCase() : "";

      const existingIndex = list.findIndex((u) => {
        const uEmail = u.email ? u.email.trim().toLowerCase() : "";
        const uId = u.id ? u.id.trim().toLowerCase() : "";
        return (normEmail && uEmail && normEmail === uEmail) || (normId && uId && normId === uId);
      });

      if (existingIndex !== -1) {
        // Merge richer details
        const existing = list[existingIndex];
        if (entry.userType === "Lawyer" || (entry.userType === "Law Student" && existing.userType === "Citizen")) {
          existing.userType = entry.userType;
        }
        if (entry.city && entry.city !== "New Delhi" && existing.city === "New Delhi") {
          existing.city = entry.city;
        }
        if (entry.name && (!existing.name || existing.name === "Citizen Account" || existing.name === "User")) {
          existing.name = entry.name;
        }
        if (entry.chatsCount > existing.chatsCount) {
          existing.chatsCount = entry.chatsCount;
        }
        if (entry.messagesCount > existing.messagesCount) {
          existing.messagesCount = entry.messagesCount;
        }
        if (existing.dateJoined === "Recent" || existing.dateJoined === "—") {
          existing.dateJoined = entry.dateJoined;
        }
        if (existing.lastActive === "—" && entry.lastActive !== "—") {
          existing.lastActive = entry.lastActive;
        }
        if (entry.studentData) {
          existing.studentData = { ...existing.studentData, ...entry.studentData };
        }
      } else {
        if (normEmail) seenEmails.add(normEmail);
        if (normId) seenIds.add(normId);
        list.push(entry);
      }
    }

    // 1. Add all users from backend admin API
    adminUsers.forEach((u) => {
      const em = u.email ? u.email.trim().toLowerCase() : "";
      addOrUpdateUser({
        id: u.id || em,
        name: u.name || em.split("@")[0] || "User",
        email: u.email,
        dateJoined: u.created_at
          ? new Date(u.created_at).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "Recent",
        city: u.city || "New Delhi",
        userType: "Citizen",
        chatsCount: u.total_chats || 0,
        messagesCount: u.total_messages || 0,
        lastActive: u.last_active_at
          ? new Date(u.last_active_at).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "—",
        status: u.status || "Active",
      });
    });

    // 2. Add all registered Advocates from Supabase lawyers table
    dbLawyers.forEach((l: any) => {
      addOrUpdateUser({
        id: l.user_id || l.id,
        name: l.full_name || "Advocate Counsel",
        email: l.email || `${(l.full_name || "advocate").toLowerCase().replace(/\s+/g, ".")}@trana.in`,
        dateJoined: l.created_at
          ? new Date(l.created_at).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "Recent",
        city: l.city || "New Delhi",
        userType: "Lawyer",
        chatsCount: 0,
        messagesCount: 0,
        lastActive: l.created_at
          ? new Date(l.created_at).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "—",
        status: l.verification_status === "SUSPENDED" ? "Inactive" : "Active",
      });
    });

    // 3. Add all signed-in users who acknowledged the statutory disclaimer
    dbDisclaimers.forEach((d: any) => {
      if (!d.user_email || d.user_email.toLowerCase().includes("visitor")) return;
      const em = d.user_email.trim().toLowerCase();
      const isLawyer = d.user_role === "advocate" || d.user_role === "lawyer";
      const isStudent = d.user_role === "student" || d.user_role === "law_student";

      addOrUpdateUser({
        id: em,
        name: d.user_name || em.split("@")[0],
        email: d.user_email,
        dateJoined: d.accepted_at
          ? new Date(d.accepted_at).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "Recent",
        city: "New Delhi",
        userType: isLawyer ? "Lawyer" : isStudent ? "Law Student" : "Citizen",
        chatsCount: 0,
        messagesCount: 0,
        lastActive: d.accepted_at
          ? new Date(d.accepted_at).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "—",
        status: "Active",
      });
    });

    // 4. Add peer connections / consultation participants
    dbConsults.forEach((c: any) => {
      let meta: any = null;
      try {
        if (c.note) meta = JSON.parse(c.note);
      } catch {}

      if (meta && meta.fromUserId && meta.fromUserName) {
        addOrUpdateUser({
          id: meta.fromUserId,
          name: meta.fromUserName,
          email: `${meta.fromUserName.toLowerCase().replace(/[^a-z0-9]/g, ".")}@trana.in`,
          dateJoined: c.created_at
            ? new Date(c.created_at).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : "Recent",
          city: meta.fromUserCity || "New Delhi",
          userType: meta.fromUserRole === "lawyer" ? "Lawyer" : meta.fromUserRole === "student" ? "Law Student" : "Citizen",
          chatsCount: 1,
          messagesCount: 1,
          lastActive: c.created_at
            ? new Date(c.created_at).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : "—",
          status: "Active",
        });
      }

      if (meta && meta.toUserId && meta.toUserName) {
        addOrUpdateUser({
          id: meta.toUserId,
          name: meta.toUserName,
          email: `${meta.toUserName.toLowerCase().replace(/[^a-z0-9]/g, ".")}@trana.in`,
          dateJoined: c.created_at
            ? new Date(c.created_at).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : "Recent",
          city: meta.toUserCity || "New Delhi",
          userType: meta.toUserRole === "lawyer" ? "Lawyer" : meta.toUserRole === "student" ? "Law Student" : "Citizen",
          chatsCount: 1,
          messagesCount: 1,
          lastActive: c.created_at
            ? new Date(c.created_at).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : "—",
          status: "Active",
        });
      }
    });

    // 5. Add registered law scholars from localStorage & current student profile
    try {
      if (typeof window !== "undefined") {
        const storedStudentsRaw = localStorage.getItem("trana_all_registered_students");
        if (storedStudentsRaw) {
          const parsed = JSON.parse(storedStudentsRaw);
          if (Array.isArray(parsed)) {
            parsed.forEach((s: any) => {
              if (s.name && !s.name.toLowerCase().includes("aarav") && !s.name.toLowerCase().includes("meera")) {
                const sEmail = s.email || `${s.name.toLowerCase().replace(/[^a-z0-9]/g, ".")}@law.in`;
                addOrUpdateUser({
                  id: s.id || sEmail,
                  name: s.name,
                  email: sEmail,
                  dateJoined: s.enrolledAt
                    ? new Date(s.enrolledAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "Recent",
                  city: s.city || "New Delhi",
                  userType: "Law Student",
                  chatsCount: 0,
                  messagesCount: 0,
                  lastActive: "—",
                  status: "Active",
                  studentData: {
                    university: s.affiliation,
                    degree: s.roleLabel,
                    yearOfStudy: s.experienceOrYear,
                    studentIdNumber: s.rollNo,
                    collegeIdUrl: s.collegeIdUrl,
                    collegeIdFileName: s.collegeIdFileName,
                    verificationStatus: s.verificationStatus || (s.collegeIdUrl ? "PENDING_VERIFICATION" : undefined),
                    isIntern: Boolean(s.isIntern),
                    internFirmOrChamber: s.internFirmOrChamber,
                    enrolledAt: s.enrolledAt,
                  },
                });
              }
            });
          }
        }

        // Also check currently enrolled student profile in active browser session
        const currentStudentProfileRaw = localStorage.getItem("trana_student_profile");
        if (currentStudentProfileRaw) {
          try {
            const csp = JSON.parse(currentStudentProfileRaw);
            if (csp && csp.university && csp.studentIdNumber) {
              const cspEmail = csp.email || "student@law.in";
              addOrUpdateUser({
                id: csp.id || "current-enrolled-student",
                name: csp.fullName || "Law Student Scholar",
                email: cspEmail,
                dateJoined: csp.enrolledAt
                  ? new Date(csp.enrolledAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "Recent",
                city: csp.city || "New Delhi",
                userType: "Law Student",
                chatsCount: 0,
                messagesCount: 0,
                lastActive: "—",
                status: "Active",
                studentData: {
                  university: csp.university,
                  degree: csp.degree,
                  yearOfStudy: csp.yearOfStudy,
                  studentIdNumber: csp.studentIdNumber,
                  collegeIdUrl: csp.collegeIdUrl,
                  collegeIdFileName: csp.collegeIdFileName,
                  verificationStatus: csp.verificationStatus || (csp.collegeIdUrl ? "PENDING_VERIFICATION" : undefined),
                  isIntern: Boolean(csp.isIntern),
                  internFirmOrChamber: csp.internFirmOrChamber,
                  enrolledAt: csp.enrolledAt,
                },
              });
            }
          } catch {}
        }
      }
    } catch {}

    // 6. Add any remaining Supabase profiles
    dbProfiles.forEach((p: any, idx: number) => {
      const pEmail = `${p.full_name?.toLowerCase().replace(/\s+/g, ".") || "user"}@trana.in`;
      addOrUpdateUser({
        id: p.id || `profile-${idx}`,
        name: p.full_name || "Citizen Account",
        email: pEmail,
        dateJoined: p.created_at
          ? new Date(p.created_at).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "—",
        city: p.city || "New Delhi",
        userType: "Citizen",
        chatsCount: 0,
        messagesCount: 0,
        lastActive: "—",
        status: "Active",
      });
    });

    return list;
  }, [adminUsers, dbProfiles, dbLawyers, dbDisclaimers, dbConsults, verificationUpdateTrigger]);

  const cities = ["All", ...new Set(usersList.map((u) => u.city).filter(Boolean))];

  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      if (userTypeFilter !== "All" && u.userType !== userTypeFilter) return false;
      if (cityFilter !== "All" && u.city !== cityFilter) return false;
      if (statusFilter !== "All" && u.status !== statusFilter) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const inName = u.name.toLowerCase().includes(q);
        const inEmail = u.email.toLowerCase().includes(q);
        const inCity = u.city.toLowerCase().includes(q);
        return inName || inEmail || inCity;
      }
      return true;
    });
  }, [usersList, userTypeFilter, cityFilter, statusFilter, searchTerm]);

  const allStudentsWithId = useMemo(() => {
    return usersList.filter(
      (u) =>
        u.userType === "Law Student" &&
        (u.studentData?.collegeIdUrl || u.studentData?.studentIdNumber)
    );
  }, [usersList]);

  const pendingVerificationsCount = useMemo(() => {
    return allStudentsWithId.filter(
      (s) =>
        s.studentData?.verificationStatus === "PENDING_VERIFICATION" ||
        (!s.studentData?.verificationStatus && s.studentData?.collegeIdUrl)
    ).length;
  }, [allStudentsWithId]);

  function exportToCSV() {
    const headers = [
      "User ID",
      "Name",
      "Email",
      "Date Joined",
      "City",
      "User Type",
      "Chats Count",
      "Messages Count",
      "Last Active",
      "Status",
    ];
    const rows = filteredUsers.map((u) => [
      u.id,
      u.name,
      u.email,
      u.dateJoined,
      u.city,
      u.userType,
      u.chatsCount,
      u.messagesCount,
      u.lastActive,
      u.status,
    ]);

    downloadCSV(
      `trana_real_users_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows,
    );
    toast.success(`Exported ${filteredUsers.length} user records to CSV.`);
  }

  const handleRowClick = (user: MergedPlatformUser) => {
    navigate({
      to: "/founders/users/$userId",
      params: { userId: user.email || user.id },
    });
  };

  return (
    <div className="space-y-6 font-mono text-[#F0F0F0]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222222] pb-4">
        <div>
          <span className="text-[0.65rem] text-amber-200/80 uppercase tracking-widest block">
            REAL USER REGISTRY & CHAT TELEMETRY
          </span>
          <h1 className="font-display text-3xl font-medium text-white mt-1">
            Users Directory
          </h1>
          <p className="text-xs text-[#888888] mt-0.5">
            Click on any user to view detailed founder analytics and complete read-only chat history.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Student ID Verifications button */}
          <button
            onClick={() => {
              setIsVerificationModalOpen(true);
              if (allStudentsWithId.length > 0 && !selectedStudentForVerification) {
                setSelectedStudentForVerification(allStudentsWithId[0]);
              }
            }}
            className="apple-glass-pill px-3.5 py-2 text-xs uppercase tracking-wider text-purple-300 hover:text-white hover:bg-purple-950/40 border-purple-500/40 flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <GraduationCap className="h-3.5 w-3.5 text-purple-400" />
            <span>Student Verifications</span>
            {pendingVerificationsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-black font-bold font-mono">
                {pendingVerificationsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              refetchAdminUsers();
              refetchProfiles();
              refetchLawyers();
              refetchDisclaimers();
              refetchConsults();
            }}
            disabled={isFetchingAdmin}
            className="apple-glass-pill px-3 py-2 text-xs uppercase tracking-wider text-white flex items-center gap-1.5 disabled:opacity-50"
            title="Refresh Users"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetchingAdmin ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={exportToCSV}
            className="apple-glass-pill px-4 py-2 text-xs uppercase tracking-wider text-white hover:text-black hover:bg-white flex items-center gap-2"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* SEARCH BAR & FILTERS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Search Bar */}
        <div className="lg:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, or city..."
            className="apple-glass-input w-full py-2 pl-9 pr-3 text-xs text-white placeholder:text-neutral-500"
          />
        </div>

        {/* Filter: User Type */}
        <div>
          <select
            value={userTypeFilter}
            onChange={(e) => setUserTypeFilter(e.target.value)}
            className="apple-glass-input w-full px-3 py-2 text-xs text-white"
          >
            <option value="All">Type: All</option>
            <option value="Citizen">Type: Citizens</option>
            <option value="Lawyer">Type: Lawyers</option>
            <option value="Law Student">Type: Law Students</option>
          </select>
        </div>

        {/* Filter: City */}
        <div>
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="apple-glass-input w-full px-3 py-2 text-xs text-white"
          >
            {cities.map((c) => (
              <option key={c} value={c}>
                City: {c}
              </option>
            ))}
          </select>
        </div>

        {/* Filter: Status */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="apple-glass-input w-full px-3 py-2 text-xs text-white"
          >
            <option value="All">Status: All</option>
            <option value="Active">Status: Active</option>
            <option value="Inactive">Status: Inactive</option>
          </select>
        </div>
      </div>

      {/* REAL USERS TABLE */}
      <div className="apple-glass-card overflow-x-auto shadow-md">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b border-[#2A2A2A] bg-[#161616] text-[#888888] uppercase tracking-wider text-[0.65rem]">
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Joined</th>
              <th className="py-3 px-4">City</th>
              <th className="py-3 px-4">Type & Verification</th>
              <th className="py-3 px-4 text-center">Chats</th>
              <th className="py-3 px-4 text-center">Messages</th>
              <th className="py-3 px-4">Last Active</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1D1D1D]">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-[#777777]">
                  {isFetchingAdmin ? "Loading real users from database..." : "No users match the search criteria."}
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => handleRowClick(u)}
                  className="hover:bg-[#1A1A1A] transition-colors cursor-pointer group"
                >
                  <td className="py-3 px-4 text-white font-medium flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#202020] border border-[#333333] flex items-center justify-center text-amber-200 text-xs shrink-0 font-serif">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="group-hover:text-amber-300 transition-colors font-semibold">
                      {u.name}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[#AAAAAA] font-mono text-[11px]">{u.email}</td>
                  <td className="py-3 px-4 text-[#888888]">{u.dateJoined}</td>
                  <td className="py-3 px-4 text-[#CCCCCC]">{u.city}</td>
                  <td className="py-3 px-4">
                    {u.userType === "Law Student" ? (
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          className={`inline-block px-2 py-0.5 text-[0.6rem] rounded border ${
                            u.studentData?.isIntern
                              ? "border-purple-500/40 text-purple-300 bg-purple-950/20"
                              : "border-sky-500/40 text-sky-300 bg-sky-950/20"
                          }`}
                        >
                          {u.studentData?.isIntern ? "Legal Intern" : "Law Student"}
                        </span>
                        {u.studentData?.collegeIdUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStudentForVerification(u);
                              setIsVerificationModalOpen(true);
                            }}
                            className={`inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.2 rounded-full border transition-all cursor-pointer ${
                              u.studentData.verificationStatus === "VERIFIED"
                                ? "border-emerald-500/40 text-emerald-400 bg-emerald-950/20 hover:bg-emerald-950/40"
                                : u.studentData.verificationStatus === "REJECTED"
                                  ? "border-rose-500/40 text-rose-400 bg-rose-950/20 hover:bg-rose-950/40"
                                  : "border-amber-500/40 text-amber-300 bg-amber-950/20 hover:bg-amber-950/40"
                            }`}
                          >
                            {u.studentData.verificationStatus === "VERIFIED" ? (
                              <>
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                <span>ID Verified</span>
                              </>
                            ) : u.studentData.verificationStatus === "REJECTED" ? (
                              <>
                                <XCircle className="h-2.5 w-2.5" />
                                <span>ID Rejected</span>
                              </>
                            ) : (
                              <>
                                <Clock className="h-2.5 w-2.5 text-amber-400" />
                                <span>Review ID</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span
                        className={`inline-block px-2 py-0.5 text-[0.6rem] rounded border ${
                          u.userType === "Lawyer"
                            ? "border-amber-500/40 text-amber-300 bg-amber-950/20"
                            : "border-neutral-700 text-[#AAAAAA] bg-neutral-900"
                        }`}
                      >
                        {u.userType}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center text-white font-mono">
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="h-3 w-3 text-neutral-500" />
                      {u.chatsCount}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-white font-mono font-medium">
                    {u.messagesCount}
                  </td>
                  <td className="py-3 px-4 text-[#888888] text-[11px]">{u.lastActive}</td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 text-[0.65rem] rounded-full border ${
                        u.status === "Active"
                          ? "border-emerald-500/40 text-emerald-400 bg-emerald-950/20"
                          : "border-neutral-800 text-[#666666] bg-neutral-950"
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {u.userType === "Law Student" && u.studentData?.collegeIdUrl && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStudentForVerification(u);
                            setIsVerificationModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-400 hover:text-purple-300 hover:underline cursor-pointer"
                          title="Review uploaded College ID Card"
                        >
                          <GraduationCap className="h-3.5 w-3.5" />
                          <span>Review ID</span>
                        </button>
                      )}
                      <Link
                        to="/founders/users/$userId"
                        params={{ userId: u.email || u.id }}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-400 group-hover:text-amber-300 hover:underline"
                      >
                        <span>Chats</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-[#666666] pt-1">
        <span>Displaying {filteredUsers.length} of {usersList.length} verified database users</span>
        <span>Source: Chat database & verified profiles</span>
      </div>

      {/* STUDENT ID VERIFICATION MODAL */}
      {isVerificationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="apple-glass-card w-full max-w-4xl p-6 md:p-8 relative my-8 max-h-[90vh] overflow-y-auto space-y-6">
            <button
              onClick={() => setIsVerificationModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-medium text-white">
                    Law Student College ID Verification
                  </h3>
                  <p className="text-xs text-neutral-400 font-mono">
                    Founders Portal • Review uploaded College ID cards and verify student scholar enrollment
                  </p>
                </div>
              </div>

              <div className="apple-glass-pill px-3 py-1 text-xs font-mono text-neutral-300">
                {allStudentsWithId.length} Submissions • {pendingVerificationsCount} Pending
              </div>
            </div>

            {/* Modal Body: Left list + Right details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: List of Students */}
              <div className="space-y-2 md:border-r md:border-white/[0.08] md:pr-4">
                <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 block mb-2">
                  Students with ID Submissions ({allStudentsWithId.length})
                </span>

                {allStudentsWithId.length === 0 ? (
                  <div className="p-6 text-center text-xs text-neutral-400 font-mono">
                    No student ID uploads found.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                    {allStudentsWithId.map((st) => {
                      const isSelected = selectedStudentForVerification?.id === st.id;
                      const status = st.studentData?.verificationStatus || "PENDING_VERIFICATION";

                      return (
                        <div
                          key={st.id}
                          onClick={() => setSelectedStudentForVerification(st)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${
                            isSelected
                              ? "bg-purple-950/40 border-purple-500/50 shadow-sm"
                              : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06]"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white truncate">
                              {st.name}
                            </span>
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full border ${
                                status === "VERIFIED"
                                  ? "border-emerald-500/40 text-emerald-400 bg-emerald-950/20"
                                  : status === "REJECTED"
                                    ? "border-rose-500/40 text-rose-400 bg-rose-950/20"
                                    : "border-amber-500/40 text-amber-300 bg-amber-950/20"
                              }`}
                            >
                              {status === "VERIFIED" ? "Verified" : status === "REJECTED" ? "Rejected" : "Pending"}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                            {st.studentData?.university || st.city}
                          </p>
                          <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                            Roll: {st.studentData?.studentIdNumber || "N/A"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Selected Student's ID & Details */}
              <div className="md:col-span-2 space-y-4">
                {selectedStudentForVerification ? (
                  <div className="space-y-4">
                    {/* Student Metadata Card */}
                    <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.03] space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-display text-lg text-white font-medium">
                              {selectedStudentForVerification.name}
                            </h4>
                            <span
                              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                                selectedStudentForVerification.studentData?.isIntern
                                  ? "border-purple-500/40 text-purple-300 bg-purple-950/30"
                                  : "border-sky-500/40 text-sky-300 bg-sky-950/30"
                              }`}
                            >
                              {selectedStudentForVerification.studentData?.isIntern ? "Legal Intern" : "Law Student"}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-400 font-mono mt-0.5">
                            {selectedStudentForVerification.email}
                          </p>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {selectedStudentForVerification.studentData?.verificationStatus === "VERIFIED" ? (
                            <span className="apple-glass-pill px-3 py-1 text-xs font-mono text-emerald-400 border-emerald-500/40 bg-emerald-950/30 flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Verified Student</span>
                            </span>
                          ) : selectedStudentForVerification.studentData?.verificationStatus === "REJECTED" ? (
                            <span className="apple-glass-pill px-3 py-1 text-xs font-mono text-rose-400 border-rose-500/40 bg-rose-950/30 flex items-center gap-1.5">
                              <XCircle className="h-3.5 w-3.5" />
                              <span>Verification Rejected</span>
                            </span>
                          ) : (
                            <span className="apple-glass-pill px-3 py-1 text-xs font-mono text-amber-300 border-amber-500/40 bg-amber-950/30 flex items-center gap-1.5 animate-pulse">
                              <Clock className="h-3.5 w-3.5" />
                              <span>Pending Verification</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Detail Grid */}
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/[0.06] text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 block">
                            University / College
                          </span>
                          <span className="text-white font-medium">
                            {selectedStudentForVerification.studentData?.university || "Not provided"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 block">
                            Roll Number / Student ID
                          </span>
                          <span className="text-purple-300 font-mono font-medium">
                            {selectedStudentForVerification.studentData?.studentIdNumber || "Not provided"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 block">
                            Degree & Year
                          </span>
                          <span className="text-neutral-300">
                            {selectedStudentForVerification.studentData?.degree || "LL.B"} •{" "}
                            {selectedStudentForVerification.studentData?.yearOfStudy || "Scholar"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 block">
                            Intern Chamber / Firm
                          </span>
                          <span className="text-neutral-300">
                            {selectedStudentForVerification.studentData?.internFirmOrChamber || (selectedStudentForVerification.studentData?.isIntern ? "Active Internship" : "None (Student)")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* College ID Photo Section */}
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-purple-300 flex items-center gap-1.5 mb-2">
                        <ImageIcon className="h-3.5 w-3.5 text-purple-400" />
                        <span>Uploaded College ID Card Document</span>
                      </span>

                      {selectedStudentForVerification.studentData?.collegeIdUrl ? (
                        <div className="rounded-xl overflow-hidden border border-white/20 bg-black/60 relative group">
                          {selectedStudentForVerification.studentData.collegeIdUrl.startsWith("data:image/") ? (
                            <div className="relative">
                              <img
                                src={selectedStudentForVerification.studentData.collegeIdUrl}
                                alt="Student College ID Card"
                                className="w-full max-h-72 object-contain bg-black/90 cursor-zoom-in"
                                onClick={() =>
                                  setZoomIdImage(selectedStudentForVerification.studentData?.collegeIdUrl || null)
                                }
                              />
                              <button
                                onClick={() =>
                                  setZoomIdImage(selectedStudentForVerification.studentData?.collegeIdUrl || null)
                                }
                                className="absolute top-3 right-3 apple-glass-pill px-3 py-1 text-xs font-mono text-white flex items-center gap-1 bg-black/70 hover:bg-black cursor-pointer shadow-md"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>Zoom Fullscreen</span>
                              </button>
                            </div>
                          ) : (
                            <div className="p-8 text-center space-y-3">
                              <GraduationCap className="h-12 w-12 text-purple-400 mx-auto" />
                              <p className="text-white font-medium text-sm">
                                {selectedStudentForVerification.studentData.collegeIdFileName || "College_ID.pdf"}
                              </p>
                              <a
                                href={selectedStudentForVerification.studentData.collegeIdUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="apple-glass-pill px-4 py-2 text-xs font-mono text-purple-300 hover:text-white inline-flex items-center gap-1.5"
                              >
                                <span>Open Attached Document</span>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          )}

                          <div className="p-2.5 bg-[#14121d] border-t border-white/[0.08] flex items-center justify-between text-[11px] font-mono text-neutral-400">
                            <span>File: {selectedStudentForVerification.studentData.collegeIdFileName || "College_ID.jpg"}</span>
                            <span>Student Verification Document</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-8 rounded-xl border border-white/10 bg-white/[0.02] text-center text-xs text-neutral-400 font-mono">
                          No College ID card uploaded for this student.
                        </div>
                      )}
                    </div>

                    {/* Verification Actions */}
                    <div className="pt-4 border-t border-white/[0.08] flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => handleRejectStudentId(selectedStudentForVerification)}
                        className="apple-glass-pill px-4 py-2 text-xs font-mono text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 border-rose-500/30 flex items-center gap-1.5 cursor-pointer"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Reject ID</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApproveStudentId(selectedStudentForVerification)}
                        className="bg-emerald-400 text-black hover:bg-emerald-300 px-5 py-2 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Approve Verification</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center text-neutral-400 font-mono text-xs">
                    Select a student from the left panel to review their College ID card and academic details.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN IMAGE LIGHTBOX MODAL */}
      {zoomIdImage && (
        <div
          onClick={() => setZoomIdImage(null)}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 cursor-zoom-out"
        >
          <button
            onClick={() => setZoomIdImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white cursor-pointer z-50"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={zoomIdImage}
            alt="College ID Fullscreen"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl border border-white/20"
          />
        </div>
      )}
    </div>
  );
}

