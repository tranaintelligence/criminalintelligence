import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { 
  Sparkles, Copy, Download, Bookmark, Check, 
  Upload, AlertTriangle, FileText, RefreshCw, CheckCircle2 
} from "lucide-react";
import { toast } from "sonner";
import { useLawyerAuth } from "./lawyer";

export const Route = createFileRoute("/_authenticated/lawyer/drafter")({
  head: () => ({
    meta: [
      { title: "Legal Professional Workspace — TRANA" },
      { name: "description", content: "Generate bail applications, petitions, legal notices and court pleadings using TRANA AI." },
      { property: "og:title", content: "Legal Professional Workspace — TRANA" },
    ],
  }),
  component: LawyerDrafter,
});

const docTypes = [
  "Bail Application",
  "Legal Notice",
  "Petition",
  "FIR Complaint",
  "Vakalatnama",
  "Written Statement",
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
  { value: "Art 226", label: "Article 226 of the Constitution Writ Petition before High Court" },
  { value: "Sec 9 CPC", label: "Section 9 CPC / Specific Relief Civil Suit for Injunction" },
];

function generateLegalDraft(docType: DocType, facts: string, section: string, advocateName: string, courts: string) {
  const dateStr = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const safeFacts = facts.trim() || "The applicant is a law-abiding citizen with no past criminal antecedents. A dispute arose solely out of civil and commercial transactions without any culpable mens rea.";

  switch (docType) {
    case "Bail Application":
      return `IN THE COURT OF THE PRINCIPAL DISTRICT & SESSIONS JUDGE
AT NEW DELHI

CRIMINAL MISC. (BAIL) APPLICATION NO. _______ OF 2026

IN THE MATTER OF:
Mr. / Ms. ____________________
S/o or D/o ____________________
R/o __________________________
Presently residing at New Delhi                     ...APPLICANT

                             VERSUS

THE STATE (GOVT. OF NCT OF DELHI)
Through SHO, Police Station _________________       ...RESPONDENT

FIR No.: _______ / 2026
Police Station: _____________________
Under Section(s): ${section}

APPLICATION UNDER SECTION ${section.includes("482") ? "482" : "480"} OF THE BHARATIYA NAGARIK SURAKSHA SANHITA, 2023 (BNSS) FOR GRANT OF BAIL TO THE APPLICANT

MOST RESPECTFULLY SHOWETH:

1. That the Applicant is a permanent and respectable citizen of India, with roots in society, residing at the address mentioned in the cause title, having no criminal antecedents of any nature whatsoever.

2. BRIEF FACTS OF THE CASE:
${safeFacts}

3. GROUNDS FOR BAIL:
A. BECAUSE the entire dispute between the parties is purely civil and contractual in nature and has been given a criminal cloak solely to harass and exert undue pressure upon the Applicant.
B. BECAUSE the foundational ingredients of ${section} are conspicuously absent from the bare reading of the allegations.
C. BECAUSE custodial interrogation or arrest of the Applicant is neither warranted nor required, as all relevant documents and records are in documentary form.
D. BECAUSE as laid down by the Hon'ble Supreme Court in *Satender Kumar Antil v. CBI* (2022) and *Arnesh Kumar v. State of Bihar* (2014), personal liberty is the rule and jail is an exception.
E. BECAUSE the Applicant undertakes to strictly join the investigation as and when directed by the Investigating Officer and shall abide by all conditions imposed by this Hon'ble Court.
F. BECAUSE the Applicant is neither a flight risk nor in a position to tamper with evidence or influence witnesses.

PRAYER:
In the premises aforesaid, it is most respectfully prayed that this Hon'ble Court may graciously be pleased to:
(a) Admit the Applicant to bail in the event of arrest / custody in connection with FIR No. _____/2026 registered at Police Station ____________ under ${section};
(b) Pass any other or further order(s) as this Hon'ble Court may deem fit and proper in the interest of justice.

AND FOR THIS ACT OF KINDNESS, THE APPLICANT AS IN DUTY BOUND SHALL EVER PRAY.

Date: ${dateStr}
Place: New Delhi

THROUGH:
${advocateName}, Advocate
Chamber No. 412, Lawyers' Chambers
${courts}
Enrolment No.: D/1429/2019`;

    case "Legal Notice":
      return `LEGAL DEMAND NOTICE
(REGISTERED POST WITH A.D. & SPEED POST)

Date: ${dateStr}

TO:
M/s ______________________________
Through its Authorized Signatory / Director
Address: __________________________
___________________________________

UNDER INSTRUCTIONS FROM:
Our Client: _______________________
R/o: ______________________________

SUBJECT: LEGAL NOTICE FOR BREACH OF CONTRACT AND STATUTORY DEMAND UNDER ${section}.

Sir / Madam,

Under instructions from and on behalf of our Client named above, we hereby serve upon you the present Legal Demand Notice:

1. That our Client is a bona fide entity / individual who entered into a mutual binding agreement with you on or about _______________.

2. FACTS AND CAUSE OF ACTION:
${safeFacts}

3. That despite repeated reminders, telephonic calls, and written communications, you have willfully neglected and failed to discharge your legal and statutory liabilities towards our Client.

4. That by reason of your aforesaid fraudulent acts, omissions, and breach of trust, you have rendered yourself liable under ${section} as well as for compensatory damages and interest @ 18% per annum.

DEMAND:
We hereby call upon you to pay to our Client the total outstanding sum of ₹___________ along with interest and costs within 15 (fifteen) days from the receipt of this notice, failing which our Client has given us peremptory instructions to initiate appropriate criminal proceedings under ${section} and civil recovery proceedings before the competent court of jurisdiction at your sole risk, costs, and consequences.

A copy of this Legal Notice is retained in our office for record and further legal action.

${advocateName}, Advocate
${courts}
New Delhi`;

    case "Vakalatnama":
      return `IN THE SUPREME COURT OF INDIA / HIGH COURT OF DELHI
AT NEW DELHI

SUIT / PETITION / APPEAL NO. ________ OF 2026

IN THE MATTER OF:
_________________________________                    ...APPELLANT / PETITIONER
                           VERSUS
_________________________________                    ...RESPONDENT

                                 VAKALATNAMA

I / We, the above-named Petitioner(s) / Appellant(s) / Respondent(s), do hereby appoint, nominate, and constitute:

${advocateName}, Advocate
Enrolment No.: D/1429/2019
${courts}

to be my/our Advocate in the above-mentioned Matter, and authorize him/her to:
1. Appear, plead, and act on my/our behalf in the said Court or any other Court where the matter may be transferred;
2. File, withdraw, or receive documents, affidavits, plaints, written statements, and appeals;
3. Deposit, withdraw, or receive moneys and grant receipts thereof;
4. Compromise or refer the matter to arbitration with my/our consent.

IN WITNESS WHEREOF I/We have signed this Vakalatnama on this ${dateStr}.

CLIENT / EXECUTANT: ___________________

ACCEPTED AND FILED BY:
${advocateName}, Advocate
Chambers: New Delhi`;

    default:
      return `IN THE HON'BLE COURT OF ____________________________
AT NEW DELHI

CASE NO. _________ OF 2026

IN THE MATTER OF:
_____________________________                        ...COMPLAINANT / PETITIONER
                           VERSUS
_____________________________                        ...ACCUSED / RESPONDENT

SUBJECT: FORMAL PROCEEDING / PLEADING UNDER ${section}

STATEMENT OF FACTS:
${safeFacts}

LEGAL SUBMISSIONS:
1. That the actions complained of clearly constitute violation of ${section}.
2. That the balance of convenience lies squarely in favour of granting the relief sought.
3. That the complainant/petitioner has approached this Hon'ble Court with clean hands.

PRAYER:
It is respectfully prayed that this Hon'ble Court may be pleased to issue appropriate directions under ${section} in accordance with law.

FILED BY:
${advocateName}, Advocate
Date: ${dateStr}`;
  }
}

