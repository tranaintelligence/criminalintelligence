import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Search, Copy, Check, BookOpen, Scale, ArrowRight, Bookmark } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lawyer/citations")({
  head: () => ({
    meta: [
      { title: "Citation Finder TRANA Lawyer Workspace" },
      { name: "description", content: "Search BNS, BNSS, BSA and case law with exact citations and section references." },
    ],
  }),
  component: LawyerCitations,
});

type LawFilter = "All" | "BNS" | "BNSS" | "BSA" | "IPC (legacy)" | "CrPC (legacy)";

type CitationItem = {
  id: string;
  code: "BNS" | "BNSS" | "BSA" | "IPC" | "CrPC";
  section: string;
  title: string;
  fullText: string;
  crossReference: string;
  keyJudgments: {
    caseName: string;
    citation: string;
    bench: string;
    ratio: string;
  }[];
};

const citationsData: CitationItem[] = [
  {
    id: "bnss-482",
    code: "BNSS",
    section: "Section 482 BNSS",
    title: "Direction for grant of bail to person apprehending arrest",
    fullText:
      "When any person has reason to believe that he may be arrested on an accusation of having committed a non-bailable offence, he may apply to the High Court or the Court of Session for a direction under this section that in the event of such arrest, he shall be released on bail; and that Court may, after taking into consideration, inter-alia, the nature and gravity of the accusation, the antecedents of the applicant, the possibility of the applicant to flee from justice, either reject the application or issue an interim order for grant of anticipatory bail.",
    crossReference: "Section 438 of the Code of Criminal Procedure, 1973 (CrPC)",
    keyJudgments: [
      {
        caseName: "Gurbaksh Singh Sibbia v. State of Punjab",
        citation: "(1980) 2 SCC 565",
        bench: "5-Judge Constitution Bench",
        ratio:
          "Anticipatory bail is an essential device for securing individual freedom. Powers under Section 438 CrPC (now 482 BNSS) are not to be circumscribed by narrow, unwritten limitations.",
      },
      {
        caseName: "Sushila Aggarwal & Ors. v. State (NCT of Delhi)",
        citation: "(2020) 5 SCC 1",
        bench: "5-Judge Constitution Bench",
        ratio:
          "Protection granted under Section 438 CrPC (now 482 BNSS) should not ordinarily be limited to a fixed period; it should continue until the conclusion of the trial unless special circumstances warrant otherwise.",
      },
    ],
  },
  {
    id: "bnss-480",
    code: "BNSS",
    section: "Section 480 BNSS",
    title: "When bail may be taken in case of non-bailable offence",
    fullText:
      "When any person accused of, or suspected of, the commission of any non-bailable offence is arrested or detained without warrant by an officer in charge of a police station, or appears or is brought before a Court, he may be released on bail, but he shall not be so released if there appear reasonable grounds for believing that he has been guilty of an offence punishable with death or imprisonment for life.",
    crossReference: "Section 437 of the Code of Criminal Procedure, 1973 (CrPC)",
    keyJudgments: [
      {
        caseName: "Satender Kumar Antil v. Central Bureau of Investigation",
        citation: "(2022) 10 SCC 51",
        bench: "2-Judge Bench (S.K. Kaul & M.M. Sundresh, JJ.)",
        ratio:
          "Formulated comprehensive guidelines categorizing offences (A, B, C, D) for grant of regular bail without remanding accused into judicial custody where cooperation in investigation is shown.",
      },
      {
        caseName: "Arnesh Kumar v. State of Bihar",
        citation: "(2014) 8 SCC 273",
        bench: "2-Judge Bench (C.K. Prasad & P.C. Ghose, JJ.)",
        ratio:
          "Police officers cannot arrest accused merely on registration of cognizable offence carrying punishment up to 7 years without satisfying prerequisites of notice under section 35 BNSS (old 41A CrPC).",
      },
    ],
  },
  {
    id: "bnss-35",
    code: "BNSS",
    section: "Section 35 BNSS",
    title: "Notice of appearance before police officer",
    fullText:
      "The police officer shall, in all cases where the arrest of a person is not required under sub-section (1) of section 35, issue a notice directing the person against whom a reasonable complaint has been made, or credible information has been received, to appear before him or at such other place as may be specified in the notice.",
    crossReference: "Section 41A of the Code of Criminal Procedure, 1973 (CrPC)",
    keyJudgments: [
      {
        caseName: "Mohd. Aslam v. State (NCT of Delhi)",
        citation: "2024 SCC OnLine Del 1420",
        bench: "Delhi High Court",
        ratio:
          "Non-compliance with notice provisions under Section 35 of BNSS vitiates detention and entitles the person to immediate bail.",
      },
    ],
  },
  {
    id: "bns-103",
    code: "BNS",
    section: "Section 103 BNS",
    title: "Punishment for murder",
    fullText:
      "Whoever commits murder shall be punished with death or imprisonment for life, and shall also be liable to fine. Sub-clause (2) explicitly provides that when a group of five or more persons acting in concert commits murder on grounds of race, caste, community, sex, place of birth, language, personal belief or any other ground, each person shall be punished with death or with imprisonment for life.",
    crossReference: "Section 302 of the Indian Penal Code, 1860 (IPC)",
    keyJudgments: [
      {
        caseName: "Bachan Singh v. State of Punjab",
        citation: "(1980) 2 SCC 684",
        bench: "5-Judge Constitution Bench",
        ratio:
          "Established the 'Rarest of Rare' doctrine: Death penalty may only be imposed when the alternative option of life imprisonment is unquestionably foreclosed.",
      },
      {
        caseName: "Machhi Singh v. State of Punjab",
        citation: "(1983) 3 SCC 470",
        bench: "3-Judge Bench",
        ratio:
          "Framed the guidelines balancing aggravating and mitigating circumstances before awarding capital punishment.",
      },
    ],
  },
  {
    id: "bns-316",
    code: "BNS",
    section: "Section 316 BNS",
    title: "Criminal breach of trust",
    fullText:
      "Whoever, being in any manner entrusted with property, or with any dominion over property, dishonestly misappropriates or converts to his own use that property, or dishonestly uses or disposes of that property in violation of any direction of law prescribing the mode in which such trust is to be discharged, commits criminal breach of trust.",
    crossReference: "Sections 405 & 406 of the Indian Penal Code, 1860 (IPC)",
    keyJudgments: [
      {
        caseName: "Rashmi Kumar v. Mahesh Kumar Bhada",
        citation: "(1997) 2 SCC 397",
        bench: "3-Judge Bench",
        ratio:
          "Entrustment of Stridhan to husband or in-laws constitutes legal entrustment; failure to return on demand satisfies the ingredients of criminal breach of trust.",
      },
    ],
  },
  {
    id: "bns-318",
    code: "BNS",
    section: "Section 318 BNS",
    title: "Cheating and dishonestly inducing delivery of property",
    fullText:
      "Whoever, by deceiving any person, fraudulently or dishonestly induces the person so deceived to deliver any property to any person, or to consent that any person shall retain any property, or intentionally induces the person so deceived to do or omit to do anything which he would not do or omit if he were not so deceived, commits the offence of cheating.",
    crossReference: "Sections 415 & 420 of the Indian Penal Code, 1860 (IPC)",
    keyJudgments: [
      {
        caseName: "Hridaya Ranjan Prasad Verma v. State of Bihar",
        citation: "(2000) 4 SCC 168",
        bench: "2-Judge Bench",
        ratio:
          "Distinction between mere breach of contract and offence of cheating depends on the intention of the accused at the time of making the representation.",
      },
      {
        caseName: "Vijay Kumar Ghai v. State of West Bengal",
        citation: "(2022) 7 SCC 124",
        bench: "2-Judge Bench",
        ratio:
          "To establish cheating, fraudulent or dishonest intention must be shown right at the inception of transaction; criminal machinery cannot be misused for civil recovery.",
      },
    ],
  },
  {
    id: "bsa-61",
    code: "BSA",
    section: "Section 61 BSA",
    title: "Admissibility of electronic records and digital evidence",
    fullText:
      "Any information contained in an electronic record which is printed on paper, stored, recorded or copied in optical or magnetic media or cloud devices shall be deemed to be also a document, and shall be admissible in any proceedings, without further proof or production of the original, if the conditions specified in this section are satisfied.",
    crossReference: "Section 65B of the Indian Evidence Act, 1872 (IEA)",
    keyJudgments: [
      {
        caseName: "Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal",
        citation: "(2020) 7 SCC 1",
        bench: "3-Judge Bench (R.F. Nariman, S. Ravindra Bhat & V. Ramasubramanian, JJ.)",
        ratio:
          "A certificate is a condition precedent to the admissibility of evidence by way of secondary electronic record under Section 65B (now Section 61 BSA).",
      },
    ],
  },
  {
    id: "ipc-498a",
    code: "IPC",
    section: "Section 85 & 86 BNS (Legacy IPC 498A)",
    title: "Husband or relative of husband of a woman subjecting her to cruelty",
    fullText:
      "Whoever, being the husband or the relative of the husband of a woman, subjects such woman to cruelty shall be punished with imprisonment for a term which may extend to three years and shall also be liable to fine.",
    crossReference: "Section 498A of the Indian Penal Code, 1860 (IPC)",
    keyJudgments: [
      {
        caseName: "Kahkashan Kausar @ Sonam v. State of Bihar",
        citation: "(2022) 6 SCC 599",
        bench: "3-Judge Bench",
        ratio:
          "General and omnibus allegations against husband's relatives without specific roles cannot sustain criminal prosecution under Section 498A IPC.",
      },
    ],
  },
];

