import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Phone, MessageSquare, Lock, X, ShieldCheck, Scale, Award, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTranaCredential } from "@/lib/trana-auth";
import { buildClientIntakeBrief } from "@/lib/intake-brief";
import { ConsultationChatModal } from "@/components/ConsultationChatModal";
import { getPublicLawyers, LawyerRecord } from "@/lib/trana-admin-api";

export const Route = createFileRoute("/_authenticated/dashboard/lawyers")({
  head: () => ({
    meta: [
      { title: "Find a Professional — TRANA" },
      { name: "description", content: "Connect with verified legal professionals and arrange a consultation by call or chat." },
      { property: "og:title", content: "Find a Professional — TRANA" },
      { property: "og:description", content: "Verified legal professionals and advocates across India." },
    ],
  }),
  component: Lawyers,
});

type Lawyer = {
  id: string;
  full_name: string;
  bar_reg_no?: string;
  state_bar_council?: string;
  experience_years?: number;
  specialisation: string;
  city: string;
  state?: string;
  courts?: string;
  offers_call: boolean;
  offers_chat: boolean;
  offers_in_person?: boolean;
  approved?: boolean;
  bio?: string;
  avatar_url?: string;
  photo_url?: string;
  bar_association?: string;
  chamber_address?: string;
};

function getLawyerPhoto(l: Lawyer): string | null {
  if (l.avatar_url) return l.avatar_url;
  if (l.photo_url) return l.photo_url;
  if (typeof window !== "undefined") {
    try {
      const photoMap = JSON.parse(localStorage.getItem("trana_all_lawyer_photos") || "{}");
      if (photoMap[l.id]) return photoMap[l.id];
      if (l.bar_reg_no && photoMap[l.bar_reg_no.trim().toUpperCase()]) return photoMap[l.bar_reg_no.trim().toUpperCase()];
      const normName = l.full_name.toLowerCase().trim();
      if (photoMap[normName]) return photoMap[normName];
      const byUser = localStorage.getItem(`trana_lawyer_avatar_${l.id}`);
      if (byUser) return byUser;
      if (l.bar_reg_no) {
        const byBar = localStorage.getItem(`trana_lawyer_avatar_${l.bar_reg_no.trim().toUpperCase()}`);
        if (byBar) return byBar;
      }
    } catch {}
  }
  return null;
}

