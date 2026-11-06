import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Search, Copy, Check, BookOpen, Scale, ArrowRight, Bookmark, GraduationCap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/student/citations")({
  head: () => ({
    meta: [
      { title: "Statutory Citation Finder — TRANA Student" },
      { name: "description", content: "Search BNS, BNSS, BSA, IPC, CrPC sections with Supreme Court ratios and landmark precedent analysis." },
      { property: "og:title", content: "Statutory Citation Finder — TRANA Student" },
    ],
  }),
  component: StudentCitations,
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
        caseName: "Sushila Aggarwal v. State (NCT of Delhi)",
        citation: "(2020) 5 SCC 1",
        bench: "5-Judge Constitution Bench",
        ratio:
          "Anticipatory bail should not ordinarily be limited to a fixed period. Protection can continue until the conclusion of the trial unless special circumstances warrant limitation.",
      },
      {
        caseName: "Satender Kumar Antil v. CBI",
        citation: "(2022) 10 SCC 51",
        bench: "S.K. Kaul & M.M. Sundresh, JJ.",
        ratio:
          "Bail is the rule and jail is the exception. Arrest is an exceptional measure and investigating agencies must scrupulously comply with notice provisions before depriving liberty.",
      },
    ],
  },
  {
    id: "bnss-35",
    code: "BNSS",
    section: "Section 35 BNSS",
    title: "When police may arrest without warrant & Mandatory Notice of Appearance",
    fullText:
      "Any police officer may without an order from a Magistrate and without a warrant, arrest any person who commits in the presence of a police officer, a cognizable offence... Provided that where the arrest of a person is not required under sub-section (1), the police officer shall issue a notice directing the person to appear before him.",
    crossReference: "Section 41 and 41A of the Code of Criminal Procedure, 1973 (CrPC)",
    keyJudgments: [
      {
        caseName: "Arnesh Kumar v. State of Bihar",
        citation: "(2014) 8 SCC 273",
        bench: "Chandramauli Kr. Prasad & P.C. Ghose, JJ.",
        ratio:
          "No arrest should be made automatically in offences punishable with imprisonment up to 7 years. Police officers must satisfy themselves about the necessity of arrest through a checklist under Sec 41A CrPC (now Sec 35 BNSS).",
      },
      {
        caseName: "Satender Kumar Antil v. CBI",
        citation: "(2022) 10 SCC 51",
        bench: "Supreme Court of India",
        ratio:
          "Non-compliance with Section 41A / Section 35 notice requirements entitles the accused to bail as a matter of right and renders the arresting officer liable for departmental inquiry.",
      },
    ],
  },
  {
    id: "bns-318",
    code: "BNS",
    section: "Section 318 BNS",
    title: "Cheating and dishonestly inducing delivery of property",
    fullText:
      "Whoever, by deceiving any person, fraudulently or dishonestly induces the person so deceived to deliver any property to any person, or to consent that any person shall retain any property, commits cheating. Whoever cheats shall be punished with imprisonment of either description for a term which may extend to three years, or with fine, or with both.",
    crossReference: "Section 415 and 420 of the Indian Penal Code, 1860 (IPC)",
    keyJudgments: [
      {
        caseName: "Hridaya Ranjan Prasad Verma v. State of Bihar",
        citation: "(2000) 4 SCC 168",
        bench: "D.P. Wadhwa & N. Santosh Hegde, JJ.",
        ratio:
          "Distinction between mere breach of contract and cheating depends upon the intention of the accused at the time of inducement. Subsequent failure to fulfill promise does not constitute cheating.",
      },
      {
        caseName: "Dalip Kaur v. Jagnar Singh",
        citation: "(2009) 14 SCC 696",
        bench: "S.B. Sinha & Cyriac Joseph, JJ.",
        ratio:
          "Fraudulent or dishonest intention must exist at the inception of the transaction. A dispute arising out of commercial contract cannot be converted into a criminal offence.",
      },
    ],
  },
  {
    id: "bsa-63",
    code: "BSA",
    section: "Section 63 BSA",
    title: "Admissibility of electronic records and digital certificate",
    fullText:
      "Any information contained in an electronic record which is printed on a paper, stored, recorded or copied in optical or magnetic media shall be deemed to be also a document... and shall be admissible in any proceedings, without further proof or production of the original, if the conditions mentioned in this section are satisfied.",
    crossReference: "Section 65B of the Indian Evidence Act, 1872 (IEA)",
    keyJudgments: [
      {
        caseName: "Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal",
        citation: "(2020) 7 SCC 1",
        bench: "3-Judge Bench (R.F. Nariman, J.)",
        ratio:
          "Certificate under Section 65B(4) [now Section 63 BSA] is a condition precedent to the admissibility of electronic evidence by way of secondary evidence.",
      },
    ],
  },
];

