import { supabase } from "@/integrations/supabase/client";
import { authFetch } from "@/lib/trana-auth";
import { API_URL } from "@/lib/trana-backend";

export interface IntakeBriefData {
  hasConversation: boolean;
  matterType: string;
  sectionsSummary: string;
  sections: string[];
  facts: string;
  analysis: string;
  bailStatus: string;
  rights: string[];
  nextSteps: string[];
  summary: string;
  fullBriefMarkdown: string;
  sourceSessionId?: string | null;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  consultationType?: string;
}

/**
 * Synthesizes the citizen's conversation with TRANA AI (and/or FIR analysis)
 * into a structured client intake brief for the advocate.
 */
export async function buildClientIntakeBrief(options: {
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  lawyerName: string;
  consultType: "call" | "chat";
  credential?: string | null;
}): Promise<IntakeBriefData> {
  const { userId, userEmail, userName, lawyerName, consultType, credential } = options;

  let apiBrief: any = null;
  if (credential) {
    try {
      const res = await authFetch(`${API_URL}/api/citizen/intake-brief`, credential);
      if (res.ok) {
        apiBrief = await res.json();
      }
    } catch (e) {
      console.warn("Could not fetch backend intake brief:", e);
    }
  }

  // Also check if user has an FIR situation analysis in Supabase
  let analysisRecord: any = null;
  try {
    const { data } = await supabase
      .from("analyses")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    analysisRecord = data;
  } catch (e) {
    console.warn("Could not fetch user analyses:", e);
  }

  // Fetch client profile for contact particulars
  let profileData: any = null;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, phone, city")
      .eq("id", userId)
      .maybeSingle();
    profileData = data;
  } catch (e) {
    console.warn("Could not fetch user profile:", e);
  }

  const clientName = profileData?.full_name || userName || userEmail?.split("@")[0] || "Citizen Client";
  const clientPhone = profileData?.phone || "Direct Platform Contact";
  const clientCity = profileData?.city || "India";
  const dateStr = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const channelStr = consultType === "call" ? "Telephonic Consultation" : "Secure In-App Chat";

  // If we have AI chat conversation data
  if (apiBrief && apiBrief.has_conversation) {
    const matterType = apiBrief.matter_type || "Legal First Aid Consultation";
    const sections = apiBrief.sections || [];
    const sectionsSummary = apiBrief.sections_summary || (sections.length > 0 ? sections.join(", ") : "Applicable BNS/BNSS Statutes");
    const facts = apiBrief.facts || "Citizen discussed legal grievance with TRANA AI.";
    const analysis = apiBrief.analysis || "Preliminary legal guidance provided.";
    const bailStatus = apiBrief.bail_status || "Subject to statutory review";
    const rights = apiBrief.rights || [];
    const nextSteps = apiBrief.next_steps || [];

    const summary = facts.length > 180 ? `${facts.slice(0, 180)}...` : facts;

    const fullBriefMarkdown = `CASE SUMMARY (TRANA LEGAL INTELLIGENCE)
Matter: ${matterType}
Client: ${clientName} (${userEmail || "Anonymous"}) • Phone: ${clientPhone} • City: ${clientCity}
Target Counsel: ${lawyerName}
Date: ${dateStr}
Mode: ${channelStr}
Applicable Statutes: ${sectionsSummary}
Bail / Custody Outlook: ${bailStatus}

1. Factual Matrix & Background
${facts}

2. Statutory Assessment & Offence Breakdown
${analysis}

${rights.length > 0 ? `3. Constitutional & Statutory Safeguards\n${rights.map((r: string) => `• ${r}`).join("\n")}\n\n` : ""}${nextSteps.length > 0 ? `4. Strategic Legal Action Plan\n${nextSteps.map((s: string) => `• ${s}`).join("\n")}\n\n` : ""}Privileged advocate-client case record prepared via TRANA Legal Intelligence Platform.`;

    return {
      hasConversation: true,
      matterType,
      sectionsSummary,
      sections,
      facts,
      analysis,
      bailStatus,
      rights,
      nextSteps,
      summary,
      fullBriefMarkdown,
      sourceSessionId: apiBrief.session_id,
      clientName,
      clientEmail: userEmail || undefined,
      clientPhone,
      consultationType: consultType,
    };
  }

  // If user has an FIR situation analysis
  if (analysisRecord && analysisRecord.result) {
    const res = analysisRecord.result;
    const matterType = analysisRecord.is_criminal ? "Criminal FIR & Offence Defence" : "Civil / Legal Rights Matter";
    const sections = Array.isArray(res.sections) ? res.sections.map((s: any) => `${s.code}: ${s.explanation}`) : [];
    const sectionsSummary = Array.isArray(res.sections) && res.sections.length > 0 ? res.sections.map((s: any) => s.code).join(", ") : "Statutes identified in situation analysis";
    const facts = analysisRecord.situation || "Citizen analysed situation via Complaint Analyser.";
    const analysis = res.meaning || "Situation analysed by TRANA statutory model.";
    const bailStatus = res.bail?.status ? `${res.bail.status.toUpperCase()} — ${res.bail.summary || ""}` : "Not applicable";
    const rights = Array.isArray(res.rights) ? res.rights : [];
    const nextSteps = Array.isArray(res.next_steps) ? res.next_steps : [];

    const summary = facts.length > 180 ? `${facts.slice(0, 180)}...` : facts;

    const fullBriefMarkdown = `CASE SUMMARY (TRANA COMPLAINT ANALYSER)
Matter: ${matterType}
Client: ${clientName} (${userEmail || "Anonymous"}) • Phone: ${clientPhone} • City: ${clientCity}
Target Counsel: ${lawyerName}
Date: ${dateStr}
Mode: ${channelStr}
Applicable Statutes: ${sectionsSummary}
Bail / Custody Outlook: ${bailStatus}

1. Factual Matrix & Citizen Statement
${facts}

2. Statutory Assessment & Offence Breakdown
${analysis}

${rights.length > 0 ? `3. Constitutional & Statutory Safeguards\n${rights.map((r: string) => `• ${r}`).join("\n")}\n\n` : ""}${nextSteps.length > 0 ? `4. Strategic Legal Action Plan\n${nextSteps.map((s: string) => `• ${s}`).join("\n")}\n\n` : ""}Privileged advocate-client case record prepared via TRANA Legal Intelligence Platform.`;

    return {
      hasConversation: true,
      matterType,
      sectionsSummary,
      sections,
      facts,
      analysis,
      bailStatus,
      rights,
      nextSteps,
      summary,
      fullBriefMarkdown,
      clientName,
      clientEmail: userEmail || undefined,
      clientPhone,
      consultationType: consultType,
    };
  }

  // Fallback if no prior AI conversation or analysis exists
  const matterType = "Comprehensive Legal Representation & Advisory";
  const sectionsSummary = "Applicable Procedural & Substantive Laws (BNS / BNSS / Civil Code)";
  const facts = `Citizen ${clientName} has formally initiated a verified legal consultation channel through TRANA with Advocate ${lawyerName}. The client seeks substantive legal counsel regarding applicable rights, dispute merits, evidentiary review, and prospective litigation strategy.`;
  const summary = facts;
  const fullBriefMarkdown = `CASE SUMMARY (TRANA LEGAL INTELLIGENCE)
Matter: ${matterType}
Client: ${clientName} (${userEmail || "Verified User"}) • City: ${clientCity}
Target Counsel: ${lawyerName}
Date: ${dateStr}
Mode: ${channelStr}
Applicable Statutes: ${sectionsSummary}
Bail / Custody Outlook: To be ascertained upon examination of summons/FIR or civil process.

1. Factual Matrix & Matter Background
Citizen ${clientName} has engaged counsel via TRANA for preliminary case assessment and legal strategy. The client requires guidance on statutory remedies, jurisdictional considerations, and dispute resolution options.

2. Statutory Assessment & Legal Framework
• Counsel to evaluate cause of action, relevant statutory limitation periods, and whether the dispute falls under criminal jurisdiction (BNSS / BNS) or civil / commercial jurisdiction.
• In civil matters, review applicability of mandatory pre-institution mediation under Section 12A of the Commercial Courts Act or Section 89 CPC.
• In criminal matters, scrutinize allegations against statutory ingredient requirements to distinguish civil defaults from cognizable offences under BNS.

3. Procedural Safeguards & Protective Measures
• Right to consult advocate of choice under Article 22(1) of the Constitution of India and Section 41D / Section 37 BNSS.
• Verification of whether formal notice under Section 35(3) BNSS or civil summons has been served.
• Maintenance of evidentiary chain of custody regarding correspondence, financial transactions, and agreements.

4. Strategic Legal Action Plan
• Conduct primary conference via ${channelStr} to record detailed chronological statement.
• Reconcile relevant documentation including contracts, notices, bank records, and official communications.
• Formulate appropriate defensive or originating proceedings (anticipatory bail petition, legal demand notice, reply to show cause, or writ/suit).
• Prepare Vakalatnama and draft affidavit in support of prospective filings.

Privileged advocate-client case record prepared via TRANA Legal Intelligence Platform.`;

  return {
    hasConversation: false,
    matterType,
    sectionsSummary,
    sections: [],
    facts,
    analysis: "Direct connection without prior AI first-aid chat.",
    bailStatus: "N/A",
    rights: [],
    nextSteps: ["Initial consultation intake", "Document verification"],
    summary,
    fullBriefMarkdown,
    clientName,
    clientEmail: userEmail || undefined,
    clientPhone,
    consultationType: consultType,
  };
}

