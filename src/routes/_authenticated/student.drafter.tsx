import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { 
  Sparkles, Copy, Download, Bookmark, Check, 
  Upload, AlertTriangle, FileText, RefreshCw, CheckCircle2, GraduationCap 
} from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/lib/user-role";

export const Route = createFileRoute("/_authenticated/student/drafter")({
  head: () => ({
    meta: [
      { title: "Academic AI Drafter — TRANA Student" },
      { name: "description", content: "Generate moot court memorials, bail applications, petitions, and legal opinions for academic research." },
      { property: "og:title", content: "Academic AI Drafter — TRANA Student" },
    ],
  }),
  component: StudentDrafter,
});

const docTypes = [
  "Moot Court Memorial (Criminal/Bail)",
  "Bail Application (Section 482 BNSS)",
  "Writ Petition (Article 226 / 32)",
  "Legal Opinion & Case Brief",
  "Statutory Demand Notice",
  "Appellate Memorandum of Arguments",
] as const;

type DocType = (typeof docTypes)[number];

const bnsSections = [
  { value: "482 BNSS", label: "Section 482 BNSS Anticipatory Bail (Apprehension of Arrest)" },
  { value: "480 BNSS", label: "Section 480 BNSS Regular Bail (Non-Bailable Offence)" },
  { value: "173 BNSS", label: "Section 173 BNSS Information of Cognizable Offence (FIR)" },
  { value: "316 BNS", label: "Section 316 BNS Criminal Breach of Trust" },
  { value: "318 BNS", label: "Section 318 BNS Cheating and Dishonestly Inducing Delivery" },
  { value: "115 BNS", label: "Section 115 BNS Voluntarily Causing Hurt" },
  { value: "351 BNS", label: "Section 351 BNS Criminal Intimidation" },
  { value: "138 NI Act", label: "Section 138 Negotiable Instruments Act Dishonour of Cheque" },
  { value: "66D IT Act", label: "Section 66D Information Technology Act Cheating by Personation" },
];

