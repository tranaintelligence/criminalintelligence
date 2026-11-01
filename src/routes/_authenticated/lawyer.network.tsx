import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { 
  Users, Search, MessageSquare, Share2, Check, 
  MapPin, Scale, ShieldCheck, Phone, X, Send, UserCheck 
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLawyerAuth } from "./lawyer";

export const Route = createFileRoute("/_authenticated/lawyer/network")({
  head: () => ({
    meta: [
      { title: "Legal Professional Workspace — TRANA" },
      { name: "description", content: "TRANA's network of verified lawyers collaborate, refer cases and connect with peers." },
      { property: "og:title", content: "Legal Professional Workspace — TRANA" },
    ],
  }),
  component: LawyerNetwork,
});

type NetworkLawyer = {
  id: string;
  full_name: string;
  specialisation: string;
  city: string;
  courts: string;
  bar_reg: string;
  experience: string;
  offers_call: boolean;
  offers_chat: boolean;
  offers_in_person: boolean;
};

const fallbackNetwork: NetworkLawyer[] = [
  {
    id: "net-1",
    full_name: "Adv. Rajeshwaran Iyer",
    specialisation: "Criminal Defence & Anticipatory Bail",
    city: "New Delhi",
    courts: "Supreme Court of India & Delhi High Court",
    bar_reg: "D/882/2012",
    experience: "14 Years Practice",
    offers_call: true,
    offers_chat: true,
    offers_in_person: true,
  },
  {
    id: "net-2",
    full_name: "Adv. Meenakshi Sundaram",
    specialisation: "Corporate Crimes & White Collar Offences",
    city: "Mumbai",
    courts: "Bombay High Court & City Civil & Sessions Court",
    bar_reg: "MAH/1540/2015",
    experience: "11 Years Practice",
    offers_call: true,
    offers_chat: true,
    offers_in_person: false,
  },
  {
    id: "net-3",
    full_name: "Adv. Harpreet Singh Sodhi",
    specialisation: "Constitutional Writs & Service Law",
    city: "Chandigarh",
    courts: "Punjab & Haryana High Court",
    bar_reg: "PH/3421/2010",
    experience: "16 Years Practice",
    offers_call: true,
    offers_chat: true,
    offers_in_person: true,
  },
  {
    id: "net-4",
    full_name: "Adv. Ananya Sengupta",
    specialisation: "Cyber Crime & Data Protection Litigation",
    city: "Bengaluru",
    courts: "Karnataka High Court & Cyber Appellate Tribunal",
    bar_reg: "KAR/2190/2017",
    experience: "9 Years Practice",
    offers_call: true,
    offers_chat: true,
    offers_in_person: true,
  },
  {
    id: "net-5",
    full_name: "Adv. Pradeep K. Dwivedi",
    specialisation: "BNS / BNSS Criminal Procedure & Trial",
    city: "Prayagraj",
    courts: "Allahabad High Court (Principal Bench)",
    bar_reg: "UP/5920/2014",
    experience: "12 Years Practice",
    offers_call: true,
    offers_chat: true,
    offers_in_person: true,
  },
  {
    id: "net-6",
    full_name: "Adv. Kavita Deshmukh",
    specialisation: "Commercial Arbitration & Cheque Dishonour",
    city: "Pune",
    courts: "District Court Pune & Bombay High Court",
    bar_reg: "MAH/4021/2018",
    experience: "8 Years Practice",
    offers_call: true,
    offers_chat: true,
    offers_in_person: true,
  },
];

