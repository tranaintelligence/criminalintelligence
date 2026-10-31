import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Scale, Check, X, Star, FileText, Eye, ShieldAlert, 
  ExternalLink, Search, RefreshCw, MessageSquare, AlertCircle 
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

  // Load local ratings / notes if stored
  useEffect(() => {
    try {
      const stored = localStorage.getItem("trana_lawyers_internal");
      if (stored) {
        const parsed = JSON.parse(stored);
        setLawyers((prev) =>
          prev.map((l) => {
            const found = parsed.find((p: any) => p.id === l.id);
            return found ? { ...l, ...found } : l;
          })
        );
      }
    } catch {
      // ignore
    }
  }, []);

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

  const activeLawyers = lawyers.filter(
    (l) => l.status === "Active" && (searchTerm ? l.name.toLowerCase().includes(searchTerm.toLowerCase()) || l.city.toLowerCase().includes(searchTerm.toLowerCase()) : true)
  );

  const pendingLawyers = lawyers.filter(
    (l) => (l.status === "Pending" || l.status === "Suspended") && (searchTerm ? l.name.toLowerCase().includes(searchTerm.toLowerCase()) || l.city.toLowerCase().includes(searchTerm.toLowerCase()) : true)
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

        {/* Tabs: Active Lawyers | Pending Applications */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("active")}
            className={`px-4 py-2 text-xs uppercase tracking-wider border transition-colors ${
              activeTab === "active"
                ? "border-white bg-white text-black font-semibold"
                : "border-[#333333] bg-[#111111] text-[#AAAAAA] hover:text-white"
            }`}
          >
            Active Lawyers ({activeLawyers.length})
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 text-xs uppercase tracking-wider border transition-colors relative ${
              activeTab === "pending"
                ? "border-white bg-white text-black font-semibold"
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
                  {/* Actions (View | Suspend) */}
                  <td className="py-2.5 px-3 text-right space-x-2">
                    <button
                      onClick={() => setSelectedLawyer(l)}
                      className="border border-white/30 px-2 py-1 text-[0.65rem] uppercase text-white hover:border-white hover:bg-white hover:text-black"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleSuspend(l.id, l.name)}
                      className="border border-red-500/40 px-2 py-1 text-[0.65rem] uppercase text-red-400 hover:bg-red-950/40"
                    >
                      Suspend
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
                  {/* Actions: Approve ✓ | Reject ✗ | View Profile */}
                  <td className="py-2.5 px-3 text-right space-x-1.5">
                    <button
                      onClick={() => handleApprove(l.id, l.name)}
                      className="border border-emerald-500/50 bg-emerald-950/20 px-2 py-1 text-[0.65rem] uppercase text-emerald-400 hover:bg-emerald-500 hover:text-black font-semibold"
                    >
                      Approve ✓
                    </button>
                    <button
                      onClick={() => handleReject(l.id, l.name)}
                      className="border border-red-500/50 bg-red-950/20 px-2 py-1 text-[0.65rem] uppercase text-red-400 hover:bg-red-500 hover:text-black"
                    >
                      Reject ✗
                    </button>
                    <button
                      onClick={() => setSelectedLawyer(l)}
                      className="border border-white/30 px-2 py-1 text-[0.65rem] uppercase text-white hover:border-white"
                    >
                      View Profile
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

            <div className="mt-6 pt-4 border-t border-[#262626] flex justify-end gap-2">
              <button
                onClick={() => setSelectedLawyer(null)}
                className="bg-white text-black px-4 py-2 text-xs font-semibold uppercase tracking-wider"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