function StudentDrafter() {
  const { user } = Route.useRouteContext();
  const { studentProfile } = useUserRole(user?.id, user?.email);

  const [docType, setDocType] = useState<DocType>("Bail Application (Section 482 BNSS)");
  const [section, setSection] = useState(bnsSections[0].value);
  const [clientParty, setClientParty] = useState("Applicant / Accused");
  const [facts, setFacts] = useState("");
  const [jurisdiction, setJurisdiction] = useState("High Court of Delhi / Sessions Court");
  const [additionalInstructions, setAdditionalInstructions] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [outputDraft, setOutputDraft] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const studentName = user?.name || user?.email?.split("@")[0] || "Law Student";
  const university = studentProfile?.university || "National Law University";

  async function handleGenerateDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!facts.trim()) {
      toast.error("Please enter the factual matrix or moot problem summary.");
      return;
    }

    setIsGenerating(true);
    setOutputDraft(null);

    try {
      await new Promise((res) => setTimeout(res, 900));

      const selectedSecObj = bnsSections.find((s) => s.value === section);
      const sectionFullName = selectedSecObj ? selectedSecObj.label : section;

      const generatedText = `IN THE HIGH COURT OF DELHI AT NEW DELHI / SESSIONS COURT
CRIMINAL MISCELLANEOUS JURISDICTION
CRIMINAL MISC. APPLICATION NO. _____ OF 2026

IN THE MATTER OF:
${facts.includes("applicant") ? "APPLICANT" : "PETITIONER"}
...Applicant / Petitioner

VERSUS

STATE (NCT OF DELHI)
...Respondent

MEMORANDUM OF APPLICATION UNDER SECTION 482 OF THE BHARATIYA NAGARIK SURAKSHA SANHITA, 2023 (BNSS)
[CORRESPONDING TO ERSTWHILE SECTION 438 CrPC, 1973]
FOR GRANT OF PRE-ARREST ANTICIPATORY BAIL IN RESPECT OF OFFENCES ALLEGED UNDER ${sectionFullName.toUpperCase()}

MOST RESPECTFULLY SHOWETH:

1. JURISDICTION & CAPACITY OF APPLICANT
The Applicant approaches this Hon'ble Court under Section 482 of the Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS), seeking pre-arrest protection against apprehended custodial arrest initiated without statutory Section 35(3) BNSS compliance.

2. FACTUAL MATRIX & STATUTORY INGREDIENTS
${facts.trim()}

3. ABSENCE OF CUSTODIAL INTERROGATION THRESHOLD
(a) The offences alleged do not warrant custodial confinement. As held by the Hon'ble Supreme Court in Arnesh Kumar v. State of Bihar (2014) 8 SCC 273 and reaffirmed in Satender Kumar Antil v. CBI (2022) 10 SCC 51, the police machinery cannot effect arbitrary arrest without furnishing cogent reasons in writing.
(b) Under Section 35(3) BNSS (formerly Sec 41A CrPC), where arrest is not imperative, the investigating agency is mandatorily bound to issue notice of appearance.
(c) The documentary evidence is already accessible, eliminating any risk of tampering or destruction of material.

4. CLEAN ANTECEDENTS & FLIGHT RISK ASSESSMENT
The Applicant is a permanent resident of ${jurisdiction}, has deep roots in society, has an unblemished antecedent record, and undertakes to join investigation as and when summoned.

PRAYER
In the light of the facts and grounds stated hereinabove, it is most respectfully prayed that this Hon'ble Court may graciously be pleased to:
(a) Grant ad-interim anticipatory bail to the Applicant in the event of arrest;
(b) Direct that in the event of arrest, the Applicant be released on bail subject to furnishing suitable solvent surety;
(c) Pass such other and further order(s) as this Hon'ble Court may deem fit and proper in the interest of justice.

DRAFTED FOR ACADEMIC & RESEARCH PURPOSES:
Scholar: ${studentName} • ${university}
Dated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
Place: ${jurisdiction}`;

      setOutputDraft(generatedText);
      toast.success("Academic draft generated successfully!");
    } catch {
      toast.error("Failed to generate draft. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleCopy() {
    if (!outputDraft) return;
    navigator.clipboard.writeText(outputDraft);
    setCopied(true);
    toast.success("Draft copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSaveDocument() {
    if (!outputDraft) return;
    const newDoc = {
      id: `DOC-STU-${Date.now()}`,
      title: `${docType} - ${section}`,
      type: docType,
      section: section,
      content: outputDraft,
      date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    };

    try {
      const stored = localStorage.getItem("trana_saved_documents");
      const list = stored ? JSON.parse(stored) : [];
      list.unshift(newDoc);
      localStorage.setItem("trana_saved_documents", JSON.stringify(list));
      setSaved(true);
      toast.success("Saved to My Documents!");
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast.success("Draft saved.");
    }
  }

  return (
    <div className="space-y-8">
      {/* Banner */}
      <div className="border-b border-[#222222] pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display text-3xl md:text-4xl font-medium text-white">
            Academic AI Drafter
          </span>
          <span className="border border-purple-500/40 bg-purple-950/20 px-3 py-1 text-xs uppercase tracking-[0.15em] text-purple-300 font-mono">
            Law Student Edition
          </span>
        </div>
        <p className="mt-2 text-xs md:text-sm text-[#999999]">
          Draft moot court memorials, anticipatory bail applications under BNSS, writ petitions, and legal opinions for clinical legal education.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* INPUT FORM */}
        <div className="lg:col-span-5 bg-[#141414] border border-[#262626] p-6 space-y-5">
          <h2 className="font-display text-xl font-medium text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <span>Draft Configuration</span>
          </h2>

          <form onSubmit={handleGenerateDraft} className="space-y-4">
            <div>
              <label className="block text-[0.7rem] uppercase tracking-wider text-[#888888] font-mono mb-1.5">
                Draft Category
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocType)}
                className="w-full bg-[#181818] border border-[#333333] px-3 py-2 text-xs text-white focus:border-purple-400 focus:outline-none"
              >
                {docTypes.map((dt) => (
                  <option key={dt} value={dt}>
                    {dt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[0.7rem] uppercase tracking-wider text-[#888888] font-mono mb-1.5">
                Primary Statute / Section
              </label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full bg-[#181818] border border-[#333333] px-3 py-2 text-xs text-white focus:border-purple-400 focus:outline-none"
              >
                {bnsSections.map((sec) => (
                  <option key={sec.value} value={sec.value}>
                    {sec.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[0.7rem] uppercase tracking-wider text-[#888888] font-mono mb-1.5">
                Moot / Case Jurisdiction
              </label>
              <input
                type="text"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className="w-full bg-[#181818] border border-[#333333] px-3 py-2 text-xs text-white focus:border-purple-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[0.7rem] uppercase tracking-wider text-[#888888] font-mono mb-1.5">
                Factual Matrix / Proposition Summary
              </label>
              <textarea
                rows={6}
                required
                value={facts}
                onChange={(e) => setFacts(e.target.value)}
                placeholder="Enter key facts, allegations, dates, FIR details or moot court problem summary..."
                className="w-full bg-[#181818] border border-[#333333] p-3 text-xs text-white placeholder-[#555555] focus:border-purple-400 focus:outline-none leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full bg-white text-black hover:bg-neutral-200 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] transition-colors flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Synthesizing Legal Draft...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Generate AI Pleading</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* OUTPUT PREVIEW */}
        <div className="lg:col-span-7 bg-[#141414] border border-[#262626] p-6 flex flex-col justify-between min-h-[500px]">
          <div>
            <div className="flex items-center justify-between border-b border-[#252525] pb-4">
              <div>
                <span className="text-[0.65rem] uppercase tracking-wider text-[#888888] font-mono">
                  Synthesized Output
                </span>
                <h3 className="font-display text-lg text-white font-medium">
                  {docType} Preview
                </h3>
              </div>

              {outputDraft && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="p-1.5 border border-[#333333] text-white hover:bg-[#202020] text-xs flex items-center gap-1"
                    title="Copy Draft"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                  <button
                    onClick={handleSaveDocument}
                    className="p-1.5 border border-purple-500/50 bg-purple-950/30 text-purple-300 hover:bg-purple-900/40 text-xs flex items-center gap-1"
                    title="Save to My Documents"
                  >
                    {saved ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Bookmark className="h-3.5 w-3.5" />}
                    <span>{saved ? "Saved" : "Save"}</span>
                  </button>
                </div>
              )}
            </div>

            {outputDraft ? (
              <pre className="mt-4 p-4 bg-[#0D0D0D] border border-[#222222] text-[#E0E0E0] font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-[600px] overflow-y-auto">
                {outputDraft}
              </pre>
            ) : (
              <div className="py-24 text-center text-[#666666] font-mono text-xs space-y-2">
                <FileText className="h-8 w-8 mx-auto text-[#444444]" />
                <p>Configure draft parameters and click "Generate AI Pleading".</p>
                <p className="text-[0.7rem] text-[#555555]">Your synthesized court pleading will appear here.</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[#222222] flex items-center justify-between text-[0.7rem] text-[#777777] font-mono">
            <span>Scholar: {studentName}</span>
            <span>{university}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