function LawyerDrafter() {
  const { data: lawyer } = useLawyerAuth();
  const [docType, setDocType] = useState<DocType>("Bail Application");
  const [facts, setFacts] = useState("");
  const [section, setSection] = useState(bnsSections[0].value);
  const [referenceFile, setReferenceFile] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [outputDraft, setOutputDraft] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setIsGenerating(true);
    setCopied(false);
    setSaved(false);

    setTimeout(() => {
      const generated = generateLegalDraft(
        docType,
        facts,
        section,
        lawyer?.full_name || "Advocate",
        lawyer?.courts || "Supreme Court of India & Delhi High Court"
      );
      setOutputDraft(generated);
      setIsGenerating(false);
      toast.success("Draft generated successfully!");
    }, 600);
  }

  function handleCopy() {
    if (!outputDraft) return;
    navigator.clipboard.writeText(outputDraft);
    setCopied(true);
    toast.success("Draft copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  }

  function handleDownloadPDF() {
    if (!outputDraft) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to download/print the PDF.");
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${docType} - TRANA AI Draft</title>
          <style>
            body { font-family: 'Times New Roman', Georgia, serif; line-height: 1.6; padding: 40px; color: #111; max-width: 800px; margin: 0 auto; }
            pre { font-family: inherit; white-space: pre-wrap; word-wrap: break-word; font-size: 13pt; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 25px; }
            .disclaimer { margin-top: 40px; padding-top: 15px; border-top: 1px dashed #777; font-size: 9pt; color: #666; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2 style="margin: 0; font-size: 14pt; letter-spacing: 2px;">TRANA LEGAL DRAFTING ENGINE</h2>
            <p style="margin: 4px 0 0; font-size: 10pt; color: #555;">LEGAL FIRST-AID & PLEADINGS GENERATOR</p>
          </div>
          <pre>${outputDraft.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
          <div class="disclaimer">
            Disclaimer: Generated via TRANA Legal Professional Workspace. Drafts are starting points only and must be verified and attested by a qualified advocate prior to filing in any court of law.
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    toast.success("Opening print / PDF view...");
  }

  function handleSaveDocument() {
    if (!outputDraft) return;
    const newDoc = {
      id: `DOC-${Date.now()}`,
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
      toast.success("Draft recorded in workspace documents.");
    }
  }

  function loadSampleFacts() {
    setDocType("Bail Application");
    setSection("482 BNSS");
    setFacts(
      "The applicant Rahul Verma is a 38-year-old accountant. Accused in FIR No. 142/2026, PS Saket under Section 318 BNS (Cheating) based on allegations made by former employer regarding accounting discrepancies of ₹4.2 Lakhs. Applicant possesses full email proof of reconciliation approved by management. Police issued verbal threats of immediate arrest without issuing notice under Section 35 BNSS. Applicant is ready to cooperate fully with IO."
    );
    toast.info("Sample facts loaded for Anticipatory Bail!");
  }

  return (
    <div className="space-y-8">
      {/* BANNER & BADGE */}
      <div className="border-b border-[#222222] pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display text-4xl md:text-5xl font-medium text-white">
            AI-Assisted Drafting
          </span>
          <span className="border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs uppercase tracking-[0.15em] text-amber-400">
            In Development Preview Mode
          </span>
        </div>

        {/* DISCLAIMER */}
        <div className="mt-4 flex items-start gap-3 bg-[#161616] border border-white/20 p-4 text-xs text-[#CCCCCC] leading-relaxed">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <p>
            <strong className="text-white">Disclaimer:</strong> Drafts generated by AI are starting points only. Always review and verify before use in any legal proceeding.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* INPUT FORM (5 cols) */}
        <div className="lg:col-span-5 bg-[#1A1A1A] border border-[#2E2E2E] p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
            <h2 className="font-display text-xl font-medium text-white">Drafting Parameters</h2>
            <button
              type="button"
              onClick={loadSampleFacts}
              className="text-[0.7rem] uppercase tracking-[0.15em] text-[#AAAAAA] hover:text-white underline"
            >
              Load Sample Matter
            </button>
          </div>

          <form onSubmit={handleGenerate} className="space-y-5">
            {/* Document Type Dropdown */}
            <div>
              <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1.5">
                Select Document Type
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocType)}
                className="w-full border border-[#333333] bg-[#0A0A0A] px-4 py-3 text-sm text-white focus:border-white focus:outline-none"
              >
                {docTypes.map((t) => (
                  <option key={t} value={t} className="bg-[#1A1A1A] text-white">
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Primary BNS/BNSS section */}
            <div>
              <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1.5">
                Primary BNS / BNSS / Statutory Section
              </label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full border border-[#333333] bg-[#0A0A0A] px-4 py-3 text-sm text-white focus:border-white focus:outline-none"
              >
                {bnsSections.map((s) => (
                  <option key={s.value} value={s.value} className="bg-[#1A1A1A] text-white">
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Facts Textarea */}
            <div>
              <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1.5">
                Describe the Case Facts
              </label>
              <textarea
                rows={7}
                required
                value={facts}
                onChange={(e) => setFacts(e.target.value)}
                placeholder="Describe key dates, FIR details, parties involved, allegations, and specific grounds for relief..."
                className="w-full border border-[#333333] bg-[#0A0A0A] p-4 text-sm text-white placeholder:text-[#555555] focus:border-white focus:outline-none leading-relaxed"
              />
            </div>

            {/* Optional: Upload reference document */}
            <div>
              <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1.5">
                Upload Reference Document (Optional)
              </label>
              <div className="border border-dashed border-[#333333] bg-[#0A0A0A] p-4 text-center hover:border-white/50 transition-colors">
                <input
                  type="file"
                  id="doc-upload"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setReferenceFile(file.name);
                      toast.success(`Attached: ${file.name}`);
                    }
                  }}
                />
                <label htmlFor="doc-upload" className="cursor-pointer flex flex-col items-center gap-1.5">
                  <Upload className="h-5 w-5 text-[#888888]" />
                  <span className="text-xs text-[#AAAAAA]">
                    {referenceFile ? (
                      <span className="text-white font-mono">{referenceFile}</span>
                    ) : (
                      "Attach FIR, Impugned Order or Notice (PDF/DOCX)"
                    )}
                  </span>
                </label>
              </div>
            </div>

            {/* "Generate Draft" button (white on black) */}
            <button
              type="submit"
              disabled={isGenerating}
              className="w-full bg-white text-black px-6 py-4 text-xs font-semibold uppercase tracking-[0.2em] hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-black" />
                  <span>Synthesizing Legal Pleadings...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-black" />
                  <span>Generate Draft</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* OUTPUT AREA (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.2em] text-[#888888]">
              Document Preview
            </span>
            {outputDraft && (
              <span className="text-xs font-mono text-emerald-400">
                Ready for review
              </span>
            )}
          </div>

          {outputDraft ? (
            <div className="space-y-4">
              {/* Clean White Card for Generated Document */}
              <div className="bg-[#F5F5F0] text-black border border-neutral-300 p-8 md:p-10 shadow-2xl rounded-sm font-serif">
                <div className="flex items-center justify-between border-b border-neutral-300 pb-4 mb-6 text-xs font-sans text-neutral-500 uppercase tracking-widest">
                  <span>{docType}</span>
                  <span>TRANA AI Engine • {new Date().toLocaleDateString("en-IN")}</span>
                </div>

                <div className="whitespace-pre-wrap leading-relaxed text-[0.95rem] font-serif text-neutral-900 select-text max-h-[550px] overflow-y-auto pr-2">
                  {outputDraft}
                </div>
              </div>

              {/* Action Buttons Bar */}
              <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {/* Copy Text Button */}
                  <button
                    onClick={handleCopy}
                    className="border border-white/40 px-4 py-2.5 text-xs uppercase tracking-[0.1em] text-white hover:bg-white hover:text-black transition-colors flex items-center gap-2"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copied ? "Copied!" : "Copy Text"}</span>
                  </button>

                  {/* Download as PDF Button */}
                  <button
                    onClick={handleDownloadPDF}
                    className="border border-white/40 px-4 py-2.5 text-xs uppercase tracking-[0.1em] text-white hover:bg-white hover:text-black transition-colors flex items-center gap-2"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download as PDF</span>
                  </button>

                  {/* Save to My Documents Button */}
                  <button
                    onClick={handleSaveDocument}
                    className="border border-white/40 px-4 py-2.5 text-xs uppercase tracking-[0.1em] text-white hover:bg-white hover:text-black transition-colors flex items-center gap-2"
                  >
                    {saved ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Bookmark className="h-3.5 w-3.5" />}
                    <span>{saved ? "Saved!" : "Save to My Documents"}</span>
                  </button>
                </div>
              </div>

              {/* Disclaimer below output */}
              <div className="p-4 bg-[#111111] border-l-2 border-white/40 text-xs text-[#999999] leading-relaxed">
                Review this draft carefully. TRANA AI drafts require verification by a qualified lawyer.
              </div>
            </div>
          ) : (
            <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-12 text-center flex flex-col items-center justify-center min-h-[480px]">
              <div className="h-14 w-14 rounded-full bg-[#111111] border border-white/20 flex items-center justify-center mb-4 text-white">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="font-display text-2xl font-medium text-white">
                No Draft Generated Yet
              </h3>
              <p className="mt-2 text-sm text-[#888888] max-w-md leading-relaxed">
                Fill in the document parameters and case facts on the left, then click <strong>"Generate Draft"</strong> to produce court-ready legal pleadings.
              </p>
              <button
                type="button"
                onClick={loadSampleFacts}
                className="mt-6 border border-white/30 px-5 py-2 text-xs uppercase tracking-[0.15em] text-white hover:border-white transition-colors"
              >
                Load Sample Anticipatory Bail Matter
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
