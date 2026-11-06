import { useState, useEffect } from "react";
import { Shield, ShieldAlert, Check, ArrowRight, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export async function syncUserStatutoryAcknowledgement(user?: {
  id?: string | null;
  email?: string | null;
  name?: string | null;
} | null) {
  if (typeof window === "undefined") return;

  const isAccepted =
    localStorage.getItem("trana_statutory_disclaimer_accepted") === "true" ||
    document.cookie.includes("trana_statutory_disclaimer_accepted=true");

  if (!isAccepted) return;

  // Resolve user info from argument, localStorage, or Supabase
  let email = user?.email?.trim().toLowerCase();
  let name = user?.name?.trim();
  let userId = user?.id || null;

  if (!email) {
    try {
      const stored = localStorage.getItem("trana_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.email) {
          email = parsed.email.trim().toLowerCase();
          name = parsed.name || parsed.email.split("@")[0];
          userId = parsed.id || null;
        }
      }
    } catch {}
  }

  if (!email) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        email = session.user.email.trim().toLowerCase();
        name = (session.user.user_metadata?.full_name as string) || session.user.email.split("@")[0];
        userId = session.user.id || null;
      }
    } catch {}
  }

  // If user is not yet signed in, DO NOT add to list. Wait till user signs in!
  if (!email || email.includes("visitor") || email === "—") return;

  const finalName = name || email.split("@")[0] || "Citizen User";

  // Check if this user email is already recorded in advocate_disclaimers with Platform Disclaimer
  try {
    const { data: existing } = await supabase
      .from("advocate_disclaimers")
      .select("id")
      .eq("user_email", email)
      .limit(1)
      .maybeSingle();

    if (!existing) {
      await supabase.from("advocate_disclaimers").insert({
        user_id: userId,
        user_email: email,
        user_name: finalName,
        notice_text: "Platform Statutory Disclaimer & User Volition Accepted",
      });
    }
  } catch (err) {
    console.warn("Could not sync user acknowledgement:", err);
  }

  // Update localStorage audit log, removing any anonymous entries
  try {
    const raw = localStorage.getItem("trana_all_user_acknowledgements");
    const list = raw ? JSON.parse(raw) : [];
    const cleaned = Array.isArray(list)
      ? list.filter((l: any) => l.user_email && !l.user_email.includes("visitor") && l.user_email !== "—")
      : [];

    if (!cleaned.some((l: any) => (l.user_email || "").toLowerCase() === email)) {
      cleaned.unshift({
        id: `ACK-${Date.now()}`,
        user_id: userId,
        user_email: email,
        user_name: finalName,
        notice_text: "Platform Statutory Disclaimer & User Volition Accepted",
        accepted_at: new Date().toISOString(),
      });
    }
    localStorage.setItem("trana_all_user_acknowledgements", JSON.stringify(cleaned));
    window.dispatchEvent(new Event("trana_user_acknowledgement_logged"));
  } catch {}
}

