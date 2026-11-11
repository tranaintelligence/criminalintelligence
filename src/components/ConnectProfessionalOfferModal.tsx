/**
 * ConnectProfessionalOfferModal.tsx
 * 
 * Provides:
 * 1. Upfront notice that private advocate consultations are chargeable.
 * 2. Neutral advocate directory grouped by Practice Area and City/State (no ranking or specific endorsement).
 * 3. District Legal Services Authority (DLSA) / NALSA 15100 free legal aid routing with ready-to-send
 *    WhatsApp and Email drafts for families unable to afford private fees.
 */

import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  Scale, ShieldAlert, Phone, MessageSquare, Copy, Check, ExternalLink, 
  MapPin, X, AlertTriangle, ArrowRight, HeartHandshake, Building2, User
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPublicLawyers, LawyerRecord } from "@/lib/trana-admin-api";
import { groupLawyersByPracticeAndCity, NALSA_HELPLINE } from "@/lib/lawyer-groups";

interface ConnectProfessionalOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopic?: string;
  userDistrict?: string;
  initialView?: "notice" | "directory" | "free_aid";
}

export const ConnectProfessionalOfferModal: React.FC<ConnectProfessionalOfferModalProps> = ({
  isOpen,
  onClose,
  initialTopic = "General Legal Matter",
  userDistrict = "District",
  initialView = "notice",
}) => {
  // Navigation inside modal: "chargeable_notice" -> "lawyer_list" | "free_legal_aid"
  const [view, setView] = useState<"notice" | "directory" | "free_aid">(initialView);
  const [lawyers, setLawyers] = useState<LawyerRecord[]>([]);
  const [loadingLawyers, setLoadingLawyers] = useState(false);
  const [selectedPracticeArea, setSelectedPracticeArea] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Free legal aid draft customization
  const [clientName, setClientName] = useState("");
  const [clientDistrict, setClientDistrict] = useState(userDistrict === "District" ? "" : userDistrict);
  const [clientState, setClientState] = useState("");
  const [copiedDraft, setCopiedDraft] = useState<"whatsapp" | "email" | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync initial view when opening
  useEffect(() => {
    if (isOpen && initialView) {
      setView(initialView);
    }
  }, [isOpen, initialView]);

  // Load verified lawyers when opening modal
  useEffect(() => {
    if (!isOpen) {
      setView(initialView);
      return;
    }

    let isMounted = true;
    async function loadDirectory() {
      setLoadingLawyers(true);
      try {
        const apiLawyers = await getPublicLawyers().catch(() => []);
        if (apiLawyers && apiLawyers.length > 0 && isMounted) {
          setLawyers(apiLawyers);
          return;
        }

        // Fallback to Supabase
        const { data } = await supabase
          .from("lawyers")
          .select("id, full_name, specialisation, city, state, bar_reg_no, experience_years, consultation_fee, offers_call, offers_chat, phone, email")
          .order("full_name", { ascending: true })
          .limit(100);

        if (data && isMounted) {
          setLawyers(data as LawyerRecord[]);
        }
      } catch (e) {
        console.warn("Could not load lawyers for neutral directory:", e);
      } finally {
        if (isMounted) setLoadingLawyers(false);
      }
    }

    loadDirectory();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Group lawyers strictly by practice area and city/state
  const advocateGroups = useMemo(() => {
    return groupLawyersByPracticeAndCity(lawyers);
  }, [lawyers]);

  // Extract distinct practice areas and cities for neutral filtering
  const distinctAreas = useMemo(() => {
    const set = new Set<string>();
    lawyers.forEach((l) => {
      if (l.specialisation) set.add(l.specialisation);
    });
    return Array.from(set).sort();
  }, [lawyers]);

  const distinctCities = useMemo(() => {
    const set = new Set<string>();
    lawyers.forEach((l) => {
      if (l.city) set.add(l.city);
    });
    return Array.from(set).sort();
  }, [lawyers]);

  // Filtered neutral list (sorted alphabetically by full name - strictly neutral)
  const filteredAdvocates = useMemo(() => {
    return lawyers
      .filter((l) => {
        const matchesArea = selectedPracticeArea === "all" || l.specialisation === selectedPracticeArea;
        const matchesCity = selectedCity === "all" || l.city === selectedCity;
        const matchesSearch =
          !searchQuery.trim() ||
          l.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (l.specialisation && l.specialisation.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (l.city && l.city.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesArea && matchesCity && matchesSearch;
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [lawyers, selectedPracticeArea, selectedCity, searchQuery]);

  if (!isOpen || !mounted || typeof document === "undefined") return null;

  const whatsappText = NALSA_HELPLINE.whatsappDraft(
    clientName || "[Your Full Name]",
    clientDistrict || "[Your District]",
    initialTopic || "[Legal Issue / FIR / Notice]"
  );

  const emailText = NALSA_HELPLINE.emailDraft(
    clientName || "[Your Full Name]",
    clientDistrict || "[Your District]",
    clientState || "[Your State]",
    initialTopic || "[Legal Issue / FIR / Notice]"
  );

  const copyToClipboard = (text: string, type: "whatsapp" | "email") => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedDraft(type);
      toast.success(type === "whatsapp" ? "WhatsApp draft copied!" : "Email draft copied!");
      setTimeout(() => setCopiedDraft(null), 3000);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-3 sm:p-4 md:p-6 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl my-auto border border-[#2a2a2a] bg-[#0c0c0e] text-neutral-100 shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#222] px-5 py-4 bg-[#121215]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-300">
              <Scale className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
                Connect with Legal Representation
              </h2>
              <p className="text-[11px] text-neutral-400 font-mono">
                Statutory First-Aid &middot; Independent Citizen Choice
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/[0.06] hover:text-white transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* VIEW 1: MANDATORY CHARGEABLE NOTICE */}
          {view === "notice" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                <div className="flex items-start gap-3.5">
                  <Scale className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-200">
                      Important Information Regarding Legal Professional Consultations
                    </h3>
                    <p className="mt-2 text-xs text-neutral-300 leading-relaxed">
                      Consulting with a private legal professional is a <strong>chargeable professional service</strong>.
                    </p>
                    <p className="mt-2 text-xs text-neutral-400 font-mono leading-relaxed">
                      &bull; TRANA does not charge any commission or referral cut on professional fees.<br />
                      &bull; TRANA does not recommend or promote any specific legal professional. You must choose entirely independently.<br />
                      &bull; If you or your family cannot afford private legal fees, you are legally entitled to <strong>100% Free Legal Aid</strong> through the District Legal Services Authority (DLSA).
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Option A: Paid Private Advocates */}
                <button
                  type="button"
                  onClick={() => setView("directory")}
                  className="group flex flex-col justify-between text-left p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-emerald-400/40 transition-all cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-300/90 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/25">
                        Chargeable
                      </span>
                      <ArrowRight className="h-4 w-4 text-neutral-500 group-hover:text-emerald-300 group-hover:translate-x-1 transition-all" />
                    </div>
                    <h4 className="text-sm font-semibold text-white group-hover:text-emerald-200">
                      Browse Private Legal Professionals Directory
                    </h4>
                    <p className="mt-1.5 text-xs text-neutral-400 leading-relaxed">
                      Review a neutral, unranked list grouped by practice area and city/state to choose your own legal professional.
                    </p>
                  </div>
                </button>

                {/* Option B: Free Legal Aid via DLSA */}
                <button
                  type="button"
                  onClick={() => setView("free_aid")}
                  className="group flex flex-col justify-between text-left p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-400/60 transition-all cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
                        100% Free / Government
                      </span>
                      <HeartHandshake className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <h4 className="text-sm font-semibold text-emerald-300">
                      Cannot Pay? Free District Legal Aid
                    </h4>
                    <p className="mt-1.5 text-xs text-neutral-300 leading-relaxed">
                      Access NALSA / DLSA free helpline number (15100), plus ready-made WhatsApp &amp; Email draft templates.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* VIEW 2: NEUTRAL DIRECTORY GROUPED BY PRACTICE & CITY */}
          {view === "directory" && (
            <div className="space-y-5">
              {/* Neutrality Disclaimer Banner */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-[#16161a] text-xs text-neutral-300">
                <p className="leading-snug">
                  <span className="font-semibold text-white">Neutral Directory:</span> TRANA does not recommend any specific legal professional. 
                  Legal professionals are arranged neutrally by Practice Area and Jurisdiction.
                </p>
                <button
                  type="button"
                  onClick={() => setView("notice")}
                  className="text-[11px] font-mono text-emerald-300 hover:underline shrink-0 ml-3"
                >
                  &larr; Back
                </button>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={selectedPracticeArea}
                  onChange={(e) => setSelectedPracticeArea(e.target.value)}
                  className="border border-[#2e2e34] bg-[#111114] px-3 py-2 text-xs rounded-lg text-neutral-200 focus:border-amber-400/60 focus:outline-none"
                >
                  <option value="all">All Practice Areas</option>
                  {distinctAreas.map((area) => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="border border-[#2e2e34] bg-[#111114] px-3 py-2 text-xs rounded-lg text-neutral-200 focus:border-amber-400/60 focus:outline-none"
                >
                  <option value="all">All Cities / States</option>
                  {distinctCities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              {/* Grouped / Filtered List */}
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {loadingLawyers ? (
                  <div className="text-center py-12 text-xs font-mono text-neutral-500">
                    Loading verified advocates directory...
                  </div>
                ) : filteredAdvocates.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-white/10 rounded-xl p-6 text-neutral-400">
                    <p className="text-xs">No advocates match this specific filter.</p>
                    <button
                      type="button"
                      onClick={() => { setSelectedPracticeArea("all"); setSelectedCity("all"); setSearchQuery(""); }}
                      className="mt-2 text-xs text-amber-300 font-mono hover:underline"
                    >
                      Reset all filters
                    </button>
                  </div>
                ) : (
                  filteredAdvocates.map((adv) => (
                    <div
                      key={adv.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-white/[0.08] bg-[#121215] hover:border-white/20 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-neutral-400" />
                          <h4 className="text-sm font-semibold text-white">
                            {adv.full_name}
                          </h4>
                          {adv.bar_reg_no && (
                            <span className="text-[10px] font-mono text-neutral-400 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06]">
                              {adv.bar_reg_no}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400">
                          <span className="text-amber-300/90 font-medium">
                            {adv.specialisation || "General Practice"}
                          </span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-neutral-500" />
                            {adv.city}{adv.state ? `, ${adv.state}` : ""}
                          </span>
                          {adv.experience_years !== undefined && adv.experience_years > 0 && (
                            <>
                              <span>&bull;</span>
                              <span>{adv.experience_years} yrs exp</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {adv.offers_call && (
                          <span className="text-[10px] font-mono text-neutral-400 bg-white/[0.04] px-2 py-1 rounded border border-white/[0.08] flex items-center gap-1">
                            <Phone className="h-3 w-3" /> Call
                          </span>
                        )}
                        {adv.offers_chat && (
                          <span className="text-[10px] font-mono text-neutral-400 bg-white/[0.04] px-2 py-1 rounded border border-white/[0.08] flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" /> Chat
                          </span>
                        )}
                        <a
                          href={`/dashboard/lawyers`}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white text-black hover:bg-neutral-200 transition-colors"
                        >
                          Select
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Bottom Aid Link */}
              <div className="border-t border-[#222] pt-3 flex items-center justify-between text-xs text-neutral-400">
                <span>Cannot pay advocate consultation charges?</span>
                <button
                  type="button"
                  onClick={() => setView("free_aid")}
                  className="text-emerald-400 hover:underline font-mono text-[11px]"
                >
                  Direct to District Free Legal Services &rarr;
                </button>
              </div>
            </div>
          )}

          {/* VIEW 3: FREE LEGAL AID ROUTING (NALSA / DLSA) */}
          {view === "free_aid" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setView("notice")}
                  className="text-xs font-mono text-neutral-400 hover:text-white flex items-center gap-1"
                >
                  &larr; Back to Options
                </button>
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Government Legal Aid
                </span>
              </div>

              {/* Helpline Callout */}
              <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-[#0e1612] to-[#0c0c0e] p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                      National Legal Services Authority (NALSA)
                    </span>
                    <h3 className="text-xl font-display font-semibold text-white mt-1">
                      Toll-Free National Helpline: 15100
                    </h3>
                    <p className="text-xs text-neutral-300 mt-1 max-w-xl leading-relaxed">
                      Under Section 12 of the Legal Services Authorities Act, 1987, citizens from economically 
                      weaker sections, women, children, persons in custody, and scheduled castes/tribes are entitled to 
                      completely free legal representation.
                    </p>
                  </div>
                  <a
                    href="tel:15100"
                    className="shrink-0 flex items-center justify-center gap-2 bg-emerald-400 text-black font-semibold text-xs px-5 py-3 rounded-xl hover:bg-emerald-300 transition-colors shadow-lg"
                  >
                    <Phone className="h-4 w-4" />
                    Call 15100 Now
                  </a>
                </div>
              </div>

              {/* Personalization for draft generation */}
              <div className="border border-[#2a2a2e] rounded-xl p-4 bg-[#111114] space-y-3">
                <p className="text-xs font-semibold text-white">
                  Customize Details for Helpline WhatsApp / Email Template:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Your Name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="border border-[#333] bg-[#0c0c0e] px-3 py-2 text-xs rounded-lg text-white focus:border-emerald-400 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Your District"
                    value={clientDistrict}
                    onChange={(e) => setClientDistrict(e.target.value)}
                    className="border border-[#333] bg-[#0c0c0e] px-3 py-2 text-xs rounded-lg text-white focus:border-emerald-400 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Your State"
                    value={clientState}
                    onChange={(e) => setClientState(e.target.value)}
                    className="border border-[#333] bg-[#0c0c0e] px-3 py-2 text-xs rounded-lg text-white focus:border-emerald-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Templates Tabs/Boxes */}
              <div className="space-y-4">
                {/* WhatsApp Template */}
                <div className="border border-white/10 rounded-xl p-4 bg-[#141418] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-emerald-400" />
                      <h4 className="text-xs font-semibold text-white">
                        Draft WhatsApp Message for District Legal Aid Office
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(whatsappText, "whatsapp")}
                        className="text-[11px] font-mono text-neutral-300 hover:text-white px-2.5 py-1 rounded bg-white/[0.06] hover:bg-white/10 flex items-center gap-1.5 transition-colors"
                      >
                        {copiedDraft === "whatsapp" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        {copiedDraft === "whatsapp" ? "Copied" : "Copy Text"}
                      </button>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono text-emerald-400 hover:text-emerald-300 px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Send on WhatsApp
                      </a>
                    </div>
                  </div>
                  <pre className="text-xs text-neutral-300 bg-[#0a0a0c] p-3 rounded-lg border border-[#222] whitespace-pre-wrap font-sans leading-relaxed">
                    {whatsappText}
                  </pre>
                </div>

                {/* Email Template */}
                <div className="border border-white/10 rounded-xl p-4 bg-[#141418] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-amber-400" />
                      <h4 className="text-xs font-semibold text-white">
                        Formal Email Draft to Secretary, DLSA (District Court)
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(emailText, "email")}
                        className="text-[11px] font-mono text-neutral-300 hover:text-white px-2.5 py-1 rounded bg-white/[0.06] hover:bg-white/10 flex items-center gap-1.5 transition-colors"
                      >
                        {copiedDraft === "email" ? <Check className="h-3 w-3 text-amber-400" /> : <Copy className="h-3 w-3" />}
                        {copiedDraft === "email" ? "Copied" : "Copy Draft"}
                      </button>
                      <a
                        href={`mailto:?subject=${encodeURIComponent(`Request for Free Legal Aid - ${clientDistrict || "District"}`)}&body=${encodeURIComponent(emailText)}`}
                        className="text-[11px] font-mono text-amber-300 hover:text-amber-200 px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 flex items-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open Email Client
                      </a>
                    </div>
                  </div>
                  <pre className="text-xs text-neutral-300 bg-[#0a0a0c] p-3 rounded-lg border border-[#222] whitespace-pre-wrap font-sans leading-relaxed">
                    {emailText}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

