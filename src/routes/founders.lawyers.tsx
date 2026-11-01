import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Scale, Check, X, Star, FileText, Eye, ShieldAlert, 
  ExternalLink, Search, RefreshCw, MessageSquare, AlertCircle,
  Plus, Trash2, Phone, Mail 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

type LawyerRecord = {
  id: string;
  name: string;
  barNo: string;
  email: string;
  phone: string;
  specialisation: string;
  city: string;
  clientsReferred: number;
  consultations: number;
  dateOnboarded: string;
  status: "Active" | "Pending" | "Suspended";
  documents: string[];
  internalRating: number;
  internalNotes: string;
};

const initialLawyersData: LawyerRecord[] = [
  {
    id: "law-01",
    name: "Adv. Rajeshwaran Iyer",
    barNo: "D/882/2012",
    email: "rajeshwaran.iyer@delhibar.org",
    phone: "+91 98110 42910",
    specialisation: "Criminal Defence & Anticipatory Bail",
    city: "New Delhi",
    clientsReferred: 18,
    consultations: 12,
    dateOnboarded: "14 Jan 2026",
    status: "Active",
    documents: ["Bar_Sanad_D882.pdf", "Aadhaar_KYC.pdf", "HighCourt_ID.pdf"],
    internalRating: 5,
    internalNotes: "Verified with Bar Council of Delhi. Top performer for Section 482 BNSS bail matters.",
  },
  {
    id: "law-02",
    name: "Adv. Meenakshi Sundaram",
    barNo: "MAH/1540/2015",
    email: "meenakshi.sundaram@mumbaibar.in",
    phone: "+91 98201 55320",
    specialisation: "Corporate Crimes & White Collar Offences",
    city: "Mumbai",
    clientsReferred: 24,
    consultations: 16,
    dateOnboarded: "02 Feb 2026",
    status: "Active",
    documents: ["BCM_Sanad_1540.pdf", "GST_Registration.pdf"],
    internalRating: 5,
    internalNotes: "Handles complex cyber fraud cases. High client satisfaction.",
  },
  {
    id: "law-03",
    name: "Adv. Harpreet Singh Sodhi",
    barNo: "PH/3421/2010",
    email: "harpreet.sodhi@chandigarhcounsel.in",
    phone: "+91 98720 18491",
    specialisation: "Constitutional Writs & Service Law",
    city: "Chandigarh",
    clientsReferred: 9,
    consultations: 6,
    dateOnboarded: "18 Feb 2026",
    status: "Active",
    documents: ["Sanad_PH3421.pdf"],
    internalRating: 4,
    internalNotes: "Strong High Court appearances; quick turnaround on client calls.",
  },
  {
    id: "law-04",
    name: "Adv. Kavita Deshmukh",
    barNo: "MAH/4021/2018",
    email: "kavita.deshmukh@punelaw.org",
    phone: "+91 99230 48102",
    specialisation: "Commercial Arbitration & Cheque Dishonour",
    city: "Pune",
    clientsReferred: 14,
    consultations: 9,
    dateOnboarded: "10 Mar 2026",
    status: "Active",
    documents: ["Sanad_MAH4021.pdf", "Chamber_Lease.pdf"],
    internalRating: 4,
    internalNotes: "Specialist in Section 138 NI Act notices and recovery proceedings.",
  },
  {
    id: "law-05",
    name: "Adv. Vikramjit Banerjee",
    barNo: "WB/2190/2019",
    email: "vikramjit.banerjee@calcuttahighcourt.in",
    phone: "+91 98300 91823",
    specialisation: "BNS Criminal Procedure",
    city: "Kolkata",
    clientsReferred: 4,
    consultations: 1,
    dateOnboarded: "28 Mar 2026",
    status: "Active",
    documents: ["Bar_Council_WB.pdf"],
    internalRating: 3,
    internalNotes: "Under probationary monitoring for response latency on chat requests.",
  },
  // Pending Applications
  {
    id: "pend-01",
    name: "Adv. Tarun K. Sachdeva",
    barNo: "D/3119/2021",
    email: "tarun.sachdeva@patialahouse.org",
    phone: "+91 98101 22894",
    specialisation: "Narcotics (NDPS) & Criminal Trial",
    city: "New Delhi",
    clientsReferred: 0,
    consultations: 0,
    dateOnboarded: "23 Oct 2026",
    status: "Pending",
    documents: ["BCD_Sanad_Scan.pdf", "Bar_Identity_Card.pdf"],
    internalRating: 0,
    internalNotes: "Awaiting physical chamber verification in Patiala House.",
  },
  {
    id: "pend-02",
    name: "Adv. Sumedha Sen",
    barNo: "KAR/5812/2020",
    email: "sumedha.sen@bengalurucounsel.com",
    phone: "+91 99800 76192",
    specialisation: "Cyber Crime & Technology Contracts",
    city: "Bengaluru",
    clientsReferred: 0,
    consultations: 0,
    dateOnboarded: "22 Oct 2026",
    status: "Pending",
    documents: ["Karnataka_Bar_Sanad.pdf", "LLM_Certificate.pdf"],
    internalRating: 4,
    internalNotes: "Documents verified against Karnataka Bar registry. Ready to approve.",
  },
  {
    id: "pend-03",
    name: "Adv. Alok N. Tiwari",
    barNo: "UP/7724/2017",
    email: "alok.tiwari@allahabadbar.org",
    phone: "+91 94150 33491",
    specialisation: "Bail & Revision Applications",
    city: "Prayagraj",
    clientsReferred: 0,
    consultations: 0,
    dateOnboarded: "20 Oct 2026",
    status: "Pending",
    documents: ["HighCourt_Bar_Assoc.pdf"],
    internalRating: 3,
    internalNotes: "Requested updated mobile number and chamber address proof.",
  },
];

