export interface BroadcastAnnouncement {
  id: string;
  title: string;
  category: "Webinar" | "Event" | "Research Sharing" | "Workshop";
  targetAudience: "All Dashboards" | "Citizens" | "Lawyers" | "Students & Interns";
  speakerOrHost: string;
  scheduledTime: string; // e.g. "Saturday, 14 Nov 2026 • 5:30 PM IST"
  eventLink?: string; // Meeting link or paper URL
  actionLabel?: string; // e.g. "Register for Webinar" | "Read Whitepaper" | "Join Live Room"
  description: string;
  isPinned: boolean;
  isActive: boolean;
  createdAt: string;
}

const STORAGE_KEY = "trana_broadcast_announcements";

export const DEFAULT_BROADCAST_ANNOUNCEMENTS: BroadcastAnnouncement[] = [
  {
    id: "ann-webinar-bns-2026",
    title: "National Webinar: Navigating Procedural Shifts under Bharatiya Nagarik Suraksha Sanhita (BNSS) 2023",
    category: "Webinar",
    targetAudience: "All Dashboards",
    speakerOrHost: "Adv. Krish Chauhan & Senior Advocates, High Court of Delhi",
    scheduledTime: "Saturday, 14 Nov 2026 • 5:30 PM IST",
    eventLink: "https://meet.google.com/trana-bnss-webinar",
    actionLabel: "Register for Live Webinar",
    description: "An in-depth procedural masterclass on Section 482 CrPC vs Section 528 BNSS quashing petitions, audio-video electronic seizure protocols, and anticipatory bail requirements.",
    isPinned: true,
    isActive: true,
    createdAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
  },
  {
    id: "ann-research-anticipatory-bail",
    title: "Empirical Whitepaper: First 1,000 Days of Section 528 BNSS & Judicial Disposition Trends",
    category: "Research Sharing",
    targetAudience: "All Dashboards",
    speakerOrHost: "TRANA Legal Research Directorate & NLU Delhi Scholar Fellows",
    scheduledTime: "Published • Academic Winter Edition 2026",
    eventLink: "#research-whitepaper-528",
    actionLabel: "Access Full Whitepaper (PDF)",
    description: "Empirical judicial telemetry analyzing high court admission ratios, police notice procedures under BNSS 35(3), and constitutional validity benchmarks.",
    isPinned: false,
    isActive: true,
    createdAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
  },
  {
    id: "ann-workshop-drafter-memorials",
    title: "National Moot Court & Memorial Drafting Intensive Workshop",
    category: "Workshop",
    targetAudience: "All Dashboards",
    speakerOrHost: "Adv. Siddharth K. Rao (Supreme Court Practice Desk)",
    scheduledTime: "Sunday, 22 Nov 2026 • 11:00 AM IST",
    eventLink: "https://meet.google.com/trana-memorial-drafter",
    actionLabel: "Join Masterclass",
    description: "Hands-on training for young advocates and law students on leveraging TRANA AI Drafter to construct air-tight petition memorials, case citations, and prayer structures.",
    isPinned: false,
    isActive: true,
    createdAt: new Date(Date.now() - 3600 * 1000 * 96).toISOString(),
  },
];

export function getBroadcastAnnouncements(): BroadcastAnnouncement[] {
  if (typeof window === "undefined") return DEFAULT_BROADCAST_ANNOUNCEMENTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_BROADCAST_ANNOUNCEMENTS));
    return DEFAULT_BROADCAST_ANNOUNCEMENTS;
  } catch {
    return DEFAULT_BROADCAST_ANNOUNCEMENTS;
  }
}

export function saveBroadcastAnnouncement(announcement: BroadcastAnnouncement): void {
  if (typeof window === "undefined") return;
  try {
    const current = getBroadcastAnnouncements();
    const existingIndex = current.findIndex((a) => a.id === announcement.id);
    let updated: BroadcastAnnouncement[];
    if (existingIndex !== -1) {
      updated = [...current];
      updated[existingIndex] = announcement;
    } else {
      updated = [announcement, ...current];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("trana_announcements_updated"));
    window.dispatchEvent(new Event("storage"));
  } catch (err) {
    console.warn("Failed to persist broadcast announcement:", err);
  }
}

export function deleteBroadcastAnnouncement(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = getBroadcastAnnouncements();
    const updated = current.filter((a) => a.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("trana_announcements_updated"));
    window.dispatchEvent(new Event("storage"));
  } catch (err) {
    console.warn("Failed to delete broadcast announcement:", err);
  }
}

export function togglePinAnnouncement(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = getBroadcastAnnouncements();
    const updated = current.map((a) => (a.id === id ? { ...a, isPinned: !a.isPinned } : a));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("trana_announcements_updated"));
    window.dispatchEvent(new Event("storage"));
  } catch (err) {
    console.warn("Failed to toggle announcement pin:", err);
  }
}

export function toggleActiveAnnouncement(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = getBroadcastAnnouncements();
    const updated = current.map((a) => (a.id === id ? { ...a, isActive: !a.isActive } : a));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("trana_announcements_updated"));
    window.dispatchEvent(new Event("storage"));
  } catch (err) {
    console.warn("Failed to toggle announcement active state:", err);
  }
}

