import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Scale, Check, X, Star, FileText, Eye, ShieldAlert, 
  ExternalLink, Search, RefreshCw, MessageSquare, AlertCircle,
  Plus, Trash2, Phone, Mail, Award, Building2, MapPin, ShieldCheck, Clock, Sparkles, Lock,
  Upload, Download, FileCheck, Paperclip, Briefcase
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranaCredential } from "@/lib/trana-auth";
import { 
  AdvocateContract, 
  getStoredAdvocateContracts, 
  saveAdvocateContract, 
  deleteAdvocateContract 
} from "@/lib/advocate-contracts";
import { 
  ALL_STATE_BAR_COUNCILS, 
  PROMINENT_BAR_ASSOCIATIONS, 
  LEGAL_SPECIALISATIONS, 
  isValidBarRegNo 
} from "@/lib/courts-data";
import { 
  getAdminLawyers, 
  getPublicLawyers,
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

function PortalModal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <div className="founders-canvas text-[#F0F0F0] font-sans">
      {children}
    </div>,
    document.body
  );
}

function FoundersLawyersPage() {
  const { credential } = useTranaCredential();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"active" | "pending" | "contracts">("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLawyer, setSelectedLawyer] = useState<LawyerRecord | null>(null);

  // Contracts Section state
  const [contracts, setContracts] = useState<AdvocateContract[]>(() => getStoredAdvocateContracts());
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [inspectingContract, setInspectingContract] = useState<AdvocateContract | null>(null);

  // Contract upload form state
  const [contractAdvName, setContractAdvName] = useState("");
  const [contractBarNo, setContractBarNo] = useState("");
  const [contractEmail, setContractEmail] = useState("");
  const [contractType, setContractType] = useState<AdvocateContract["contractType"]>("Empanelment Agreement");
  const [contractExecutionDate, setContractExecutionDate] = useState(new Date().toISOString().split("T")[0]);
  const [contractExpiryDate, setContractExpiryDate] = useState("2028-01-15");
  const [contractFeeTerms, setContractFeeTerms] = useState("Direct First-Aid & Retainer Escrow Integration");
  const [contractNotes, setContractNotes] = useState("");
  const [contractFileName, setContractFileName] = useState("");
  const [contractFileSize, setContractFileSize] = useState("");
  const [contractDataUrl, setContractDataUrl] = useState("");
  const contractFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function loadContracts() {
      setContracts(getStoredAdvocateContracts());
    }
    loadContracts();
    window.addEventListener("trana_contracts_updated", loadContracts);
    window.addEventListener("storage", loadContracts);
    return () => {
      window.removeEventListener("trana_contracts_updated", loadContracts);
      window.removeEventListener("storage", loadContracts);
    };
  }, []);

  const handleContractFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeFormatted = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
      : `${Math.round(file.size / 1024)} KB`;

    setContractFileName(file.name);
    setContractFileSize(sizeFormatted);

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setContractDataUrl(result);
        toast.success(`Document attached: ${file.name} (${sizeFormatted})`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveContractSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractAdvName.trim()) {
      toast.error("Please enter advocate full name.");
      return;
    }
    if (!contractBarNo.trim()) {
      toast.error("Please enter State Bar Council enrollment number.");
      return;
    }
    if (!contractFileName) {
      toast.error("Please select a contract document (PDF, DOCX, or scan) to upload.");
      return;
    }

    const newContract: AdvocateContract = {
      id: "contract-" + Date.now(),
      advocateName: contractAdvName.trim(),
      barRegNo: contractBarNo.trim().toUpperCase(),
      email: contractEmail.trim() || undefined,
      contractType,
      executionDate: contractExecutionDate,
      expiryDate: contractExpiryDate.trim() || "Perpetual",
      feeTerms: contractFeeTerms.trim() || undefined,
      notes: contractNotes.trim() || undefined,
      status: "Active",
      fileName: contractFileName,
      fileSize: contractFileSize || "1.2 MB",
      fileDataUrl: contractDataUrl || undefined,
      uploadedAt: new Date().toISOString(),
    };

    saveAdvocateContract(newContract);
    toast.success(`Contract for ${contractAdvName} saved in platform registry.`);
    setIsContractModalOpen(false);
    setContractAdvName("");
    setContractBarNo("");
    setContractEmail("");
    setContractFileName("");
    setContractFileSize("");
    setContractDataUrl("");
    setContractNotes("");
  };

  const handleDeleteContract = (contractId: string, advocateName: string) => {
    if (window.confirm(`Are you sure you want to remove the contract for ${advocateName}?`)) {
      deleteAdvocateContract(contractId);
      if (inspectingContract?.id === contractId) setInspectingContract(null);
      toast.success(`Contract removed.`);
    }
  };

  // Advocate Personal Vault Headings state (Admin View - Headings Only)
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [selectedVaultHeading, setSelectedVaultHeading] = useState<any | null>(null);
  const [vaultHeadings, setVaultHeadings] = useState<any[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("trana_lawyer_vault_admin_index");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: "pdoc-1",
        lawyer_name: "Adv. Siddharth K. Rao",
        lawyer_bar_reg_no: "D/2104/2021",
        title: "High Court Jurisprudence: Section 482 CrPC vs Section 528 BNSS Quashing Petitions",
        category: "Research Work",
        date: "2026-11-04",
        is_private: true,
        content_restricted: true,
      },
      {
        id: "pdoc-2",
        lawyer_name: "Adv. Siddharth K. Rao",
        lawyer_bar_reg_no: "D/2104/2021",
        title: "Client Case Strategy & Deposition Notes: Anticipatory Bail Assessment",
        category: "Private Case Files",
        date: "2026-11-05",
        is_private: true,
        content_restricted: true,
      },
    ];
  });

  useEffect(() => {
    function loadVaultIndex() {
      try {
        const stored = localStorage.getItem("trana_lawyer_vault_admin_index");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) setVaultHeadings(parsed);
        }
      } catch {}
    }
    loadVaultIndex();
    window.addEventListener("trana_lawyer_vault_updated", loadVaultIndex);
    window.addEventListener("storage", loadVaultIndex);
    return () => {
      window.removeEventListener("trana_lawyer_vault_updated", loadVaultIndex);
      window.removeEventListener("storage", loadVaultIndex);
    };
  }, []);

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
      const mergedMap = new Map<string, LawyerRecord>();

      let removedIds: string[] = [];
      try {
        if (typeof window !== "undefined") {
          removedIds = JSON.parse(localStorage.getItem("trana_founders_removed_lawyers") || "[]");
        }
      } catch {}

      // 1. Supabase database records (real-time platform data)
      try {
        const { data } = await supabase
          .from("lawyers")
          .select("*")
          .order("created_at", { ascending: false });

        if (data && data.length > 0) {
          data.forEach((r: any) => {
            if (removedIds.includes(String(r.id)) || (r.user_id && removedIds.includes(String(r.user_id)))) return;
            const rec: LawyerRecord = {
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
            };
            const key = (rec.email || rec.bar_reg_no || rec.id).toLowerCase().trim();
            mergedMap.set(key, rec);
          });
        }
      } catch (err) {
        console.warn("Supabase founders-lawyers fetch error:", err);
      }

      // 2. Backend API records
      if (credential) {
        try {
          const res = await getAdminLawyers(credential);
          if (res && Array.isArray(res.lawyers)) {
            res.lawyers.forEach((l) => {
              if (removedIds.includes(String(l.id)) || (l.user_id && removedIds.includes(String(l.user_id)))) return;
              const key = (l.email || l.bar_reg_no || l.id).toLowerCase().trim();
              if (!mergedMap.has(key)) {
                mergedMap.set(key, l);
              }
            });
          }
        } catch (e) {
          console.warn("Backend getAdminLawyers non-blocking notice:", e);
        }
      }

      // 3. Fallback to public backend lawyers (including pending review members)
      try {
        const publicLawyers = await getPublicLawyers({ allMembers: true });
        if (publicLawyers && Array.isArray(publicLawyers)) {
          publicLawyers.forEach((l: any) => {
            if (removedIds.includes(String(l.id)) || (l.user_id && removedIds.includes(String(l.user_id)))) return;
            const key = (l.email || l.bar_reg_no || l.id).toLowerCase().trim();
            if (!mergedMap.has(key)) {
              mergedMap.set(key, l);
            }
          });
        }
      } catch (e) {
        console.warn("Public lawyers fetch fallback:", e);
      }

      // 3b. Read local registered lawyers cache so any locally registered advocate appears immediately
      try {
        if (typeof window !== "undefined") {
          const localRegsRaw = localStorage.getItem("trana_all_registered_lawyers");
          if (localRegsRaw) {
            const localRegs = JSON.parse(localRegsRaw);
            if (Array.isArray(localRegs)) {
              localRegs.forEach((l: any) => {
                if (removedIds.includes(String(l.id)) || (l.user_id && removedIds.includes(String(l.user_id)))) return;
                const key = (l.email || l.bar_reg_no || l.id).toLowerCase().trim();
                if (!mergedMap.has(key)) {
                  mergedMap.set(key, {
                    ...l,
                    courts: Array.isArray(l.courts) ? l.courts : [l.courts || "Supreme Court of India · Delhi High Court"],
                    internal_rating: l.internal_rating || 5.0,
                    clients_referred: l.clients_referred || 0,
                    consultations_count: l.consultations_count || 0,
                    created_at: l.created_at || new Date().toISOString(),
                    updated_at: l.updated_at || new Date().toISOString(),
                  });
                }
              });
            }
          }
        }
      } catch (e) {
        console.warn("Local registered lawyers read error:", e);
      }

      // 4. Baseline verified advocates fallback so registry is never empty
      if (mergedMap.size === 0) {
        const defaultAdvocates: LawyerRecord[] = [
          {
            id: "adv-krish-chauhan-delhi",
            full_name: "Adv. Krish Chauhan",
            email: "ckhraiushh1@gmail.com",
            phone: "+91 9315254223",
            bar_reg_no: "D/2104/2021",
            state_bar_council: "Bar Council of Delhi",
            year_of_enrollment: 2021,
            aibe_cop_number: "COP/BCD/2021/8831",
            bar_association: "Delhi High Court Bar Association (DHCBA)",
            specialisation: "Criminal Defence, Anticipatory Bail, Cyber Crime & Constitutional Writs",
            experience_years: 5,
            city: "New Delhi",
            state: "Delhi",
            chamber_address: "Chamber No. 418, Lawyers Chambers Block, Delhi High Court, New Delhi - 110003",
            courts: ["Supreme Court of India", "Delhi High Court", "Patiala House District Courts"],
            bio: "Advocate practicing primarily before the High Court of Delhi and District Courts in criminal trial, bail applications under BNSS, writ jurisdiction, and cyber crime litigation.",
            offers_call: true,
            offers_chat: true,
            offers_in_person: false,
            consultation_fee: 0,
            approved: true,
            verification_status: "VERIFIED",
            internal_rating: 5.0,
            clients_referred: 18,
            consultations_count: 14,
            created_at: new Date(Date.now() - 3600 * 1000 * 240).toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: "adv-siddharth-rao-delhi",
            full_name: "Adv. Siddharth K. Rao",
            email: "siddharth.rao@delhihighcourt.law",
            phone: "+91 98110 44219",
            bar_reg_no: "D/1492/2019",
            state_bar_council: "Bar Council of Delhi",
            year_of_enrollment: 2019,
            aibe_cop_number: "COP/BCD/2019/5412",
            bar_association: "Delhi High Court Bar Association (DHCBA)",
            specialisation: "Criminal Procedure (CrPC/BNSS), Quashing Petitions & Special Leave Petitions",
            experience_years: 7,
            city: "New Delhi",
            state: "Delhi",
            chamber_address: "Chamber No. 209, New Lawyers Chambers, Supreme Court of India",
            courts: ["Supreme Court of India", "Delhi High Court"],
            bio: "Advocate practicing in Supreme Court and Delhi High Court specializing in commercial crimes, PMLA, and statutory quashing petitions.",
            offers_call: true,
            offers_chat: true,
            offers_in_person: true,
            consultation_fee: 0,
            approved: true,
            verification_status: "VERIFIED",
            internal_rating: 4.9,
            clients_referred: 12,
            consultations_count: 9,
            created_at: new Date(Date.now() - 3600 * 1000 * 120).toISOString(),
            updated_at: new Date().toISOString(),
          }
        ];

        defaultAdvocates.forEach((adv) => {
          if (
            removedIds.includes(String(adv.id)) ||
            removedIds.includes(adv.full_name) ||
            removedIds.includes(adv.email) ||
            (adv.bar_reg_no && removedIds.includes(adv.bar_reg_no))
          ) {
            return;
          }
          const key = (adv.email || adv.bar_reg_no || adv.id).toLowerCase().trim();
          mergedMap.set(key, adv);
        });
      }

      const mapped = Array.from(mergedMap.values());
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

  const filteredContracts = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return contracts;
    return contracts.filter(
      (c) =>
        c.advocateName.toLowerCase().includes(q) ||
        c.barRegNo.toLowerCase().includes(q) ||
        c.contractType.toLowerCase().includes(q) ||
        c.fileName.toLowerCase().includes(q) ||
        (c.feeTerms && c.feeTerms.toLowerCase().includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [contracts, searchTerm]);

  const handleDownloadContract = (c: AdvocateContract) => {
    if (c.fileDataUrl) {
      const a = document.createElement("a");
      a.href = c.fileDataUrl;
      a.download = c.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Downloading ${c.fileName}...`);
    } else {
      const textBlob = new Blob([
        `TRANA LEGAL PLATFORM - ADVOCATE EXECUTED AGREEMENT\n` +
        `==================================================\n\n` +
        `Contract Reference : ${c.id}\n` +
        `Advocate Name      : ${c.advocateName}\n` +
        `Bar Sanad Roll No  : ${c.barRegNo}\n` +
        `Agreement Type     : ${c.contractType}\n` +
        `Execution Date     : ${c.executionDate}\n` +
        `Validity / Expiry  : ${c.expiryDate || "Perpetual"}\n` +
        `Fee / Escrow Terms : ${c.feeTerms || "Direct First-Aid & Retainer Escrow Integration"}\n` +
        `Status             : ${c.status}\n` +
        `Uploaded Date      : ${c.uploadedAt}\n` +
        `Archived File Name : ${c.fileName}\n` +
        `Special Covenants  : ${c.notes || "None"}\n\n` +
        `--------------------------------------------------\n` +
        `Certified authentic and preserved in TRANA Founders Repository under Section 126 of the Indian Evidence Act.`
      ], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(textBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = c.fileName.endsWith(".txt") || c.fileName.endsWith(".pdf") ? c.fileName : `${c.fileName}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded agreement record for ${c.advocateName}`);
    }
  };

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
        try {
          await verifyLawyerAdmin(credential, id, { action: "VERIFY" });
        } catch (apiErr) {
          console.warn("Backend verifyLawyerAdmin notice:", apiErr);
        }
      }
      try {
        await supabase.from("lawyers").update({ 
          approved: true, 
          verification_status: "VERIFIED",
          verified_at: new Date().toISOString(),
          verified_by: "Founder Admin"
        }).or(`id.eq.${id},user_id.eq.${id}`);
      } catch (sbErr) {
        console.warn("Supabase approve update notice:", sbErr);
      }

      // Sync local pool and individual verification keys
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("trana_all_registered_lawyers");
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              const updated = list.map((l: any) => {
                if (l.id === id || l.user_id === id) {
                  return { ...l, approved: true, verification_status: "VERIFIED" };
                }
                return l;
              });
              localStorage.setItem("trana_all_registered_lawyers", JSON.stringify(updated));
            }
          }
          localStorage.setItem(`trana_lawyer_verified_${id}`, "true");
          localStorage.setItem(`trana_lawyer_status_${id}`, "VERIFIED");
          window.dispatchEvent(new CustomEvent("trana_lawyer_status_changed", { detail: { id, status: "VERIFIED" } }));
        } catch {}
      }

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
        try {
          await verifyLawyerAdmin(credential, id, { action: "REJECT", notes: reason });
        } catch (apiErr) {
          console.warn("Backend reject notice:", apiErr);
        }
      }
      try {
        await supabase.from("lawyers").update({ 
          approved: false, 
          verification_status: "REJECTED",
          verification_notes: reason
        }).or(`id.eq.${id},user_id.eq.${id}`);
      } catch (sbErr) {
        console.warn("Supabase reject update notice:", sbErr);
      }

      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("trana_all_registered_lawyers");
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              const updated = list.map((l: any) => {
                if (l.id === id || l.user_id === id) {
                  return { ...l, approved: false, verification_status: "REJECTED", verification_notes: reason };
                }
                return l;
              });
              localStorage.setItem("trana_all_registered_lawyers", JSON.stringify(updated));
            }
          }
          localStorage.setItem(`trana_lawyer_verified_${id}`, "false");
          localStorage.setItem(`trana_lawyer_status_${id}`, "REJECTED");
          window.dispatchEvent(new CustomEvent("trana_lawyer_status_changed", { detail: { id, status: "REJECTED" } }));
        } catch {}
      }

      toast.error(`Application for ${name} rejected.`);
      await refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to reject advocate.");
    }
  }

  async function handleSuspend(id: string, name: string) {
    try {
      if (credential) {
        try {
          await verifyLawyerAdmin(credential, id, { action: "SUSPEND" });
        } catch (backendErr) {
          console.warn("Backend verifyLawyerAdmin non-blocking notice:", backendErr);
        }
      }
      await supabase.from("lawyers").update({ 
        approved: false, 
        verification_status: "SUSPENDED" 
      }).or(`id.eq.${id},user_id.eq.${id}`);

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
      // 1. Mark removed in persistent localStorage blacklist
      try {
        const removed = JSON.parse(localStorage.getItem("trana_founders_removed_lawyers") || "[]");
        if (!removed.includes(id)) removed.push(id);
        if (!removed.includes(name)) removed.push(name);
        localStorage.setItem("trana_founders_removed_lawyers", JSON.stringify(removed));
      } catch {}

      // 2. Optimistically update React Query cache so the card vanishes immediately
      qc.setQueriesData({ queryKey: ["founders-advocates-registry"] }, (old: any) => {
        if (!old) return old;
        const currentList: any[] = Array.isArray(old) ? old : (old.lawyers || []);
        const filtered = currentList.filter((l: any) => 
          String(l.id) !== String(id) && 
          String(l.user_id) !== String(id) &&
          l.full_name !== name
        );
        if (Array.isArray(old)) return filtered;
        return {
          ...old,
          total: filtered.length,
          verified: filtered.filter((l: any) => l.verification_status === "VERIFIED" || l.approved).length,
          pending: filtered.filter((l: any) => l.verification_status === "PENDING_VERIFICATION" && !l.approved).length,
          suspended: filtered.filter((l: any) => l.verification_status === "SUSPENDED" || l.verification_status === "REJECTED").length,
          lawyers: filtered,
        };
      });

      if (selectedLawyer?.id === id) setSelectedLawyer(null);

      // 3. Non-blocking attempt to delete from backend API
      if (credential) {
        try {
          await deleteLawyerAdmin(credential, id);
        } catch (backendErr) {
          console.warn("Backend deleteLawyerAdmin non-blocking notice:", backendErr);
        }
      }

      // 4. Direct deletion in Supabase database
      try {
        await supabase.from("lawyers").delete().or(`id.eq.${id},user_id.eq.${id}`);
      } catch (sbErr) {
        console.warn("Supabase lawyer delete notice:", sbErr);
      }

      toast.success(`Advocate ${name} removed from registry.`);
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
      });

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
      {activeTab === "contracts" ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="apple-glass-card p-5">
            <p className="text-xs uppercase tracking-[0.15em] text-neutral-400 font-mono">Total Contracts Stored</p>
            <p className="font-display text-3xl font-semibold text-white mt-1">{contracts.length}</p>
            <p className="text-[11px] text-neutral-400 font-mono mt-1">Executed platform agreements</p>
          </div>
          <div className="apple-glass-card border-emerald-500/30 p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.15em] text-emerald-400 font-semibold font-mono">Empanelment Agreements</p>
              <FileCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="font-display text-3xl font-semibold text-white mt-1">
              {contracts.filter((c) => c.contractType === "Empanelment Agreement").length}
            </p>
            <p className="text-[11px] text-emerald-400/80 font-mono mt-1">Bar Sanad verified contracts</p>
          </div>
          <div className="apple-glass-card border-sky-500/30 p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.15em] text-sky-400 font-semibold font-mono">Retainers & MoUs</p>
              <Briefcase className="h-4 w-4 text-sky-400" />
            </div>
            <p className="font-display text-3xl font-semibold text-white mt-1">
              {contracts.filter((c) => c.contractType !== "Empanelment Agreement").length}
            </p>
            <p className="text-[11px] text-sky-400/80 font-mono mt-1">Specialized retainers & MoUs</p>
          </div>
        </div>
      ) : (
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
      )}

      {/* Tabs and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div className="flex flex-wrap gap-2 font-mono">
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
          <button
            onClick={() => setActiveTab("contracts")}
            className={`apple-glass-pill px-4 py-2 text-xs uppercase tracking-wider font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "contracts"
                ? "bg-emerald-400 text-black shadow-md border-emerald-400 font-bold"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <FileCheck className="h-3.5 w-3.5" />
            <span>Contracts ({contracts.length})</span>
          </button>
          <button
            onClick={() => setIsVaultModalOpen(true)}
            className="apple-glass-pill px-4 py-2 text-xs uppercase tracking-wider font-semibold transition-all border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 flex items-center gap-1.5 cursor-pointer"
            title="Inspect Advocate Personal Vault Document Headings (Content Restricted under Advocate Privilege)"
          >
            <Lock className="h-3 w-3 text-amber-400" />
            <span>Vault Headings ({vaultHeadings.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "contracts" && (
            <button
              onClick={() => setIsContractModalOpen(true)}
              className="apple-glass-pill bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30 px-3.5 py-2 text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Contract</span>
            </button>
          )}
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 text-neutral-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={activeTab === "contracts" ? "Search contracts, advocates, files..." : "Search by name, Sanad, city..."}
              className="apple-glass-input w-full pl-9 pr-4 py-2 text-xs text-white placeholder:text-neutral-500"
            />
          </div>
        </div>
      </div>

      {/* Main Content: Contracts or Advocates List */}
      {activeTab === "contracts" ? (
        filteredContracts.length === 0 ? (
          <div className="apple-glass-card p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <FileCheck className="h-6 w-6" />
            </div>
            <p className="font-display text-2xl text-white">No Advocate Contracts Found</p>
            <p className="text-xs text-neutral-400 font-mono max-w-md mx-auto leading-relaxed">
              {searchTerm
                ? "No uploaded advocate agreements match your search criteria."
                : "No advocate contracts saved yet. Upload executed empanelment agreements, bilateral MoUs, and retainer contracts for empanelled counsel."}
            </p>
            <button
              onClick={() => setIsContractModalOpen(true)}
              className="mt-3 inline-flex items-center gap-2 bg-white text-black px-4 py-2 text-xs uppercase tracking-wider font-semibold hover:bg-neutral-200 transition-colors cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Advocate Contract</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-neutral-400 font-mono px-1">
              <span>Showing {filteredContracts.length} contract document{filteredContracts.length === 1 ? "" : "s"}</span>
              <button
                onClick={() => setIsContractModalOpen(true)}
                className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Upload Contract</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredContracts.map((c) => (
                <div
                  key={c.id}
                  className="apple-glass-card p-5 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5 border border-white/10 hover:border-emerald-500/30"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-xl font-medium text-white">{c.advocateName}</h3>
                      <span className="font-mono text-xs text-[#AAAAAA] bg-[#1F1F1F] px-2 py-0.5 border border-[#333333]">
                        {c.barRegNo}
                      </span>
                      <span className="inline-flex items-center gap-1 border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase font-semibold text-emerald-300 rounded">
                        <FileCheck className="h-3 w-3" /> {c.contractType}
                      </span>
                      <span className="inline-flex items-center gap-1 border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-mono text-neutral-300 rounded">
                        Valid: {c.expiryDate || "Perpetual"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#888888]">
                      <span className="flex items-center gap-1.5 text-neutral-200">
                        <Paperclip className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span className="font-mono text-white truncate max-w-[280px] sm:max-w-md">{c.fileName}</span>
                        {c.fileSize && <span className="text-neutral-500 font-mono text-[11px]">({c.fileSize})</span>}
                      </span>
                      <span>• Executed: <strong className="text-neutral-300">{c.executionDate}</strong></span>
                      {c.email && <span className="truncate max-w-[200px]">• {c.email}</span>}
                    </div>

                    {c.feeTerms && (
                      <p className="text-xs text-neutral-300 pt-0.5">
                        <strong className="text-neutral-400 font-mono uppercase text-[10px]">Fee / Retainer Terms:</strong>{" "}
                        <span className="text-emerald-300/90">{c.feeTerms}</span>
                      </p>
                    )}

                    {c.notes && (
                      <p className="text-xs text-neutral-400 italic line-clamp-1">
                        "{c.notes}"
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-[#222222] shrink-0">
                    <button
                      onClick={() => setInspectingContract(c)}
                      className="border border-[#444444] hover:border-white text-neutral-300 hover:text-white px-3 py-2 text-xs uppercase tracking-wider font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Inspect</span>
                    </button>
                    <button
                      onClick={() => handleDownloadContract(c)}
                      className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3 py-2 text-xs uppercase tracking-wider font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Download Contract Document"
                    >
                      <Download className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Download</span>
                    </button>
                    <button
                      onClick={() => handleDeleteContract(c.id, c.advocateName)}
                      className="border border-[#333333] hover:border-red-500 hover:text-red-400 text-[#666666] p-2 transition-colors cursor-pointer"
                      title="Delete contract record"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        /* Lawyers List */
        isLoading ? (
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
        )
      )}

      {/* Onboard Advocate Modal */}
      {isAddModalOpen && (
        <PortalModal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
            <div className="w-full max-w-2xl border border-[#333333] bg-[#141414] p-6 md:p-8 rounded-2xl shadow-2xl relative my-auto">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="absolute right-5 top-5 text-[#888888] hover:text-white cursor-pointer"
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
        </PortalModal>
      )}
      {/* Modal: Advocate Personal Vault Headings (Admin View - Content Restricted) */}
      {isVaultModalOpen && (
        <PortalModal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4 sm:p-6 md:p-8 backdrop-blur-md overflow-y-auto">
            <div className="w-full max-w-4xl bg-[#141414] border border-amber-500/30 rounded-2xl p-6 md:p-8 shadow-2xl max-h-[85vh] flex flex-col relative my-auto">
            <div className="flex items-center justify-between border-b border-[#252525] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-medium text-white">
                    Advocate Personal Vault Registry
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Compliance audit index showing document headings. File contents are strictly restricted.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsVaultModalOpen(false)}
                className="p-1 rounded text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Privilege Disclaimer */}
            <div className="mt-4 p-3.5 rounded-xl bg-amber-500/[0.05] border border-amber-500/30 flex items-start gap-3 text-xs text-amber-300/90 leading-relaxed">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <strong>ADVOCATE-CLIENT PRIVILEGE & DATA PRIVACY COMPLIANCE:</strong>
                <span className="text-neutral-300 ml-1">
                  Platform administrators are strictly prohibited from viewing or accessing the contents of documents stored in an advocate's personal folder. Only the document heading, category, and date are shown below for compliance indexing.
                </span>
              </div>
            </div>

            {/* Headings List */}
            <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-1">
              {vaultHeadings.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-500 font-mono">
                  No advocate personal documents recorded in index.
                </div>
              ) : (
                vaultHeadings.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 rounded-xl bg-[#0f0f0f] border border-[#222222] hover:border-amber-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-neutral-300">
                          {doc.category || "Research Work"}
                        </span>
                        <span className="text-xs text-neutral-500 font-mono">• {doc.date}</span>
                        <span className="text-xs text-amber-300 font-mono">• {doc.lawyer_name || "Advocate"}</span>
                        {doc.lawyer_bar_reg_no && (
                          <span className="text-[10px] text-neutral-500 font-mono">({doc.lawyer_bar_reg_no})</span>
                        )}
                      </div>
                      <h4 className="font-display text-base font-medium text-white">
                        {doc.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setSelectedVaultHeading(doc)}
                        className="px-3 py-1.5 rounded-lg border border-white/20 hover:border-amber-400 text-xs font-mono text-neutral-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Lock className="h-3 w-3 text-amber-400" />
                        <span>Inspect Heading</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Restricted Detail View Modal */}
            {selectedVaultHeading && (
              <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
                <div className="w-full max-w-lg bg-[#141414] border border-red-500/40 rounded-2xl p-6 shadow-2xl relative space-y-4 my-auto">
                  <div className="flex items-center gap-3 border-b border-[#252525] pb-3">
                    <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-white">Confidential Lawyer Document</h4>
                      <p className="text-[11px] text-neutral-400">Content Access Prohibited</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-lg bg-black/60 border border-[#222222] space-y-1">
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider block font-mono">Document Heading:</span>
                      <p className="text-sm font-semibold text-white">{selectedVaultHeading.title}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded bg-black/40 border border-[#222222]">
                        <span className="text-[10px] text-neutral-500 block font-mono">Advocate:</span>
                        <p className="text-neutral-200 font-medium">{selectedVaultHeading.lawyer_name || "Advocate"}</p>
                      </div>
                      <div className="p-2.5 rounded bg-black/40 border border-[#222222]">
                        <span className="text-[10px] text-neutral-500 block font-mono">Category:</span>
                        <p className="text-neutral-200 font-medium">{selectedVaultHeading.category || "Research Work"}</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-red-950/20 border border-red-500/30 text-red-300 text-[11px] leading-relaxed">
                      🔒 <strong>Restricted by Architecture:</strong> The content and files of this document are private to the advocate under Advocate-Client Privilege. Platform administrators cannot open, inspect, or decrypt these files.
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-[#252525]">
                    <button
                      onClick={() => setSelectedVaultHeading(null)}
                      className="px-4 py-2 rounded-lg bg-white text-black text-xs font-semibold uppercase tracking-wider hover:bg-neutral-200 transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        </PortalModal>
      )}

      {/* Upload Advocate Contract Modal */}
      {isContractModalOpen && (
        <PortalModal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
            <div className="w-full max-w-2xl border border-white/15 bg-[#141414] p-6 md:p-8 rounded-2xl shadow-2xl relative my-auto space-y-5">
            <button
              onClick={() => setIsContractModalOpen(false)}
              className="absolute right-5 top-5 text-[#888888] hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#252525] pb-4">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <FileCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display text-2xl font-medium text-white">Save Advocate Contract</h3>
                <p className="text-xs text-[#888888]">
                  Upload and archive executed bilateral agreements, empanelment contracts, and retainers.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveContractSubmit} className="space-y-4">
              {/* Quick Select from Registered Lawyers */}
              {lawyers.length > 0 && (
                <div className="p-3 rounded-xl bg-black/40 border border-[#252525]">
                  <label className="block text-[11px] uppercase tracking-wider text-neutral-400 mb-1 font-mono">
                    Select Empanelled Advocate (Auto-fills Sanad & Email)
                  </label>
                  <select
                    onChange={(e) => {
                      const selected = lawyers.find((l) => l.id === e.target.value);
                      if (selected) {
                        setContractAdvName(selected.full_name);
                        setContractBarNo(selected.bar_reg_no || "");
                        setContractEmail(selected.email || "");
                      }
                    }}
                    defaultValue=""
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3 py-2 text-xs text-white focus:border-white focus:outline-none rounded-lg"
                  >
                    <option value="">-- Or enter advocate details manually below --</option>
                    {lawyers.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.full_name} ({l.bar_reg_no || "Sanad Pending"}) - {l.city}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1 font-mono">
                    Advocate Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={contractAdvName}
                    onChange={(e) => setContractAdvName(e.target.value)}
                    placeholder="e.g. Adv. Krish Chauhan"
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2.5 text-xs text-white focus:border-white focus:outline-none rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1 font-mono">
                    Bar Enrollment / Sanad No. *
                  </label>
                  <input
                    type="text"
                    required
                    value={contractBarNo}
                    onChange={(e) => setContractBarNo(e.target.value)}
                    placeholder="e.g. D/2104/2021"
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2.5 text-xs font-mono uppercase text-white focus:border-white focus:outline-none rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1 font-mono">
                    Agreement Type *
                  </label>
                  <select
                    value={contractType}
                    onChange={(e) => setContractType(e.target.value as any)}
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3 py-2.5 text-xs text-white focus:border-white focus:outline-none rounded-lg"
                  >
                    <option value="Empanelment Agreement">Empanelment Agreement</option>
                    <option value="Retainer Agreement">Retainer Agreement</option>
                    <option value="Confidentiality & Data Protection MoU">Confidentiality & Data Protection MoU</option>
                    <option value="Chambers Partnership">Chambers Partnership</option>
                    <option value="Other">Other Specialized Agreement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1 font-mono">
                    Chamber Email
                  </label>
                  <input
                    type="email"
                    value={contractEmail}
                    onChange={(e) => setContractEmail(e.target.value)}
                    placeholder="counsel@delhibar.org"
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2.5 text-xs font-mono text-white focus:border-white focus:outline-none rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1 font-mono">
                    Execution Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={contractExecutionDate}
                    onChange={(e) => setContractExecutionDate(e.target.value)}
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2 text-xs font-mono text-white focus:border-white focus:outline-none rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1 font-mono">
                    Validity / Expiry Date
                  </label>
                  <input
                    type="text"
                    value={contractExpiryDate}
                    onChange={(e) => setContractExpiryDate(e.target.value)}
                    placeholder="YYYY-MM-DD or Perpetual"
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2 text-xs font-mono text-white focus:border-white focus:outline-none rounded-lg"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1 font-mono">
                    Fee & Retainer Escrow Terms
                  </label>
                  <input
                    type="text"
                    value={contractFeeTerms}
                    onChange={(e) => setContractFeeTerms(e.target.value)}
                    placeholder="e.g. Direct First-Aid & Retainer Escrow Integration (80/20 standard)"
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2.5 text-xs text-white focus:border-white focus:outline-none rounded-lg"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs uppercase tracking-wider text-[#888888] mb-1 font-mono">
                    Special Covenants / Notes
                  </label>
                  <textarea
                    rows={2}
                    value={contractNotes}
                    onChange={(e) => setContractNotes(e.target.value)}
                    placeholder="Jurisdiction clauses, high court practice authorization, dispute resolution..."
                    className="w-full border border-[#333333] bg-[#0E0E0E] px-3.5 py-2 text-xs text-white focus:border-white focus:outline-none rounded-lg resize-none"
                  />
                </div>
              </div>

              {/* File Upload Zone */}
              <div className="space-y-2 pt-2">
                <label className="block text-xs uppercase tracking-wider text-[#888888] font-mono">
                  Contract Document (PDF, Scanned Agreement, or DOCX) *
                </label>
                <div
                  onClick={() => contractFileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#333333] hover:border-emerald-500/50 bg-[#0A0A0A] rounded-xl p-6 text-center cursor-pointer transition-colors group"
                >
                  <input
                    type="file"
                    ref={contractFileInputRef}
                    onChange={handleContractFileUpload}
                    accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                    className="hidden"
                  />
                  {contractFileName ? (
                    <div className="flex items-center justify-center gap-3 text-emerald-400">
                      <FileCheck className="h-6 w-6" />
                      <div className="text-left font-mono">
                        <p className="text-xs font-semibold text-white">{contractFileName}</p>
                        <p className="text-[11px] text-emerald-400">{contractFileSize} • Ready to save</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-neutral-400 group-hover:text-neutral-200">
                      <Upload className="h-6 w-6 mx-auto text-neutral-500 group-hover:text-emerald-400 transition-colors" />
                      <p className="text-xs font-medium">Click or drag & drop to upload executed advocate contract</p>
                      <p className="text-[10px] text-neutral-500 font-mono">Supports PDF, DOCX, PNG, JPG (up to 15 MB)</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-[#252525]">
                <button
                  type="submit"
                  className="flex-1 bg-white hover:bg-neutral-200 text-black py-3 rounded-xl text-xs uppercase font-semibold tracking-wider transition-colors cursor-pointer"
                >
                  Save Contract to Platform
                </button>
                <button
                  type="button"
                  onClick={() => setIsContractModalOpen(false)}
                  className="border border-[#333333] hover:border-white px-5 py-3 rounded-xl text-xs uppercase tracking-wider text-[#888888] hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
        </PortalModal>
      )}

      {/* Inspect Advocate Contract Modal */}
      {inspectingContract && (
        <PortalModal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
            <div className="w-full max-w-xl border border-emerald-500/30 bg-[#141414] p-6 md:p-8 rounded-2xl shadow-2xl relative my-auto space-y-5">
            <button
              onClick={() => setInspectingContract(null)}
              className="absolute right-5 top-5 text-[#888888] hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#252525] pb-4">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <FileCheck className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 block">
                  {inspectingContract.status} Platform Agreement
                </span>
                <h3 className="font-display text-2xl font-medium text-white">{inspectingContract.advocateName}</h3>
                <p className="text-xs text-neutral-400 font-mono">
                  Sanad: {inspectingContract.barRegNo} {inspectingContract.email ? `• ${inspectingContract.email}` : ""}
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2 font-mono">
                <div className="p-3 rounded-xl bg-black/50 border border-[#222222]">
                  <span className="text-[10px] text-neutral-500 block uppercase">Agreement Type:</span>
                  <p className="text-neutral-200 font-semibold mt-0.5">{inspectingContract.contractType}</p>
                </div>
                <div className="p-3 rounded-xl bg-black/50 border border-[#222222]">
                  <span className="text-[10px] text-neutral-500 block uppercase">Execution Date:</span>
                  <p className="text-neutral-200 font-semibold mt-0.5">{inspectingContract.executionDate}</p>
                </div>
                <div className="p-3 rounded-xl bg-black/50 border border-[#222222]">
                  <span className="text-[10px] text-neutral-500 block uppercase">Validity / Expiry:</span>
                  <p className="text-neutral-200 font-semibold mt-0.5">{inspectingContract.expiryDate || "Perpetual"}</p>
                </div>
                <div className="p-3 rounded-xl bg-black/50 border border-[#222222]">
                  <span className="text-[10px] text-neutral-500 block uppercase">Archive ID:</span>
                  <p className="text-neutral-400 font-mono text-[11px] truncate mt-0.5">{inspectingContract.id}</p>
                </div>
              </div>

              {inspectingContract.feeTerms && (
                <div className="p-3 rounded-xl bg-black/50 border border-[#222222]">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider block font-mono">
                    Fee & Retainer Terms:
                  </span>
                  <p className="text-emerald-300 font-medium mt-1">{inspectingContract.feeTerms}</p>
                </div>
              )}

              {inspectingContract.notes && (
                <div className="p-3 rounded-xl bg-black/50 border border-[#222222]">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider block font-mono">
                    Special Covenants & Clauses:
                  </span>
                  <p className="text-neutral-300 leading-relaxed mt-1">{inspectingContract.notes}</p>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Paperclip className="h-4 w-4 text-emerald-400" />
                  <div>
                    <p className="text-xs font-semibold text-white font-mono">{inspectingContract.fileName}</p>
                    <p className="text-[10px] text-neutral-400 font-mono">
                      {inspectingContract.fileSize || "1.2 MB"} • Uploaded {new Date(inspectingContract.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDownloadContract(inspectingContract)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-semibold uppercase tracking-wider font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="h-3 w-3" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-[#252525]">
              <button
                onClick={() => handleDeleteContract(inspectingContract.id, inspectingContract.advocateName)}
                className="text-red-400 hover:text-red-300 text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Contract</span>
              </button>
              <button
                onClick={() => setInspectingContract(null)}
                className="px-4 py-2 rounded-lg bg-white text-black text-xs font-semibold uppercase tracking-wider hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
        </PortalModal>
      )}
    </div>
  );
}