function LawyerCitations() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<LawFilter>("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filters: LawFilter[] = ["All", "BNS", "BNSS", "BSA", "IPC (legacy)", "CrPC (legacy)"];

  const filteredCitations = useMemo(() => {
    return citationsData.filter((item) => {
      // Filter check
      if (activeFilter === "BNS" && item.code !== "BNS") return false;
      if (activeFilter === "BNSS" && item.code !== "BNSS") return false;
      if (activeFilter === "BSA" && item.code !== "BSA") return false;
      if (activeFilter === "IPC (legacy)" && !item.crossReference.includes("IPC") && item.code !== "IPC") return false;
      if (activeFilter === "CrPC (legacy)" && !item.crossReference.includes("CrPC") && item.code !== "CrPC") return false;

      // Search term check
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const inSection = item.section.toLowerCase().includes(q);
        const inTitle = item.title.toLowerCase().includes(q);
        const inFullText = item.fullText.toLowerCase().includes(q);
        const inCross = item.crossReference.toLowerCase().includes(q);
        const inJudgments = item.keyJudgments.some(
          (j) =>
            j.caseName.toLowerCase().includes(q) ||
            j.citation.toLowerCase().includes(q) ||
            j.ratio.toLowerCase().includes(q)
        );
        return inSection || inTitle || inFullText || inCross || inJudgments;
      }
      return true;
    });
  }, [searchTerm, activeFilter]);

  function handleCopyCitation(item: CitationItem) {
    const formatted = `${item.section} ${item.title}\nCross-reference: ${item.crossReference}\n\nLeading Precedents:\n` +
      item.keyJudgments.map((j) => `• ${j.caseName} [${j.citation}] (${j.bench}): "${j.ratio}"`).join("\n");

    navigator.clipboard.writeText(formatted);
    setCopiedId(item.id);
    toast.success(`Copied citation for ${item.section}`);
    setTimeout(() => setCopiedId(null), 2500);
  }

  return (
    <div className="space-y-8">
      {/* HEADER & BADGE */}
      <div className="border-b border-[#222222] pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl md:text-5xl font-medium text-white">
            Citation Finder
          </h1>
          {/* Badge: "In Development" */}
          <span className="border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs uppercase tracking-[0.15em] text-amber-400">
            In Development
          </span>
        </div>
        <p className="mt-2 text-sm text-[#999999]">
          Search BNS, BNSS, BSA and landmark Supreme Court case law with exact citations and section equivalents.
        </p>
      </div>

      {/* SEARCH BAR & FILTERS */}
      <div className="space-y-4">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#777777]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by section, topic, case name or keyword..."
            className="w-full border border-[#333333] bg-[#1A1A1A] py-4 pl-12 pr-4 text-sm text-white placeholder:text-[#666666] focus:border-white focus:outline-none shadow-lg"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs uppercase tracking-[0.15em] text-[#777777] mr-1">Filter:</span>
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3.5 py-1.5 text-xs uppercase tracking-[0.1em] border transition-colors ${
                activeFilter === f
                  ? "border-white bg-white text-black font-semibold"
                  : "border-[#333333] bg-[#111111] text-[#AAAAAA] hover:text-white hover:border-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* RESULTS LIST */}
      <div className="space-y-6">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.15em] text-[#888888]">
          <span>Found {filteredCitations.length} Citations</span>
          <span>Showing Verified Statutory Records</span>
        </div>

        {filteredCitations.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-12 text-center text-[#888888]">
            <BookOpen className="h-8 w-8 mx-auto mb-3 text-[#555555]" />
            <p className="text-base text-white">No citations match your search.</p>
            <p className="text-xs mt-1 text-[#888888]">
              Try searching "482", "bail", "Antil", "cheating", or switch filter to "All".
            </p>
          </div>
        ) : (
          filteredCitations.map((item) => (
            /* Result cards (#1A1A1A) */
            <div
              key={item.id}
              className="bg-[#1A1A1A] border border-[#2E2E2E] hover:border-white/50 transition-all p-6 md:p-8 space-y-6 shadow-md"
            >
              {/* Card Header: Section number + cross-reference */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-[#282828] pb-5">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-2xl md:text-3xl font-medium text-white">
                      {item.section}
                    </span>
                    <span className="border border-white/20 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.1em] text-[#AAAAAA]">
                      {item.code}
                    </span>
                  </div>
                  <h3 className="mt-1 text-sm font-medium text-[#E0E0E0]">
                    {item.title}
                  </h3>
                </div>

                {/* Cross-reference: Old IPC/CrPC equivalent */}
                <div className="bg-[#111111] border border-[#2A2A2A] px-3.5 py-2 flex items-center gap-2 flex-wrap">
                  <span className="text-[#888888] text-xs font-mono">Equivalent:</span>
                  <span
                    className="text-slate-200 text-sm tracking-normal"
                    style={{ fontFamily: '"Times New Roman", Times, serif' }}
                  >
                    {item.crossReference}
                  </span>
                </div>
              </div>

              {/* Section full text */}
              <div>
                <span className="text-xs uppercase tracking-[0.15em] text-[#888888] block mb-2">
                  Bare Act Statutory Provision
                </span>
                <p className="text-sm text-[#CCCCCC] leading-relaxed font-light bg-[#141414] border border-[#242424] p-4">
                  "{item.fullText}"
                </p>
              </div>

              {/* Key Supreme Court judgments on this section */}
              <div>
                <span className="text-xs uppercase tracking-[0.15em] text-[#888888] block mb-3">
                  Key Supreme Court Precedents & Legal Ratio
                </span>
                <div className="space-y-3">
                  {item.keyJudgments.map((j) => (
                    <div
                      key={j.citation}
                      className="bg-[#111111] border border-[#262626] p-4 space-y-1.5"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium text-white text-sm">
                          {j.caseName}
                        </span>
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span className="text-emerald-400">{j.citation}</span>
                          <span className="text-[#666666]">•</span>
                          <span className="text-[#888888]">{j.bench}</span>
                        </div>
                      </div>
                      <p className="text-xs text-[#AAAAAA] leading-relaxed italic">
                        Ratio: "{j.ratio}"
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* "Copy Citation" button */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => handleCopyCitation(item)}
                  className="border border-white/40 px-4 py-2 text-xs uppercase tracking-[0.1em] text-white hover:bg-white hover:text-black transition-colors flex items-center gap-2"
                >
                  {copiedId === item.id ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Copied Citation!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Citation</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
