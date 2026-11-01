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

    const fullBriefMarkdown = `### CLIENT INTAKE BRIEF (TRANA AI FIRST-AID)
**Matter**: ${matterType}
**Client**: ${clientName} (${userEmail || "Anonymous"}) • Phone: ${clientPhone} • City: ${clientCity}
**Target Counsel**: ${lawyerName} • Date: ${dateStr} • Mode: ${channelStr}
**Applicable Statutes**: ${sectionsSummary}
**Bail / Jeopardy Position**: ${bailStatus}

#### 1. Factual Summary (Citizen's Statement to AI)
${facts}

#### 2. AI Statutory Assessment
${analysis}

${rights.length > 0 ? `#### 3. Key Rights Identified\n${rights.map((r: string) => `• ${r}`).join("\n")}\n\n` : ""}${nextSteps.length > 0 ? `#### 4. Recommended Urgent Actions\n${nextSteps.map((s: string) => `• ${s}`).join("\n")}\n\n` : ""}*Prepared automatically via TRANA Legal Intelligence Platform for advocate review.*`;

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
    const facts = analysisRecord.situation || "Citizen analysed situation via FIR Analyser.";
    const analysis = res.meaning || "Situation analysed by TRANA statutory model.";
    const bailStatus = res.bail?.status ? `${res.bail.status.toUpperCase()} — ${res.bail.summary || ""}` : "Not applicable";
    const rights = Array.isArray(res.rights) ? res.rights : [];
    const nextSteps = Array.isArray(res.next_steps) ? res.next_steps : [];

    const summary = facts.length > 180 ? `${facts.slice(0, 180)}...` : facts;

    const fullBriefMarkdown = `### CLIENT INTAKE BRIEF (FIR ANALYSER)
**Matter**: ${matterType}
**Client**: ${clientName} (${userEmail || "Anonymous"}) • Phone: ${clientPhone} • City: ${clientCity}
**Target Counsel**: ${lawyerName} • Date: ${dateStr} • Mode: ${channelStr}
**Applicable Statutes**: ${sectionsSummary}
**Bail / Jeopardy Position**: ${bailStatus}

#### 1. Factual Summary (Citizen's Situation)
${facts}

#### 2. Statutory Assessment & Meaning
${analysis}

${rights.length > 0 ? `#### 3. Key Rights Identified\n${rights.map((r: string) => `• ${r}`).join("\n")}\n\n` : ""}${nextSteps.length > 0 ? `#### 4. Recommended Actions\n${nextSteps.map((s: string) => `• ${s}`).join("\n")}\n\n` : ""}*Prepared automatically via TRANA Legal Intelligence Platform for advocate review.*`;

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
  const matterType = "General Legal Consultation";
  const sectionsSummary = "Direct Directory Inquiry";
  const facts = `Citizen ${clientName} initiated a direct consultation inquiry via the TRANA Lawyer Directory seeking legal consultation with Advocate ${lawyerName}.`;
  const summary = facts;
  const fullBriefMarkdown = `### CLIENT INTAKE BRIEF
**Matter**: ${matterType}
**Client**: ${clientName} (${userEmail || "Anonymous"}) • City: ${clientCity}
**Target Counsel**: ${lawyerName} • Date: ${dateStr} • Mode: ${channelStr}

#### Matter Overview
Direct consultation inquiry initiated via TRANA Legal Directory. No prior AI First Aid conversation recorded for this inquiry.

#### Recommended Preliminary Steps
• Schedule introductory consultation (${channelStr})
• Request relevant case documents, court notices, or police records
• Ascertain specific legal relief sought`;

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