function FoundersLawyersPage() {
  const [activeTab, setActiveTab] = useState<"active" | "pending">("active");
  const [lawyers, setLawyers] = useState<LawyerRecord[]>(initialLawyersData);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLawyer, setSelectedLawyer] = useState<LawyerRecord | null>(null);

  // Add Lawyer modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addBarNo, setAddBarNo] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addSpecialisation, setAddSpecialisation] = useState("Criminal Defence & Anticipatory Bail");
  const [addCity, setAddCity] = useState("New Delhi");
  const [addStatus, setAddStatus] = useState<"Active" | "Pending">("Active");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch real lawyers from Supabase
  const { data: dbLawyers = [] } = useQuery({
    queryKey: ["founders-supabase-lawyers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lawyers")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Reconcile and load lawyers list + local ratings / notes / added / removed
  useEffect(() => {
    try {
      const removedIds: string[] = JSON.parse(localStorage.getItem("trana_founders_removed_lawyers") || "[]");
      const addedLawyers: LawyerRecord[] = JSON.parse(localStorage.getItem("trana_founders_added_lawyers") || "[]");

      let storedNotes: Record<string, Partial<LawyerRecord>> = {};
      const rawNotes = localStorage.getItem("trana_lawyers_internal");
      if (rawNotes) {
        const parsed = JSON.parse(rawNotes);
        if (Array.isArray(parsed)) {
          parsed.forEach((p: any) => {
            if (p.id) storedNotes[p.id] = p;
          });
        } else if (typeof parsed === "object") {
          storedNotes = parsed;
        }
      }

      const dbRecords: LawyerRecord[] = dbLawyers.map((row) => ({
        id: row.id,
        name: row.full_name,
        barNo: "BAR/VERIFIED/2026",
        email: "verified.advocate@trana.in",
        phone: "+91 (Verified Account)",
        specialisation: row.specialisation || "General Legal Practice",
        city: row.city || "New Delhi",
        clientsReferred: 0,
        consultations: 0,
        dateOnboarded: row.created_at
          ? new Date(row.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
          : "Recent",
        status: row.approved ? "Active" : "Pending",
        documents: ["Sanad_Verified.pdf"],
        internalRating: 4,
        internalNotes: "Registered advocate on TRANA platform.",
      }));

      const combined: LawyerRecord[] = [];
      const seenIds = new Set<string>();
      const seenNames = new Set<string>();

      [...addedLawyers, ...dbRecords, ...initialLawyersData].forEach((item) => {
        const idKey = item.id.toLowerCase();
        const nameKey = item.name.toLowerCase().trim();
        if (removedIds.includes(item.id)) return;
        if (!seenIds.has(idKey) && !seenNames.has(nameKey)) {
          seenIds.add(idKey);
          seenNames.add(nameKey);
          const overrides = storedNotes[item.id] || {};
          combined.push({ ...item, ...overrides });
        }
      });

      setLawyers(combined);
    } catch (e) {
      console.warn("Hydration error:", e);
    }
  }, [dbLawyers]);

  function saveInternalData(id: string, updates: Partial<LawyerRecord>) {
    setLawyers((prev) => {
      const updated = prev.map((l) => (l.id === id ? { ...l, ...updates } : l));
      try {
        localStorage.setItem("trana_lawyers_internal", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    if (selectedLawyer && selectedLawyer.id === id) {
      setSelectedLawyer((prev) => prev ? { ...prev, ...updates } : null);
    }
  }

  async function handleApprove(id: string, name: string) {
    saveInternalData(id, { status: "Active", dateOnboarded: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) });
    try {
      await supabase.from("lawyers").update({ approved: true }).eq("id", id);
    } catch {
      // ignore
    }
    toast.success(`Advocate ${name} approved and activated on TRANA platform!`);
  }

  async function handleReject(id: string, name: string) {
    saveInternalData(id, { status: "Suspended" });
    try {
      await supabase.from("lawyers").update({ approved: false }).eq("id", id);
    } catch {
      // ignore
    }
    toast.error(`Application for ${name} rejected.`);
  }

  function handleSuspend(id: string, name: string) {
    saveInternalData(id, { status: "Suspended" });
    toast.warning(`Advocate ${name} has been suspended from receiving referrals.`);
  }

  async function handleRemove(id: string, name: string) {
    const confirmed = window.confirm(
      `Are you sure you want to permanently remove Advocate ${name} from the platform? This cannot be undone.`
    );
    if (!confirmed) return;

    // 1. Immediately remove from state
    setLawyers((prev) => prev.filter((l) => l.id !== id));
    if (selectedLawyer?.id === id) {
      setSelectedLawyer(null);
    }

    // 2. Persist removed ID to localStorage
    try {
      const removed: string[] = JSON.parse(localStorage.getItem("trana_founders_removed_lawyers") || "[]");
      if (!removed.includes(id)) {
        removed.push(id);
        localStorage.setItem("trana_founders_removed_lawyers", JSON.stringify(removed));
      }
      // Also remove from added list if present
      const added: LawyerRecord[] = JSON.parse(localStorage.getItem("trana_founders_added_lawyers") || "[]");
      const updatedAdded = added.filter((l) => l.id !== id);
      localStorage.setItem("trana_founders_added_lawyers", JSON.stringify(updatedAdded));
    } catch (e) {
      console.warn("Remove error:", e);
    }

    // 3. Delete from Supabase lawyers table if present
    try {
      await supabase.from("lawyers").delete().eq("id", id);
    } catch (e) {
      console.warn("Supabase delete lawyer error:", e);
    }

    toast.success(`Advocate ${name} has been removed.`);
  }

  async function handleAddLawyer(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = addName.trim();
    const trimmedBar = addBarNo.trim();
    const trimmedEmail = addEmail.trim();
    const trimmedPhone = addPhone.trim();
    const trimmedCity = addCity.trim() || "New Delhi";

    if (!trimmedName) {
      toast.error("Please enter lawyer's full name");
      return;
    }
    if (!trimmedBar) {
      toast.error("Please enter Bar Enrolment Number");
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!trimmedPhone) {
      toast.error("Please enter contact mobile number");
      return;
    }

    setIsSubmitting(true);
    try {
      const newId = `law-manual-${Date.now().toString(36)}`;
      const formattedName = trimmedName.startsWith("Adv.") ? trimmedName : `Adv. ${trimmedName}`;

      const newRecord: LawyerRecord = {
        id: newId,
        name: formattedName,
        barNo: trimmedBar,
        email: trimmedEmail,
        phone: trimmedPhone,
        specialisation: addSpecialisation.trim() || "Criminal Defence & Anticipatory Bail",
        city: trimmedCity,
        clientsReferred: 0,
        consultations: 0,
        dateOnboarded: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        status: addStatus,
        documents: [`Bar_Sanad_${trimmedBar.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`],
        internalRating: 5,
        internalNotes: `Manually added by platform founders on ${new Date().toLocaleDateString("en-IN")}. Contact: ${trimmedPhone} • ${trimmedEmail}`,
      };

      // 1. Insert into Supabase lawyers table so citizen directory reflects it
      try {
        const { data: inserted } = await supabase
          .from("lawyers")
          .insert({
            full_name: newRecord.name,
            specialisation: newRecord.specialisation,
            city: newRecord.city,
            approved: newRecord.status === "Active",
            offers_call: true,
            offers_chat: true,
            offers_in_person: false,
          })
          .select()
          .single();
        if (inserted?.id) {
          newRecord.id = inserted.id;
        }
      } catch (err) {
        console.warn("Supabase insert note:", err);
      }

      // 2. Persist to localStorage added list
      try {
        const added: LawyerRecord[] = JSON.parse(localStorage.getItem("trana_founders_added_lawyers") || "[]");
        added.unshift(newRecord);
        localStorage.setItem("trana_founders_added_lawyers", JSON.stringify(added));
      } catch (e) {
        console.warn("localStorage save error:", e);
      }

      // 3. Update state
      setLawyers((prev) => [newRecord, ...prev]);

      // Reset form & close
      setAddName("");
      setAddBarNo("");
      setAddEmail("");
      setAddPhone("");
      setAddCity("New Delhi");
      setAddSpecialisation("Criminal Defence & Anticipatory Bail");
      setAddStatus("Active");
      setIsAddModalOpen(false);

      toast.success(`${newRecord.name} successfully added to directory!`);
    } catch (error) {
      toast.error("Failed to add lawyer");
    } finally {
      setIsSubmitting(false);
    }
  }

  const matchesSearch = (l: LawyerRecord) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      l.city.toLowerCase().includes(q) ||
      l.barNo.toLowerCase().includes(q) ||
      l.specialisation.toLowerCase().includes(q) ||
      (l.email && l.email.toLowerCase().includes(q))
    );
  };

  const activeLawyers = lawyers.filter((l) => l.status === "Active" && matchesSearch(l));

  const pendingLawyers = lawyers.filter(
    (l) => (l.status === "Pending" || l.status === "Suspended") && matchesSearch(l)
  );

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222222] pb-4">
        <div>
          <span className="text-[0.65rem] text-[#888888] uppercase tracking-widest block">
            ADVOCATE DIRECTORY & CREDENTIAL REVIEW
          </span>
          <h1 className="font-display text-3xl font-medium text-white mt-1">
            Lawyer Operations
          </h1>
        </div>

        {/* Action Button & Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-2 text-xs uppercase tracking-wider border border-white bg-white text-black font-semibold hover:bg-neutral-200 transition-colors flex items-center gap-1.5 shadow"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Lawyer</span>
          </button>
          <button
            onClick={() => setActiveTab("active")}
            className={`px-4 py-2 text-xs uppercase tracking-wider border transition-colors ${
              activeTab === "active"
                ? "border-white bg-[#222222] text-white font-semibold"
                : "border-[#333333] bg-[#111111] text-[#AAAAAA] hover:text-white"
            }`}
          >
            Active Lawyers ({activeLawyers.length})
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 text-xs uppercase tracking-wider border transition-colors relative ${
              activeTab === "pending"
                ? "border-white bg-[#222222] text-white font-semibold"
                : "border-[#333333] bg-[#111111] text-[#AAAAAA] hover:text-white"
            }`}
          >
            Pending Applications ({pendingLawyers.length})
            {pendingLawyers.length > 0 && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-400" />
            )}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#666666]" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter lawyers by name, Bar number, or city..."
          className="w-full border border-[#333333] bg-[#111111] py-2 pl-9 pr-3 text-xs text-white placeholder:text-[#555555] focus:border-white focus:outline-none"
        />
      </div>

      {/* TAB 1: ACTIVE LAWYERS TABLE */}
      {activeTab === "active" && (
        <div className="bg-[#111111] border border-[#222222] overflow-x-auto shadow-md">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="border-b border-[#2A2A2A] bg-[#161616] text-[#888888] uppercase tracking-wider text-[0.65rem]">
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Bar No.</th>
                <th className="py-2.5 px-3">Specialisation</th>
                <th className="py-2.5 px-3">City</th>
                <th className="py-2.5 px-3 text-center">Clients Referred</th>
                <th className="py-2.5 px-3 text-center">Consultations</th>
                <th className="py-2.5 px-3">Date Onboarded</th>
                <th className="py-2.5 px-3">Internal Rating</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1D1D1D]">
              {activeLawyers.map((l) => (
                <tr key={l.id} className="hover:bg-[#1A1A1A] transition-colors">
                  <td className="py-2.5 px-3 text-white font-medium">{l.name}</td>
                  <td className="py-2.5 px-3 text-amber-300 font-mono text-[0.7rem]">{l.barNo}</td>
                  <td className="py-2.5 px-3 text-[#CCCCCC]">{l.specialisation}</td>
                  <td className="py-2.5 px-3 text-[#888888]">{l.city}</td>
                  <td className="py-2.5 px-3 text-center text-white">{l.clientsReferred}</td>
                  <td className="py-2.5 px-3 text-center text-white">{l.consultations}</td>
                  <td className="py-2.5 px-3 text-[#888888]">{l.dateOnboarded}</td>
                  {/* Internal Rating (Star rating editable by founders only) */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => {
                            saveInternalData(l.id, { internalRating: star });
                            toast.success(`Internal rating for ${l.name} updated to ${star} stars.`);
                          }}
                          className={`text-sm ${
                            star <= l.internalRating ? "text-amber-400" : "text-[#444444]"
                          } hover:scale-125 transition-transform`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </td>
                  {/* Actions (View | Suspend | Remove) */}
                  <td className="py-2.5 px-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedLawyer(l)}
                      className="border border-white/30 px-2 py-1 text-[0.65rem] uppercase text-white hover:border-white hover:bg-white hover:text-black transition-colors"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSuspend(l.id, l.name)}
                      className="border border-amber-500/40 px-2 py-1 text-[0.65rem] uppercase text-amber-400 hover:bg-amber-950/40 transition-colors"
                    >
                      Suspend
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(l.id, l.name)}
                      className="border border-red-500/50 bg-red-950/30 px-2 py-1 text-[0.65rem] uppercase text-red-300 hover:bg-red-600 hover:text-white transition-colors"
                      title="Permanently remove advocate"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: PENDING APPLICATIONS TABLE */}
      {activeTab === "pending" && (
        <div className="bg-[#111111] border border-[#222222] overflow-x-auto shadow-md">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="border-b border-[#2A2A2A] bg-[#161616] text-[#888888] uppercase tracking-wider text-[0.65rem]">
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Bar No.</th>
                <th className="py-2.5 px-3">City</th>
                <th className="py-2.5 px-3">Date Applied</th>
                <th className="py-2.5 px-3">Documents</th>
                <th className="py-2.5 px-3">Internal Notes</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1D1D1D]">
              {pendingLawyers.map((l) => (
                <tr key={l.id} className="hover:bg-[#1A1A1A] transition-colors">
                  <td className="py-2.5 px-3 text-white font-medium">{l.name}</td>
                  <td className="py-2.5 px-3 text-amber-300 font-mono text-[0.7rem]">{l.barNo}</td>
                  <td className="py-2.5 px-3 text-[#CCCCCC]">{l.city}</td>
                  <td className="py-2.5 px-3 text-[#888888]">{l.dateOnboarded}</td>
                  {/* Documents */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      {l.documents.map((doc) => (
                        <span
                          key={doc}
                          className="border border-[#333333] bg-[#0A0A0A] px-1.5 py-0.5 text-[0.6rem] text-[#AAAAAA] flex items-center gap-1"
                        >
                          <FileText className="h-2.5 w-2.5" />
                          <span>{doc}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                  {/* Internal Notes field editable */}
                  <td className="py-2.5 px-3 max-w-[200px] truncate text-[#999999]">
                    <span title={l.internalNotes}>{l.internalNotes || "No notes"}</span>
                  </td>
                  {/* Actions: Approve ✓ | Reject ✗ | View Profile | Remove */}
                  <td className="py-2.5 px-3 text-right space-x-1.5">
                    <button
                      type="button"
                      onClick={() => handleApprove(l.id, l.name)}
                      className="border border-emerald-500/50 bg-emerald-950/20 px-2 py-1 text-[0.65rem] uppercase text-emerald-400 hover:bg-emerald-500 hover:text-black font-semibold transition-colors"
                    >
                      Approve ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(l.id, l.name)}
                      className="border border-red-500/50 bg-red-950/20 px-2 py-1 text-[0.65rem] uppercase text-red-400 hover:bg-red-500 hover:text-black transition-colors"
                    >
                      Reject ✗
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedLawyer(l)}
                      className="border border-white/30 px-2 py-1 text-[0.65rem] uppercase text-white hover:border-white transition-colors"
                    >
                      View Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(l.id, l.name)}
                      className="border border-red-500/50 bg-red-950/30 px-2 py-1 text-[0.65rem] uppercase text-red-300 hover:bg-red-600 hover:text-white transition-colors"
                      title="Permanently remove advocate"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DETAIL & FOUNDER PRIVATE NOTES MODAL */}
      {selectedLawyer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-[#161616] border border-white/30 p-6 md:p-8 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#282828] pb-4">
              <div>
                <span className="text-[0.65rem] uppercase tracking-widest text-[#888888]">
                  CONFIDENTIAL ADVOCATE RECORD
                </span>
                <h3 className="font-display text-2xl font-medium text-white mt-1">
                  {selectedLawyer.name}
                </h3>
                <p className="text-xs text-amber-300 font-mono mt-0.5">
                  Bar Enrolment: {selectedLawyer.barNo} • {selectedLawyer.city}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[0.7rem] text-[#888888] font-mono">
                  {selectedLawyer.email && (
                    <span className="flex items-center gap-1 text-white/90">
                      <Mail className="h-3 w-3 text-sky-400" />
                      {selectedLawyer.email}
                    </span>
                  )}
                  {selectedLawyer.phone && (
                    <span className="flex items-center gap-1 text-white/90">
                      <Phone className="h-3 w-3 text-emerald-400" />
                      {selectedLawyer.phone}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedLawyer(null)}
                className="p-1 border border-[#333333] text-white hover:bg-[#252525]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <span className="text-[0.65rem] uppercase tracking-wider text-[#777777] block">
                  Practice Areas
                </span>
                <p className="text-sm text-white mt-0.5">{selectedLawyer.specialisation}</p>
              </div>

              <div>
                <span className="text-[0.65rem] uppercase tracking-wider text-[#777777] block">
                  Verified Bar Credentials & Uploaded Documents
                </span>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {selectedLawyer.documents.map((d) => (
                    <div key={d} className="border border-white/20 bg-[#0A0A0A] p-2 text-xs text-white flex items-center gap-1.5 font-mono">
                      <FileText className="h-3.5 w-3.5 text-amber-300" />
                      <span>{d}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Internal Rating (Editable) */}
              <div className="border-t border-[#262626] pt-4">
                <span className="text-[0.65rem] uppercase tracking-wider text-[#888888] block mb-1">
                  Founder Internal Rating (Hidden from Public & Clients)
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      onClick={() => saveInternalData(selectedLawyer.id, { internalRating: s })}
                      className={`text-xl ${
                        s <= selectedLawyer.internalRating ? "text-amber-400" : "text-[#444444]"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="text-xs text-[#888888] ml-2">
                    {selectedLawyer.internalRating}/5
                  </span>
                </div>
              </div>

              {/* Internal Notes (Editable) */}
              <div>
                <span className="text-[0.65rem] uppercase tracking-wider text-[#888888] block mb-1">
                  Founder Internal Notes & Due Diligence (Editable)
                </span>
                <textarea
                  rows={3}
                  value={selectedLawyer.internalNotes}
                  onChange={(e) => saveInternalData(selectedLawyer.id, { internalNotes: e.target.value })}
                  placeholder="Record verification notes, Bar Council validity, disciplinary checks, or conversion quality..."
                  className="w-full border border-[#333333] bg-[#0A0A0A] p-2.5 text-xs text-white placeholder:text-[#555555] focus:border-white focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#262626] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleRemove(selectedLawyer.id, selectedLawyer.name)}
                className="border border-red-500/50 bg-red-950/40 text-red-300 hover:bg-red-600 hover:text-white px-3.5 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Remove Lawyer</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedLawyer(null)}
                className="bg-white text-black px-4 py-2 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-200 transition-colors"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD LAWYER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#161616] border border-white/30 p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-[#282828] pb-4">
              <div>
                <span className="text-[0.65rem] uppercase tracking-widest text-[#888888] block">
                  MANUAL ONBOARDING
                </span>
                <h3 className="font-display text-2xl font-medium text-white mt-1">
                  Add Legal Professional
                </h3>
                <p className="text-xs text-[#888888] mt-0.5">
                  Enter credentials, Bar registration, and contact information.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 border border-[#333333] text-white hover:bg-[#252525]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddLawyer} className="mt-5 space-y-4">
              <div>
                <label className="text-[0.65rem] uppercase tracking-wider text-[#888888] block mb-1">
                  Full Name (with Advocate Prefix) <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Adv. Amit Saxena"
                  className="w-full border border-[#333333] bg-[#0A0A0A] p-2.5 text-xs text-white placeholder:text-[#555555] focus:border-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[0.65rem] uppercase tracking-wider text-[#888888] block mb-1">
                    Bar Enrolment Number <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={addBarNo}
                    onChange={(e) => setAddBarNo(e.target.value)}
                    placeholder="e.g. D/1842/2020"
                    className="w-full border border-[#333333] bg-[#0A0A0A] p-2.5 text-xs text-white placeholder:text-[#555555] focus:border-white focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-[0.65rem] uppercase tracking-wider text-[#888888] block mb-1">
                    City / Jurisdiction <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={addCity}
                    onChange={(e) => setAddCity(e.target.value)}
                    placeholder="e.g. New Delhi"
                    className="w-full border border-[#333333] bg-[#0A0A0A] p-2.5 text-xs text-white placeholder:text-[#555555] focus:border-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[0.65rem] uppercase tracking-wider text-[#888888] block mb-1">
                    Email Address <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="e.g. advocate@delhibar.org"
                    className="w-full border border-[#333333] bg-[#0A0A0A] p-2.5 text-xs text-white placeholder:text-[#555555] focus:border-white focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-[0.65rem] uppercase tracking-wider text-[#888888] block mb-1">
                    Mobile Number <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    placeholder="e.g. +91 98110 42910"
                    className="w-full border border-[#333333] bg-[#0A0A0A] p-2.5 text-xs text-white placeholder:text-[#555555] focus:border-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[0.65rem] uppercase tracking-wider text-[#888888] block mb-1">
                    Primary Specialisation
                  </label>
                  <select
                    value={addSpecialisation}
                    onChange={(e) => setAddSpecialisation(e.target.value)}
                    className="w-full border border-[#333333] bg-[#0A0A0A] p-2.5 text-xs text-white focus:border-white focus:outline-none"
                  >
                    <option value="Criminal Defence & Anticipatory Bail">Criminal Defence & Anticipatory Bail</option>
                    <option value="Corporate Crimes & White Collar Offences">Corporate Crimes & White Collar Offences</option>
                    <option value="Constitutional Writs & Service Law">Constitutional Writs & Service Law</option>
                    <option value="Commercial Arbitration & Cheque Dishonour">Commercial Arbitration & Cheque Dishonour</option>
                    <option value="Cyber Crime & Technology Law">Cyber Crime & Technology Law</option>
                    <option value="BNS / BNSS Criminal Procedure">BNS / BNSS Criminal Procedure</option>
                    <option value="Family & Matrimonial Disputes">Family & Matrimonial Disputes</option>
                    <option value="Civil Litigation & Property Disputes">Civil Litigation & Property Disputes</option>
                  </select>
                </div>

                <div>
                  <label className="text-[0.65rem] uppercase tracking-wider text-[#888888] block mb-1">
                    Initial Status
                  </label>
                  <select
                    value={addStatus}
                    onChange={(e) => setAddStatus(e.target.value as "Active" | "Pending")}
                    className="w-full border border-[#333333] bg-[#0A0A0A] p-2.5 text-xs text-white focus:border-white focus:outline-none"
                  >
                    <option value="Active">Active (Approved)</option>
                    <option value="Pending">Pending Verification</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#262626] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="border border-[#333333] text-[#AAAAAA] hover:text-white px-4 py-2 text-xs uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-white text-black px-5 py-2 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-200 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Adding..." : "Add Lawyer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