interface StatutoryDisclaimerModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export function StatutoryDisclaimerModal({ forceOpen = false, onClose }: StatutoryDisclaimerModalProps) {
  // Check if user has previously accepted the statutory acknowledgment
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    const localAccepted = localStorage.getItem("trana_statutory_disclaimer_accepted") === "true";
    const cookieAccepted = document.cookie.includes("trana_statutory_disclaimer_accepted=true");
    return !localAccepted && !cookieAccepted;
  });
  const [agreed, setAgreed] = useState(false);
  const [isDeclined, setIsDeclined] = useState(false);

  useEffect(() => {
    // If user is signed in or when auth state changes, sync their acknowledgement with real email
    syncUserStatutoryAcknowledgement();

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        syncUserStatutoryAcknowledgement({
          id: session.user.id,
          email: session.user.email,
          name: (session.user.user_metadata?.full_name as string) || session.user.email.split("@")[0],
        });
      }
    });

    return () => {
      authSub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Listen to global open event (e.g. from footer link or manual trigger)
    function handleOpenEvent() {
      setIsDeclined(false);
      setIsOpen(true);
      setAgreed(false);
    }
    window.addEventListener("open_statutory_disclaimer", handleOpenEvent);
    return () => window.removeEventListener("open_statutory_disclaimer", handleOpenEvent);
  }, []);

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      setAgreed(false);
      setIsDeclined(false);
    }
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
    // Persist acceptance in localStorage and cookie so it never re-prompts on page reload
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("trana_statutory_disclaimer_accepted", "true");
        document.cookie = "trana_statutory_disclaimer_accepted=true; path=/; max-age=31536000; SameSite=Lax";
      } catch {
        // ignore
      }
    }

    // If user is already signed in, record with their email; otherwise wait till they sign in
    await syncUserStatutoryAcknowledgement();

    setIsOpen(false);
    if (onClose) onClose();
  }

  function handleLeave() {
    if (typeof window !== "undefined") {
      window.location.href = "https://www.google.com";
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-2 sm:p-4 md:p-6 lg:p-8 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
    >
      <div className="relative flex h-[92vh] max-h-[96vh] w-[96vw] max-w-5xl lg:max-w-6xl flex-col rounded-2xl border border-white/15 bg-[#0a0a0a]/95 text-neutral-100 shadow-[0_25px_70px_rgba(0,0,0,0.85)] backdrop-blur-2xl overflow-hidden">
        {/* Apple subtle light reflection edge */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        {isDeclined ? (
          /* Declined Access State */
          <div className="flex flex-col items-center justify-center p-8 sm:p-14 text-center my-auto">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 text-red-400 mb-5">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h3 className="font-display text-2xl sm:text-3xl md:text-4xl font-medium text-white mb-3">
              Access Restricted
            </h3>
            <p className="max-w-lg text-sm sm:text-base text-neutral-400 leading-relaxed mb-6 font-light">
              Under the rules of the Bar Council of India, access to TRANA requires voluntary acknowledgement that you are seeking legal information of your own accord, with no form of advertisement or solicitation.
            </p>
            <p className="max-w-lg text-xs sm:text-sm text-neutral-500 leading-relaxed mb-8">
              Because you did not agree to the statutory disclaimer, access to this platform cannot be granted at this time.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setIsDeclined(false);
                  setAgreed(true);
                }}
                className="rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 px-6 py-3 text-xs sm:text-sm font-medium uppercase tracking-wider text-white transition-colors cursor-pointer"
              >
                Review Disclaimer Again
              </button>
              <button
                type="button"
                onClick={handleLeave}
                className="rounded-lg bg-white px-6 py-3 text-xs sm:text-sm font-semibold uppercase tracking-wider text-black hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                Leave to Google
              </button>
            </div>
          </div>
        ) : (
          /* Main Statutory Disclaimer Modal View */
          <>
            {/* Header */}
            <div className="border-b border-white/10 px-6 py-6 sm:px-10 sm:py-7 shrink-0 bg-white/[0.02]">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-mono uppercase tracking-[0.2em] text-amber-300">
                <Shield className="h-3.5 w-3.5" />
                Bar Council of India Compliance
              </div>
              <h2 id="disclaimer-title" className="mt-3 font-display text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-white">
                Statutory Disclaimer & Acknowledgement
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-neutral-400">
                Please review and acknowledge the following statutory terms before accessing TRANA.
              </p>
            </div>

            {/* Scrollable Disclaimer Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-10 sm:py-8 space-y-6 text-sm sm:text-[14.5px] leading-relaxed text-neutral-300 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 text-neutral-200 leading-relaxed font-light text-sm sm:text-base">
                The Bar Council of India does not permit advertisement or solicitation by advocates in any form or manner. TRANA is an independent legal information and technology platform, and is <strong>NOT a law firm</strong>. By accessing this website (www.trana.in or any associated TRANA domains), you acknowledge, confirm, and agree that:
              </div>

              <div className="space-y-6">
                <div className="border-l-2 border-white/25 pl-4 sm:pl-5">
                  <h4 className="font-semibold text-white text-sm sm:text-base uppercase tracking-wider">1. User Volition & Non-Solicitation</h4>
                  <p className="mt-1.5 text-neutral-400 font-light leading-relaxed">
                    You are seeking information relating to TRANA, its legal education resources, and legal first-aid tools of your own accord and volition. There has been no form of solicitation, advertisement, personal communication, invitation, or inducement of any sort whatsoever by TRANA, its founders, directors, employees, or any advocate or legal professional listed on or associated with it.
                  </p>
                </div>

                <div className="border-l-2 border-white/25 pl-4 sm:pl-5">
                  <h4 className="font-semibold text-white text-sm sm:text-base uppercase tracking-wider">2. Legal Information Platform: Not Legal Advice</h4>
                  <p className="mt-1.5 text-neutral-400 font-light leading-relaxed">
                    This website should not be construed as providing legal advice for any purpose. All information, content, statutory summaries, case law extracts, procedural workflows, and content generated by its AI tools and algorithms are for general informational and educational purposes only. Content generated by TRANA or its automated tools should not be interpreted as soliciting or advertising.
                  </p>
                </div>

                <div className="border-l-2 border-white/25 pl-4 sm:pl-5">
                  <h4 className="font-semibold text-white text-sm sm:text-base uppercase tracking-wider">3. No Advocate-Client Relationship</h4>
                  <p className="mt-1.5 text-neutral-400 font-light leading-relaxed">
                    Any information obtained or material downloaded from this website is completely at your own volition. Any transmission, receipt, access, or use of this website, including communications through automated assistance or preliminary intake channels, does not create, and is not intended to create, an advocate-client or legal professional-client relationship between you and TRANA, its founders, or any advocate.
                  </p>
                </div>

                <div className="border-l-2 border-white/25 pl-4 sm:pl-5">
                  <h4 className="font-semibold text-white text-sm sm:text-base uppercase tracking-wider">4. Legal First-Aid Guide: Not a Substitute for Counsel</h4>
                  <p className="mt-1.5 text-neutral-400 font-light leading-relaxed">
                    TRANA is a guide designed to assist you in difficult circumstances and help you reach a qualified legal professional; it is not a substitute for one. Readers of this website or recipients of content or information available on this website should not act or refrain from acting based on any or all such content or information, and should always seek the independent advice of competent legal counsel licensed to practice in the appropriate jurisdiction.
                  </p>
                </div>

                <div className="border-l-2 border-white/25 pl-4 sm:pl-5">
                  <h4 className="font-semibold text-white text-sm sm:text-base uppercase tracking-wider">5. Limitation of Liability & Up-to-Date Information</h4>
                  <p className="mt-1.5 text-neutral-400 font-light leading-relaxed">
                    Information on this website may not constitute the most up-to-date legal or other information. TRANA shall not be liable for the consequences of any action taken or omitted by any person based on any material, answers, AI-generated outputs, or information available on this website, or for any inaccuracy in or exclusion of any information or interpretation thereof.
                  </p>
                </div>

                <div className="border-l-2 border-white/25 pl-4 sm:pl-5">
                  <h4 className="font-semibold text-white text-sm sm:text-base uppercase tracking-wider">6. Third-Party Links & External Operators</h4>
                  <p className="mt-1.5 text-neutral-400 font-light leading-relaxed">
                    Third-party links contained on this website redirecting users to external portals (such as e-Courts or official government repositories) should neither be construed as legal reference / legal advice, nor considered as referrals to, endorsements of, or affiliations with any such third-party website operators.
                  </p>
                </div>

                <div className="border-l-2 border-white/25 pl-4 sm:pl-5">
                  <h4 className="font-semibold text-white text-sm sm:text-base uppercase tracking-wider">7. Platform Communication & Neutrality</h4>
                  <p className="mt-1.5 text-neutral-400 font-light leading-relaxed">
                    The communication platform and preliminary messaging relays provided on this website should not be used for the exchange of unredacted, business-critical, or politically sensitive confidential information prior to establishing a formalized advocate-client engagement.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer with Mandatory Agreement Checkbox and Actions */}
            <div className="border-t border-white/10 bg-[#0d0d0d] px-6 py-5 sm:px-10 sm:py-6 shrink-0">
              <label className="flex items-start gap-3.5 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-neutral-700 bg-neutral-900 text-white accent-white focus:ring-1 focus:ring-white transition-all cursor-pointer shrink-0"
                />
                <span className="text-xs sm:text-sm text-neutral-300 leading-normal group-hover:text-white transition-colors">
                  I acknowledge that I am seeking information relating to TRANA of my own volition, confirm there has been no solicitation or advertisement by TRANA or any advocate, and agree to the statutory terms, Terms of Use, and Privacy Policy.
                </span>
              </label>

              <div className="mt-5 flex flex-col-reverse sm:flex-row items-center justify-between gap-4 pt-2">
                <button
                  type="button"
                  onClick={handleLeave}
                  className="w-full sm:w-auto rounded-lg border border-white/15 px-6 py-3 text-xs sm:text-sm font-medium uppercase tracking-wider text-neutral-400 hover:text-white hover:border-white/30 transition-colors text-center cursor-pointer"
                >
                  Decline & Leave
                </button>

                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={!agreed}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg px-8 py-3 text-xs sm:text-sm font-semibold uppercase tracking-wider bg-white text-black hover:bg-neutral-200 shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all duration-200 cursor-pointer active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:bg-white"
                >
                  <span>I Agree & Enter</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

