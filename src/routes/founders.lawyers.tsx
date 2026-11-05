import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Scale, Check, X, Star, FileText, Eye, ShieldAlert, 
  ExternalLink, Search, RefreshCw, MessageSquare, AlertCircle,
  Plus, Trash2, Phone, Mail, Award, Building2, MapPin, ShieldCheck, Clock, Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranaCredential } from "@/lib/trana-auth";
import { 
  ALL_STATE_BAR_COUNCILS, 
  PROMINENT_BAR_ASSOCIATIONS, 
  LEGAL_SPECIALISATIONS, 
  isValidBarRegNo 
} from "@/lib/courts-data";
import { 
  getAdminLawyers, 
  verifyLawyerAdmin, 
  deleteLawyerAdmin, 
  registerLawyer, 
  autoVerifyLawyerAdmin, 
  LawyerRecord 
} from "@/lib/trana-admin-api";

export const Route = createFileRoute("/founders/lawyers")({
  head: () => ({
    meta: [
      { title: "Founders Dashboard — TRANA" },
      { name: "description", content: "Review advocate applications, verify Bar Council Sanads, and track internal performance ratings." },
      { property: "og:title", content: "Founders Dashboard — TRANA" },
    ],
  }),
  component: FoundersLawyersPage,
});

function FoundersLawyersPage() {
  const { credential } = useTranaCredential();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"active" | "pending">("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLawyer, setSelectedLawyer] = useState<LawyerRecord | null>(null);

  // Add Lawyer modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addBarNo, setAddBarNo] = useState("");
  const [addStateBarCouncil, setAddStateBarCouncil] = useState<string>("Bar Council of Delhi (BCD)");
  const [addYearOfEnrollment, setAddYearOfEnrollment] = useState<number>(new Date().getFullYear() - 3);
  const [addAibeCopNumber, setAddAibeCopNumber] = useState("");
  const [addBarAssociation, setAddBarAssociation] = useState<string>("Delhi High Court Bar Association (DHCBA)");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("+91 ");
  const [addSpecialisation, setAddSpecialisation] = useState("Criminal Defence & Anticipatory Bail");
  const [addExperience, setAddExperience] = useState<number>(5);
  const [addCity, setAddCity] = useState("New Delhi");
  const [addState, setAddState] = useState("Delhi");
  const [addChamber, setAddChamber] = useState("");
  const [addStatus, setAddStatus] = useState<"VERIFIED" | "PENDING_VERIFICATION">("VERIFIED");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch real lawyers from Backend API with Supabase fallback
  const { data: lawyersSummary, isLoading, refetch } = useQuery({
    queryKey: ["founders-admin-lawyers"],
    queryFn: async () => {
      if (credential) {
        try {
          const res = await getAdminLawyers(credential);
          if (res && Array.isArray(res.lawyers)) {
            return res;
          }
        } catch (e) {
          console.warn("Backend getAdminLawyers fallback to Supabase:", e);
        }
      }

      // Supabase fallback
      const { data } = await supabase
        .from("lawyers")
        .select("*")
        .order("created_at", { ascending: false });

      const mapped: LawyerRecord[] = (data || []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        full_name: r.full_name,
        email: r.email,
        phone: r.phone,
        bar_reg_no: r.bar_reg_no,
        state_bar_council: r.state_bar_council,
        year_of_enrollment: r.year_of_enrollment,
        aibe_cop_number: r.aibe_cop_number,
        bar_association: r.bar_association,
        specialisation: r.specialisation || "General Legal Practice",
        experience_years: r.experience_years || 1,
        city: r.city || "New Delhi",
        state: r.state || "Delhi",
        chamber_address: r.chamber_address,
        courts: typeof r.courts === "string" ? [r.courts] : (r.courts || []),
        bio: r.bio,
        sanad_document_url: r.sanad_document_url,
        id_card_document_url: r.id_card_document_url,
        offers_call: r.offers_call ?? true,
        offers_chat: r.offers_chat ?? true,
        offers_in_person: r.offers_in_person ?? false,
        consultation_fee: r.consultation_fee || 0,
        approved: r.approved ?? true,
        verification_status: r.verification_status || (r.approved ? "VERIFIED" : "PENDING_VERIFICATION"),
        verification_notes: r.verification_notes,
        verified_at: r.verified_at,
        verified_by: r.verified_by,
        internal_rating: r.internal_rating || 5.0,
        clients_referred: r.clients_referred || 0,
        consultations_count: r.consultations_count || 0,
        created_at: r.created_at || new Date().toISOString(),
        updated_at: r.updated_at || new Date().toISOString(),
      }));

      const verified = mapped.filter((l) => l.verification_status === "VERIFIED" || l.approved).length;
      const pending = mapped.filter((l) => l.verification_status === "PENDING_VERIFICATION" && !l.approved).length;
      const suspended = mapped.filter((l) => l.verification_status === "SUSPENDED" || l.verification_status === "REJECTED").length;

      return {
        total: mapped.length,
        verified,
        pending,
        suspended,
        lawyers: mapped,
      };
    },
  });

  const lawyers = lawyersSummary?.lawyers || [];

  const filteredLawyers = useMemo(() => {
    return lawyers.filter((l) => {
      const isPending = l.verification_status === "PENDING_VERIFICATION" || (!l.approved && l.verification_status !== "SUSPENDED");
      const matchesTab = activeTab === "pending" ? isPending : !isPending;
      if (!matchesTab) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        l.full_name?.toLowerCase().includes(term) ||
        l.bar_reg_no?.toLowerCase().includes(term) ||
        l.email?.toLowerCase().includes(term) ||
        l.city?.toLowerCase().includes(term) ||
        l.specialisation?.toLowerCase().includes(term)
      );
    });
  }, [lawyers, activeTab, searchTerm]);

  const [autoVerifyingId, setAutoVerifyingId] = useState<string | null>(null);

  async function handleAutoVerify(lawyer: LawyerRecord) {
    if (!credential) {
      toast.error("Authentication required to run verification.");
      return;
    }
    setAutoVerifyingId(lawyer.id);
    try {
      const updated = await autoVerifyLawyerAdmin(credential, lawyer.id);
      if (updated.verification_status === "VERIFIED") {
        toast.success(`Advocate ${lawyer.full_name} auto-verified! ${updated.verified_by || ""}`);
      } else {
        toast.warning(`Verification pending: ${updated.verification_notes || "Requires manual check"}`);
      }
      await refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to execute auto-verification.");
    } finally {
      setAutoVerifyingId(null);
    }
  }

  async function handleApprove(id: string, name: string) {
    try {
      if (credential) {
        await verifyLawyerAdmin(credential, id, { action: "VERIFY" });
      }
      await supabase.from("lawyers").update({ 
        approved: true, 
        verification_status: "VERIFIED",
        verified_at: new Date().toISOString(),
        verified_by: "Founder Admin"
      }).eq("id", id);

      toast.success(`Advocate ${name} verified and approved on TRANA platform!`);
      await refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to approve advocate.");
    }
  }

  async function handleReject(id: string, name: string) {
    const reason = window.prompt(`Enter reason for rejecting advocate ${name}:`, "Sanad record could not be verified on State Bar Council Roll.");
    if (reason === null) return;

    try {
      if (credential) {
        await verifyLawyerAdmin(credential, id, { action: "REJECT", notes: reason });
      }
      await supabase.from("lawyers").update({ 
        approved: false, 
        verification_status: "REJECTED",
        verification_notes: reason
      }).eq("id", id);

      toast.error(`Application for ${name} rejected.`);
      await refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to reject advocate.");
    }
  }

  async function handleSuspend(id: string, name: string) {
    try {
      if (credential) {
        await verifyLawyerAdmin(credential, id, { action: "SUSPEND" });
      }
      await supabase.from("lawyers").update({ 
        approved: false, 
        verification_status: "SUSPENDED" 
      }).eq("id", id);

      toast.warning(`Advocate ${name} has been suspended.`);
      await refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to suspend advocate.");
    }
  }

  async function handleRemove(id: string, name: string) {
    const confirmed = window.confirm(
      `Are you sure you want to permanently remove Advocate ${name} from the platform database?`
    );
    if (!confirmed) return;

    try {
      if (credential) {
        await deleteLawyerAdmin(credential, id);
      }
      await supabase.from("lawyers").delete().eq("id", id);
      if (selectedLawyer?.id === id) setSelectedLawyer(null);

      toast.success(`Advocate ${name} removed from registry.`);
      await refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete advocate.");
    }
  }

  async function handleAddLawyer(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = addName.trim();
    const cleanBar = addBarNo.trim().toUpperCase();
    const cleanEmail = addEmail.trim().toLowerCase();
    const cleanPhone = addPhone.trim();

    if (!cleanName) {
      toast.error("Please enter advocate full name.");
      return;
    }
    if (!cleanBar) {
      toast.error("Please enter State Bar Council Enrollment Number.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        full_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        bar_reg_no: cleanBar,
        state_bar_council: addStateBarCouncil,
        year_of_enrollment: Number(addYearOfEnrollment) || 2021,
        aibe_cop_number: addAibeCopNumber.trim() || undefined,
        bar_association: addBarAssociation,
        specialisation: addSpecialisation,
        experience_years: Number(addExperience) || 1,
        city: addCity.trim() || "New Delhi",
        state: addState.trim() || "Delhi",
        chamber_address: addChamber.trim() || undefined,
        courts: ["Supreme Court of India", "Delhi High Court"],
        bio: `Advocate practicing at ${addCity} specializing in ${addSpecialisation}.`,
        offers_call: true,
        offers_chat: true,
        offers_in_person: false,
        consultation_fee: 0,
      };

      try {
        await registerLawyer(payload, credential || undefined);
      } catch (beErr) {
        console.warn("Backend register error:", beErr);
      }

      await supabase.from("lawyers").upsert({
        full_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        bar_reg_no: cleanBar,
        state_bar_council: addStateBarCouncil,
        year_of_enrollment: Number(addYearOfEnrollment) || 2021,
        aibe_cop_number: addAibeCopNumber.trim() || null,
        bar_association: addBarAssociation,
        specialisation: addSpecialisation,
        experience_years: Number(addExperience) || 1,
        city: addCity.trim() || "New Delhi",
        state: addState.trim() || "Delhi",
        chamber_address: addChamber.trim() || null,
        courts: JSON.stringify(["Supreme Court of India", "Delhi High Court"]),
        offers_call: true,
        offers_chat: true,
        offers_in_person: false,
        approved: addStatus === "VERIFIED",
        verification_status: addStatus,
        internal_rating: 5.0,
      }).catch((e) => console.warn("Supabase add lawyer:", e));

      toast.success(`Advocate ${cleanName} (${cleanBar}) added to TRANA database.`);
      setIsAddModalOpen(false);
      setAddName("");
      setAddBarNo("");
      setAddEmail("");
      setAddPhone("+91 ");
      setAddChamber("");
      await refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to onboard advocate.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const verifiedCount = lawyersSummary?.verified ?? lawyers.filter((l) => l.verification_status === "VERIFIED" || l.approved).length;
  const pendingCount = lawyersSummary?.pending ?? lawyers.filter((l) => l.verification_status === "PENDING_VERIFICATION" && !l.approved).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#252525] pb-6">
        <div>
          <h1 className="font-display text-4xl font-medium text-white">Advocate Verification & Directory</h1>
          <p className="mt-1 text-sm text-[#888888]">
            Manage real advocates enrolled with State Bar Councils across India. Authenticate Sanad numbers and manage consultation routing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 border border-[#333333] px-3.5 py-2 text-xs uppercase tracking-wider text-[#999999] hover:text-white hover:border-white transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sync DB</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-white text-black px-4 py-2 text-xs uppercase tracking-wider font-semibold hover:bg-neutral-200 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Onboard Advocate</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="apple-glass-card p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-neutral-400 font-mono">Total Registered</p>
          <p className="font-display text-3xl font-semibold text-white mt-1">{lawyers.length}</p>
          <p className="text-[11px] text-neutral-400 font-mono mt-1">Advocates on platform</p>
        </div>
        <div className="apple-glass-card border-emerald-500/30 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.15em] text-emerald-400 font-semibold font-mono">Active & Verified</p>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="font-display text-3xl font-semibold text-white mt-1">{verifiedCount}</p>
          <p className="text-[11px] text-emerald-400/80 font-mono mt-1">Sanad verified & receiving referrals</p>
        </div>
        <div className="apple-glass-card border-amber-500/30 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.15em] text-amber-400 font-semibold font-mono">Pending Verification</p>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <p className="font-display text-3xl font-semibold text-white mt-1">{pendingCount}</p>
          <p className="text-[11px] text-amber-400/80 font-mono mt-1">Awaiting Sanad / BCI roll check</p>
        </div>
      </div>

      {/* Tabs and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div className="flex gap-2 font-mono">
          <button
            onClick={() => setActiveTab("active")}
            className={`apple-glass-pill px-4 py-2 text-xs uppercase tracking-wider font-semibold transition-all ${
              activeTab === "active"
                ? "bg-white text-black shadow-md border-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Active Advocates ({verifiedCount})
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={`apple-glass-pill px-4 py-2 text-xs uppercase tracking-wider font-semibold transition-all ${
              activeTab === "pending"
                ? "bg-amber-400 text-black shadow-md border-amber-400"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Pending Sanad Verification ({pendingCount})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="h-4 w-4 text-neutral-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, Sanad, city..."
            className="apple-glass-input w-full pl-9 pr-4 py-2 text-xs text-white placeholder:text-neutral-500"
          />
        </div>
      </div>

      {/* Lawyers List */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-neutral-400 font-mono">Loading advocates...</div>
      ) : filteredLawyers.length === 0 ? (
        <div className="apple-glass-card p-8 text-center space-y-2">
          <p className="font-display text-xl text-white">No advocates found</p>
          <p className="text-xs text-neutral-400 font-mono">
            {activeTab === "pending" ? "No applications pending review." : "No active advocates match this search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredLawyers.map((l) => {
            const isVerified = l.verification_status === "VERIFIED" || l.approved;

            return (
              <div
                key={l.id}
                className="apple-glass-card p-5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-xl font-medium text-white">{l.full_name}</h3>
                    {isVerified ? (
                      <span className="inline-flex items-center gap-1 border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase font-semibold text-emerald-400">
                        <Check className="h-3 w-3" /> Verified Sanad
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase font-semibold text-amber-400">
                        <Clock className="h-3 w-3" /> Verification Pending
                      </span>
                    )}
                    {l.bar_reg_no && (
                      <span className="font-mono text-xs text-[#AAAAAA] bg-[#1F1F1F] px-2 py-0.5 border border-[#333333]">
                        {l.bar_reg_no}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#888888]">
                    {l.state_bar_council && (
                      <span className="flex items-center gap-1 text-neutral-300">
                        <Award className="h-3.5 w-3.5 text-neutral-400" />
                        <span>{l.state_bar_council}</span>
                      </span>
                    )}
                    {l.bar_association && (
                      <span>• {l.bar_association}</span>
                    )}
                    <span>• {l.city}, {l.state || "India"}</span>
                    {l.experience_years ? <span>• {l.experience_years}+ Yrs Practice</span> : null}
                  </div>

                  <p className="text-xs text-neutral-300 pt-1">
                    <strong className="text-white">Specialisation:</strong> {l.specialisation}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 text-xs text-[#666666] pt-1">
                    {l.email && (
                      <span className="flex items-center gap-1 font-mono">
                        <Mail className="h-3 w-3" /> {l.email}
                      </span>
                    )}
                    {l.phone && (
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="h-3 w-3" /> {l.phone}
                      </span>
                    )}
                    {l.chamber_address && (
                      <span className="text-[11px] text-[#777777]">
                        Chamber: {l.chamber_address}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-[#222222]">
                  {!isVerified && (
                    <button
                      onClick={() => handleAutoVerify(l)}
                      disabled={autoVerifyingId === l.id}
                      className="bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-amber-500/40 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      title="Run automated Bar Council Sanad, AIBE COP and eCourts verification"
                    >
                      {autoVerifyingId === l.id ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                          <span>Auto-Verify</span>
                        </>
                      )}
                    </button>
                  )}

                  {!isVerified && (
                    <button
                      onClick={() => handleApprove(l.id, l.full_name)}
                      className="bg-emerald-500 hover:bg-emerald-600 text-black px-3.5 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Approve Sanad</span>
                    </button>
                  )}

                  {isVerified ? (
                    <button
                      onClick={() => handleSuspend(l.id, l.full_name)}
                      className="border border-[#444444] hover:border-amber-400 hover:text-amber-400 text-[#888888] px-3 py-2 text-xs uppercase tracking-wider transition-colors"
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReject(l.id, l.full_name)}
                      className="border border-red-500/40 text-red-400 hover:bg-red-500/10 px-3 py-2 text-xs uppercase tracking-wider transition-colors flex items-center gap-1"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Reject</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleRemove(l.id, l.full_name)}
                    className="border border-[#333333] hover:border-red-500 hover:text-red-400 text-[#666666] p-2 transition-colors"
                    title="Delete advocate"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Onboard Advocate Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl border border-[#333333] bg-[#141414] p-6 md:p-8 shadow-2xl relative my-8">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute right-5 top-5 text-[#888888] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#252525] pb-4 mb-6">
              <Scale className="h-6 w-6 text-white" />
              <div>
                <h3 className="font-display text-2xl font-medium text-white">Onboard Verified Advocate</h3>
                <p className="text-xs text-[#888888]">Register real advocate with State Bar Council Sanad credentials</p>
              </div>
            </div>

            <form onSubmit={handleAddLawyer} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1">
                    Full Legal Name (as on Bar Sanad) *
                  </label>
                  <input
                    type="text"
                    required
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="e.g. Adv. Siddharth K. Rao"
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1">
                    State Bar Council *
                  </label>
                  <select
                    value={addStateBarCouncil}
                    onChange={(e) => setAddStateBarCouncil(e.target.value)}
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                  >
                    {ALL_STATE_BAR_COUNCILS.map((sbc) => (
                      <option key={sbc} value={sbc} className="bg-[#141414] text-white">
                        {sbc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1">
                    Bar Enrollment / Sanad No. *
                  </label>
                  <input
                    type="text"
                    required
                    value={addBarNo}
                    onChange={(e) => setAddBarNo(e.target.value)}
                    placeholder="e.g. D/1429/2019"
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2.5 text-sm font-mono text-white focus:border-white focus:outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1">
                    Year of Enrollment
                  </label>
                  <input
                    type="number"
                    value={addYearOfEnrollment}
                    onChange={(e) => setAddYearOfEnrollment(parseInt(e.target.value) || 2021)}
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1">
                    AIBE COP Number
                  </label>
                  <input
                    type="text"
                    value={addAibeCopNumber}
                    onChange={(e) => setAddAibeCopNumber(e.target.value)}
                    placeholder="e.g. COP/BCD/2021/8831"
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2.5 text-sm font-mono text-white focus:border-white focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1">
                    Primary Bar Association Membership
                  </label>
                  <select
                    value={addBarAssociation}
                    onChange={(e) => setAddBarAssociation(e.target.value)}
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                  >
                    {PROMINENT_BAR_ASSOCIATIONS.map((ba) => (
                      <option key={ba} value={ba} className="bg-[#141414] text-white">
                        {ba}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1">
                    Specialisation *
                  </label>
                  <select
                    value={addSpecialisation}
                    onChange={(e) => setAddSpecialisation(e.target.value)}
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                  >
                    {LEGAL_SPECIALISATIONS.map((spec) => (
                      <option key={spec} value={spec} className="bg-[#141414] text-white">
                        {spec}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1">
                    Years of Active Practice
                  </label>
                  <input
                    type="number"
                    value={addExperience}
                    onChange={(e) => setAddExperience(parseInt(e.target.value) || 1)}
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1">
                    Primary City *
                  </label>
                  <input
                    type="text"
                    required
                    value={addCity}
                    onChange={(e) => setAddCity(e.target.value)}
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1">
                    State / UT *
                  </label>
                  <input
                    type="text"
                    required
                    value={addState}
                    onChange={(e) => setAddState(e.target.value)}
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1">
                    Chamber Mobile Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2.5 text-sm text-white font-mono focus:border-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1">
                    Chamber Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="counsel@delhibar.org"
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2.5 text-sm text-white font-mono focus:border-white focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1">
                    Chamber / Office Address
                  </label>
                  <input
                    type="text"
                    value={addChamber}
                    onChange={(e) => setAddChamber(e.target.value)}
                    placeholder="e.g. Chamber No. 418, Lawyers Block, High Court of Delhi"
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1">
                    Initial Verification Status
                  </label>
                  <select
                    value={addStatus}
                    onChange={(e) => setAddStatus(e.target.value as any)}
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                  >
                    <option value="VERIFIED">Verified & Active</option>
                    <option value="PENDING_VERIFICATION">Pending Verification</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-[#252525]">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-white text-black py-3 text-xs uppercase font-semibold tracking-wider hover:bg-neutral-200 transition-colors"
                >
                  {isSubmitting ? "Onboarding..." : "Register & Activate Advocate"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="border border-[#333333] px-5 py-3 text-xs uppercase tracking-wider text-[#888888] hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
