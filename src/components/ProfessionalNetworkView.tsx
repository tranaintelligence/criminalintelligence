import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users, Search, UserCheck, Clock, Check, X, MessageSquare,
  GraduationCap, Scale, Building2, MapPin, Send, ShieldCheck,
  ChevronRight, ExternalLink, Sparkles, Filter, AlertCircle, Share2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPublicLawyers } from "@/lib/trana-admin-api";
import {
  NetworkMember,
  NetworkRole,
  ConnectionRecord,
  fetchAllConnections,
  sendConnectionRequest,
  acceptConnectionRequest,
  declineConnectionRequest,
  removeConnection,
  getConnectionStatusBetween,
} from "@/lib/network-connections";
import { ConsultationChatModal } from "@/components/ConsultationChatModal";

interface ProfessionalNetworkViewProps {
  currentUser: {
    id: string;
    name: string;
    email?: string;
    role: NetworkRole;
    roleLabel: string;
    affiliation: string;
    city: string;
  };
  baseRoute: "/lawyer" | "/student";
}

export function ProfessionalNetworkView({ currentUser, baseRoute }: ProfessionalNetworkViewProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"discover" | "invitations" | "connections">("discover");
  const [roleFilter, setRoleFilter] = useState<"all" | "lawyers" | "students">("all");
  const [search, setSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState("All");

  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Active chat session
  const [activeChatTarget, setActiveChatTarget] = useState<{
    consultationId: string;
    clientName: string;
    lawyerName: string;
    consultType: string;
  } | null>(null);

  // 1. Fetch real advocates from Supabase/Backend
  const { data: dbLawyers = [] } = useQuery({
    queryKey: ["network-view-lawyers"],
    queryFn: async () => {
      try {
        const apiRows = await getPublicLawyers();
        if (apiRows && apiRows.length > 0) return apiRows;
      } catch {}
      const { data } = await supabase
        .from("lawyers")
        .select("*")
        .eq("approved", true)
        .order("full_name");
      return data || [];
    },
  });

  // 2. Fetch connections
  const { data: connections = [], refetch: refetchConnections } = useQuery({
    queryKey: ["network-view-connections", currentUser.id],
    queryFn: () => fetchAllConnections(currentUser.id),
    refetchInterval: 4000,
  });

  useEffect(() => {
    const handleConnUpdate = () => refetchConnections();
    window.addEventListener("trana_network_connections_changed", handleConnUpdate);
    return () => window.removeEventListener("trana_network_connections_changed", handleConnUpdate);
  }, [refetchConnections]);

  // 3. Reconcile Network Members (Advocates + Law Students)
  const allMembers: NetworkMember[] = useMemo(() => {
    const list: NetworkMember[] = [];
    const myNormId = currentUser.id.toLowerCase().trim();
    const myNormName = currentUser.name.toLowerCase().replace(/^adv\.?\s*/i, "").trim();

    // A. Real Lawyers
    (dbLawyers || []).forEach((row: any) => {
      const normId = String(row.id || "").toLowerCase().trim();
      const normName = String(row.full_name || "").toLowerCase().replace(/^adv\.?\s*/i, "").trim();

      if (normId === myNormId || normName === myNormName) return;

      let courtsDisplay = "High Court & Sessions";
      if (row.courts) {
        try {
          const parsed = Array.isArray(row.courts) ? row.courts : JSON.parse(row.courts);
          if (Array.isArray(parsed) && parsed.length > 0) {
            courtsDisplay = parsed.slice(0, 2).join(" · ") + (parsed.length > 2 ? ` +${parsed.length - 2} more` : "");
          }
        } catch {
          courtsDisplay = String(row.courts);
        }
      }

      list.push({
        id: String(row.id),
        name: row.full_name,
        role: "lawyer",
        roleLabel: "Verified Advocate",
        affiliation: courtsDisplay,
        city: row.city || "New Delhi",
        experienceOrYear: row.experience_years ? `${row.experience_years} Years Practice` : "Verified Sanad",
        specialisationOrInterests: row.specialisation || "Criminal Defence & Litigation",
        bio: row.bio || "Practicing advocate enrolled with State Bar Council.",
        isVerified: true,
        email: row.email,
        phone: row.phone,
      });
    });

    // B. Registered Law Students from localStorage or known student network
    try {
      const storedStudentsRaw = localStorage.getItem("trana_all_registered_students");
      if (storedStudentsRaw) {
        const parsed = JSON.parse(storedStudentsRaw);
        if (Array.isArray(parsed)) {
          parsed.forEach((s: any) => {
            if (!s.id || s.id === currentUser.id) return;
            if (!list.some((existing) => existing.id === s.id)) {
              list.push(s);
            }
          });
        }
      }
    } catch {}

    return list;
  }, [dbLawyers, currentUser]);

  // Separate pending invitations received
  const pendingReceived = useMemo(() => {
    const myNorm = currentUser.id.toLowerCase().trim();
    return connections.filter(
      (c) => c.status === "pending" && c.toUserId.toLowerCase().trim() === myNorm
    );
  }, [connections, currentUser.id]);

  // Separate active accepted connections
  const myAcceptedConnections = useMemo(() => {
    const myNorm = currentUser.id.toLowerCase().trim();
    return connections.filter((c) => {
      if (c.status !== "accepted") return false;
      return (
        c.fromUserId.toLowerCase().trim() === myNorm ||
        c.toUserId.toLowerCase().trim() === myNorm
      );
    });
  }, [connections, currentUser.id]);

  // Filter Discover Members
  const cities = ["All", ...new Set(allMembers.map((m) => m.city))];

  const filteredMembers = useMemo(() => {
    return allMembers.filter((m) => {
      if (roleFilter === "lawyers" && m.role !== "lawyer") return false;
      if (roleFilter === "students" && m.role !== "student") return false;
      if (selectedCity !== "All" && m.city !== selectedCity) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          m.affiliation.toLowerCase().includes(q) ||
          m.specialisationOrInterests.toLowerCase().includes(q) ||
          m.city.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allMembers, roleFilter, selectedCity, search]);

  // Actions
  async function handleSendRequest(target: NetworkMember) {
    setConnectingId(target.id);
    try {
      await sendConnectionRequest({
        fromUser: {
          id: currentUser.id,
          name: currentUser.name,
          role: currentUser.role,
          roleLabel: currentUser.roleLabel,
          city: currentUser.city,
        },
        toUser: {
          id: target.id,
          name: target.name,
          role: target.role,
          roleLabel: target.roleLabel,
          city: target.city,
        },
      });
      await refetchConnections();
      toast.success(`Connection request sent to ${target.name}!`);
    } catch (err: any) {
      toast.error(err.message || "Could not send connection request.");
    } finally {
      setConnectingId(null);
    }
  }

  async function handleAccept(conn: ConnectionRecord) {
    setAcceptingId(conn.id);
    try {
      await acceptConnectionRequest(conn.id);
      await refetchConnections();
      toast.success(`Connected with ${conn.fromUserName}!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to accept connection.");
    } finally {
      setAcceptingId(null);
    }
  }

  async function handleDecline(conn: ConnectionRecord) {
    try {
      await declineConnectionRequest(conn.id);
      await refetchConnections();
      toast.info(`Invitation from ${conn.fromUserName} declined.`);
    } catch {
      toast.error("Failed to decline request.");
    }
  }

  async function handleDisconnect(conn: ConnectionRecord) {
    try {
      await removeConnection(conn.id);
      await refetchConnections();
      toast.info("Connection removed.");
    } catch {
      toast.error("Failed to remove connection.");
    }
  }

  function handleOpenMessage(otherName: string, connId: string) {
    // If lawyer portal, can go to lawyer inbox or open in-app modal
    if (baseRoute === "/lawyer") {
      navigate({
        to: "/lawyer/inbox",
        search: { chat: connId },
      });
    } else {
      setActiveChatTarget({
        consultationId: connId,
        clientName: currentUser.name,
        lawyerName: otherName,
        consultType: "Peer",
      });
    }
  }

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="border-b border-[#222222] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#888888] font-mono">
            <span>TRANA Professional Network</span>
            <span>•</span>
            <span className="text-emerald-400">Interactive Connections</span>
          </div>
          <h1 className="mt-2 font-display text-3xl md:text-4xl font-medium text-white">
            Legal & Academic Network
          </h1>
          <p className="mt-2 text-xs md:text-sm text-[#999999] max-w-2xl leading-relaxed">
            Connect with verified advocates across High Courts and aspiring law scholars. Send connection requests, collaborate on statutory research, and share litigation insights.
          </p>
        </div>

        {/* Current User Badge Card */}
        <div className="bg-[#141414] border border-[#2A2A2A] px-4 py-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#202020] border border-[#333333] flex items-center justify-center font-display text-white text-base">
            {currentUser.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-medium">{currentUser.name}</span>
              {currentUser.role === "lawyer" ? (
                <span className="px-2 py-0.5 text-[0.65rem] font-mono uppercase tracking-wider rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                  <Scale className="h-3 w-3" />
                  Advocate
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[0.65rem] font-mono uppercase tracking-wider rounded bg-purple-950/60 border border-purple-500/40 text-purple-300 flex items-center gap-1">
                  <GraduationCap className="h-3 w-3" />
                  Law Student
                </span>
              )}
            </div>
            <p className="text-[0.7rem] text-[#888888] font-mono mt-0.5 truncate max-w-[200px]">
              {currentUser.affiliation}
            </p>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs (Discover, Invitations, My Connections) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("discover")}
            className={`px-4 py-2 text-xs uppercase tracking-[0.1em] font-mono transition-all rounded-full cursor-pointer ${
              activeTab === "discover"
                ? "bg-white text-black font-semibold shadow-md"
                : "apple-glass-pill text-neutral-300 hover:text-white"
            }`}
          >
            Discover Network ({allMembers.length})
          </button>

          <button
            onClick={() => setActiveTab("invitations")}
            className={`relative px-4 py-2 text-xs uppercase tracking-[0.1em] font-mono transition-all rounded-full cursor-pointer flex items-center gap-2 ${
              activeTab === "invitations"
                ? "bg-white text-black font-semibold shadow-md"
                : "apple-glass-pill text-neutral-300 hover:text-white"
            }`}
          >
            <span>Invitations</span>
            {pendingReceived.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[0.65rem] bg-emerald-400 text-black font-bold">
                {pendingReceived.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("connections")}
            className={`px-4 py-2 text-xs uppercase tracking-[0.1em] font-mono transition-all rounded-full cursor-pointer flex items-center gap-2 ${
              activeTab === "connections"
                ? "bg-white text-black font-semibold shadow-md"
                : "apple-glass-pill text-neutral-300 hover:text-white"
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>My Connections ({myAcceptedConnections.length})</span>
          </button>
        </div>

        {activeTab === "discover" && (
          <div className="flex items-center gap-1.5 apple-glass-pill p-1">
            <button
              onClick={() => setRoleFilter("all")}
              className={`px-3 py-1 text-[0.7rem] uppercase font-mono rounded-full transition-colors cursor-pointer ${
                roleFilter === "all" ? "bg-white/20 text-white font-medium" : "text-neutral-400 hover:text-white"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setRoleFilter("lawyers")}
              className={`px-3 py-1 text-[0.7rem] uppercase font-mono rounded-full flex items-center gap-1 transition-colors cursor-pointer ${
                roleFilter === "lawyers" ? "bg-white/20 text-white font-medium" : "text-neutral-400 hover:text-white"
              }`}
            >
              <Scale className="h-3 w-3" />
              Advocates
            </button>
            <button
              onClick={() => setRoleFilter("students")}
              className={`px-3 py-1 text-[0.7rem] uppercase font-mono rounded-full flex items-center gap-1 transition-colors cursor-pointer ${
                roleFilter === "students" ? "bg-white/20 text-white font-medium" : "text-neutral-400 hover:text-white"
              }`}
            >
              <GraduationCap className="h-3 w-3" />
              Students
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: DISCOVER MEMBERS */}
      {activeTab === "discover" && (
        <div className="space-y-6">
          {/* Search and Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search colleagues by advocate name, student name, university, or court..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full apple-glass-input pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500"
              />
            </div>
            <div>
              <select
                aria-label="Filter members by city"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full apple-glass-input px-3.5 py-2.5 text-xs text-white"
              >
                {cities.map((c) => (
                  <option key={c} value={c} className="bg-[#121216] text-white">
                    City: {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Members Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredMembers.map((member) => {
              const { status, connection } = getConnectionStatusBetween(
                connections,
                currentUser.id,
                member.id
              );
              const isLawyer = member.role === "lawyer";

              return (
                <div
                  key={member.id}
                  className="apple-glass-card p-6 flex flex-col justify-between group"
                >
                  <div className="space-y-4">
                    {/* Header: Name and Role Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-xl font-medium text-white group-hover:text-emerald-300 transition-colors">
                          {member.name}
                        </h3>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
                          <MapPin className="h-3 w-3 text-neutral-500" />
                          <span>{member.city}</span>
                          <span>•</span>
                          <span>{member.experienceOrYear}</span>
                        </div>
                      </div>

                      {isLawyer ? (
                        <span className="apple-glass-pill px-2 py-0.5 text-[0.65rem] font-mono uppercase tracking-wider text-emerald-300 border-emerald-500/30 bg-emerald-500/10 flex items-center gap-1 shrink-0">
                          <ShieldCheck className="h-3 w-3" />
                          Advocate
                        </span>
                      ) : (
                        <span className="apple-glass-pill px-2 py-0.5 text-[0.65rem] font-mono uppercase tracking-wider text-purple-300 border-purple-500/30 bg-purple-500/10 flex items-center gap-1 shrink-0">
                          <GraduationCap className="h-3 w-3" />
                          Student
                        </span>
                      )}
                    </div>

                    {/* Affiliation / Institution */}
                    <div className="space-y-1 rounded-xl bg-white/[0.05] p-3 border border-white/[0.08] text-xs">
                      <div className="text-[0.65rem] uppercase tracking-wider text-neutral-400 font-mono">
                        {isLawyer ? "Courts & Practice" : "University / Law School"}
                      </div>
                      <div className="text-white font-medium line-clamp-1">{member.affiliation}</div>
                    </div>

                    {/* Specialisation */}
                    <div className="text-xs">
                      <span className="text-[0.65rem] uppercase tracking-wider text-neutral-400 font-mono block">
                        Focus & Research
                      </span>
                      <p className="mt-0.5 text-neutral-300 line-clamp-2 leading-relaxed">
                        {member.specialisationOrInterests}
                      </p>
                    </div>

                    {member.bio && (
                      <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed italic border-l-2 border-white/20 pl-2.5">
                        "{member.bio}"
                      </p>
                    )}
                  </div>

                  {/* Action Button: LinkedIn-Style Connection State */}
                  <div className="mt-6 pt-4 border-t border-white/[0.08] flex items-center justify-between gap-2">
                    {status === "connected" ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-mono">
                          <UserCheck className="h-3.5 w-3.5" />
                          <span>Connected</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenMessage(member.name, connection?.id || `CONN-${member.id}`)}
                          className="bg-white text-black hover:bg-neutral-200 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>Message</span>
                        </button>
                      </div>
                    ) : status === "pending_sent" ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="inline-flex items-center gap-1 text-xs text-amber-300 font-mono">
                          <Clock className="h-3.5 w-3.5 animate-pulse" />
                          <span>Request Pending</span>
                        </span>
                        <span className="text-[0.7rem] text-neutral-400 font-mono">Awaiting reply</span>
                      </div>
                    ) : status === "pending_received" ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs text-emerald-300 font-mono">Sent you invite</span>
                        <button
                          type="button"
                          onClick={() => connection && handleAccept(connection)}
                          className="bg-emerald-400 text-black px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider hover:bg-emerald-300 transition-colors shadow-sm cursor-pointer"
                        >
                          Accept
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendRequest(member)}
                        disabled={connectingId === member.id}
                        className="w-full apple-glass-pill text-white hover:bg-white hover:text-black py-2 text-xs font-mono uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Users className="h-3.5 w-3.5" />
                        <span>{connectingId === member.id ? "Connecting..." : "Connect"}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredMembers.length === 0 && (
            <div className="apple-glass-card p-12 text-center space-y-3">
              <Users className="h-8 w-8 text-neutral-500 mx-auto" />
              <h3 className="text-white font-medium text-sm">No Members Found</h3>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                No legal professionals or students match your filter criteria. Try adjusting your search query or city selection.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INVITATIONS / PENDING REQUESTS */}
      {activeTab === "invitations" && (
        <div className="space-y-6">
          <div className="apple-glass-card p-6">
            <h3 className="text-white font-display text-xl font-medium">
              Received Invitations ({pendingReceived.length})
            </h3>
            <p className="mt-1 text-xs text-neutral-400">
              Colleagues, advocates, and law scholars who have requested to connect with your profile.
            </p>

            <div className="mt-6 divide-y divide-white/[0.08]">
              {pendingReceived.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 font-mono text-xs">
                  No pending invitations. When colleagues or students request to connect with you, they will appear here.
                </div>
              ) : (
                pendingReceived.map((inv) => (
                  <div key={inv.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-display text-white">
                        {inv.fromUserName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium text-sm">{inv.fromUserName}</span>
                          <span className="apple-glass-pill text-[0.65rem] font-mono uppercase px-2 py-0.5 text-neutral-300">
                            {inv.fromUserRole === "lawyer" ? "Advocate" : "Law Student"}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 font-mono mt-0.5">
                          {inv.fromUserRoleLabel} • {inv.fromUserCity}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleAccept(inv)}
                        disabled={acceptingId === inv.id}
                        className="bg-white text-black hover:bg-neutral-200 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>{acceptingId === inv.id ? "Accepting..." : "Accept"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecline(inv)}
                        className="apple-glass-pill hover:border-red-400 text-neutral-400 hover:text-red-400 px-3 py-1.5 text-xs uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MY CONNECTIONS */}
      {activeTab === "connections" && (
        <div className="space-y-6">
          <div className="apple-glass-card p-6">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <h3 className="text-white font-display text-xl font-medium">
                  Your Connections ({myAcceptedConnections.length})
                </h3>
                <p className="mt-1 text-xs text-neutral-400">
                  Verified advocates and students you have established professional connections with.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {myAcceptedConnections.length === 0 ? (
                <div className="col-span-2 py-12 text-center text-neutral-400 font-mono text-xs">
                  You haven't added any connections yet. Go to "Discover Network" to connect with advocates and law students.
                </div>
              ) : (
                myAcceptedConnections.map((conn) => {
                  const isInitiator = conn.fromUserId.toLowerCase().trim() === currentUser.id.toLowerCase().trim();
                  const partnerName = isInitiator ? conn.toUserName : conn.fromUserName;
                  const partnerRole = isInitiator ? conn.toUserRole : conn.fromUserRole;
                  const partnerCity = isInitiator ? (conn.toUserCity || "New Delhi") : conn.fromUserCity;

                  return (
                    <div
                      key={conn.id}
                      className="apple-glass-card p-5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-display text-white">
                          {partnerName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium text-sm">{partnerName}</span>
                            <span
                              className={`text-[0.65rem] font-mono uppercase px-2 py-0.5 rounded-full border ${
                                partnerRole === "lawyer"
                                  ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                                  : "border-purple-500/40 text-purple-300 bg-purple-500/10"
                              }`}
                            >
                              {partnerRole === "lawyer" ? "Advocate" : "Law Student"}
                            </span>
                          </div>
                          <p className="text-xs text-[#888888] font-mono mt-0.5">
                            Location: {partnerCity}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenMessage(partnerName, conn.id)}
                          className="bg-white text-black hover:bg-neutral-200 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>Message</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDisconnect(conn)}
                          title="Remove connection"
                          className="p-1.5 apple-glass-pill hover:border-red-400 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* In-App Direct Chat Modal for Student or Quick Message */}
      {activeChatTarget && (
        <ConsultationChatModal
          isOpen={Boolean(activeChatTarget)}
          onClose={() => setActiveChatTarget(null)}
          consultationId={activeChatTarget.consultationId}
          clientName={activeChatTarget.clientName}
          lawyerName={activeChatTarget.lawyerName}
          currentParty="lawyer"
        />
      )}
    </div>
  );
}