function StudentCitations() {
  const [search, setSearch] = useState("");
  const [selectedLaw, setSelectedLaw] = useState<LawFilter>("All");
  const [expandedId, setExpandedId] = useState<string | null>("bnss-482");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredCitations = useMemo(() => {
    return citationsData.filter((item) => {
      if (selectedLaw !== "All") {
        if (selectedLaw === "BNS" && item.code !== "BNS") return false;
        if (selectedLaw === "BNSS" && item.code !== "BNSS") return false;
        if (selectedLaw === "BSA" && item.code !== "BSA") return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        item.section.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.crossReference.toLowerCase().includes(q) ||
        item.keyJudgments.some(
          (j) => j.caseName.toLowerCase().includes(q) || j.ratio.toLowerCase().includes(q)
        )
      );
    });
  }, [search, selectedLaw]);

  function handleCopy(citation: CitationItem) {
    const text = `${citation.section}: ${citation.title}\nCross Reference: ${citation.crossReference}\n\nStatutory Text:\n${citation.fullText}\n\nLandmark Precedents:\n${citation.keyJudgments.map((j) => `• ${j.caseName} [${j.citation}] (${j.bench}): ${j.ratio}`).join("\n")}`;
    navigator.clipboard.writeText(text);
    setCopiedId(citation.id);
    toast.success("Citation & landmark ratios copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-8">
      {/* Banner */}
      <div className="border-b border-[#222222] pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display text-3xl md:text-4xl font-medium text-white">
            Statutory Citation Finder
          </span>
          <span className="border border-purple-500/40 bg-purple-950/20 px-3 py-1 text-xs uppercase tracking-[0.15em] text-purple-300 font-mono">
            Academic Research
          </span>
        </div>
        <p className="mt-2 text-xs md:text-sm text-[#999999]">
          Search BNS, BNSS, BSA, IPC, and CrPC comparative statutory provisions with landmark Supreme Court ratio decidendi.
        </p>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[#777777]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by section number, offence, or case name (e.g. 482 BNSS, Anticipatory Bail, Arnesh Kumar)..."
            className="w-full bg-[#141414] border border-[#2B2B2B] pl-10 pr-4 py-3 text-xs md:text-sm text-white placeholder-[#666666] focus:border-purple-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["All", "BNS", "BNSS", "BSA"] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setSelectedLaw(code)}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border transition-colors ${
                selectedLaw === code
                  ? "bg-white text-black border-white font-semibold"
                  : "bg-[#141414] text-[#888888] border-[#2A2A2A] hover:text-white hover:border-[#444444]"
              }`}
            >
              {code}
            </button>
          ))}
        </div>
      </div>

      {/* RESULTS LIST */}
      <div className="space-y-4">
        {filteredCitations.map((item) => {
          const isExpanded = expandedId === item.id;

          return (
            <div
              key={item.id}
              className="bg-[#141414] border border-[#262626] hover:border-purple-400/60 transition-all p-6 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-display text-2xl font-medium text-white">{item.section}</span>
                    <span className="px-2 py-0.5 text-[0.65rem] font-mono uppercase tracking-wider rounded bg-[#202020] border border-[#333333] text-purple-300">
                      {item.code}
                    </span>
                  </div>
                  <h3 className="mt-1 text-sm font-medium text-[#CCCCCC]">{item.title}</h3>
                  <div className="mt-2 text-xs font-mono text-amber-300 flex items-center gap-1.5">
                    <span>Erstwhile:</span>
                    <span>{item.crossReference}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => handleCopy(item)}
                    className="p-2 border border-[#333333] hover:border-white text-[#AAAAAA] hover:text-white text-xs flex items-center gap-1.5 transition-colors"
                    title="Copy full statutory citation & ratios"
                  >
                    {copiedId === item.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedId === item.id ? "Copied" : "Copy"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="p-2 border border-[#333333] hover:border-white text-white text-xs font-mono transition-colors"
                  >
                    {isExpanded ? "Collapse" : "Read Full"}
                  </button>
                </div>
              </div>

              {/* Statutory Text */}
              <div className="bg-[#0E0E0E] border border-[#202020] p-4 text-xs text-[#CCCCCC] leading-relaxed font-serif">
                {isExpanded ? item.fullText : `${item.fullText.slice(0, 220)}...`}
              </div>

              {/* Landmark Judgments */}
              {isExpanded && (
                <div className="pt-2 space-y-3">
                  <h4 className="text-xs uppercase tracking-wider text-[#888888] font-mono flex items-center gap-1.5">
                    <Scale className="h-3.5 w-3.5 text-purple-400" />
                    <span>Landmark Precedents & Ratio Decidendi ({item.keyJudgments.length})</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {item.keyJudgments.map((j, idx) => (
                      <div key={idx} className="bg-[#111111] border border-[#242424] p-4 space-y-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-white font-serif">{j.caseName}</span>
                          <span className="text-[0.7rem] font-mono text-amber-300 shrink-0">{j.citation}</span>
                        </div>
                        <span className="text-[0.65rem] text-[#777777] font-mono block">{j.bench}</span>
                        <p className="text-[#AAAAAA] leading-relaxed font-sans">{j.ratio}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredCitations.length === 0 && (
          <div className="bg-[#141414] border border-[#242424] p-12 text-center text-[#777777] font-mono text-xs space-y-2">
            <BookOpen className="h-8 w-8 mx-auto text-[#444444]" />
            <p>No statutory sections or precedents found matching "{search}".</p>
          </div>
        )}
      </div>
    </div>
  );
}

