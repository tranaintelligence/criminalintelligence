"""Versioned legal-source registry.

The registry is intentionally small and deterministic. LLM output may identify a
candidate Act and section, but only records loaded here can become authoritative
quotes in an API response.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any, Iterable


_DEFAULT_CORPUS_PATH = Path(__file__).with_name("corpus.json")
_SECTION_RE = re.compile(r"(?:section|sec\.?|s\.?|article)\s*", re.IGNORECASE)
_SPACE_RE = re.compile(r"\s+")


@dataclass(frozen=True)
class LawRecord:
    """One exact, versioned legal-text record."""

    act: str
    code: str
    section: str
    subsection: str | None
    heading: str
    exact_text: str
    source_url: str
    source_version: str
    source_hash: str
    jurisdiction: str = "India"
    former_citation: str | None = None
    canonical_title: str | None = None

    @property
    def citation(self) -> str:
        if self.former_citation:
            return f"{self.code}, Section {self.section} ({self.former_citation})"
        return f"{self.code}, Section {self.section}"


def _normalize_code(value: str | None) -> str:
    lowered = _SPACE_RE.sub(" ", (value or "").strip().lower())
    aliases = {
        "bns": "BNS",
        "bharatiya nyaya sanhita": "BNS",
        "bharatiya nyaya sanhita, 2023": "BNS",
        "bnss": "BNSS",
        "bharatiya nagarik suraksha sanhita": "BNSS",
        "bharatiya nagarik suraksha sanhita, 2023": "BNSS",
        "bsa": "BSA",
        "bharatiya sakshya adhiniyam": "BSA",
        "bharatiya sakshya adhiniyam, 2023": "BSA",
        "ipc": "IPC",
        "indian penal code": "IPC",
        "indian penal code, 1860": "IPC",
        "crpc": "CRPC",
        "code of criminal procedure": "CRPC",
        "code of criminal procedure, 1973": "CRPC",
        "iea": "IEA",
        "evidence act": "IEA",
        "indian evidence act": "IEA",
        "indian evidence act, 1872": "IEA",
        "ica": "ICA",
        "indian contract act": "ICA",
        "indian contract act, 1872": "ICA",
    }
    return aliases.get(lowered, value.strip().upper() if value else "")


def _normalize_section(value: str | None) -> tuple[str, str | None]:
    """Return canonical section and optional subsection, e.g. ``1(1)``."""

    cleaned = _SECTION_RE.sub("", value or "")
    cleaned = cleaned.strip().replace(" ", "")
    match = re.fullmatch(r"(\d+[A-Za-z]?)(?:\(([^()]*)\))?", cleaned)
    if not match:
        return cleaned, None
    section, subsection = match.groups()
    return f"{section}({subsection})" if subsection else section, subsection


def _record_from_payload(payload: dict[str, Any]) -> LawRecord:
    exact_text = str(payload["exact_text"])
    expected_hash = hashlib.sha256(exact_text.encode("utf-8")).hexdigest()
    source_hash = str(payload.get("source_hash") or expected_hash)
    if source_hash != expected_hash:
        raise ValueError(
            f"Source hash mismatch for {payload.get('code')} Section {payload.get('section')}"
        )

    section, parsed_subsection = _normalize_section(str(payload["section"]))
    subsection = payload.get("subsection") or parsed_subsection
    return LawRecord(
        act=str(payload["act"]),
        code=_normalize_code(str(payload["code"])),
        section=section,
        subsection=str(subsection) if subsection else None,
        heading=str(payload.get("heading", "")),
        exact_text=exact_text,
        source_url=str(payload["source_url"]),
        source_version=str(payload["source_version"]),
        source_hash=source_hash,
        jurisdiction=str(payload.get("jurisdiction", "India")),
    )


# (Old Code, Old Section) -> (New Code, New Section, Former Citation String, Canonical Title)
CONCORDANCE_MAP: dict[tuple[str, str], tuple[str, str, str, str]] = {
    # IPC -> BNS
    ("IPC", "34"): ("BNS", "3", "previously Section 34 IPC", "Joint liability and common intention"),
    ("IPC", "120B"): ("BNS", "61", "previously Section 120B IPC", "Criminal conspiracy"),
    ("IPC", "141"): ("BNS", "189", "previously Section 141 IPC", "Unlawful assembly"),
    ("IPC", "147"): ("BNS", "191", "previously Section 147 IPC", "Rioting"),
    ("IPC", "148"): ("BNS", "191", "previously Section 148 IPC", "Rioting armed with deadly weapon"),
    ("IPC", "149"): ("BNS", "190", "previously Section 149 IPC", "Unlawful assembly common object"),
    ("IPC", "153A"): ("BNS", "196", "previously Section 153A IPC", "Promoting enmity between groups"),
    ("IPC", "166"): ("BNS", "198", "previously Section 166 IPC", "Public servant disobeying law"),
    ("IPC", "193"): ("BNS", "229", "previously Section 193 IPC", "Punishment for false evidence / perjury"),
    ("IPC", "279"): ("BNS", "281", "previously Section 279 IPC", "Rash driving or riding on a public way"),
    ("IPC", "290"): ("BNS", "292", "previously Section 290 IPC", "Public nuisance"),
    ("IPC", "295A"): ("BNS", "299", "previously Section 295A IPC", "Deliberate acts outraging religious feelings"),
    ("IPC", "300"): ("BNS", "101", "previously Section 300 IPC", "Murder / Culpable homicide"),
    ("IPC", "302"): ("BNS", "103", "previously Section 302 IPC", "Punishment for murder"),
    ("IPC", "304"): ("BNS", "105", "previously Section 304 IPC", "Culpable homicide not amounting to murder"),
    ("IPC", "304A"): ("BNS", "106", "previously Section 304A IPC", "Causing death by negligence / Hit and run"),
    ("IPC", "304B"): ("BNS", "80", "previously Section 304B IPC", "Dowry death"),
    ("IPC", "306"): ("BNS", "108", "previously Section 306 IPC", "Abetment of suicide"),
    ("IPC", "307"): ("BNS", "109", "previously Section 307 IPC", "Attempt to murder"),
    ("IPC", "308"): ("BNS", "110", "previously Section 308 IPC", "Attempt to commit culpable homicide"),
    ("IPC", "323"): ("BNS", "115", "previously Section 323 IPC", "Voluntarily causing hurt"),
    ("IPC", "324"): ("BNS", "118", "previously Section 324 IPC", "Voluntarily causing hurt by dangerous weapons"),
    ("IPC", "325"): ("BNS", "117", "previously Section 325 IPC", "Voluntarily causing grievous hurt"),
    ("IPC", "326"): ("BNS", "118", "previously Section 326 IPC", "Voluntarily causing grievous hurt by dangerous weapons"),
    ("IPC", "326A"): ("BNS", "124", "previously Section 326A IPC", "Acid attack"),
    ("IPC", "336"): ("BNS", "125", "previously Section 336 IPC", "Act endangering life or personal safety"),
    ("IPC", "341"): ("BNS", "126", "previously Section 341 IPC", "Wrongful restraint"),
    ("IPC", "342"): ("BNS", "127", "previously Section 342 IPC", "Wrongful confinement"),
    ("IPC", "354"): ("BNS", "74", "previously Section 354 IPC", "Assault or criminal force to woman with intent to outrage modesty"),
    ("IPC", "354A"): ("BNS", "75", "previously Section 354A IPC", "Sexual harassment"),
    ("IPC", "354B"): ("BNS", "76", "previously Section 354B IPC", "Assault with intent to disrobe"),
    ("IPC", "354C"): ("BNS", "77", "previously Section 354C IPC", "Voyeurism"),
    ("IPC", "354D"): ("BNS", "78", "previously Section 354D IPC", "Stalking"),
    ("IPC", "363"): ("BNS", "137", "previously Section 363 IPC", "Kidnapping"),
    ("IPC", "365"): ("BNS", "140", "previously Section 365 IPC", "Kidnapping or abducting with intent to secretly confine"),
    ("IPC", "375"): ("BNS", "63", "previously Section 375 IPC", "Rape"),
    ("IPC", "376"): ("BNS", "64", "previously Section 376 IPC", "Punishment for rape"),
    ("IPC", "376D"): ("BNS", "70", "previously Section 376D IPC", "Gang rape"),
    ("IPC", "378"): ("BNS", "303", "previously Section 378 IPC", "Theft"),
    ("IPC", "379"): ("BNS", "303", "previously Section 379 IPC", "Punishment for theft"),
    ("IPC", "380"): ("BNS", "305", "previously Section 380 IPC", "Theft in dwelling house"),
    ("IPC", "383"): ("BNS", "308", "previously Section 383 IPC", "Extortion"),
    ("IPC", "384"): ("BNS", "308", "previously Section 384 IPC", "Punishment for extortion"),
    ("IPC", "390"): ("BNS", "309", "previously Section 390 IPC", "Robbery"),
    ("IPC", "391"): ("BNS", "310", "previously Section 391 IPC", "Dacoity"),
    ("IPC", "392"): ("BNS", "309", "previously Section 392 IPC", "Punishment for robbery"),
    ("IPC", "395"): ("BNS", "310", "previously Section 395 IPC", "Punishment for dacoity"),
    ("IPC", "405"): ("BNS", "316", "previously Section 405 IPC", "Criminal breach of trust"),
    ("IPC", "406"): ("BNS", "316", "previously Section 406 IPC", "Punishment for criminal breach of trust"),
    ("IPC", "415"): ("BNS", "318", "previously Section 415 IPC", "Cheating"),
    ("IPC", "420"): ("BNS", "318", "previously Section 420 IPC", "Cheating and dishonestly inducing delivery of property"),
    ("IPC", "425"): ("BNS", "324", "previously Section 425 IPC", "Mischief"),
    ("IPC", "441"): ("BNS", "329", "previously Section 441 IPC", "Criminal trespass"),
    ("IPC", "447"): ("BNS", "329", "previously Section 447 IPC", "Punishment for criminal trespass"),
    ("IPC", "448"): ("BNS", "331", "previously Section 448 IPC", "House-trespass"),
    ("IPC", "463"): ("BNS", "336", "previously Section 463 IPC", "Forgery"),
    ("IPC", "465"): ("BNS", "336", "previously Section 465 IPC", "Punishment for forgery"),
    ("IPC", "468"): ("BNS", "338", "previously Section 468 IPC", "Forgery for purpose of cheating"),
    ("IPC", "471"): ("BNS", "340", "previously Section 471 IPC", "Using as genuine a forged document"),
    ("IPC", "498A"): ("BNS", "85", "previously Section 498A IPC", "Cruelty by husband or relatives of husband"),
    ("IPC", "499"): ("BNS", "356", "previously Section 499 IPC", "Defamation"),
    ("IPC", "500"): ("BNS", "356", "previously Section 500 IPC", "Punishment for defamation"),
    ("IPC", "503"): ("BNS", "351", "previously Section 503 IPC", "Criminal intimidation"),
    ("IPC", "504"): ("BNS", "352", "previously Section 504 IPC", "Intentional insult with intent to provoke breach of peace"),
    ("IPC", "506"): ("BNS", "351", "previously Section 506 IPC", "Punishment for criminal intimidation"),
    ("IPC", "509"): ("BNS", "79", "previously Section 509 IPC", "Word, gesture or act intended to insult modesty of woman"),

    # CrPC -> BNSS
    ("CRPC", "41"): ("BNSS", "35", "previously Section 41 CrPC", "When police may arrest without warrant"),
    ("CRPC", "41A"): ("BNSS", "35", "previously Section 41A CrPC", "Notice of appearance before police officer"),
    ("CRPC", "41B"): ("BNSS", "36", "previously Section 41B CrPC", "Procedure of arrest and duties of officer making arrest"),
    ("CRPC", "41D"): ("BNSS", "38", "previously Section 41D CrPC", "Right of arrested person to meet an advocate"),
    ("CRPC", "46"): ("BNSS", "43", "previously Section 46 CrPC", "Arrest how made"),
    ("CRPC", "50"): ("BNSS", "47", "previously Section 50 CrPC", "Person arrested to be informed of grounds of arrest and right to bail"),
    ("CRPC", "51"): ("BNSS", "49", "previously Section 51 CrPC", "Search of arrested person"),
    ("CRPC", "54"): ("BNSS", "53", "previously Section 54 CrPC", "Medical examination of arrested person"),
    ("CRPC", "57"): ("BNSS", "58", "previously Section 57 CrPC", "Person arrested not to be detained more than twenty-four hours"),
    ("CRPC", "61"): ("BNSS", "63", "previously Section 61 CrPC", "Form of summons"),
    ("CRPC", "70"): ("BNSS", "72", "previously Section 70 CrPC", "Form of warrant of arrest"),
    ("CRPC", "91"): ("BNSS", "94", "previously Section 91 CrPC", "Summons to produce document or other thing"),
    ("CRPC", "93"): ("BNSS", "96", "previously Section 93 CrPC", "When search-warrant may be issued"),
    ("CRPC", "100"): ("BNSS", "103", "previously Section 100 CrPC", "Search of closed place and independent witnesses"),
    ("CRPC", "154"): ("BNSS", "173", "previously Section 154 CrPC", "Information in cognizable cases (FIR)"),
    ("CRPC", "155"): ("BNSS", "174", "previously Section 155 CrPC", "Information as to non-cognizable cases (NCR)"),
    ("CRPC", "156"): ("BNSS", "175", "previously Section 156 CrPC", "Police officer power to investigate cognizable case"),
    ("CRPC", "160"): ("BNSS", "179", "previously Section 160 CrPC", "Police officer power to require attendance of witnesses"),
    ("CRPC", "161"): ("BNSS", "180", "previously Section 161 CrPC", "Examination of witnesses by police"),
    ("CRPC", "162"): ("BNSS", "182", "previously Section 162 CrPC", "Statements to police not to be signed"),
    ("CRPC", "164"): ("BNSS", "183", "previously Section 164 CrPC", "Recording of confessions and statements by Magistrate"),
    ("CRPC", "165"): ("BNSS", "185", "previously Section 165 CrPC", "Search by police officer without warrant"),
    ("CRPC", "167"): ("BNSS", "187", "previously Section 167 CrPC", "Procedure when investigation cannot be completed in 24 hours (remand)"),
    ("CRPC", "173"): ("BNSS", "193", "previously Section 173 CrPC", "Report of police officer on completion of investigation (Chargesheet)"),
    ("CRPC", "174"): ("BNSS", "194", "previously Section 174 CrPC", "Police enquiry on suicide / Inquest"),
    ("CRPC", "190"): ("BNSS", "210", "previously Section 190 CrPC", "Cognizance of offences by Magistrates"),
    ("CRPC", "200"): ("BNSS", "223", "previously Section 200 CrPC", "Examination of complainant"),
    ("CRPC", "204"): ("BNSS", "227", "previously Section 204 CrPC", "Issue of process"),
    ("CRPC", "207"): ("BNSS", "230", "previously Section 207 CrPC", "Supply to the accused of copy of police report and other documents"),
    ("CRPC", "227"): ("BNSS", "250", "previously Section 227 CrPC", "Discharge in Sessions trial"),
    ("CRPC", "228"): ("BNSS", "251", "previously Section 228 CrPC", "Framing of charge in Sessions trial"),
    ("CRPC", "436"): ("BNSS", "478", "previously Section 436 CrPC", "In what cases bail to be taken (Bailable offences)"),
    ("CRPC", "436A"): ("BNSS", "479", "previously Section 436A CrPC", "Maximum period of detention of undertrial prisoner"),
    ("CRPC", "437"): ("BNSS", "480", "previously Section 437 CrPC", "When bail may be taken in case of non-bailable offence"),
    ("CRPC", "438"): ("BNSS", "482", "previously Section 438 CrPC", "Anticipatory bail (direction for grant of bail to person apprehending arrest)"),
    ("CRPC", "439"): ("BNSS", "483", "previously Section 439 CrPC", "Special powers of High Court or Court of Session regarding bail"),
    ("CRPC", "482"): ("BNSS", "528", "previously Section 482 CrPC", "Saving of inherent powers of High Court (Quashing)"),

    # IEA -> BSA
    ("IEA", "61"): ("BSA", "56", "previously Section 61 Indian Evidence Act", "Proof of contents of documents"),
    ("IEA", "62"): ("BSA", "57", "previously Section 62 Indian Evidence Act", "Primary evidence"),
    ("IEA", "63"): ("BSA", "58", "previously Section 63 Indian Evidence Act", "Secondary evidence"),
    ("IEA", "65A"): ("BSA", "61", "previously Section 65A Indian Evidence Act", "Admissibility of electronic or digital record"),
    ("IEA", "65B"): ("BSA", "63", "previously Section 65B Indian Evidence Act", "Admissibility of electronic records in evidence"),
    ("IEA", "101"): ("BSA", "104", "previously Section 101 Indian Evidence Act", "Burden of proof"),
    ("IEA", "113A"): ("BSA", "117", "previously Section 113A Indian Evidence Act", "Presumption as to abetment of suicide by married woman"),
    ("IEA", "113B"): ("BSA", "118", "previously Section 113B Indian Evidence Act", "Presumption as to dowry death"),
    ("IEA", "133"): ("BSA", "138", "previously Section 133 Indian Evidence Act", "Accomplice evidence"),
    ("IEA", "137"): ("BSA", "142", "previously Section 137 Indian Evidence Act", "Examination of witnesses"),
    ("IEA", "141"): ("BSA", "146", "previously Section 141 Indian Evidence Act", "Leading questions"),
}

REVERSE_CONCORDANCE_MAP: dict[tuple[str, str], tuple[str, str]] = {
    (new_code, new_sec): (former, title)
    for (old_code, old_sec), (new_code, new_sec, former, title) in CONCORDANCE_MAP.items()
}
# Significant new statutory provisions introduced in 2023 enactments
REVERSE_CONCORDANCE_MAP[("BNSS", "105")] = ("new provision in BNSS, 2023", "Mandatory audio-video electronic recording of search and seizure")
REVERSE_CONCORDANCE_MAP[("BNS", "304")] = ("new provision in BNS, 2023", "Snatching")
REVERSE_CONCORDANCE_MAP[("BNS", "69")] = ("new provision in BNS, 2023", "Sexual intercourse by deceitful means / false promise to marry")
REVERSE_CONCORDANCE_MAP[("BNS", "111")] = ("new provision in BNS, 2023", "Organised crime")
REVERSE_CONCORDANCE_MAP[("BNS", "112")] = ("new provision in BNS, 2023", "Petty organised crime")
REVERSE_CONCORDANCE_MAP[("BNS", "113")] = ("new provision in BNS, 2023", "Terrorist act")

CONCEPT_RULES: list[dict[str, Any]] = [
    {
        "keywords": ["murder", "killing", "killed", "homicide", "jaan se maar", "jaan se marne", "hatya"],
        "targets": [("BNS", "103"), ("BNS", "105"), ("BNS", "101")],
    },
    {
        "keywords": ["attempt to murder", "jaanleva", "marne ki koshish"],
        "targets": [("BNS", "109")],
    },
    {
        "keywords": ["cheat", "cheating", "fraud", "scam", "dhokhadhadi", "dhokha", "embezzlement", "420"],
        "targets": [("BNS", "318"), ("BNS", "316")],
    },
    {
        "keywords": ["theft", "stole", "stolen", "stealing", "thief", "chori", "chura"],
        "targets": [("BNS", "303"), ("BNS", "305")],
    },
    {
        "keywords": [
            "snatch", "snatched", "snatching", "chain snatching", "mobile snatching", "phone snatching",
            "chinauti", "chheen", "chheena", "chheen liya", "chheen kar", "cheen liya", "cheena"
        ],
        "targets": [("BNS", "304"), ("BNS", "309")],
    },
    {
        "keywords": [
            "extortion", "extort", "extorted", "extorting", "demanded money", "demanding money",
            "demanded cash", "demand money", "hafta", "vasooli", "rangdari", "threatened to burn",
            "burn down", "burn property", "blackmail", "blackmailing", "ransom"
        ],
        "targets": [("BNS", "308"), ("BNS", "351")],
    },
    {
        "keywords": [
            "robbery", "robbed", "robbing", "loot", "looted", "looting", "dacoity", "dacoit",
            "snatched by force", "snatched with violence", "snatched using force", "robbed phone"
        ],
        "targets": [("BNS", "309"), ("BNS", "308")],
    },
    {
        "keywords": [
            "threat", "threatening", "threatened", "intimidation", "dhamki", "dhamkaya",
            "threatened to kill", "threatened to burn", "criminal intimidation", "jaan se marne ki dhamki"
        ],
        "targets": [("BNS", "351"), ("BNS", "352")],
    },
    {
        "keywords": [
            "insult", "insulted", "abused", "abusive language", "gaali", "provoke breach of peace", "intentional insult"
        ],
        "targets": [("BNS", "352")],
    },
    {
        "keywords": ["rash", "negligent driving", "accident", "vehicle", "hit and run", "car crash", "rash driving"],
        "targets": [("BNS", "281"), ("BNS", "106")],
    },
    {
        "keywords": ["dowry", "dahej", "cruelty", "domestic violence", "in-laws", "harassment by husband", "patni"],
        "targets": [("BNS", "85"), ("BNS", "86"), ("BNS", "80")],
    },
    {
        "keywords": [
            "assault", "slap", "slapped", "slapping", "thappad", "beating", "beaten", "hit", "punched",
            "marpeet", "fight", "hurt", "grievous hurt", "fracture", "chot", "injury", "physical violence"
        ],
        "targets": [("BNS", "115"), ("BNS", "117"), ("BNS", "118")],
    },
    {
        "keywords": ["rape", "balatkar", "sexual assault", "molestation", "chedchad", "outrage modesty", "stalking"],
        "targets": [("BNS", "64"), ("BNS", "74"), ("BNS", "75"), ("BNS", "78")],
    },
    {
        "keywords": ["false promise to marry", "promise of marriage", "deceitful means"],
        "targets": [("BNS", "69")],
    },
    {
        "keywords": ["defamation", "defame", "badnaam", "character assassination"],
        "targets": [("BNS", "356")],
    },
    {
        "keywords": ["forgery", "forged", "fake document", "fake signature", "fraudulent deed"],
        "targets": [("BNS", "336"), ("BNS", "338"), ("BNS", "340")],
    },
    {
        "keywords": ["conspiracy", "sazish", "conspire"],
        "targets": [("BNS", "61")],
    },
    {
        "keywords": ["arrest", "arrested", "custody", "detained", "girftar", "girftari", "police station", "warrant", "41a"],
        "targets": [("BNSS", "35"), ("BNSS", "47"), ("BNSS", "58"), ("BNSS", "36")],
    },
    {
        "keywords": ["search", "seizure", "seize", "seized", "raids", "talashi", "chhapamari", "confiscate", "without warrant"],
        "targets": [("BNSS", "185"), ("BNSS", "103"), ("BNSS", "105"), ("BNSS", "94")],
    },
    {
        "keywords": ["anticipatory bail", "agrim jamanat", "pre-arrest bail", "apprehending arrest"],
        "targets": [("BNSS", "482")],
    },
    {
        "keywords": ["bail", "jamanat", "bond", "surety", "bailable", "non-bailable"],
        "targets": [("BNSS", "480"), ("BNSS", "478"), ("BNSS", "483")],
    },
    {
        "keywords": [
            "fir", "first information report", "police complaint", "zero fir", "refusal to register fir",
            "police not registering", "lodge fir", "police station complaint", "lodging complaint"
        ],
        "targets": [("BNSS", "173"), ("BNSS", "175"), ("BNSS", "170")],
    },
    {
        "keywords": ["police questioning", "witness", "interrogation", "statement to police", "161"],
        "targets": [("BNSS", "179"), ("BNSS", "180"), ("BNSS", "182")],
    },
    {
        "keywords": ["remand", "police remand", "magisterial custody", "24 hours", "detention"],
        "targets": [("BNSS", "187"), ("BNSS", "58")],
    },
    {
        "keywords": ["quash", "quashing", "quash fir", "false case", "fake allegation"],
        "targets": [("BNSS", "528")],
    },
    {
        "keywords": ["electronic evidence", "digital evidence", "whatsapp", "cctv", "call recording", "phone records", "audio evidence", "video evidence", "screenshot", "65b"],
        "targets": [("BSA", "61"), ("BSA", "63")],
    },
]


class LawSourceRegistry:
    """Read-only lookup over a validated JSON corpus."""

    def __init__(self, records: Iterable[LawRecord] = ()) -> None:
        self._records: dict[tuple[str, str], LawRecord] = {}
        for record in records:
            key = (_normalize_code(record.code), _normalize_section(record.section)[0])
            if key in self._records:
                raise ValueError(f"Duplicate legal source record: {key[0]} Section {key[1]}")
            self._records[key] = record

    @classmethod
    def from_json(cls, path: str | Path = _DEFAULT_CORPUS_PATH) -> "LawSourceRegistry":
        source_path = Path(path)
        payload = json.loads(source_path.read_text(encoding="utf-8"))
        if payload.get("schema_version") != "1.0":
            raise ValueError(f"Unsupported legal corpus schema: {payload.get('schema_version')}")
        supplemental_path = source_path.with_name("contract_corpus.json")
        supplemental_records = []
        if supplemental_path.is_file():
            supplemental = json.loads(supplemental_path.read_text(encoding="utf-8"))
            if supplemental.get("schema_version") != "1.0":
                raise ValueError(f"Unsupported supplemental corpus schema: {supplemental.get('schema_version')}")
            supplemental_records = supplemental.get("records", [])
        records = [
            _record_from_payload(item)
            for item in [*payload.get("records", []), *supplemental_records]
        ]
        return cls(records)

    def lookup(
        self,
        act: str | None = None,
        section: str | None = None,
        *,
        code: str | None = None,
        subsection: str | None = None,
    ) -> LawRecord | None:
        """Look up a section using either an Act name or a short code.

        ``act`` and ``code`` are both accepted for compatibility with model
        providers that use different field names. If both are supplied, each
        normalized value is tried without mutating the caller's data.
        """

        candidate_codes = []
        for candidate in (code, act):
            normalized = _normalize_code(candidate)
            if normalized and normalized not in candidate_codes:
                candidate_codes.append(normalized)
        section_value = str(section or "").strip()
        if subsection and "(" not in section_value:
            section_value = f"{section_value}({str(subsection).strip()})"
        normalized_section, _ = _normalize_section(section_value)
        for candidate_code in candidate_codes:
            record = self._records.get((candidate_code, normalized_section))
            if record is not None:
                return record
        return None

    def get_concordance_info(self, code: str | None, section: str | None) -> tuple[str | None, str | None]:
        """Return former section citation and canonical title if known."""
        norm_code = _normalize_code(code)
        norm_sec, _ = _normalize_section(section)
        return REVERSE_CONCORDANCE_MAP.get((norm_code, norm_sec), (None, None))

    def resolve_concordance(self, code: str | None, section: str | None) -> LawRecord | None:
        """Resolve any candidate statute, automatically mapping former codes (IPC/CrPC/IEA)
        or common model confusions directly to the authoritative 2023 Gazette record.
        """
        norm_code = _normalize_code(code)
        norm_sec, _ = _normalize_section(section)
        if not norm_sec:
            return None

        # 1. Direct lookup in loaded 2023 records
        rec = self.lookup(code=norm_code, section=norm_sec)
        if rec is not None:
            former, title = REVERSE_CONCORDANCE_MAP.get((rec.code, rec.section), (None, None))
            return replace(rec, former_citation=former, canonical_title=title) if (former or title) else rec

        # 2. Check if (norm_code, norm_sec) is in CONCORDANCE_MAP (e.g. ("IPC", "420") or ("CRPC", "438"))
        if (norm_code, norm_sec) in CONCORDANCE_MAP:
            target_code, target_sec, former, title = CONCORDANCE_MAP[(norm_code, norm_sec)]
            target_rec = self.lookup(code=target_code, section=target_sec)
            if target_rec is not None:
                return replace(target_rec, former_citation=former, canonical_title=title)

        # 3. Model confusion: candidate is labeled "BNS" but uses former IPC section number (e.g. BNS 420 or BNS 302)
        if norm_code == "BNS" and ("IPC", norm_sec) in CONCORDANCE_MAP:
            target_code, target_sec, former, title = CONCORDANCE_MAP[("IPC", norm_sec)]
            target_rec = self.lookup(code=target_code, section=target_sec)
            if target_rec is not None:
                return replace(target_rec, former_citation=former, canonical_title=title)

        # 4. Model confusion: candidate is labeled "BNSS" but uses former CrPC section number (e.g. BNSS 41 or BNSS 438)
        if norm_code == "BNSS" and ("CRPC", norm_sec) in CONCORDANCE_MAP:
            target_code, target_sec, former, title = CONCORDANCE_MAP[("CRPC", norm_sec)]
            target_rec = self.lookup(code=target_code, section=target_sec)
            if target_rec is not None:
                return replace(target_rec, former_citation=former, canonical_title=title)

        # 5. Model confusion: candidate is labeled "BSA" and section is 65B or 65A
        if norm_code == "BSA" and ("IEA", norm_sec) in CONCORDANCE_MAP:
            target_code, target_sec, former, title = CONCORDANCE_MAP[("IEA", norm_sec)]
            target_rec = self.lookup(code=target_code, section=target_sec)
            if target_rec is not None:
                return replace(target_rec, former_citation=former, canonical_title=title)

        # 6. Model confusion on FIR and procedural sections
        if norm_code in {"BNS", "BNSS"} and norm_sec in {"154", "154A"}:
            target_rec = self.lookup(code="BNSS", section="173")
            if target_rec is not None:
                return replace(target_rec, former_citation="previously Section 154 CrPC", canonical_title="Information in cognizable cases (FIR)")

        if norm_code == "BNS" and norm_sec == "151":
            target_rec = self.lookup(code="BNS", section="351")
            if target_rec is not None:
                return replace(target_rec, former_citation="previously Section 506 IPC", canonical_title="Criminal intimidation")

        return None

    def find_relevant_statutes(self, query: str, top_k: int = 4) -> list[tuple[LawRecord, str, str]]:
        """Retrieve verified statutory provisions from the official 2023 Gazette corpus.

        Returns a list of tuples: (LawRecord, former_citation_str, canonical_title).
        """
        results: list[tuple[LawRecord, str, str]] = []
        seen_keys: set[tuple[str, str]] = set()

        # Non-offence preliminary definition sections that should never be returned as substantive offences
        preliminary_sections = {
            ("BNS", "1"), ("BNS", "2"), ("BNS", "3"), ("BNS", "4"), ("BNS", "5"),
            ("BNS", "6"), ("BNS", "7"), ("BNS", "8"), ("BNS", "9"), ("BNS", "10"),
            ("BNSS", "1"), ("BNSS", "2"), ("BNSS", "6"), ("BNSS", "7"), ("BNSS", "8"),
            ("BNSS", "9"), ("BNSS", "10"), ("BSA", "1"), ("BSA", "2"), ("BSA", "8"),
        }

        def add_record(rec: LawRecord, former: str = "", title: str = "", allow_preliminary: bool = False):
            key = (rec.code, rec.section)
            if not allow_preliminary and key in preliminary_sections:
                return
            if key not in seen_keys:
                seen_keys.add(key)
                rev_former, rev_title = REVERSE_CONCORDANCE_MAP.get(key, (None, None))
                final_former = former or rev_former or ""
                final_title = title or rev_title or rec.heading or ""
                enriched_rec = replace(rec, former_citation=final_former, canonical_title=final_title)
                results.append((enriched_rec, final_former, final_title))

        q_clean = query or ""
        q_lower = q_clean.lower()

        # Step 1: Explicit mentions of acts + sections (e.g. IPC 420, BNS 318, CrPC 438, BNSS 482)
        explicit_re = re.compile(
            r"\b(BNS|BNSS|BSA|IPC|CRPC|IEA|EVIDENCE)\s*(?:section\s*)?(\d+[A-Za-z]?(?:\(\d+\))?)\b|"
            r"\b(?:section\s*)?(\d+[A-Za-z]?(?:\(\d+\))?)\s+(?:of\s+)?(BNS|BNSS|BSA|IPC|CRPC|IEA|EVIDENCE)\b",
            re.IGNORECASE,
        )
        for match in explicit_re.finditer(q_clean):
            if match.group(1):
                raw_code, raw_sec = match.group(1), match.group(2)
            else:
                raw_sec, raw_code = match.group(3), match.group(4)
            rec = self.resolve_concordance(raw_code, raw_sec)
            if rec is not None:
                rev_former, rev_title = REVERSE_CONCORDANCE_MAP.get((rec.code, rec.section), ("", ""))
                add_record(rec, rev_former, rev_title, allow_preliminary=False)

        # Step 2: Match factual concept rules FIRST before standalone numbers
        for rule in CONCEPT_RULES:
            matches_rule = any(
                re.search(r"\b" + re.escape(kw) + r"\b", q_lower)
                for kw in rule["keywords"]
            )
            if matches_rule:
                for target_code, target_sec in rule["targets"]:
                    rec = self.lookup(code=target_code, section=target_sec)
                    if rec is not None:
                        rev_former, rev_title = REVERSE_CONCORDANCE_MAP.get((rec.code, rec.section), ("", ""))
                        add_record(rec, rev_former, rev_title)
                    if len(results) >= top_k:
                        break
            if len(results) >= top_k:
                break

        # Step 3: Check numbers explicitly designated as sections (e.g. "Section 308", "sec 309", "dhara 351")
        explicit_sec_matches = re.findall(r"\b(?:section|sec|s\.|dhara|u/s)\s*(\d+[A-Za-z]?)\b", q_clean, re.IGNORECASE)
        for sec_num in explicit_sec_matches:
            num_clean = sec_num.upper()
            for old_code in ("IPC", "CRPC", "IEA"):
                if (old_code, num_clean) in CONCORDANCE_MAP:
                    rec = self.resolve_concordance(old_code, num_clean)
                    if rec is not None:
                        rev_former, rev_title = REVERSE_CONCORDANCE_MAP.get((rec.code, rec.section), ("", ""))
                        add_record(rec, rev_former, rev_title)
            for new_code in ("BNS", "BNSS", "BSA"):
                rec = self.lookup(code=new_code, section=num_clean)
                if rec is not None:
                    rev_former, rev_title = REVERSE_CONCORDANCE_MAP.get((rec.code, rec.section), ("", ""))
                    add_record(rec, rev_former, rev_title)

        # Step 4: Standalone numbers ONLY if in well-known criminal section whitelist (prevents "8" matching Section 8)
        well_known_standalone_sections = {
            "420", "302", "307", "376", "498A", "379", "384", "390", "392", "323", "504", "506",
            "438", "437", "436", "41A", "144", "161", "164", "138", "65B", "154", "318", "103",
            "106", "85", "64", "303", "304", "308", "309", "115", "351", "352", "482", "480",
            "478", "173", "175", "185",
        }
        num_matches = re.findall(r"\b(\d+[A-Za-z]?)\b", q_clean)
        for num in num_matches:
            num_clean = num.upper()
            if num_clean not in well_known_standalone_sections:
                continue
            for old_code in ("IPC", "CRPC", "IEA"):
                if (old_code, num_clean) in CONCORDANCE_MAP:
                    rec = self.resolve_concordance(old_code, num_clean)
                    if rec is not None:
                        rev_former, rev_title = REVERSE_CONCORDANCE_MAP.get((rec.code, rec.section), ("", ""))
                        add_record(rec, rev_former, rev_title)
            for new_code in ("BNS", "BNSS", "BSA"):
                rec = self.lookup(code=new_code, section=num_clean)
                if rec is not None:
                    rev_former, rev_title = REVERSE_CONCORDANCE_MAP.get((rec.code, rec.section), ("", ""))
                    add_record(rec, rev_former, rev_title)

        # Step 5: If still fewer than top_k and query is specific, search text
        if len(results) < top_k:
            query_tokens = [w for w in re.findall(r"\w{4,}", q_lower) if w not in {"what", "when", "where", "which", "about", "there", "their", "under", "police", "court"}]
            if query_tokens:
                for rec in self._records.values():
                    if rec.code not in {"BNS", "BNSS", "BSA"}:
                        continue
                    text_lower = rec.exact_text.lower()
                    if sum(1 for tok in query_tokens if tok in text_lower) >= 2:
                        rev_former, rev_title = REVERSE_CONCORDANCE_MAP.get((rec.code, rec.section), ("", ""))
                        add_record(rec, rev_former, rev_title)
                    if len(results) >= top_k:
                        break

        return results[:top_k]

    def __len__(self) -> int:
        return len(self._records)

    def records(self) -> tuple[LawRecord, ...]:
        return tuple(self._records.values())


_registry: LawSourceRegistry | None = None


def get_registry() -> LawSourceRegistry:
    """Return the process-wide registry, loading and validating it once."""

    global _registry
    if _registry is None:
        _registry = LawSourceRegistry.from_json()
    return _registry
