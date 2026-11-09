import { useState, useEffect } from "react";
import { 
  Video, BookOpen, Calendar, Sparkles, ExternalLink, X, ChevronRight, 
  ChevronLeft, Bell, Users, CheckCircle2 
} from "lucide-react";
import { toast } from "sonner";
import { 
  BroadcastAnnouncement, 
  getBroadcastAnnouncements 
} from "@/lib/broadcast-announcements";

interface MassAnnouncementBannerProps {
  currentDashboard?: "citizens" | "lawyers" | "students" | "founders";
  className?: string;
}

export function MassAnnouncementBanner({ currentDashboard = "citizens", className = "" }: MassAnnouncementBannerProps) {
  const [announcements, setAnnouncements] = useState<BroadcastAnnouncement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    function load() {
      const all = getBroadcastAnnouncements();
      const active = all.filter((a) => {
        if (!a.isActive) return false;
        if (a.targetAudience === "All Dashboards") return true;
        if (currentDashboard === "citizens" && a.targetAudience === "Citizens") return true;
        if (currentDashboard === "lawyers" && a.targetAudience === "Lawyers") return true;
        if (currentDashboard === "students" && a.targetAudience === "Students & Interns") return true;
        return true;
      });
      // Sort pinned first, then newest
      active.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setAnnouncements(active);
    }
    load();
    window.addEventListener("trana_announcements_updated", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("trana_announcements_updated", load);
      window.removeEventListener("storage", load);
    };
  }, [currentDashboard]);

  if (isDismissed || announcements.length === 0) return null;

  const current = announcements[currentIndex % announcements.length];

  const getCategoryBadge = (cat: BroadcastAnnouncement["category"]) => {
    switch (cat) {
      case "Webinar":
        return {
          icon: Video,
          label: "Live National Webinar",
          bg: "bg-purple-500/15 border-purple-500/30 text-purple-300",
        };
      case "Research Sharing":
        return {
          icon: BookOpen,
          label: "Research Whitepaper",
          bg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
        };
      case "Workshop":
        return {
          icon: Sparkles,
          label: "Interactive Workshop",
          bg: "bg-sky-500/15 border-sky-500/30 text-sky-300",
        };
      default:
        return {
          icon: Calendar,
          label: "Platform Event",
          bg: "bg-amber-500/15 border-amber-500/30 text-amber-300",
        };
    }
  };

  const badge = getCategoryBadge(current.category);
  const BadgeIcon = badge.icon;

  const handleActionClick = () => {
    if (current.category === "Research Sharing") {
      toast.success(`Accessing whitepaper: ${current.title}`);
    } else {
      setIsRegistered(true);
      toast.success(`Seat reserved for "${current.title}". Registration link opened!`);
    }
    if (current.eventLink && current.eventLink !== "#") {
      window.open(current.eventLink, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-r from-[#14101e]/90 via-[#0e0f17]/90 to-[#121622]/90 backdrop-blur-xl p-4 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] transition-all ${className}`}>
      {/* Subtle ambient gradient sheen */}
      <div className="absolute top-0 right-0 w-80 h-32 bg-purple-500/[0.07] blur-[70px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-64 h-24 bg-sky-500/[0.05] blur-[60px] pointer-events-none -z-10" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Content */}
        <div className="space-y-2 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider border ${badge.bg}`}>
              <BadgeIcon className="h-3 w-3" />
              <span>{badge.label}</span>
            </span>

            {current.isPinned && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-amber-400/20 text-amber-300 border border-amber-400/30">
                PINNED MASS BROADCAST
              </span>
            )}

            <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1">
              <Calendar className="h-3 w-3 text-neutral-500" />
              <span>{current.scheduledTime}</span>
            </span>
          </div>

          <h3 className="font-display text-base sm:text-lg font-medium text-white tracking-tight leading-snug">
            {current.title}
          </h3>

          <p className="text-xs text-neutral-300 leading-relaxed line-clamp-2 max-w-4xl font-sans">
            {current.description}
          </p>

          <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400 pt-0.5">
            <span className="text-neutral-500">Host / Directorate:</span>
            <span className="text-neutral-300 font-medium truncate">{current.speakerOrHost}</span>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
          <button
            onClick={handleActionClick}
            className="bg-white hover:bg-neutral-200 text-black px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider font-mono flex items-center gap-1.5 shadow-md transition-all cursor-pointer whitespace-nowrap"
          >
            {isRegistered ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Confirmed</span>
              </>
            ) : (
              <>
                <span>{current.actionLabel || (current.category === "Research Sharing" ? "Access Paper" : "Join Event")}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </>
            )}
          </button>

          {announcements.length > 1 && (
            <div className="flex items-center gap-1 bg-white/[0.05] p-1 rounded-full border border-white/10">
              <button
                onClick={() => setCurrentIndex((idx) => (idx - 1 + announcements.length) % announcements.length)}
                className="p-1 rounded-full text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title="Previous announcement"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-[10px] font-mono text-neutral-400 px-1">
                {(currentIndex % announcements.length) + 1}/{announcements.length}
              </span>
              <button
                onClick={() => setCurrentIndex((idx) => (idx + 1) % announcements.length)}
                className="p-1 rounded-full text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title="Next announcement"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Dismiss announcement banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