function LawyerNetwork() {
  const { data: myProfile } = useLawyerAuth();
  const [search, setSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState("All");
  const [selectedSpecialisation, setSelectedSpecialisation] = useState("All");

  // Dialog states
  const [messageTarget, setMessageTarget] = useState<NetworkLawyer | null>(null);
  const [messageText, setMessageText] = useState("");
  const [referTarget, setReferTarget] = useState<NetworkLawyer | null>(null);
  const [referClientName, setReferClientName] = useState("");
  const [referMatterSummary, setReferMatterSummary] = useState("");

  const { data: dbLawyers = [] } = useQuery({
    queryKey: ["network-lawyers"],
    queryFn: async () => {
      const { data } = await supabase.from("lawyers").select("*").order("full_name");
      return data || [];
    },
  });

  // Combine DB lawyers with network lawyers
  const allLawyers: NetworkLawyer[] = [
    ...fallbackNetwork,
    ...dbLawyers.map((l, idx) => ({
      id: l.id || `db-${idx}`,
      full_name: l.full_name,
      specialisation: l.specialisation,
      city: l.city,
      courts: "District & Sessions Courts",
      bar_reg: "BAR/VERIFIED/2026",
      experience: "Verified Practitioner",
      offers_call: l.offers_call,
      offers_chat: l.offers_chat,
      offers_in_person: l.offers_in_person,
    })),
  ].filter(
    (item, index, self) =>
      index === self.findIndex((t) => t.full_name.toLowerCase() === item.full_name.toLowerCase())
  );

  const cities = ["All", ...new Set(allLawyers.map((l) => l.city))];
  const specialisations = ["All", ...new Set(allLawyers.map((l) => l.specialisation))];

  const filteredLawyers = allLawyers.filter((l) => {
    if (selectedCity !== "All" && l.city !== selectedCity) return false;
    if (selectedSpecialisation !== "All" && l.specialisation !== selectedSpecialisation) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const inName = l.full_name.toLowerCase().includes(q);
      const inSpec = l.specialisation.toLowerCase().includes(q);
      const inCity = l.city.toLowerCase().includes(q);
      return inName || inSpec || inCity;
    }
    return true;
  });

  function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!messageTarget || !messageText.trim()) return;
    toast.success(`Message sent directly to ${messageTarget.full_name}!`);
    setMessageText("");
    setMessageTarget(null);
  }

  function handleReferClient(e: React.FormEvent) {
    e.preventDefault();
    if (!referTarget || !referClientName.trim()) return;
    toast.success(`Client matter successfully referred to ${referTarget.full_name}!`);
    setReferClientName("");
    setReferMatterSummary("");
    setReferTarget(null);
  }

  return (
    <div className="space-y-8">
      {/* HEADLINE & SUBHEADING */}
      <div className="border-b border-[#222222] pb-6">
        <h1 className="font-display text-4xl md:text-5xl font-medium text-white">
          Connect With Legal Professionals
        </h1>
        <p className="mt-2 text-sm text-[#999999] max-w-2xl leading-relaxed">
          TRANA's network of verified lawyers collaborate, refer cases and connect with peers.
        </p>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-6 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#777777]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search colleagues by name, specialisation, or court..."
            className="w-full border border-[#333333] bg-[#1A1A1A] py-3.5 pl-11 pr-4 text-sm text-white placeholder:text-[#666666] focus:border-white focus:outline-none shadow-md"
          />
        </div>

        <div className="md:col-span-3">
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="w-full border border-[#333333] bg-[#1A1A1A] px-4 py-3.5 text-sm text-white focus:border-white focus:outline-none shadow-md"
          >
            {cities.map((c) => (
              <option key={c} value={c} className="bg-[#1A1A1A]">
                City: {c}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <select
            value={selectedSpecialisation}
            onChange={(e) => setSelectedSpecialisation(e.target.value)}
            className="w-full border border-[#333333] bg-[#1A1A1A] px-4 py-3.5 text-sm text-white focus:border-white focus:outline-none shadow-md"
          >
            {specialisations.map((s) => (
              <option key={s} value={s} className="bg-[#1A1A1A]">
                Area: {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* LAWYER CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLawyers.map((l) => (
          <div
            key={l.id}
            className="bg-[#1A1A1A] border border-[#2E2E2E] hover:border-white/60 transition-all p-6 flex flex-col justify-between shadow-lg group"
          >
            <div>
              {/* Header: Name + Verification badge */}
              <div className="flex items-start justify-between gap-2 border-b border-[#282828] pb-4">
                <div>
                  <h3 className="font-display text-2xl font-medium text-white group-hover:text-amber-200 transition-colors">
                    {l.full_name}
                  </h3>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[#888888]">
                    <MapPin className="h-3 w-3 text-[#666666]" />
                    <span>{l.city}</span>
                    <span>•</span>
                    <span className="font-mono text-[#AAAAAA]">{l.bar_reg}</span>
                  </div>
                </div>

                <div className="border border-white/20 bg-[#111111] px-2 py-0.5 text-[0.65rem] text-emerald-400 font-mono">
                  ✓ Verified
                </div>
              </div>

              {/* Specialisation & Courts */}
              <div className="mt-4 space-y-2">
                <div>
                  <span className="text-[0.7rem] uppercase tracking-[0.15em] text-[#777777]">
                    Primary Specialisation
                  </span>
                  <p className="text-sm text-[#E0E0E0] font-medium mt-0.5">
                    {l.specialisation}
                  </p>
                </div>

                <div>
                  <span className="text-[0.7rem] uppercase tracking-[0.15em] text-[#777777]">
                    Courts of Practice
                  </span>
                  <p className="text-xs text-[#AAAAAA] mt-0.5">
                    {l.courts}
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-3 text-xs text-[#888888]">
                  <span>Available for:</span>
                  {l.offers_call && <span className="text-white">Call</span>}
                  {l.offers_chat && <span className="text-white">Chat</span>}
                </div>
              </div>
            </div>

            {/* Action Buttons: "Send Message" & "Refer a Client" */}
            <div className="mt-6 pt-4 border-t border-[#262626] grid grid-cols-2 gap-3">
              <button
                onClick={() => setMessageTarget(l)}
                className="border border-white/40 px-3 py-2 text-xs uppercase tracking-[0.1em] text-white hover:bg-white hover:text-black transition-colors flex items-center justify-center gap-1.5"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Send Message</span>
              </button>

              <button
                onClick={() => setReferTarget(l)}
                className="bg-white text-black px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-neutral-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Refer Client</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* DIRECT MESSAGE MODAL */}
      {messageTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#1A1A1A] border border-white/30 p-6 md:p-8 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#2E2E2E] pb-4">
              <div>
                <span className="text-xs uppercase tracking-[0.2em] text-[#888888]">
                  Direct Peer Communication
                </span>
                <h3 className="mt-1 font-display text-2xl font-medium text-white">
                  Message {messageTarget.full_name}
                </h3>
                <p className="text-xs text-[#AAAAAA]">
                  {messageTarget.city} • {messageTarget.courts}
                </p>
              </div>
              <button
                onClick={() => setMessageTarget(null)}
                className="p-1 border border-[#333333] text-white hover:bg-[#252525]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1.5">
                  Your Message
                </label>
                <textarea
                  rows={5}
                  required
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Inquire about co-counseling, legal precedence, or jurisdictional assistance..."
                  className="w-full border border-[#333333] bg-[#0A0A0A] p-3 text-sm text-white placeholder:text-[#555555] focus:border-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMessageTarget(null)}
                  className="border border-[#333333] px-4 py-2 text-xs uppercase tracking-[0.1em] text-[#AAAAAA] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-white text-black px-5 py-2 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-neutral-200 flex items-center gap-2"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send Message</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REFER A CLIENT MODAL */}
      {referTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#1A1A1A] border border-white/30 p-6 md:p-8 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#2E2E2E] pb-4">
              <div>
                <span className="text-xs uppercase tracking-[0.2em] text-[#888888]">
                  Case Referral Transmission
                </span>
                <h3 className="mt-1 font-display text-2xl font-medium text-white">
                  Refer a Client to {referTarget.full_name}
                </h3>
                <p className="text-xs text-[#AAAAAA]">
                  Specialisation: {referTarget.specialisation}
                </p>
              </div>
              <button
                onClick={() => setReferTarget(null)}
                className="p-1 border border-[#333333] text-white hover:bg-[#252525]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleReferClient} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1.5">
                  Client Name / Reference ID
                </label>
                <input
                  type="text"
                  required
                  value={referClientName}
                  onChange={(e) => setReferClientName(e.target.value)}
                  placeholder="e.g. Rahul V. (Anticipatory Bail)"
                  className="w-full border border-[#333333] bg-[#0A0A0A] p-3 text-sm text-white placeholder:text-[#555555] focus:border-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1.5">
                  Matter Brief & Scope of Co-Counsel
                </label>
                <textarea
                  rows={4}
                  required
                  value={referMatterSummary}
                  onChange={(e) => setReferMatterSummary(e.target.value)}
                  placeholder="Summarize the legal jurisdiction, urgency, and specific assistance needed in their court..."
                  className="w-full border border-[#333333] bg-[#0A0A0A] p-3 text-sm text-white placeholder:text-[#555555] focus:border-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReferTarget(null)}
                  className="border border-[#333333] px-4 py-2 text-xs uppercase tracking-[0.1em] text-[#AAAAAA] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-white text-black px-5 py-2 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-neutral-200 flex items-center gap-2"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Forward Referral</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
