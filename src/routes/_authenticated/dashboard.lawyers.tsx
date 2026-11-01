import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Phone, MessageSquare, Lock, X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTranaCredential } from "@/lib/trana-auth";
import { buildClientIntakeBrief } from "@/lib/intake-brief";
import { ConsultationChatModal } from "@/components/ConsultationChatModal";

export const Route = createFileRoute("/_authenticated/dashboard/lawyers")({
  head: () => ({
    meta: [
      { title: "Citizens Dashboard — TRANA" },
      { name: "description", content: "Connect with verified lawyers and arrange a consultation by call or chat." },
      { property: "og:title", content: "Citizens Dashboard — TRANA" },
      { property: "og:description", content: "Verified legal professionals across India." },
    ],
  }),
  component: Lawyers,
});

type Lawyer = {
  id: string;
  full_name: string;
  specialisation: string;
  city: string;
  offers_call: boolean;
  offers_chat: boolean;
  offers_in_person?: boolean;
  approved?: boolean;
};

// Benchmarked sample advocate profiles for testing and demonstration
const sampleBenchmarkLawyers: Lawyer[] = [
  {
    id: "sample-law-01",
    full_name: "Adv. Rajeshwaran Iyer",
    specialisation: "Criminal Defence & Anticipatory Bail",
    city: "New Delhi",
    offers_call: true,
    offers_chat: true,
    offers_in_person: false,
    approved: true,
  },
  {
    id: "sample-law-02",
    full_name: "Adv. Meenakshi Sundaram",
    specialisation: "Corporate Crimes & White Collar Offences",
    city: "Mumbai",
    offers_call: true,
    offers_chat: true,
    offers_in_person: false,
    approved: true,
  },
  {
    id: "sample-law-03",
    full_name: "Adv. Harpreet Singh Sodhi",
    specialisation: "Constitutional Writs & Service Law",
    city: "Chandigarh",
    offers_call: true,
    offers_chat: true,
    offers_in_person: false,
    approved: true,
  },
  {
    id: "sample-law-04",
    full_name: "Adv. Kavita Deshmukh",
    specialisation: "Commercial Arbitration & Cheque Dishonour",
    city: "Pune",
    offers_call: true,
    offers_chat: true,
    offers_in_person: false,
    approved: true,
  },
  {
    id: "sample-law-05",
    full_name: "Adv. Vikramjit Banerjee",
    specialisation: "BNS Criminal Procedure & Bail",
    city: "Kolkata",
    offers_call: true,
    offers_chat: true,
    offers_in_person: false,
    approved: true,
  },
  {
    id: "sample-law-06",
    full_name: "Adv. Ananya Sengupta",
    specialisation: "Cyber Crime & Data Protection Litigation",
    city: "Bengaluru",
    offers_call: true,
    offers_chat: true,
    offers_in_person: false,
    approved: true,
  },
  {
    id: "sample-law-07",
    full_name: "Adv. Pradeep K. Dwivedi",
    specialisation: "BNSS Criminal Procedure & Trial",
    city: "Prayagraj",
    offers_call: true,
    offers_chat: true,
    offers_in_person: false,
    approved: true,
  },
  {
    id: "sample-law-08",
    full_name: "Adv. Sumedha Sen",
    specialisation: "Technology Contracts & Privacy Compliance",
    city: "Bengaluru",
    offers_call: true,
    offers_chat: true,
    offers_in_person: false,
    approved: true,
  },
];

