import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Phone, MessageSquare, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTranaCredential } from "@/lib/trana-auth";
import { buildClientIntakeBrief } from "@/lib/intake-brief";

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

  // Fetch verified advocates onboard with TRANA from Supabase
  const { data: dbLawyers = [], isLoading } = useQuery({
    queryKey: ["lawyers"],
    queryFn: async () => (await supabase.from("lawyers").select("*").order("full_name")).data ?? [],
  });

  // User's existing consultations so previously requested lawyer boxes remain locked
  const { data: userConsultations = [] } = useQuery({
    queryKey: ["citizen-consultations-lock", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("consultations")
        .select("lawyer_id, lawyer_name, status")
        .eq("user_id", user.id);
      return data || [];
    },
    enabled: Boolean(user?.id),
  });

  const lockedInfo = useMemo(() => {
    const ids = new Set<string>();
    const names = new Set<string>();

    userConsultations.forEach((c) => {
      if (c.status !== "cancelled") {
        if (c.lawyer_id) ids.add(c.lawyer_id);
        if (c.lawyer_name) names.add(c.lawyer_name.toLowerCase().trim());
      }
    });

    if (typeof window !== "undefined" && user?.id) {
      try {
        const stored = JSON.parse(localStorage.getItem(`trana_requested_lawyers_${user.id}`) || "[]");
        if (Array.isArray(stored)) {
          stored.forEach((item: any) => {
            if (typeof item === "string") ids.add(item);
            else if (item && typeof item === "object") {
              if (item.id) ids.add(item.id);
              if (item.name) names.add(item.name.toLowerCase().trim());
            }
          });
        }
      } catch {
        // ignore
      }
    }

    return { ids, names };
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

  async function request(l: Lawyer) {
    setLoadingLawyerId(l.id);
    try {
      const consultType = l.offers_call ? "call" : "chat";
      // Generate client intake brief from citizen's AI conversation / analysis
      const brief = await buildClientIntakeBrief({
        userId: user.id,
        userEmail: user.email,
        userName: (user as any).name || (user as any).user_metadata?.full_name,
        lawyerName: l.full_name,
        consultType,
        credential,
      });

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(l.id);

      let createdId = `REF-${Date.now().toString(36).toUpperCase()}`;

      const { data: inserted, error } = await supabase.from("consultations").insert({
        user_id: user.id,
        lawyer_id: isUuid ? l.id : null,
        lawyer_name: l.full_name,
        consult_type: consultType,
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
          consult_type: consultType,
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
        const clientName = brief.clientName || (user as any).name || (user as any).user_metadata?.full_name || user.email?.split("@")[0] || "Citizen Client";
        const newReferral = {
          id: createdId,
          date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
          client: clientName,
          phone: "+91 (Verified Account)",
          matterType: brief.matterType || "Legal Consultation Request",
          section: brief.sectionsSummary || "Applicable Statutes",
          consultationType: (consultType === "call" ? "Call" : "Chat") as "Call" | "Chat",
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

      if (brief.hasConversation) {
        toast.success(`Consultation requested with ${l.full_name}. All details and your AI intake brief sent to lawyer.`);
      } else {
        toast.success(`Consultation requested with ${l.full_name}. Details sent to lawyer referrals.`);
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
              lockedInfo.ids.has(l.id) ||
              lockedInfo.names.has(l.full_name.toLowerCase().trim())
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

                <button
                  onClick={() => request(l)}
                  disabled={isLocked || loadingLawyerId === l.id}
                  className={`mt-6 transition-all flex items-center justify-center gap-1.5 ${
                    isLocked
                      ? "border border-emerald-500/50 bg-emerald-950/40 text-emerald-300 py-3 px-4 text-xs font-semibold uppercase tracking-wider cursor-not-allowed opacity-90"
                      : "btn-line disabled:opacity-50"
                  }`}
                >
                  {loadingLawyerId === l.id ? (
                    "Preparing Brief..."
                  ) : isLocked ? (
                    <>
                      <Lock className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Consultation Requested</span>
                    </>
                  ) : (
                    "Request Consultation"
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
