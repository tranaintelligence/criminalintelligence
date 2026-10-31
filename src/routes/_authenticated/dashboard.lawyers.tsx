import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Phone, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

function Lawyers() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const { data: lawyers = [], isLoading } = useQuery({
    queryKey: ["lawyers"],
    queryFn: async () => (await supabase.from("lawyers").select("*").order("full_name")).data ?? [],
  });

  const areas = [...new Set(lawyers.map((l) => l.specialisation))];
  const cities = [...new Set(lawyers.map((l) => l.city))];
  const list = lawyers.filter((l) => {
    const t = q.toLowerCase();
    if (t && ![l.full_name, l.specialisation, l.city].some((v) => v.toLowerCase().includes(t))) return false;
    if (area && l.specialisation !== area) return false;
    if (city && l.city !== city) return false;
    if (type === "call" && !l.offers_call) return false;
    if (type === "chat" && !l.offers_chat) return false;
    return true;
  });

  async function request(l: (typeof lawyers)[number]) {
    const { error } = await supabase.from("consultations").insert({
      user_id: user.id, lawyer_id: l.id, lawyer_name: l.full_name, consult_type: l.offers_call ? "call" : "chat",
    });
    if (!error) { setRequested((r) => ({ ...r, [l.id]: true })); qc.invalidateQueries({ queryKey: ["consultations"] }); }
  }

  const sel = "border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none";
  return (
    <div>
      <h1 className="font-display text-4xl md:text-5xl">Find a Legal Professional</h1>
      <p className="mt-3 text-sm text-muted-foreground">Connect with verified lawyers and legal experts. Arrange a consultation by call or chat.</p>

      <div className="mt-10">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, specialisation or city" className="w-full border border-foreground/80 bg-background px-5 py-4 text-sm placeholder:text-muted-foreground focus:outline-none" />
        <div className="mt-3 flex flex-wrap gap-3">
          <select className={sel} value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area of law"><option value="">All areas of law</option>{areas.map((a) => <option key={a}>{a}</option>)}</select>
          <select className={sel} value={city} onChange={(e) => setCity(e.target.value)} aria-label="City"><option value="">All cities</option>{cities.map((c) => <option key={c}>{c}</option>)}</select>
          <select className={sel} value={type} onChange={(e) => setType(e.target.value)} aria-label="Consultation type"><option value="">Any consultation type</option><option value="call">Call</option><option value="chat">Chat</option></select>
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
          {list.map((l) => (
            <div key={l.id} className="flex flex-col border border-foreground/80 bg-card p-6">
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">✓ Verified by TRANA</p>
              <h2 className="mt-3 font-display text-2xl">{l.full_name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{l.specialisation}</p>
              <p className="text-sm text-muted-foreground">{l.city}</p>
              <div className="mt-4 flex gap-4 text-sm">
                {l.offers_call && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" />Call</span>}
                {l.offers_chat && <span className="flex items-center gap-1.5"><MessageSquare className="h-4 w-4" />Chat</span>}
              </div>
              <button onClick={() => request(l)} disabled={requested[l.id]} className="btn-line mt-6 disabled:opacity-50">
                {requested[l.id] ? "Requested" : "Request Consultation"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