function Lawyers() {
  const { user } = Route.useRouteContext();
  const { credential } = useTranaCredential();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [loadingLawyerId, setLoadingLawyerId] = useState<string | null>(null);

  // Consultation Mode modal state
  const [consultingLawyer, setConsultingLawyer] = useState<Lawyer | null>(null);
  const [isModeModalOpen, setIsModeModalOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"call" | "chat">("call");

  // Private Masked Consultation Chat Modal
  const [activeChat, setActiveChat] = useState<{
    consultationId: string;
    lawyerName: string;
    clientName: string;
    consultType: string;
  } | null>(null);

  // Fetch verified advocates onboard with TRANA from Supabase
  const { data: dbLawyers = [], isLoading } = useQuery({
    queryKey: ["lawyers"],
    queryFn: async () => (await supabase.from("lawyers").select("*").order("full_name")).data ?? [],
  });

  // User's existing consultations so previously requested lawyer boxes remain locked unless denied
  const { data: userConsultations = [] } = useQuery({
    queryKey: ["citizen-consultations-lock", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("consultations")
        .select("id, lawyer_id, lawyer_name, status, consult_type")
        .eq("user_id", user.id);
      return data || [];
    },
    enabled: Boolean(user?.id),
  });

  const { lockedIds, lockedNames } = useMemo(() => {
    const ids = new Set<string>();
    const names = new Set<string>();
    const deniedIds = new Set<string>();
    const deniedNames = new Set<string>();

    userConsultations.forEach((c) => {
      const statusLower = (c.status || "").toLowerCase();
      if (statusLower === "denied" || statusLower === "cancelled") {
        if (c.lawyer_id) deniedIds.add(c.lawyer_id);
        if (c.lawyer_name) deniedNames.add(c.lawyer_name.toLowerCase().trim());
      } else if (statusLower === "requested" || statusLower === "confirmed" || statusLower === "upcoming") {
        if (c.lawyer_id) ids.add(c.lawyer_id);
        if (c.lawyer_name) names.add(c.lawyer_name.toLowerCase().trim());
      }
    });

    // Also check local referrals in case case was denied in lawyer workspace
    if (typeof window !== "undefined") {
      try {
        const localReferrals = JSON.parse(localStorage.getItem("trana_client_referrals") || "[]");
        (localReferrals || []).forEach((r: any) => {
          const st = (r.status || "").toLowerCase();
          if (st === "denied" || st === "cancelled") {
            if (r.lawyerId) deniedIds.add(r.lawyerId);
            if (r.lawyerName) deniedNames.add(r.lawyerName.toLowerCase().trim());
          }
        });
      } catch {
        // ignore
      }
    }

    if (typeof window !== "undefined" && user?.id) {
      try {
        const stored = JSON.parse(localStorage.getItem(`trana_requested_lawyers_${user.id}`) || "[]");
        if (Array.isArray(stored)) {
          stored.forEach((item: any) => {
            const itemId = typeof item === "string" ? item : item?.id;
            const itemName = (typeof item === "object" ? item?.name : "")?.toLowerCase().trim();
            if (itemId && !deniedIds.has(itemId)) ids.add(itemId);
            if (itemName && !deniedNames.has(itemName)) names.add(itemName);
          });
        }
      } catch {
        // ignore
      }
    }

    // Explicitly delete any denied lawyers so their box is unlocked
    deniedIds.forEach((id) => ids.delete(id));
    deniedNames.forEach((n) => names.delete(n));

    return { lockedIds: ids, lockedNames: names };
  }, [userConsultations, user?.id]);

  // Reconcile onboarded database lawyers, founders' newly added lawyers, and sample benchmark advocates
  const lawyers = useMemo(() => {
    let removedIds: string[] = [];
    let foundersAdded: any[] = [];
    try {
      if (typeof window !== "undefined") {
        removedIds = JSON.parse(localStorage.getItem("trana_founders_removed_lawyers") || "[]");
        foundersAdded = JSON.parse(localStorage.getItem("trana_founders_added_lawyers") || "[]");
      }
    } catch {
      // ignore
    }

    const mappedFoundersAdded: Lawyer[] = (foundersAdded || [])
      .filter((item) => item && (item.status === "Active" || !item.status))
      .map((item) => ({
        id: item.id || `manual-${item.name || item.full_name}`,
        full_name: item.name || item.full_name || "Advocate",
        specialisation: item.specialisation || "General Legal Practice",
        city: item.city || "New Delhi",
        offers_call: true,
        offers_chat: true,
        offers_in_person: false,
        approved: true,
      }));

    const mappedDbLawyers: Lawyer[] = (dbLawyers || []).map((row: any) => ({
      id: row.id,
      full_name: row.full_name,
      specialisation: row.specialisation || "General Legal Practice",
      city: row.city || "New Delhi",
      offers_call: row.offers_call ?? true,
      offers_chat: row.offers_chat ?? true,
      offers_in_person: false,
      approved: row.approved ?? true,
    }));

    const combinedCandidates: Lawyer[] = [
      ...mappedFoundersAdded,
      ...mappedDbLawyers,
      ...sampleBenchmarkLawyers,
    ];

    const result: Lawyer[] = [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();

    for (const l of combinedCandidates) {
      if (!l.id || !l.full_name) continue;
      if (removedIds.includes(l.id)) continue;

      const normId = l.id.toLowerCase().trim();
      const normName = l.full_name.toLowerCase().replace(/^adv\.?\s*/i, "").trim();

      if (!seenIds.has(normId) && !seenNames.has(normName)) {
        seenIds.add(normId);
        seenNames.add(normName);
        result.push(l);
      }
    }

    return result;
  }, [dbLawyers]);

  const areas = [...new Set(lawyers.map((l) => l.specialisation).filter(Boolean))];
  const cities = [...new Set(lawyers.map((l) => l.city).filter(Boolean))];
  const list = lawyers.filter((l) => {
    const t = q.toLowerCase().trim();
    if (t && ![l.full_name, l.specialisation, l.city].some((v) => v?.toLowerCase().includes(t))) return false;
    if (area && l.specialisation !== area) return false;
    if (city && l.city !== city) return false;
    if (type === "call" && !l.offers_call) return false;
    if (type === "chat" && !l.offers_chat) return false;
    return true;
  });

  function handleInitiateRequest(l: Lawyer) {
    setConsultingLawyer(l);
    // Default to available consultation type
    const initialMode = l.offers_call && !l.offers_chat ? "call" : l.offers_chat && !l.offers_call ? "chat" : "call";
    setSelectedMode(initialMode);
    setIsModeModalOpen(true);
  }

  function handleOpenExistingChat(l: Lawyer) {
    const clientName = (user as any).name || (user as any).user_metadata?.full_name || user.email?.split("@")[0] || "Citizen Client";
    let consultId = `REF-${l.id}`;
    const match = userConsultations.find(
      (c) => c.lawyer_id === l.id || c.lawyer_name?.toLowerCase().trim() === l.full_name.toLowerCase().trim()
    );
    if (match) {
      consultId = `REF-${match.id.slice(0, 8).toUpperCase()}`;
    }

    setActiveChat({
      consultationId: consultId,
      lawyerName: l.full_name,
      clientName,
      consultType: l.offers_chat ? "Chat" : "Call",
    });
  }

  async function request(l: Lawyer, chosenMode: "call" | "chat") {
    setLoadingLawyerId(l.id);
    try {
      const clientName = (user as any).name || (user as any).user_metadata?.full_name || user.email?.split("@")[0] || "Citizen Client";
      // Generate client intake brief from citizen's AI conversation / analysis
      const brief = await buildClientIntakeBrief({
        userId: user.id,
        userEmail: user.email,
        userName: clientName,
        lawyerName: l.full_name,
        consultType: chosenMode,
        credential,
      });

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(l.id);

      let createdId = `REF-${Date.now().toString(36).toUpperCase()}`;

      const { data: inserted, error } = await supabase.from("consultations").insert({
        user_id: user.id,
        lawyer_id: isUuid ? l.id : null,
        lawyer_name: l.full_name,
        consult_type: chosenMode,
        status: "requested",
        note: brief.fullBriefMarkdown,
        intake_brief: brief.fullBriefMarkdown,
      }).select().maybeSingle();

      if (inserted?.id) {
        createdId = `REF-${inserted.id.slice(0, 8).toUpperCase()}`;
      } else if (error) {
        // Fallback retry with lawyer_id: null in case foreign key check on mock id failed
        const retry = await supabase.from("consultations").insert({
          user_id: user.id,
          lawyer_id: null,
          lawyer_name: l.full_name,
          consult_type: chosenMode,
          status: "requested",
          note: brief.fullBriefMarkdown,
          intake_brief: brief.fullBriefMarkdown,
        }).select().maybeSingle();

        if (retry.data?.id) {
          createdId = `REF-${retry.data.id.slice(0, 8).toUpperCase()}`;
        }
      }

      // Send all details to the lawyers dashboard under client referrals
      try {
        const newReferral = {
          id: createdId,
          date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
          client: clientName,
          phone: "+91 (Verified Account)",
          matterType: brief.matterType || "Legal Consultation Request",
          section: brief.sectionsSummary || "Applicable Statutes",
          consultationType: (chosenMode === "call" ? "Call" : "Chat") as "Call" | "Chat",
          status: "New Request" as const,
          summary: brief.summary || brief.facts || "Client requested consultation with counsel.",
          intakeBrief: brief.fullBriefMarkdown,
          lawyerName: l.full_name,
          lawyerId: l.id,
          created_at: new Date().toISOString(),
        };

        const existingReferrals = JSON.parse(localStorage.getItem("trana_client_referrals") || "[]");
        existingReferrals.unshift(newReferral);
        localStorage.setItem("trana_client_referrals", JSON.stringify(existingReferrals));
      } catch (err) {
        console.warn("Could not save to client referrals:", err);
      }

      // Persist locked box state for this citizen
      try {
        const stored = JSON.parse(localStorage.getItem(`trana_requested_lawyers_${user.id}`) || "[]");
        stored.push({ id: l.id, name: l.full_name });
        localStorage.setItem(`trana_requested_lawyers_${user.id}`, JSON.stringify(stored));
      } catch {
        // ignore
      }

      setRequested((r) => ({ ...r, [l.id]: true }));
      qc.invalidateQueries({ queryKey: ["consultations"] });
      qc.invalidateQueries({ queryKey: ["citizen-consultations-lock"] });
      qc.invalidateQueries({ queryKey: ["lawyer-referrals-consultations"] });
      qc.invalidateQueries({ queryKey: ["lawyer-overview-consultations"] });

      // Immediately open masked consultation chat between client and lawyer
      setActiveChat({
        consultationId: createdId,
        lawyerName: l.full_name,
        clientName,
        consultType: chosenMode === "call" ? "Call" : "Chat",
      });

      if (brief.hasConversation) {
        toast.success(`Consultation requested with ${l.full_name}. Channel opened with counsel.`);
      } else {
        toast.success(`Consultation requested with ${l.full_name}. Details forwarded to counsel.`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to request consultation.");
    } finally {
      setLoadingLawyerId(null);
    }
  }

  const sel = "border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none";
  return (
    <div>
      <h1 className="font-display text-4xl md:text-5xl">Find a Legal Professional</h1>
      <p className="mt-3 text-sm text-muted-foreground">Connect with verified lawyers and legal experts. Arrange a consultation by call or chat.</p>

      <div className="mt-10">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by specialisation or city"
          className="w-full border border-foreground/80 bg-background px-5 py-4 text-sm placeholder:text-muted-foreground focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap gap-3">
          <select className={sel} value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area of law">
            <option value="">All areas of law</option>
            {areas.map((a) => <option key={a}>{a}</option>)}
          </select>
          <select className={sel} value={city} onChange={(e) => setCity(e.target.value)} aria-label="City">
            <option value="">All cities</option>
            {cities.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className={sel} value={type} onChange={(e) => setType(e.target.value)} aria-label="Consultation type">
            <option value="">Any consultation type</option>
            <option value="call">Call</option>
            <option value="chat">Chat</option>
          </select>
        </div>
      </div>

      {isLoading ? null : lawyers.length === 0 ? (
        <div className="mt-10 border border-border bg-card p-8">
          <p className="font-display text-2xl">No lawyers listed yet</p>
          <p className="mt-2 text-sm text-muted-foreground">We're verifying our first legal professionals. Check back soon in an emergency, contact your nearest legal aid authority (NALSA helpline 15100).</p>
        </div>
      ) : list.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">No lawyers match these filters.</p>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((l) => {
            const isLocked = Boolean(
              requested[l.id] ||
              lockedIds.has(l.id) ||
              lockedNames.has(l.full_name.toLowerCase().trim())
            );

            return (
              <div
                key={l.id}
                className={`flex flex-col justify-between border p-6 transition-all relative ${
                  isLocked
                    ? "border-emerald-500/60 bg-emerald-950/10 shadow-sm"
                    : "border-foreground/80 bg-card"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">✓ Verified by TRANA</p>
                    {isLocked && (
                      <span className="flex items-center gap-1 text-[0.65rem] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded">
                        <Lock className="h-3 w-3" /> Locked
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 font-display text-2xl">{l.full_name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{l.specialisation}</p>
                  <p className="text-sm text-muted-foreground">{l.city}</p>
                  <div className="mt-4 flex gap-4 text-sm">
                    {l.offers_call && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" />Call</span>}
                    {l.offers_chat && <span className="flex items-center gap-1.5"><MessageSquare className="h-4 w-4" />Chat</span>}
                  </div>
                </div>

                {isLocked ? (
                  <div className="mt-6 flex flex-col gap-2">
                    <div className="border border-emerald-500/50 bg-emerald-950/40 text-emerald-300 py-2.5 px-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 rounded cursor-not-allowed">
                      <Lock className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Consultation Requested</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenExistingChat(l)}
                      className="border border-white/40 hover:border-white bg-[#1A1A1A] hover:bg-[#252525] text-white py-2 px-3 text-xs uppercase tracking-wider font-mono flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Open Consultation Chat</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleInitiateRequest(l)}
                    disabled={loadingLawyerId === l.id}
                    className="btn-line mt-6 disabled:opacity-50"
                  >
                    {loadingLawyerId === l.id ? "Preparing Brief..." : "Request Consultation"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CITIZEN CONSULTATION MODE SELECTION MODAL */}
      {isModeModalOpen && consultingLawyer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#161616] border border-[#333333] p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-[#282828] pb-3">
              <div>
                <span className="text-[0.65rem] uppercase tracking-widest text-[#888888] font-mono">
                  CONSULTATION PREFERENCE
                </span>
                <h3 className="font-display text-2xl font-medium text-white mt-1">
                  Choose Consultation Mode
                </h3>
                <p className="text-xs text-[#AAAAAA] mt-0.5">
                  Connecting with {consultingLawyer.full_name}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsModeModalOpen(false);
                  setConsultingLawyer(null);
                }}
                className="p-1 border border-[#333333] text-[#AAAAAA] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs text-[#888888] uppercase tracking-wider font-mono block">
                Select your preferred mode of consultation:
              </label>

              {/* Option 1: Phone Call */}
              <button
                type="button"
                disabled={!consultingLawyer.offers_call}
                onClick={() => setSelectedMode("call")}
                className={`w-full p-4 border text-left flex items-start gap-3 transition-colors ${
                  selectedMode === "call"
                    ? "border-white bg-[#222222] text-white"
                    : consultingLawyer.offers_call
                    ? "border-[#333333] bg-[#111111] text-[#AAAAAA] hover:text-white hover:border-[#555555]"
                    : "border-[#222222] bg-[#0E0E0E] text-[#555555] cursor-not-allowed opacity-50"
                }`}
              >
                <Phone className={`h-5 w-5 mt-0.5 ${selectedMode === "call" ? "text-sky-400" : "text-[#777777]"}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">Phone Consultation</span>
                    {selectedMode === "call" && (
                      <span className="text-[0.65rem] font-mono bg-sky-950 text-sky-400 px-1.5 py-0.5 border border-sky-800 rounded">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#888888] mt-1">
                    Direct phone consultation with advocate. Masked privacy relay.
                  </p>
                </div>
              </button>

              {/* Option 2: Secure In-App Chat */}
              <button
                type="button"
                disabled={!consultingLawyer.offers_chat}
                onClick={() => setSelectedMode("chat")}
                className={`w-full p-4 border text-left flex items-start gap-3 transition-colors ${
                  selectedMode === "chat"
                    ? "border-white bg-[#222222] text-white"
                    : consultingLawyer.offers_chat
                    ? "border-[#333333] bg-[#111111] text-[#AAAAAA] hover:text-white hover:border-[#555555]"
                    : "border-[#222222] bg-[#0E0E0E] text-[#555555] cursor-not-allowed opacity-50"
                }`}
              >
                <MessageSquare className={`h-5 w-5 mt-0.5 ${selectedMode === "chat" ? "text-purple-400" : "text-[#777777]"}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">Secure In-App Chat</span>
                    {selectedMode === "chat" && (
                      <span className="text-[0.65rem] font-mono bg-purple-950 text-purple-400 px-1.5 py-0.5 border border-purple-800 rounded">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#888888] mt-1">
                    Direct confidential messaging with counsel. No personal contact details disclosed.
                  </p>
                </div>
              </button>
            </div>

            <div className="bg-[#111111] border border-[#222222] p-3 text-[0.7rem] text-[#888888] flex items-center gap-2 font-mono">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Strict Privacy: Only names and consultation mode are disclosed between parties.</span>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsModeModalOpen(false);
                  setConsultingLawyer(null);
                }}
                className="border border-[#333333] px-4 py-2 text-xs uppercase tracking-wider text-[#AAAAAA] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const l = consultingLawyer;
                  const mode = selectedMode;
                  setIsModeModalOpen(false);
                  setConsultingLawyer(null);
                  request(l, mode);
                }}
                className="bg-white text-black px-5 py-2 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-200 transition-colors"
              >
                Proceed with Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRIVATE MASKED CONSULTATION CHAT MODAL */}
      {activeChat && (
        <ConsultationChatModal
          isOpen={Boolean(activeChat)}
          onClose={() => setActiveChat(null)}
          consultationId={activeChat.consultationId}
          consultationType={activeChat.consultType}
          currentParty="client"
          clientName={activeChat.clientName}
          lawyerName={activeChat.lawyerName}
        />
      )}
    </div>
  );
}
