export interface AdvocateContract {
  id: string;
  advocateName: string;
  barRegNo: string;
  email?: string;
  contractType: "Empanelment Agreement" | "Retainer Agreement" | "Confidentiality & Data Protection MoU" | "Chambers Partnership" | "Other";
  executionDate: string; // YYYY-MM-DD
  expiryDate?: string; // YYYY-MM-DD or "Perpetual"
  status: "Active" | "Under Review" | "Terminated" | "Expired";
  fileName: string;
  fileSize?: string;
  fileDataUrl?: string; // Base64 data URL or document link
  feeTerms?: string; // e.g. "80/20 Retainer Escrow"
  notes?: string;
  uploadedAt: string;
}

const STORAGE_KEY = "trana_advocate_contracts";

export const DEFAULT_CONTRACTS: AdvocateContract[] = [
  {
    id: "contract-krish-chauhan-2026",
    advocateName: "Adv. Krish Chauhan",
    barRegNo: "D/2104/2021",
    email: "ckhraiushh1@gmail.com",
    contractType: "Empanelment Agreement",
    executionDate: "2026-01-15",
    expiryDate: "2028-01-14",
    status: "Active",
    fileName: "TRANA_Advocate_Empanelment_Adv_Krish_Chauhan_D21042021.pdf",
    fileSize: "1.4 MB",
    feeTerms: "Direct First-Aid & Retainer Escrow Integration",
    notes: "Formal State Bar Council of Delhi verified empanelment contract covering High Court criminal trial and bail consultations.",
    uploadedAt: "2026-01-15T10:30:00.000Z",
  },
  {
    id: "contract-siddharth-rao-2026",
    advocateName: "Adv. Siddharth K. Rao",
    barRegNo: "D/1492/2019",
    email: "siddharth.rao@delhihighcourt.law",
    contractType: "Confidentiality & Data Protection MoU",
    executionDate: "2026-02-01",
    expiryDate: "2027-01-31",
    status: "Active",
    fileName: "TRANA_Confidentiality_Data_Protection_MoU_Adv_Siddharth_Rao.pdf",
    fileSize: "890 KB",
    feeTerms: "Zero-Knowledge Vault Privileges & Quashing Petition Retainer",
    notes: "Restricted client file vault agreement ensuring Section 126 Evidence Act professional communications privilege.",
    uploadedAt: "2026-02-01T14:15:00.000Z",
  },
  {
    id: "contract-meenakshi-sundaram-2026",
    advocateName: "Adv. Meenakshi Sundaram",
    barRegNo: "MAH/3920/2017",
    email: "meenakshi.sundaram@bombayhighcourt.law",
    contractType: "Retainer Agreement",
    executionDate: "2026-03-10",
    expiryDate: "2027-03-09",
    status: "Active",
    fileName: "TRANA_Retainer_Agreement_Adv_Meenakshi_Sundaram.pdf",
    fileSize: "1.1 MB",
    feeTerms: "Supreme Court Special Leave Petition Consultations",
    notes: "Institutional retainer covering complex commercial arbitration and appellate writ consultations.",
    uploadedAt: "2026-03-10T11:00:00.000Z",
  },
];

export function getStoredAdvocateContracts(): AdvocateContract[] {
  if (typeof window === "undefined") return DEFAULT_CONTRACTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    // Initialize default seeds
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CONTRACTS));
    return DEFAULT_CONTRACTS;
  } catch {
    return DEFAULT_CONTRACTS;
  }
}

export function saveAdvocateContract(contract: AdvocateContract): void {
  if (typeof window === "undefined") return;
  try {
    const current = getStoredAdvocateContracts();
    const existingIndex = current.findIndex((c) => c.id === contract.id);
    let updated: AdvocateContract[];
    if (existingIndex !== -1) {
      updated = [...current];
      updated[existingIndex] = contract;
    } else {
      updated = [contract, ...current];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("trana_contracts_updated"));
    window.dispatchEvent(new Event("storage"));
  } catch (err) {
    console.warn("Failed to persist advocate contract:", err);
  }
}

export function deleteAdvocateContract(contractId: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = getStoredAdvocateContracts();
    const updated = current.filter((c) => c.id !== contractId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("trana_contracts_updated"));
    window.dispatchEvent(new Event("storage"));
  } catch (err) {
    console.warn("Failed to delete advocate contract:", err);
  }
}
