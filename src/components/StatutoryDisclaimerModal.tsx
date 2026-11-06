import { useState, useEffect } from "react";
import { Shield, ShieldAlert, Check, ArrowRight, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface StatutoryDisclaimerModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export function StatutoryDisclaimerModal({ forceOpen = false, onClose }: StatutoryDisclaimerModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [isDeclined, setIsDeclined] = useState(false);

  useEffect(() => {
    // If explicitly forced open (e.g. from footer link)
    if (forceOpen) {
      setIsOpen(true);
      setIsDeclined(false);
      return;
    }

    // Check if user has already agreed
    if (typeof window !== "undefined") {
      const accepted = localStorage.getItem("trana_statutory_disclaimer_accepted");
      if (accepted !== "true") {
        setIsOpen(true);
      }
    }

    // Listen to global open event
    function handleOpenEvent() {
      setIsDeclined(false);
      setIsOpen(true);
    }
    window.addEventListener("open_statutory_disclaimer", handleOpenEvent);
    return () => window.removeEventListener("open_statutory_disclaimer", handleOpenEvent);
  }, [forceOpen]);

  // Lock body scroll when modal is active
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  async function handleAccept() {
    if (!agreed) return;

    if (typeof window !== "undefined") {
      localStorage.setItem("trana_statutory_disclaimer_accepted", "true");
      localStorage.setItem("trana_statutory_disclaimer_accepted_at", new Date().toISOString());
      localStorage.setItem("trana_disclaimer_accepted_all", "true");
    }

    // Attempt to log acceptance in Supabase if a user session exists
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const u = session.user;
        const { data: existing } = await supabase
          .from("advocate_disclaimers")
          .select("id")
          .or(`user_id.eq.${u.id},user_email.eq.${u.email || ""}`)
          .limit(1)
          .maybeSingle();

        if (!existing) {
          await supabase.from("advocate_disclaimers").insert({
            user_id: u.id,
            user_email: u.email,
            user_name: (u.user_metadata?.full_name as string) || u.email?.split("@")[0] || "Citizen User",
            notice_text: "Bar Council of India Statutory Disclaimer & User Volition Accepted",
          });
        }
      }
    } catch {
      // ignore
    }

    setIsOpen(false);
    if (onClose) onClose();
  }

  function handleDecline() {
    setIsDeclined(true);
  }

  function handleExit() {
    if (typeof window !== "undefined") {
      window.location.href = "https://www.google.com";
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 sm:p-4 md:p-6 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-white/15 bg-[#0a0a0a]/95 text-neutral-100 shadow-[0_25px_70px_rgba(0,0,0,0.85)] backdrop-blur-2xl overflow-hidden">
        {/* Apple subtle light reflection edge */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        {isDeclined ? (
          /* Declined Access State */
          <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center my-auto">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 text-red-400 mb-5">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-medium text-white mb-3">
              Access Restricted
            </h3>
            <p className="max-w-md text-sm text-neutral-400 leading-relaxed mb-6 font-light">
              Under the rules of the Bar Council of India, access to TRANA requires voluntary acknowledgement that you are seeking legal information of your own accord, with no form of advertisement or solicitation.
            </p>
            <p className="max-w-md text-xs text-neutral-500 leading-relaxed mb-8">
              Because you did not agree to the statutory disclaimer, access to this platform cannot be granted at this time.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIsDeclined(false)}
                className="rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 px-6 py-2.5 text-xs font-medium uppercase tracking-wider text-white transition-colors"
              >
                Review Disclaimer Again
              </button>
              <button
                type="button"
                onClick={handleExit}
                className="rounded-lg bg-white px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-black hover:bg-neutral-200 transition-colors"
              >
                Exit Website
              </button>
            </div>
          </div>
        ) : (
          /* Main Statutory Disclaimer Modal View */
          <>
            {/* Header */}
            <div className="border-b border-white/10 px-6 py-5 sm:px-8 sm:py-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[0.68rem] font-mono uppercase tracking-[0.2em] text-amber-300">
                <Shield className="h-3 w-3" />
                Bar Council of India Compliance
              </div>
              <h2 id="disclaimer-title" className="mt-3 font-display text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                Statutory Disclaimer & Acknowledgement
              </h2>
              <p className="mt-1 text-xs text-neutral-400">
                Please review and acknowledge the following statutory terms before accessing TRANA.
              </p>
            </div>

            {/* Scrollable Disclaimer Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 sm:px-8 sm:py-6 space-y-4 text-xs sm:text-[13px] leading-relaxed text-neutral-300 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-neutral-200 leading-relaxed font-light">
                The Bar Council of India does not permit advertisement or solicitation by advocates in any form or manner. TRANA is an independent legal information and technology platform, and is <strong>NOT a law firm</strong>. By accessing this website (www.trana.in or any associated TRANA domains), you acknowledge, confirm, and agree that:
              </div>

              <div className="space-y-4">
                <div className="border-l-2 border-white/20 pl-3">
                  <h4 className="font-semibold text-white text-xs uppercase tracking-wider">1. User Volition & Non-Solicitation</h4>
                  <p className="mt-1 text-neutral-400 font-light">
                    You are seeking information relating to TRANA, its legal education resources, and legal first-aid tools of your own accord and volition. There has been no form of solicitation, advertisement, personal communication, invitation, or inducement of any sort whatsoever by TRANA, its founders, directors, employees, or any advocate or legal professional listed on or associated with it.
                  </p>
                </div>

                <div className="border-l-2 border-white/20 pl-3">
                  <h4 className="font-semibold text-white text-xs uppercase tracking-wider">2. Legal Information Platform — Not Legal Advice</h4>
                  <p className="mt-1 text-neutral-400 font-light">
                    This website should not be construed as providing legal advice for any purpose. All information, content, statutory summaries, case law extracts, procedural workflows, and content generated by its AI tools and algorithms are for general informational and educational purposes only. Content generated by TRANA or its automated tools should not be interpreted as soliciting or advertising.
                  </p>
                </div>

                <div className="border-l-2 border-white/20 pl-3">
                  <h4 className="font-semibold text-white text-xs uppercase tracking-wider">3. No Advocate-Client Relationship</h4>
                  <p className="mt-1 text-neutral-400 font-light">
                    Any information obtained or material downloaded from this website is completely at your own volition. Any transmission, receipt, access, or use of this website, including communications through automated assistance or preliminary intake channels, does not create, and is not intended to create, an advocate-client or lawyer-client relationship between you and TRANA, its founders, or any advocate.
                  </p>
                </div>

                <div className="border-l-2 border-white/20 pl-3">
                  <h4 className="font-semibold text-white text-xs uppercase tracking-wider">4. Legal First-Aid Guide — Not a Substitute for Counsel</h4>
                  <p className="mt-1 text-neutral-400 font-light">
                    TRANA is a guide designed to assist you in difficult circumstances and help you reach a qualified lawyer; it is not a substitute for one. Readers of this website or recipients of content or information available on this website should not act or refrain from acting based on any or all such content or information, and should always seek the independent advice of competent legal counsel licensed to practice in the appropriate jurisdiction.
                  </p>
                </div>

                <div className="border-l-2 border-white/20 pl-3">
                  <h4 className="font-semibold text-white text-xs uppercase tracking-wider">5. Limitation of Liability & Up-to-Date Information</h4>
                  <p className="mt-1 text-neutral-400 font-light">
                    Information on this website may not constitute the most up-to-date legal or other information. TRANA shall not be liable for the consequences of any action taken or omitted by any person based on any material, answers, AI-generated outputs, or information available on this website, or for any inaccuracy in or exclusion of any information or interpretation thereof.
                  </p>
                </div>

                <div className="border-l-2 border-white/20 pl-3">
                  <h4 className="font-semibold text-white text-xs uppercase tracking-wider">6. Third-Party Links & External Operators</h4>
                  <p className="mt-1 text-neutral-400 font-light">
                    Third-party links contained on this website redirecting users to external portals (such as e-Courts or official government repositories) should neither be construed as legal reference / legal advice, nor considered as referrals to, endorsements of, or affiliations with any such third-party website operators.
                  </p>
                </div>

                <div className="border-l-2 border-white/20 pl-3">
                  <h4 className="font-semibold text-white text-xs uppercase tracking-wider">7. Platform Communication & Neutrality</h4>
                  <p className="mt-1 text-neutral-400 font-light">
                    The communication platform and preliminary messaging relays provided on this website should not be used for the exchange of unredacted, business-critical, or politically sensitive confidential information prior to establishing a formalized advocate-client engagement.
                  </p>
                </div>

                <div className="border-l-2 border-white/20 pl-3">
                  <h4 className="font-semibold text-white text-xs uppercase tracking-wider">8. Intellectual Property</h4>
                  <p className="mt-1 text-neutral-400 font-light">
                    All contents, software architecture, text, designs, algorithms, and intellectual property on this website are the exclusive intellectual property of TRANA.
                  </p>
                </div>

                <div className="border-l-2 border-white/20 pl-3">
                  <h4 className="font-semibold text-white text-xs uppercase tracking-wider">9. Privacy & Terms of Use</h4>
                  <p className="mt-1 text-neutral-400 font-light">
                    We prioritize your privacy. Before proceeding, we encourage you to read our Terms of Use and Privacy Policy to understand how we handle your data:
                  </p>
                  <ul className="mt-2 space-y-1 list-disc list-inside text-neutral-400 pl-1 font-light text-xs">
                    <li>The types of information we collect and why we collect them.</li>
                    <li>How we use your information to provide a personalized experience.</li>
                    <li>The measures we take to ensure the security of your data.</li>
                    <li>Your rights and choices in managing your personal information.</li>
                    <li>How we may share information with trusted partners for specific purposes.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Footer with Mandatory Agreement Checkbox and Actions */}
            <div className="border-t border-white/10 bg-[#0d0d0d] px-6 py-4 sm:px-8 sm:py-5">
              <label className="flex items-start gap-3 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-white accent-white focus:ring-1 focus:ring-white transition-all cursor-pointer"
                />
                <span className="text-xs text-neutral-300 leading-normal group-hover:text-white transition-colors">
                  I acknowledge that I am seeking information relating to TRANA of my own volition, confirm there has been no solicitation or advertisement by TRANA or any advocate, and agree to the statutory terms, Terms of Use, and Privacy Policy.
                </span>
              </label>

              <div className="mt-4 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDecline}
                  className="w-full sm:w-auto rounded-lg border border-white/15 px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-neutral-400 hover:text-white hover:border-white/30 transition-colors text-center"
                >
                  Decline & Leave
                </button>

                <button
                  type="button"
                  disabled={!agreed}
                  onClick={handleAccept}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                    agreed
                      ? "bg-white text-black hover:bg-neutral-200 shadow-[0_0_20px_rgba(255,255,255,0.2)] cursor-pointer"
                      : "bg-white/20 text-neutral-400 cursor-not-allowed border border-white/5"
                  }`}
                >
                  <span>I Agree & Enter</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

