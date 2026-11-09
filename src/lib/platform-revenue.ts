export interface RevenueTransaction {
  id: string;
  referenceNo: string;
  payerName: string;
  payerType: "Citizen" | "Law Firm" | "Corporate" | "Academic Institution";
  serviceCategory: "Advocate Retainer Consultation" | "AI Memorial Drafter Pro" | "Statutory Precedent Research" | "Emergency Bail First-Aid" | "Institutional Campus License";
  amountInInr: number;
  paymentMethod: "UPI" | "Net Banking" | "Stripe INR" | "Direct Escrow";
  status: "Settled" | "Processing" | "Escrow Held";
  transactionDate: string; // ISO string
  notes?: string;
}

const STORAGE_KEY = "trana_platform_revenue_ledger";

export const DEFAULT_REVENUE_TRANSACTIONS: RevenueTransaction[] = [
  {
    id: "tx-rev-1001",
    referenceNo: "TRN-UPI-984210",
    payerName: "Rajiv Malhotra",
    payerType: "Citizen",
    serviceCategory: "Advocate Retainer Consultation",
    amountInInr: 4500,
    paymentMethod: "UPI",
    status: "Settled",
    transactionDate: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    notes: "High Court Anticipatory Bail Consultation Retainer with Adv. Krish Chauhan.",
  },
  {
    id: "tx-rev-1002",
    referenceNo: "TRN-STRIPE-441209",
    payerName: "Shardul Amarchand Chambers (Litigation Desk)",
    payerType: "Law Firm",
    serviceCategory: "AI Memorial Drafter Pro",
    amountInInr: 24999,
    paymentMethod: "Stripe INR",
    status: "Settled",
    transactionDate: new Date(Date.now() - 3600 * 1000 * 18).toISOString(),
    notes: "Chamber Enterprise Annual License for Memorial Drafter & Precedent Search.",
  },
  {
    id: "tx-rev-1003",
    referenceNo: "TRN-NB-300184",
    payerName: "Karan Singhania",
    payerType: "Citizen",
    serviceCategory: "Emergency Bail First-Aid",
    amountInInr: 3500,
    paymentMethod: "Net Banking",
    status: "Settled",
    transactionDate: new Date(Date.now() - 3600 * 1000 * 36).toISOString(),
    notes: "Urgent FIR Analysis and Police Station Legal First-Aid consultation escrow.",
  },
  {
    id: "tx-rev-1004",
    referenceNo: "TRN-UPI-771230",
    payerName: "National Law University Scholars Association",
    payerType: "Academic Institution",
    serviceCategory: "Institutional Campus License",
    amountInInr: 48000,
    paymentMethod: "Net Banking",
    status: "Settled",
    transactionDate: new Date(Date.now() - 3600 * 1000 * 72).toISOString(),
    notes: "Academic batch access for Moot Court Memorial AI drafter (120 scholars).",
  },
  {
    id: "tx-rev-1005",
    referenceNo: "TRN-UPI-551029",
    payerName: "Ananya Deshmukh",
    payerType: "Citizen",
    serviceCategory: "Advocate Retainer Consultation",
    amountInInr: 5000,
    paymentMethod: "UPI",
    status: "Settled",
    transactionDate: new Date(Date.now() - 3600 * 1000 * 96).toISOString(),
    notes: "Section 528 BNSS Quashing Petition Advisory with Adv. Siddharth K. Rao.",
  },
  {
    id: "tx-rev-1006",
    referenceNo: "TRN-STRIPE-881920",
    payerName: "Verma & Associates Legal",
    payerType: "Law Firm",
    serviceCategory: "Statutory Precedent Research",
    amountInInr: 15000,
    paymentMethod: "Stripe INR",
    status: "Settled",
    transactionDate: new Date(Date.now() - 3600 * 1000 * 140).toISOString(),
    notes: "Quarterly Statutory AI Precedent and Citation Research Pass.",
  },
];

export function getRevenueTransactions(): RevenueTransaction[] {
  if (typeof window === "undefined") return DEFAULT_REVENUE_TRANSACTIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_REVENUE_TRANSACTIONS));
    return DEFAULT_REVENUE_TRANSACTIONS;
  } catch {
    return DEFAULT_REVENUE_TRANSACTIONS;
  }
}

export function saveRevenueTransaction(tx: RevenueTransaction): void {
  if (typeof window === "undefined") return;
  try {
    const current = getRevenueTransactions();
    const updated = [tx, ...current];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("trana_revenue_updated"));
    window.dispatchEvent(new Event("storage"));
  } catch (err) {
    console.warn("Failed to persist revenue transaction:", err);
  }
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