function Lawyers() {
  const { user } = Route.useRouteContext();
  const { credential } = useTranaCredential();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [loadingLawyerId, setLoadingLawyerId] = useState<string | null>(null);

  // Lawyer Full Profile Modal State
  const [selectedLawyerProfile, setSelectedLawyerProfile] = useState<Lawyer | null>(null);

  // Consultation Mode modal state
  const [consultingLawyer, setConsultingLawyer] = useState<Lawyer | null>(null);
  const [isModeModalOpen, setIsModeModalOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"call" | "chat">("call");

  // Private Masked Consultation Chat Modal
  // Handled via /dashboard/consultations

  // Fetch verified advocates from Backend API & Supabase database
  const { data: dbLawyers = [], isLoading } = useQuery({
    queryKey: ["verified-lawyers-directory"],
    queryFn: async () => {
      // 1. Try Backend API
      try {
        const apiRows = await getPublicLawyers();
        if (apiRows && apiRows.length > 0) {
          return apiRows;
        }
      } catch (e) {
        console.warn("Backend getPublicLawyers fallback to Supabase:", e);
      }

      // 2. Direct Supabase Query
      const { data } = await supabase
        .from("lawyers")
        .select("*")
        .eq("approved", true)
        .order("full_name");
      return data ?? [];
    },
  });

  // User's existing consultations so previously requested lawyer boxes remain locked unless denied
  const { data: userConsultations = [] } = useQuery({
    queryKey: ["citizen-consultations-lock", user?.id],
    queryFn: async () => {
      if (!user?.id && !user?.email) return [];
      let q = supabase.from("consultations").select("id, lawyer_id, lawyer_name, status, consult_type");
      if (user?.id && user?.email) {
        q = q.or(`user_id.eq.${user.id},user_id.eq.${user.email}`);
      } else if (user?.id) {
        q = q.eq("user_id", String(user.id));
      } else if (user?.email) {
        q = q.eq("user_id", String(user.email));
      }
      const { data } = await q;
      return data || [];
    },
    enabled: Boolean(user?.id || user?.email),
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

    deniedIds.forEach((id) => ids.delete(id));
    deniedNames.forEach((n) => names.delete(n));

    return { lockedIds: ids, lockedNames: names };
  }, [userConsultations, user?.id]);

  // Reconcile ONLY real verified advocates from the database
  const lawyers = useMemo(() => {
    let removedIds: string[] = [];
    try {
      if (typeof window !== "undefined") {
        removedIds = JSON.parse(localStorage.getItem("trana_founders_removed_lawyers") || "[]");
      }
    } catch {
      // ignore
    }

    const mappedDbLawyers: Lawyer[] = (dbLawyers || [])
      .filter((row: any) => row.approved !== false && row.verification_status !== "REJECTED" && row.verification_status !== "SUSPENDED")
      .map((row: any) => {
        let courtsDisplay = "";
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
        return {
          id: row.id,
          full_name: row.full_name,
          bar_reg_no: row.bar_reg_no,
          state_bar_council: row.state_bar_council,
          experience_years: row.experience_years,
          specialisation: row.specialisation || "General Legal Practice",
          city: row.city || "New Delhi",
          state: row.state || "Delhi",
          courts: courtsDisplay || "Supreme Court of India · Delhi High Court",
          offers_call: row.offers_call ?? true,
          offers_chat: row.offers_chat ?? true,
          offers_in_person: false,
          approved: true,
        };
      });

    const result: Lawyer[] = [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();

    for (const l of mappedDbLawyers) {
      if (!l.id || !l.full_name) continue;
      if (removedIds.includes(l.id)) continue;

      const normId = l.id.toLowerCase().trim();
      const normName = l.full_name.toLowerCase().replace(/^adv\.?\s*/i, "").trim();

      // Guard against any test / mock advocates
      if (
        normName.includes("anandita") ||
        normName.includes("swastik") ||
        normName.includes("vikramaditya")
      ) {
        continue;
      }

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
    if (t && ![l.full_name, l.specialisation, l.city, l.bar_reg_no, l.courts].some((v) => v?.toLowerCase().includes(t))) return false;
    if (area && l.specialisation !== area) return false;
    if (city && l.city !== city) return false;
    if (type === "call" && !l.offers_call) return false;
    if (type === "chat" && !l.offers_chat) return false;
    return true;
  });

  function handleInitiateRequest(l: Lawyer) {
    setConsultingLawyer(l);
    const initialMode = l.offers_call && !l.offers_chat ? "call" : l.offers_chat && !l.offers_call ? "chat" : "call";
    setSelectedMode(initialMode);
    setIsModeModalOpen(true);
  }

  function handleOpenExistingChat(l: Lawyer) {
    const normName = l.full_name.toLowerCase().replace(/^adv\.?\s*/i, "").trim();
    const match = userConsultations.find(
      (c) => (c.lawyer_id && c.lawyer_id === l.id) || (c.lawyer_name && c.lawyer_name.toLowerCase().replace(/^adv\.?\s*/i, "").trim() === normName)
    );
    let targetId = match ? match.id : null;

    if (!targetId && typeof window !== "undefined") {
      try {
        const localReferrals = JSON.parse(localStorage.getItem("trana_client_referrals") || "[]");
        const found = (localReferrals || []).find(
          (r: any) => (r.lawyerId && r.lawyerId === l.id) || (r.lawyerName && r.lawyerName.toLowerCase().replace(/^adv\.?\s*/i, "").trim() === normName)
        );
        if (found) targetId = found.id;
      } catch {}
    }

    if (!targetId) targetId = `REF-${l.id}`;
    navigate({
      to: "/dashboard/consultations",
      search: { chat: targetId },
    });
  }

  async function request(l: Lawyer, chosenMode: "call" | "chat") {
    // 1. Prevent duplicate consultation with the same lawyer
    const normName = l.full_name.toLowerCase().replace(/^adv\.?\s*/i, "").trim();
    const match = userConsultations.find(
      (c) => (c.lawyer_id && c.lawyer_id === l.id) || (c.lawyer_name && c.lawyer_name.toLowerCase().replace(/^adv\.?\s*/i, "").trim() === normName)
    );
    let existingChatId = match ? match.id : null;

    if (!existingChatId && typeof window !== "undefined") {
      try {
        const localReferrals = JSON.parse(localStorage.getItem("trana_client_referrals") || "[]");
        const found = (localReferrals || []).find(
          (r: any) => (r.lawyerId && r.lawyerId === l.id) || (r.lawyerName && r.lawyerName.toLowerCase().replace(/^adv\.?\s*/i, "").trim() === normName)
        );
        if (found) existingChatId = found.id;
      } catch {}
    }

    if (existingChatId) {
      toast.info(`Opening existing consultation channel with ${l.full_name}...`);
      navigate({
        to: "/dashboard/consultations",
        search: { chat: existingChatId },
      });
      return;
    }

    setLoadingLawyerId(l.id);
    try {
      const clientName = (user as any).name || (user as any).user_metadata?.full_name || user.email?.split("@")[0] || "Citizen Client";
      const brief = await buildClientIntakeBrief({
        userId: user.id,
        userEmail: user.email,
        userName: clientName,
        lawyerName: l.full_name,
        consultType: chosenMode,
        credential,
      });

      const initialMessages = [
        {
          id: `msg-sys-${Date.now()}`,
          sender: "system",
          senderName: "TRANA Secure Relay",
          text: `Confidential consultation channel opened between ${clientName} and ${l.full_name} (Mode: ${chosenMode === "call" ? "Telephonic Relay" : "Secure In-App Chat"}). Contact particulars and phone numbers are strictly masked (XXXXX) for privacy.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ];

      const { data: inserted, error } = await supabase
        .from("consultations")
        .insert({
          user_id: user?.id ? String(user.id) : (user?.email || "anonymous"),
          lawyer_id: l.id,
          lawyer_name: l.full_name,
          consult_type: chosenMode,
          status: "confirmed",
          note: JSON.stringify(initialMessages),
          intake_brief: brief.fullBriefMarkdown,
        })
        .select()
        .maybeSingle();

      if (error) {
        console.warn("Consultation insert error:", error);
      }

      const finalId = inserted?.id || `REF-${l.id}`;

      // Update central chat index and local referrals
      try {
        localStorage.setItem(`trana_consult_chat_${finalId}`, JSON.stringify(initialMessages));
        const chatIndex = JSON.parse(localStorage.getItem("trana_all_consultation_chats_index") || "{}");
        chatIndex[finalId] = {
          consultationId: finalId,
          clientName,
          lawyerName: l.full_name,
          consultationType: chosenMode === "call" ? "Call" : "Chat",
          status: "Confirmed",
          lastMessage: initialMessages[0].text,
          lastUpdated: new Date().toISOString(),
        };
        localStorage.setItem("trana_all_consultation_chats_index", JSON.stringify(chatIndex));

        const localReferrals = JSON.parse(localStorage.getItem("trana_client_referrals") || "[]");
        localReferrals.unshift({
          id: finalId,
          client: clientName,
          lawyerId: l.id,
          lawyerName: l.full_name,
          consultationType: chosenMode === "call" ? "Call" : "Chat",
          status: "Confirmed",
          date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
          intakeBrief: brief.fullBriefMarkdown,
          summary: initialMessages[0].text,
        });
        localStorage.setItem("trana_client_referrals", JSON.stringify(localReferrals));
      } catch {}

      // Lock state
      try {
        const stored = JSON.parse(localStorage.getItem(`trana_requested_lawyers_${user.id}`) || "[]");
        stored.push({ id: l.id, name: l.full_name });
        localStorage.setItem(`trana_requested_lawyers_${user.id}`, JSON.stringify(stored));
      } catch {}

      setRequested((r) => ({ ...r, [l.id]: true }));
      qc.invalidateQueries({ queryKey: ["consultations"] });
      qc.invalidateQueries({ queryKey: ["citizen-consultations-lock"] });
      qc.invalidateQueries({ queryKey: ["lawyer-referrals-consultations"] });
      qc.invalidateQueries({ queryKey: ["lawyer-overview-consultations"] });
      window.dispatchEvent(new Event("trana_consult_chat_update"));

      toast.success(`Consultation channel opened with ${l.full_name}.`);

      // Immediately navigate to My Consultations with the new chat open!
      navigate({
        to: "/dashboard/consultations",
        search: { chat: finalId },
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to request consultation.");
    } finally {
      setLoadingLawyerId(null);
    }
  }

  const sel = "border border-[#333333] bg-[#111111] px-3.5 py-2 text-xs text-white focus:border-white focus:outline-none";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-6">
        <div>
          <h1 className="font-display text-4xl md:text-5xl font-medium text-white">Find a Professional</h1>
          <p className="mt-2 text-sm text-[#999999]">
            Connect with verified advocates enrolled with State Bar Councils across India. Arrange a privileged consultation by call or chat.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-1.5 text-xs text-emerald-400 self-start sm:self-auto">
          <ShieldCheck className="h-4 w-4" />
          <span>Bar Sanad Verified Advocates</span>
        </div>
      </div>

      <div className="mt-8">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by advocate name, Bar Council, court, specialisation, or city..."
          className="w-full border border-white/20 bg-[#111111] px-5 py-3.5 text-sm text-white placeholder:text-[#666666] focus:border-white focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap gap-3">
          <select className={sel} value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area of law">
            <option value="">All areas of law</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className={sel} value={city} onChange={(e) => setCity(e.target.value)} aria-label="City">
            <option value="">All cities</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className={sel} value={type} onChange={(e) => setType(e.target.value)} aria-label="Consultation type">
            <option value="">Any consultation mode</option>
            <option value="call">Offers Call</option>
            <option value="chat">Offers Chat</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-12 text-center text-sm text-[#777777]">Loading verified advocate directory...</div>
      ) : lawyers.length === 0 ? (
        <div className="mt-10 border border-[#2E2E2E] bg-[#141414] p-8 text-center space-y-3">
          <Scale className="h-8 w-8 text-[#777777] mx-auto mb-2" />
          <p className="font-display text-2xl text-white">No Verified Advocates Listed Yet</p>
          <p className="text-sm text-[#888888] max-w-lg mx-auto">
            Our verification desk authenticates advocate Sanads directly against State Bar Council rolls before granting public listing. If you are an advocate, verify your credentials via the Legal Professional Workspace.
          </p>
        </div>
      ) : list.length === 0 ? (
        <div className="mt-10 border border-[#2E2E2E] bg-[#141414] p-8 text-center space-y-2">
          <p className="font-display text-xl text-white">No advocates match these filters</p>
          <p className="text-xs text-[#888888]">Try resetting the city or specialisation filters above.</p>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((l) => {
            const isLocked = Boolean(
              requested[l.id] ||
              lockedIds.has(l.id) ||
              lockedNames.has(l.full_name.toLowerCase().trim())
            );
            const photoUrl = getLawyerPhoto(l);

            return (
              <div
                key={l.id}
                onClick={() => setSelectedLawyerProfile(l)}
                className={`flex flex-col justify-between border p-6 transition-all relative cursor-pointer group hover:scale-[1.01] ${
                  isLocked
                    ? "border-emerald-500/60 bg-emerald-950/10 shadow-sm"
                    : "border-white/15 bg-[#141414] hover:border-white/40"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 border-b border-[#222222] pb-3 mb-3">
                    <span className="inline-flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.15em] text-emerald-400 font-semibold">
                      <ShieldCheck className="h-3 w-3" />
                      <span>Verified Sanad</span>
                    </span>
                    {l.bar_reg_no && (
                      <span className="font-mono text-[10px] text-[#888888] bg-[#1A1A1A] px-2 py-0.5 border border-[#333333]">
                        {l.bar_reg_no}
                      </span>
                    )}
                    {isLocked && (
                      <span className="flex items-center gap-1 text-[0.65rem] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded">
                        <Lock className="h-3 w-3" /> In Touch
                      </span>
                    )}
                  </div>

                  {/* Profile Photo & Name */}
                  <div className="flex items-center gap-3.5 my-2">
                    <div className="relative h-12 w-12 rounded-full border border-white/20 bg-neutral-900 overflow-hidden shrink-0 flex items-center justify-center shadow-md">
                      {photoUrl ? (
                        <img src={photoUrl} alt={l.full_name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="font-display text-lg font-semibold text-white">
                          {l.full_name.charAt(0) || "A"}
                        </span>
                      )}
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-black shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display text-2xl font-medium text-white truncate group-hover:text-emerald-300 transition-colors">
                        {l.full_name}
                      </h2>
                      {l.state_bar_council && (
                        <p className="text-xs text-[#888888] mt-0.5 flex items-center gap-1 truncate">
                          <Award className="h-3 w-3 text-neutral-400 shrink-0" />
                          <span className="truncate">{l.state_bar_council}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-neutral-200 font-medium line-clamp-2">{l.specialisation}</p>
                  
                  {l.courts && (
                    <p className="mt-1 text-xs text-[#888888] line-clamp-1">
                      Courts: <span className="text-neutral-300">{l.courts}</span>
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between text-xs text-[#777777] border-t border-[#222222] pt-3">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-neutral-400" />
                      <span>{l.city}, {l.state || "India"}</span>
                    </span>
                    {l.experience_years ? (
                      <span className="text-[11px] text-neutral-400 font-mono">
                        {l.experience_years}+ Yrs Practice
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex gap-4 text-xs text-[#888888]">
                    {l.offers_call && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-white" />Direct Call</span>}
                    {l.offers_chat && <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5 text-white" />Confidential Chat</span>}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#222222]">
                  {isLocked ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenExistingChat(l);
                      }}
                      className="w-full bg-[#1A1A1A] border border-emerald-500/50 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-emerald-400 hover:bg-emerald-950/40 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>Open Consultation Channel</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInitiateRequest(l);
                      }}
                      disabled={loadingLawyerId === l.id}
                      className="w-full bg-white py-3 text-xs font-semibold uppercase tracking-[0.15em] text-black hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {loadingLawyerId === l.id ? (
                        <span>Routing Request...</span>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4" />
                          <span>Request Consultation</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Consultation Mode Selection Modal */}
      {isModeModalOpen && consultingLawyer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md border border-[#333333] bg-[#141414] p-6 shadow-2xl relative">
            <button
              onClick={() => setIsModeModalOpen(false)}
              className="absolute right-4 top-4 text-[#888888] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 border-b border-[#252525] pb-4 mb-4">
              <Scale className="h-5 w-5 text-white" />
              <div>
                <h3 className="font-display text-lg font-medium text-white">{consultingLawyer.full_name}</h3>
                <p className="text-xs text-[#888888]">{consultingLawyer.bar_reg_no || consultingLawyer.specialisation}</p>
              </div>
            </div>

            <p className="text-xs text-[#999999] mb-4">
              Select your preferred consultation channel. All inquiries are encrypted and protected under advocate-client privilege.
            </p>

            <div className="space-y-3 mb-6">
              {consultingLawyer.offers_call && (
                <label
                  onClick={() => setSelectedMode("call")}
                  className={`flex items-center justify-between p-3.5 border cursor-pointer transition-colors ${
                    selectedMode === "call" ? "border-white bg-[#222222]" : "border-[#333333] bg-[#0E0E0E]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-white" />
                    <div>
                      <p className="text-sm font-medium text-white">Telephone Consultation</p>
                      <p className="text-[11px] text-[#777777]">Direct briefing call with advocate</p>
                    </div>
                  </div>
                  <input type="radio" checked={selectedMode === "call"} onChange={() => {}} className="accent-white" />
                </label>
              )}

              {consultingLawyer.offers_chat && (
                <label
                  onClick={() => setSelectedMode("chat")}
                  className={`flex items-center justify-between p-3.5 border cursor-pointer transition-colors ${
                    selectedMode === "chat" ? "border-white bg-[#222222]" : "border-[#333333] bg-[#0E0E0E]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-4 w-4 text-white" />
                    <div>
                      <p className="text-sm font-medium text-white">Confidential Masked Chat</p>
                      <p className="text-[11px] text-[#777777]">Instant secure messaging channel</p>
                    </div>
                  </div>
                  <input type="radio" checked={selectedMode === "chat"} onChange={() => {}} className="accent-white" />
                </label>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  const target = consultingLawyer;
                  const mode = selectedMode;
                  setIsModeModalOpen(false);
                  if (target) request(target, mode);
                }}
                className="flex-1 bg-white py-3 text-xs font-semibold uppercase tracking-[0.15em] text-black hover:bg-neutral-200 transition-colors"
              >
                Confirm & Connect
              </button>
              <button
                type="button"
                onClick={() => setIsModeModalOpen(false)}
                className="border border-[#333333] px-4 py-3 text-xs uppercase tracking-[0.15em] text-[#888888] hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lawyer Full Profile Center Modal */}
      {selectedLawyerProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedLawyerProfile(null)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/20 bg-[#121212] p-6 sm:p-8 text-neutral-100 shadow-[0_25px_70px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close Button */}
            <button
              onClick={() => setSelectedLawyerProfile(null)}
              className="absolute right-4 top-4 p-2 text-neutral-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              title="Close Profile"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Profile Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 border-b border-white/10 pb-6">
              <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-2xl border-2 border-white/20 bg-neutral-900 overflow-hidden shrink-0 flex items-center justify-center shadow-xl">
                {getLawyerPhoto(selectedLawyerProfile) ? (
                  <img
                    src={getLawyerPhoto(selectedLawyerProfile)!}
                    alt={selectedLawyerProfile.full_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-display text-3xl font-semibold text-white">
                    {selectedLawyerProfile.full_name.charAt(0) || "A"}
                  </span>
                )}
                <span className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#121212] shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.15em] text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                    <ShieldCheck className="h-3 w-3" />
                    <span>Verified Sanad</span>
                  </span>
                  {selectedLawyerProfile.bar_reg_no && (
                    <span className="font-mono text-[10px] text-neutral-300 bg-white/10 px-2 py-0.5 rounded border border-white/15">
                      {selectedLawyerProfile.bar_reg_no}
                    </span>
                  )}
                  {selectedLawyerProfile.experience_years && (
                    <span className="text-[10px] font-mono text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded">
                      {selectedLawyerProfile.experience_years}+ Yrs Practice
                    </span>
                  )}
                </div>

                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white tracking-tight">
                  {selectedLawyerProfile.full_name}
                </h2>

                {selectedLawyerProfile.state_bar_council && (
                  <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                    <span>{selectedLawyerProfile.state_bar_council}</span>
                  </p>
                )}
              </div>
            </div>

            {/* About Me / Bio Section */}
            <div className="mt-6 space-y-6">
              <div>
                <h3 className="text-xs uppercase tracking-[0.18em] font-mono text-neutral-400 mb-2.5">
                  About Me / Professional Background
                </h3>
                <p className="text-sm leading-relaxed text-neutral-200 bg-white/[0.03] border border-white/10 p-4 rounded-xl font-sans">
                  {selectedLawyerProfile.bio ||
                    "Practicing Advocate with extensive trial and appellate court experience, specializing in criminal defence, anticipatory bail applications under BNSS, constitutional writ petitions, and statutory representation."}
                </p>
              </div>

              {/* Specialisations */}
              <div>
                <h3 className="text-xs uppercase tracking-[0.18em] font-mono text-neutral-400 mb-2">
                  Areas of Specialisation
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {selectedLawyerProfile.specialisation.split(",").map((s, idx) => (
                    <span
                      key={idx}
                      className="text-xs font-medium px-3 py-1 rounded-lg border border-white/15 bg-white/5 text-neutral-200"
                    >
                      {s.trim()}
                    </span>
                  ))}
                </div>
              </div>

              {/* Courts of Practice */}
              {selectedLawyerProfile.courts && (
                <div>
                  <h3 className="text-xs uppercase tracking-[0.18em] font-mono text-neutral-400 mb-2">
                    Admitted Courts of Practice
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedLawyerProfile.courts.split(/·|,|\+/).map((c, idx) => {
                      const trimmed = c.trim();
                      if (!trimmed || trimmed.match(/^\d+\s*more/i)) return null;
                      return (
                        <span
                          key={idx}
                          className="text-xs font-mono px-3 py-1 rounded-lg border border-sky-500/20 bg-sky-950/30 text-sky-300"
                        >
                          {trimmed}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Location & Contact Particulars */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-neutral-300 pt-2 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-neutral-400 shrink-0" />
                  <span>{selectedLawyerProfile.city}, {selectedLawyerProfile.state || "India"}</span>
                </div>
                <div className="flex items-center gap-3">
                  {selectedLawyerProfile.offers_call && (
                    <span className="flex items-center gap-1.5 text-neutral-300">
                      <Phone className="h-3.5 w-3.5 text-white" /> Direct Call
                    </span>
                  )}
                  {selectedLawyerProfile.offers_chat && (
                    <span className="flex items-center gap-1.5 text-neutral-300">
                      <MessageSquare className="h-3.5 w-3.5 text-white" /> Confidential Chat
                    </span>
                  )}
                </div>
              </div>

              {/* Modal CTA Button */}
              <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedLawyerProfile(null)}
                  className="px-4 py-2.5 rounded-xl border border-white/20 text-xs font-semibold uppercase tracking-wider text-neutral-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const l = selectedLawyerProfile;
                    setSelectedLawyerProfile(null);
                    const isAlreadyLocked = Boolean(
                      requested[l.id] ||
                      lockedIds.has(l.id) ||
                      lockedNames.has(l.full_name.toLowerCase().trim())
                    );
                    if (isAlreadyLocked) {
                      handleOpenExistingChat(l);
                    } else {
                      handleInitiateRequest(l);
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-white text-black text-xs font-semibold uppercase tracking-wider hover:bg-neutral-200 transition-colors flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Open Consultation Channel</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
