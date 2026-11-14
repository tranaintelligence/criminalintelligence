"""Versioned legal-source registry.

The registry is intentionally small and deterministic. LLM output may identify a
candidate Act and section, but only records loaded here can become authoritative
quotes in an API response.

Design notes
------------
* Every record is hash-verified on load (``source_hash``) and can be re-verified
  later with :meth:`LawSourceRegistry.verify_integrity`.
* Concordance data (IPC/CrPC/IEA -> BNS/BNSS/BSA) is declared once in compact
  tables; the forward and reverse maps, and the "previously Section X" strings,
  are generated from them so they can never drift apart.
* Resolution reports *how* a section was resolved (``direct`` / ``concordance`` /
  ``label_correction``) so callers can treat auto-corrected model output with
  appropriate suspicion.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import threading
import unicodedata
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any, Iterable, Iterator

logger = logging.getLogger(__name__)

_DEFAULT_CORPUS_PATH = Path(__file__).with_name("corpus.json")
_SUPPLEMENTAL_CORPUS_NAME = "contract_corpus.json"
_SUPPORTED_SCHEMA = "1.0"
MAX_QUERY_CHARS = 4000  # hard cap on free-text input to the retrieval functions

_NEW_CODES = ("BNS", "BNSS", "BSA")
_OLD_CODES = ("IPC", "CRPC", "IEA")
_NEW_TO_OLD_FAMILY = {"BNS": "IPC", "BNSS": "CRPC", "BSA": "IEA"}

# --------------------------------------------------------------------------- #
# Normalisation helpers
# --------------------------------------------------------------------------- #

_SPACE_RE = re.compile(r"\s+")
_YEAR_SUFFIX_RE = re.compile(r"\s*,?\s*\b(?:1[89]|20)\d{2}$")
# Anchored: only strips a *leading* "Section"/"s."/"u/s"/"dhara" label.
_SECTION_PREFIX_RE = re.compile(
    r"^\s*(?:sections?|sec|s|article|dhara|u/s|धारा)\s*\.?\s*", re.IGNORECASE
)
_SECTION_BODY_RE = re.compile(r"(\d+)([A-Za-z]?)((?:\([^()]*\))*)")
_SUBSECTION_RE = re.compile(r"\(([^()]*)\)")
_TRAILING_PAREN_RE = re.compile(r"\([^()]*\)$")

_CODE_ALIASES = {
    "bns": "BNS",
    "bharatiya nyaya sanhita": "BNS",
    "bnss": "BNSS",
    "bharatiya nagarik suraksha sanhita": "BNSS",
    "bsa": "BSA",
    "bharatiya sakshya adhiniyam": "BSA",
    "ipc": "IPC",
    "indian penal code": "IPC",
    "crpc": "CRPC",
    "cr pc": "CRPC",
    "code of criminal procedure": "CRPC",
    "iea": "IEA",
    "evidence act": "IEA",
    "indian evidence act": "IEA",
    "ica": "ICA",
    "contract act": "ICA",
    "indian contract act": "ICA",
}


def _normalize_code(value: str | None) -> str:
    """Map an Act name / abbreviation (``Cr.P.C.``, ``Indian Penal Code, 1860``) to a short code."""

    if not value:
        return ""
    raw = str(value)
    text = unicodedata.normalize("NFKC", raw).lower().replace(".", "").replace(",", " ")
    text = _SPACE_RE.sub(" ", text).strip()
    text = _YEAR_SUFFIX_RE.sub("", text).strip()
    if text.startswith("the "):
        text = text[4:]
    return _CODE_ALIASES.get(text, _SPACE_RE.sub(" ", raw.strip()).upper())


def _normalize_section(value: str | None) -> tuple[str, str | None]:
    """Return ``(canonical_section, first_level_subsection)``.

    ``"Section 65b"`` -> ``("65B", None)``; ``"s. 3(5)(a)"`` -> ``("3(5)(a)", "5")``.
    Unparseable input is returned cleaned but otherwise untouched.
    """

    cleaned = _SECTION_PREFIX_RE.sub("", str(value or ""), count=1)
    cleaned = _SPACE_RE.sub("", cleaned)
    match = _SECTION_BODY_RE.fullmatch(cleaned)
    if not match:
        return cleaned, None
    number, letter, suffix = match.groups()
    subsections = _SUBSECTION_RE.findall(suffix)
    return f"{number}{letter.upper()}{suffix}", (subsections[0] if subsections else None)


def _base_section(section: str) -> str:
    """``"318(4)"`` -> ``"318"``."""

    return section.split("(", 1)[0]


# --------------------------------------------------------------------------- #
# Records
# --------------------------------------------------------------------------- #


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
    def key(self) -> tuple[str, str]:
        return (self.code, self.section)

    @property
    def citation(self) -> str:
        if self.former_citation:
            return f"{self.code}, Section {self.section} ({self.former_citation})"
        return f"{self.code}, Section {self.section}"


_REQUIRED_FIELDS = ("act", "code", "section", "exact_text", "source_url", "source_version")


def _clean_hash(value: Any) -> str:
    text = str(value).strip().lower()
    return text[len("sha256:"):] if text.startswith("sha256:") else text


def _record_from_payload(payload: dict[str, Any]) -> LawRecord:
    if not isinstance(payload, dict):
        raise ValueError(f"Legal source record must be an object, got {type(payload).__name__}")
    label = f"{payload.get('code')} Section {payload.get('section')}"
    missing = [f for f in _REQUIRED_FIELDS if payload.get(f) in (None, "")]
    if missing:
        raise ValueError(f"Legal source record {label} is missing fields: {', '.join(missing)}")

    exact_text = str(payload["exact_text"])
    if not exact_text.strip():
        raise ValueError(f"Legal source record {label} has empty exact_text")
    expected_hash = hashlib.sha256(exact_text.encode("utf-8")).hexdigest()
    source_hash = _clean_hash(payload.get("source_hash") or expected_hash)
    if source_hash != expected_hash:
        raise ValueError(f"Source hash mismatch for {label}")

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


# --------------------------------------------------------------------------- #
# Concordance (old code -> 2023 code). Declared once; everything else is derived.
# Rows: (old_section, new_section, canonical_title)
#
# NOTE: several old sections legitimately collapse into one new section
# (e.g. IPC 415 and 420 -> BNS 318), and the new sections often carry the
# old section as a sub-section (e.g. IPC 34 -> BNS 3(5), IPC 420 -> BNS 318(4)).
# Keys are base sections because the corpus is keyed by base section.
# Entries marked (fixed) were corrected from the earlier version; re-verify them
# against the Gazette text before relying on them.
# --------------------------------------------------------------------------- #

_OLD_CODE_LABELS = {"IPC": "IPC", "CRPC": "CrPC", "IEA": "Indian Evidence Act"}

_IPC_TO_BNS = (
    ("34", "3", "Joint liability and common intention"),  # BNS 3(5)
    ("120B", "61", "Criminal conspiracy"),
    ("141", "189", "Unlawful assembly"),
    ("147", "191", "Rioting"),
    ("148", "191", "Rioting armed with deadly weapon"),
    ("149", "190", "Unlawful assembly common object"),
    ("153A", "196", "Promoting enmity between groups"),
    ("166", "198", "Public servant disobeying law"),
    ("193", "229", "Punishment for false evidence / perjury"),
    ("279", "281", "Rash driving or riding on a public way"),
    ("290", "292", "Public nuisance"),
    ("295A", "299", "Deliberate acts outraging religious feelings"),
    ("300", "101", "Murder / Culpable homicide"),
    ("302", "103", "Punishment for murder"),
    ("304", "105", "Culpable homicide not amounting to murder"),
    ("304A", "106", "Causing death by negligence / Hit and run"),
    ("304B", "80", "Dowry death"),
    ("306", "108", "Abetment of suicide"),
    ("307", "109", "Attempt to murder"),
    ("308", "110", "Attempt to commit culpable homicide"),
    ("323", "115", "Voluntarily causing hurt"),
    ("324", "118", "Voluntarily causing hurt by dangerous weapons"),
    ("325", "117", "Voluntarily causing grievous hurt"),
    ("326", "118", "Voluntarily causing grievous hurt by dangerous weapons"),
    ("326A", "124", "Acid attack"),
    ("336", "125", "Act endangering life or personal safety"),
    ("341", "126", "Wrongful restraint"),
    ("342", "127", "Wrongful confinement"),
    ("351", "130", "Assault"),
    ("352", "131", "Punishment for assault or criminal force"),
    ("353", "132", "Assault or criminal force to deter public servant"),
    ("354", "74", "Assault or criminal force to woman with intent to outrage modesty"),
    ("354A", "75", "Sexual harassment"),
    ("354B", "76", "Assault with intent to disrobe"),
    ("354C", "77", "Voyeurism"),
    ("354D", "78", "Stalking"),
    ("357", "135", "Assault in attempting wrongfully to confine a person"),
    ("363", "137", "Kidnapping"),
    ("365", "140", "Kidnapping or abducting with intent to secretly confine"),
    ("375", "63", "Rape"),
    ("376", "64", "Punishment for rape"),
    ("376D", "70", "Gang rape"),
    ("378", "303", "Theft"),
    ("379", "303", "Punishment for theft"),
    ("380", "305", "Theft in dwelling house"),
    ("383", "308", "Extortion"),
    ("384", "308", "Punishment for extortion"),
    ("390", "309", "Robbery"),
    ("391", "310", "Dacoity"),
    ("392", "309", "Punishment for robbery"),
    ("395", "310", "Punishment for dacoity"),
    ("405", "316", "Criminal breach of trust"),
    ("406", "316", "Punishment for criminal breach of trust"),
    ("415", "318", "Cheating"),
    ("420", "318", "Cheating and dishonestly inducing delivery of property"),
    ("425", "324", "Mischief"),
    ("441", "329", "Criminal trespass"),
    ("447", "329", "Punishment for criminal trespass"),
    ("448", "329", "Punishment for house-trespass"),  # (fixed) was 331
    ("463", "336", "Forgery"),
    ("465", "336", "Punishment for forgery"),
    ("468", "336", "Forgery for purpose of cheating"),  # (fixed) was 338
    ("471", "340", "Using as genuine a forged document"),
    ("498A", "85", "Cruelty by husband or relatives of husband"),
    ("499", "356", "Defamation"),
    ("500", "356", "Punishment for defamation"),
    ("503", "351", "Criminal intimidation"),
    ("504", "352", "Intentional insult with intent to provoke breach of peace"),
    ("506", "351", "Punishment for criminal intimidation"),
    ("509", "79", "Word, gesture or act intended to insult modesty of woman"),
)

_CRPC_TO_BNSS = (
    ("41", "35", "When police may arrest without warrant"),
    ("41A", "35", "Notice of appearance before police officer"),
    ("41B", "36", "Procedure of arrest and duties of officer making arrest"),
    ("41D", "38", "Right of arrested person to meet an advocate"),
    ("46", "43", "Arrest how made"),
    ("50", "47", "Person arrested to be informed of grounds of arrest and right to bail"),
    ("51", "49", "Search of arrested person"),
    ("54", "53", "Medical examination of arrested person"),
    ("57", "58", "Person arrested not to be detained more than twenty-four hours"),
    ("61", "63", "Form of summons"),
    ("70", "72", "Form of warrant of arrest"),
    ("91", "94", "Summons to produce document or other thing"),
    ("93", "96", "When search-warrant may be issued"),
    ("100", "103", "Search of closed place and independent witnesses"),
    ("154", "173", "Information in cognizable cases (FIR)"),
    ("155", "174", "Information as to non-cognizable cases (NCR)"),
    ("156", "175", "Police officer power to investigate cognizable case"),
    ("160", "179", "Police officer power to require attendance of witnesses"),
    ("161", "180", "Examination of witnesses by police"),
    ("162", "181", "Statements to police not to be signed"),  # (fixed) was 182
    ("164", "183", "Recording of confessions and statements by Magistrate"),
    ("165", "185", "Search by police officer without warrant"),
    ("167", "187", "Procedure when investigation cannot be completed in 24 hours (remand)"),
    ("173", "193", "Report of police officer on completion of investigation (Chargesheet)"),
    ("174", "194", "Police enquiry on suicide / Inquest"),
    ("190", "210", "Cognizance of offences by Magistrates"),
    ("200", "223", "Examination of complainant"),
    ("204", "227", "Issue of process"),
    ("207", "230", "Supply to the accused of copy of police report and other documents"),
    ("227", "250", "Discharge in Sessions trial"),
    ("228", "251", "Framing of charge in Sessions trial"),
    ("436", "478", "In what cases bail to be taken (Bailable offences)"),
    ("436A", "479", "Maximum period of detention of undertrial prisoner"),
    ("437", "480", "When bail may be taken in case of non-bailable offence"),
    ("438", "482", "Anticipatory bail (direction for grant of bail to person apprehending arrest)"),
    ("439", "483", "Special powers of High Court or Court of Session regarding bail"),
    ("482", "528", "Saving of inherent powers of High Court (Quashing)"),
)

_IEA_TO_BSA = (
    ("61", "56", "Proof of contents of documents"),
    ("62", "57", "Primary evidence"),
    ("63", "58", "Secondary evidence"),
    ("65A", "62", "Special provisions as to evidence relating to electronic record"),  # (fixed) was 61
    ("65B", "63", "Admissibility of electronic records in evidence"),
    ("101", "104", "Burden of proof"),
    ("113A", "117", "Presumption as to abetment of suicide by married woman"),
    ("113B", "118", "Presumption as to dowry death"),
    ("133", "138", "Accomplice evidence"),
    ("137", "142", "Examination of witnesses"),
    ("141", "146", "Leading questions"),
)

# Significant provisions with no old-code counterpart.
_NEW_PROVISIONS: dict[tuple[str, str], tuple[str, str]] = {
    ("BNSS", "105"): ("new provision in BNSS, 2023", "Mandatory audio-video electronic recording of search and seizure"),
    ("BNS", "304"): ("new provision in BNS, 2023", "Snatching"),
    ("BNS", "69"): ("new provision in BNS, 2023", "Sexual intercourse by deceitful means / false promise to marry"),
    ("BNS", "111"): ("new provision in BNS, 2023", "Organised crime"),
    ("BNS", "112"): ("new provision in BNS, 2023", "Petty organised crime"),
    ("BNS", "113"): ("new provision in BNS, 2023", "Terrorist act"),
}

# Last-resort fixes for specific model mislabels that no generic rule can recover.
# (BNS 151 -> 351 looks like a one-off; delete it unless you have evidence it recurs.)
_KNOWN_MISLABELS: dict[tuple[str, str], tuple[str, str, str, str]] = {
    ("BNS", "151"): ("BNS", "351", "previously Section 506 IPC", "Criminal intimidation"),
}


def _former_label(old_code: str, old_section: str) -> str:
    return f"previously Section {old_section} {_OLD_CODE_LABELS[old_code]}"


def _build_forward() -> dict[tuple[str, str], tuple[str, str, str, str]]:
    forward: dict[tuple[str, str], tuple[str, str, str, str]] = {}
    blocks = (("IPC", "BNS", _IPC_TO_BNS), ("CRPC", "BNSS", _CRPC_TO_BNSS), ("IEA", "BSA", _IEA_TO_BSA))
    for old_code, new_code, rows in blocks:
        for old_sec, new_sec, title in rows:
            key = (old_code, old_sec)
            if key in forward:
                raise ValueError(f"Duplicate concordance row: {old_code} {old_sec}")
            forward[key] = (new_code, new_sec, _former_label(old_code, old_sec), title)
    return forward


def _join_sections(sections: list[str]) -> str:
    if len(sections) == 1:
        return sections[0]
    return f"{', '.join(sections[:-1])} and {sections[-1]}"


def _build_reverse(
    forward: dict[tuple[str, str], tuple[str, str, str, str]],
) -> dict[tuple[str, str], tuple[str, str]]:
    """Group every old section that feeds a new section (the old code kept only the last)."""

    grouped: dict[tuple[str, str], dict[str, list[str]]] = {}
    first_title: dict[tuple[str, str], str] = {}
    for (old_code, old_sec), (new_code, new_sec, _former, title) in forward.items():
        key = (new_code, new_sec)
        grouped.setdefault(key, {}).setdefault(old_code, []).append(old_sec)
        first_title.setdefault(key, title)
    reverse: dict[tuple[str, str], tuple[str, str]] = {}
    for key, by_code in grouped.items():
        parts = [
            f"{'Section' if len(secs) == 1 else 'Sections'} {_join_sections(secs)} {_OLD_CODE_LABELS[code]}"
            for code, secs in by_code.items()
        ]
        reverse[key] = ("previously " + "; ".join(parts), first_title[key])
    overlap = set(reverse) & set(_NEW_PROVISIONS)
    if overlap:
        raise ValueError(f"Provisions listed as both mapped and new: {sorted(overlap)}")
    reverse.update(_NEW_PROVISIONS)
    return reverse


# (Old Code, Old Section) -> (New Code, New Section, Former Citation String, Canonical Title)
CONCORDANCE_MAP: dict[tuple[str, str], tuple[str, str, str, str]] = _build_forward()
# (New Code, New Section) -> (Former Citation String, Canonical Title)
REVERSE_CONCORDANCE_MAP: dict[tuple[str, str], tuple[str, str]] = _build_reverse(CONCORDANCE_MAP)

# --------------------------------------------------------------------------- #
# Concept rules
# --------------------------------------------------------------------------- #

CONCEPT_RULES: list[dict[str, Any]] = [
    {
        "keywords": ["murder", "killing", "killed", "homicide", "jaan se maar", "jaan se marne", "hatya", "हत्या"],
        "targets": [("BNS", "103"), ("BNS", "105"), ("BNS", "101")],
    },
    {
        "keywords": ["attempt to murder", "jaanleva", "marne ki koshish"],
        "targets": [("BNS", "109")],
    },
    {
        "keywords": ["cheat", "cheating", "fraud", "scam", "dhokhadhadi", "dhokha", "embezzlement", "420", "धोखाधड़ी"],
        "targets": [("BNS", "318"), ("BNS", "316")],
    },
    {
        "keywords": ["theft", "stole", "stolen", "stealing", "thief", "chori", "chura", "चोरी"],
        "targets": [("BNS", "303")],
    },
    {
        "keywords": [
            "dwelling house", "means of transportation", "place of worship",
            "human dwelling", "housebreaking", "house-breaking",
        ],
        "targets": [("BNS", "305")],
    },
    {
        "keywords": [
            "snatch", "snatched", "snatching", "chain snatching", "mobile snatching", "phone snatching",
            "chinauti", "chheen", "chheena", "chheen liya", "chheen kar", "cheen liya", "cheena",
        ],
        "targets": [("BNS", "304"), ("BNS", "309")],
    },
    {
        "keywords": [
            "extortion", "extort", "extorted", "extorting", "demanded money", "demanding money",
            "demanded cash", "demand money", "hafta", "vasooli", "rangdari", "threatened to burn",
            "burn down", "burn property", "blackmail", "blackmailing", "ransom",
        ],
        "targets": [("BNS", "308"), ("BNS", "351")],
    },
    {
        "keywords": [
            "robbery", "robbed", "robbing", "loot", "looted", "looting", "dacoity", "dacoit",
            "snatched by force", "snatched with violence", "snatched using force", "robbed phone",
        ],
        "targets": [("BNS", "309"), ("BNS", "308")],
    },
    {
        "keywords": [
            "threat", "threatening", "threatened", "intimidation", "dhamki", "dhamkaya",
            "threatened to kill", "criminal intimidation", "jaan se marne ki dhamki", "धमकी",
        ],
        "targets": [("BNS", "351"), ("BNS", "352")],
    },
    {
        "keywords": [
            "insult", "insulted", "abused", "abusive language", "gaali", "provoke breach of peace", "intentional insult",
        ],
        "targets": [("BNS", "352")],
    },
    {
        "keywords": ["rash", "negligent driving", "accident", "vehicle", "hit and run", "car crash", "rash driving"],
        "targets": [("BNS", "281"), ("BNS", "106")],
    },
    {
        "keywords": ["dowry", "dahej", "cruelty", "domestic violence", "in-laws", "harassment by husband", "patni", "दहेज"],
        "targets": [("BNS", "85"), ("BNS", "86"), ("BNS", "80")],
    },
    {
        "keywords": [
            "assault", "assaulted", "criminal force", "slap", "slapped", "slapping", "thappad",
            "beating", "beaten", "hit", "punched", "marpeet", "fight", "hurt", "grievous hurt",
            "fracture", "chot", "injury", "physical violence",
        ],
        "targets": [("BNS", "115"), ("BNS", "131"), ("BNS", "117"), ("BNS", "135"), ("BNS", "118")],
    },
    {
        "keywords": ["rape", "balatkar", "sexual assault", "molestation", "chedchad", "outrage modesty", "stalking", "बलात्कार"],
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
        "keywords": ["bail", "jamanat", "bond", "surety", "bailable", "non-bailable", "जमानत"],
        "targets": [("BNSS", "480"), ("BNSS", "478"), ("BNSS", "483")],
    },
    {
        "keywords": [
            "fir", "first information report", "police complaint", "zero fir", "refusal to register fir",
            "police not registering", "lodge fir", "police station complaint", "lodging complaint", "एफआईआर",
        ],
        # (fixed) BNSS 170 (arrest to prevent cognizable offences) removed: it is not an FIR provision.
        "targets": [("BNSS", "173"), ("BNSS", "175")],
    },
    {
        "keywords": ["police questioning", "witness", "interrogation", "statement to police", "161"],
        "targets": [("BNSS", "179"), ("BNSS", "180"), ("BNSS", "181")],  # (fixed) was 182
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
        "keywords": [
            "electronic evidence", "digital evidence", "whatsapp", "cctv", "call recording", "phone records",
            "audio evidence", "video evidence", "screenshot", "65b",
        ],
        "targets": [("BSA", "61"), ("BSA", "63")],
    },
]


@dataclass(frozen=True)
class _CompiledRule:
    pattern: re.Pattern[str]
    targets: tuple[tuple[str, str], ...]


def _compile_rules(rules: Iterable[dict[str, Any]]) -> tuple[_CompiledRule, ...]:
    """One precompiled alternation per rule. Lookarounds replace ``\\b`` so that
    Devanagari keywords (whose combining marks are not ``\\w``) still match."""

    compiled = []
    for rule in rules:
        words = sorted(
            {unicodedata.normalize("NFC", kw).lower() for kw in rule["keywords"]}, key=len, reverse=True
        )
        body = "|".join(re.escape(w).replace(r"\ ", r"\s+") for w in words)
        compiled.append(
            _CompiledRule(re.compile(rf"(?<!\w)(?:{body})(?!\w)"), tuple(rule["targets"]))
        )
    return tuple(compiled)


_COMPILED_RULES = _compile_rules(CONCEPT_RULES)

# Non-offence preliminary/definition sections never returned as substantive hits
# unless the user cited them explicitly together with an Act.
_PRELIMINARY_SECTIONS = frozenset(
    [("BNS", str(n)) for n in range(1, 11)]
    + [("BNSS", s) for s in ("1", "2", "6", "7", "8", "9", "10")]
    + [("BSA", s) for s in ("1", "2", "8")]
)

# Standalone numbers ("what is 420?") are only trusted if they are famous section numbers.
_WELL_KNOWN_STANDALONE = frozenset({
    "420", "302", "307", "376", "498A", "379", "384", "390", "392", "323", "504", "506",
    "438", "437", "436", "41A", "144", "161", "164", "138", "65B", "154", "318", "103",
    "106", "85", "64", "303", "304", "308", "309", "115", "130", "131", "135", "351", "352", "482", "480",
    "478", "173", "175", "185",
})

_STOPWORDS = frozenset({"what", "when", "where", "which", "about", "there", "their", "under", "police", "court"})

_CODE_PATTERN = (
    r"BNSS|BNS|BSA|I\.?P\.?C\.?|Cr\.?\s?P\.?\s?C\.?|I\.?E\.?A\.?|"
    r"Indian\s+Penal\s+Code|Code\s+of\s+Criminal\s+Procedure|Indian\s+Evidence\s+Act|Evidence\s+Act|"
    r"Bharatiya\s+Nyaya\s+Sanhita|Bharatiya\s+Nagarik\s+Suraksha\s+Sanhita|Bharatiya\s+Sakshya\s+Adhiniyam"
)
_SEC_PATTERN = r"\d+[A-Za-z]?(?:\([^()\s]+\))*"
_SEC_KW = r"sections?|sec\.?|s\.|u/s|dhara|धारा"
# "IPC 420", "BNSS section 482", "I.P.C. s. 302(1)"
_CODE_THEN_SECTION_RE = re.compile(
    rf"(?<!\w)(?P<code>{_CODE_PATTERN})(?:\s*,)?\s*(?:(?:{_SEC_KW})\s*)?(?P<sec>{_SEC_PATTERN})(?!\w)",
    re.IGNORECASE,
)
# "Section 420 of the IPC", "420 IPC"
_SECTION_THEN_CODE_RE = re.compile(
    rf"(?<!\w)(?P<kw>{_SEC_KW})?\s*(?P<sec>{_SEC_PATTERN})\s+(?:of\s+)?(?:the\s+)?(?P<code>{_CODE_PATTERN})(?!\w)",
    re.IGNORECASE,
)
# "section 308", "dhara 351" (no Act named)
_SECTION_ONLY_RE = re.compile(rf"(?<!\w)(?:{_SEC_KW})\s*(?P<sec>\d+[A-Za-z]?)(?!\w)", re.IGNORECASE)
_NUMBER_RE = re.compile(r"(?<![\w.,₹/-])(\d+[A-Za-z]?)(?![\w%]|\.\d)")
_CURRENCY_BEFORE_RE = re.compile(r"(?:₹|\brs\.?|\binr)\s*$", re.IGNORECASE)
_QUANTITY_AFTER_RE = re.compile(
    r"\s*(?:rs\b|rupees?|inr|/-|lakhs?|crores?|thousand|km|kg|years?|days?|months?|persons?|people|times)\b",
    re.IGNORECASE,
)


def _looks_like_quantity(text: str, start: int, end: int) -> bool:
    """True for '420 rupees', 'Rs. 420', '302 people' - numbers that are not section numbers."""

    return bool(_CURRENCY_BEFORE_RE.search(text[max(0, start - 6):start])) or bool(
        _QUANTITY_AFTER_RE.match(text, end)
    )


# --------------------------------------------------------------------------- #
# Registry
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class Resolution:
    """Result of resolving a candidate (code, section) from model/user input."""

    record: LawRecord
    # "direct": the code/section exists as given.
    # "concordance": an old-code citation (IPC/CrPC/IEA) mapped to its 2023 equivalent.
    # "label_correction": the model used a 2023 code label with an old-code section number.
    match_type: str


class LawSourceRegistry:
    """Read-only lookup over a validated JSON corpus."""

    def __init__(self, records: Iterable[LawRecord] = ()) -> None:
        self._records: dict[tuple[str, str], LawRecord] = {}
        self._search_text: dict[tuple[str, str], str] = {}
        for record in records:
            key = (_normalize_code(record.code), _normalize_section(record.section)[0])
            if key in self._records:
                raise ValueError(f"Duplicate legal source record: {key[0]} Section {key[1]}")
            self._records[key] = record
            self._search_text[key] = unicodedata.normalize(
                "NFC", f"{record.heading} {record.exact_text}"
            ).lower()

    # ----- loading --------------------------------------------------------- #

    @staticmethod
    def _read_records(path: Path, *, supplemental: bool) -> list[Any]:
        label = "supplemental corpus" if supplemental else "legal corpus"
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON in {label} {path}: {exc}") from exc
        if not isinstance(payload, dict):
            raise ValueError(f"Invalid {label} {path}: top level must be an object")
        if payload.get("schema_version") != _SUPPORTED_SCHEMA:
            kind = "supplemental corpus" if supplemental else "legal corpus"
            raise ValueError(f"Unsupported {kind} schema: {payload.get('schema_version')}")
        records = payload.get("records", [])
        if not isinstance(records, list):
            raise ValueError(f"Invalid {label} {path}: 'records' must be a list")
        return records

    @classmethod
    def from_json(cls, path: str | Path = _DEFAULT_CORPUS_PATH) -> "LawSourceRegistry":
        source_path = Path(path)
        sources: list[tuple[Path, list[Any]]] = [(source_path, cls._read_records(source_path, supplemental=False))]
        supplemental_path = source_path.with_name(_SUPPLEMENTAL_CORPUS_NAME)
        if supplemental_path.is_file():
            sources.append((supplemental_path, cls._read_records(supplemental_path, supplemental=True)))

        records: list[LawRecord] = []
        for file_path, items in sources:
            for index, item in enumerate(items):
                try:
                    records.append(_record_from_payload(item))
                except (ValueError, KeyError, TypeError) as exc:
                    raise ValueError(f"{exc} [record #{index} in {file_path.name}]") from exc
        registry = cls(records)
        logger.info("Loaded %d legal source records from %s", len(registry), source_path)
        return registry

    # ----- lookup ---------------------------------------------------------- #

    def lookup(
        self,
        act: str | None = None,
        section: str | None = None,
        *,
        code: str | None = None,
        subsection: str | None = None,
        allow_parent: bool = False,
    ) -> LawRecord | None:
        """Look up a section using either an Act name or a short code.

        ``act`` and ``code`` are both accepted for compatibility with model
        providers that use different field names. If both are supplied, each
        normalized value is tried without mutating the caller's data.

        With ``allow_parent=True`` a missing ``318(4)`` falls back to ``318``
        (the returned record is then the whole parent section).
        """

        candidate_codes: list[str] = []
        for candidate in (code, act):
            normalized = _normalize_code(candidate)
            if normalized and normalized not in candidate_codes:
                candidate_codes.append(normalized)
        if not candidate_codes:
            return None

        section_value = "" if section is None else str(section).strip()
        if subsection and "(" not in section_value:
            section_value = f"{section_value}({str(subsection).strip().strip('()')})"
        normalized_section, _ = _normalize_section(section_value)

        while normalized_section:
            for candidate_code in candidate_codes:
                record = self._records.get((candidate_code, normalized_section))
                if record is not None:
                    return record
            parent = _TRAILING_PAREN_RE.sub("", normalized_section)
            if not allow_parent or parent == normalized_section:
                break
            normalized_section = parent
        return None

    # ----- concordance ------------------------------------------------------ #

    def get_concordance_info(self, code: str | None, section: str | None) -> tuple[str | None, str | None]:
        """Return former section citation and canonical title if known."""

        norm_code = _normalize_code(code)
        norm_sec, _ = _normalize_section(section)
        return (
            REVERSE_CONCORDANCE_MAP.get((norm_code, norm_sec))
            or REVERSE_CONCORDANCE_MAP.get((norm_code, _base_section(norm_sec)))
            or (None, None)
        )

    @staticmethod
    def _enrich(record: LawRecord, former: str | None = None, title: str | None = None) -> LawRecord:
        """Attach former citation / canonical title without overwriting values already present."""

        rev_former, rev_title = REVERSE_CONCORDANCE_MAP.get(record.key, (None, None))
        new_former = former or record.former_citation or rev_former
        new_title = title or record.canonical_title or rev_title
        if new_former == record.former_citation and new_title == record.canonical_title:
            return record
        return replace(record, former_citation=new_former, canonical_title=new_title)

    def resolve_concordance_detailed(self, code: str | None, section: str | None) -> Resolution | None:
        """Resolve a candidate statute to the authoritative 2023 record and say how.

        Order: direct hit -> old-code concordance -> 2023 label with old section
        number (own family first, then a *unique* cross-family match) -> known mislabels.
        """

        norm_code = _normalize_code(code)
        norm_sec, _ = _normalize_section(section)
        if not norm_code or not norm_sec:
            return None
        base = _base_section(norm_sec)

        # 1. Direct hit (a sub-section citation falls back to its parent section).
        direct = self.lookup(code=norm_code, section=norm_sec, allow_parent=True)
        if direct is not None:
            return Resolution(self._enrich(direct), "direct")

        def via_old(old_code: str, match_type: str) -> Resolution | None:
            entry = CONCORDANCE_MAP.get((old_code, base))
            if entry is None:
                return None
            target_code, target_sec, former, title = entry
            target = self.lookup(code=target_code, section=target_sec)
            if target is None:
                logger.debug("Concordance target %s %s not in corpus", target_code, target_sec)
                return None
            return Resolution(self._enrich(target, former, title), match_type)

        # 2. Old-code citation (IPC 420, CrPC 438, IEA 65B).
        if norm_code in _OLD_CODES:
            return via_old(norm_code, "concordance")

        if norm_code in _NEW_TO_OLD_FAMILY:
            # 3a. 2023 label, old section number, same family (BNS 420, BNSS 438, BSA 65B).
            resolved = via_old(_NEW_TO_OLD_FAMILY[norm_code], "label_correction")
            if resolved is not None:
                return resolved
            # 3b. Cross-family, only if the number identifies exactly one old section (BNS 154 -> CrPC 154).
            candidates = [oc for oc in _OLD_CODES if (oc, base) in CONCORDANCE_MAP]
            if len(candidates) == 1:
                resolved = via_old(candidates[0], "label_correction")
                if resolved is not None:
                    return resolved

        # 4. Explicit, documented one-off mislabels.
        known = _KNOWN_MISLABELS.get((norm_code, base))
        if known is not None:
            target_code, target_sec, former, title = known
            target = self.lookup(code=target_code, section=target_sec)
            if target is not None:
                return Resolution(self._enrich(target, former, title), "label_correction")
        return None

    def resolve_concordance(self, code: str | None, section: str | None) -> LawRecord | None:
        """Resolve any candidate statute, automatically mapping former codes (IPC/CrPC/IEA)
        or common model confusions directly to the authoritative 2023 Gazette record.
        """

        resolution = self.resolve_concordance_detailed(code, section)
        return resolution.record if resolution else None

    # ----- retrieval -------------------------------------------------------- #

    def find_relevant_statutes(
        self,
        query: str,
        top_k: int = 4,
        *,
        topup_with_text_search: bool = False,
    ) -> list[tuple[LawRecord, str, str]]:
        """Retrieve verified statutory provisions from the official 2023 Gazette corpus.

        Returns a list of tuples: (LawRecord, former_citation_str, canonical_title).

        Priority: explicit citations ("IPC 420", "section 308") -> factual concept rules
        (most specific keyword wins) -> well-known standalone numbers -> free-text search.
        Free-text search only runs when nothing else matched, unless
        ``topup_with_text_search`` is set (weak matches can reduce precision).
        """

        if top_k <= 0:
            return []
        q_clean = unicodedata.normalize("NFC", str(query or ""))[:MAX_QUERY_CHARS]
        q_lower = _SPACE_RE.sub(" ", q_clean.lower())

        results: list[tuple[LawRecord, str, str]] = []
        seen: set[tuple[str, str]] = set()

        def add(rec: LawRecord, *, allow_preliminary: bool = False) -> bool:
            """Add a record; returns True once top_k is reached."""
            if rec.key in seen or (not allow_preliminary and rec.key in _PRELIMINARY_SECTIONS):
                return len(results) >= top_k
            seen.add(rec.key)
            enriched = self._enrich(rec)
            results.append((enriched, enriched.former_citation or "", enriched.canonical_title or enriched.heading or ""))
            return len(results) >= top_k

        # Determine if any 2023 code is explicitly mentioned in the query
        explicit_matches = list(_CODE_THEN_SECTION_RE.finditer(q_clean)) + list(_SECTION_THEN_CODE_RE.finditer(q_clean))
        explicit_spans = [(m.start(), m.end()) for m in explicit_matches]
        query_codes = [_normalize_code(m["code"]) for m in explicit_matches]
        preferred_code = query_codes[0] if query_codes else None

        def by_number(num: str) -> Iterator[LawRecord]:
            if preferred_code:
                rec = self.lookup(code=preferred_code, section=num)
                if rec is not None:
                    yield rec
                    return

            for old_code in _OLD_CODES:
                if (old_code, num) in CONCORDANCE_MAP:
                    rec = self.resolve_concordance(old_code, num)
                    if rec is not None:
                        yield rec
                        return

            for new_code in _NEW_CODES:
                rec = self.lookup(code=new_code, section=num)
                if rec is not None:
                    yield rec
                    return

        # Step 1: explicit "<Act> <section>" / "<section> of <Act>" citations, in order of appearance.
        citations: list[tuple[int, str, str]] = []
        for match in _CODE_THEN_SECTION_RE.finditer(q_clean):
            citations.append((match.start(), match["code"], match["sec"]))
        for match in _SECTION_THEN_CODE_RE.finditer(q_clean):
            if not match["kw"] and len(match["sec"]) < 2:
                continue  # "2 BNS cases" is not a citation of section 2
            citations.append((match.start(), match["code"], match["sec"]))
        for _, raw_code, raw_sec in sorted(citations):
            rec = self.resolve_concordance(raw_code, raw_sec)
            if rec is not None and add(rec, allow_preliminary=True):
                return results

        # Step 2: "section 308" / "dhara 351" with no Act named.
        for match in _SECTION_ONLY_RE.finditer(q_clean):
            if any(s <= match.start() and match.end() <= e for s, e in explicit_spans):
                continue
            for rec in by_number(match["sec"].upper()):
                if add(rec):
                    return results

        # Step 3: concept rules; the rule with the longest (most specific) keyword hit goes first.
        scored = []
        for index, rule in enumerate(_COMPILED_RULES):
            best = max((len(m.group(0)) for m in rule.pattern.finditer(q_lower)), default=0)
            if best:
                scored.append((-best, index, rule))
        scored.sort(key=lambda item: item[:2])
        for _, _, rule in scored:
            for target_code, target_sec in rule.targets:
                rec = self.lookup(code=target_code, section=target_sec)
                if rec is not None and add(rec):
                    return results

        # Step 4: standalone numbers, only famous ones, and not amounts/quantities.
        for match in _NUMBER_RE.finditer(q_clean):
            num = match.group(1).upper()
            if num not in _WELL_KNOWN_STANDALONE or _looks_like_quantity(q_clean, match.start(1), match.end(1)):
                continue
            for rec in by_number(num):
                if add(rec):
                    return results

        # Step 5: ranked free-text fallback.
        if not results or topup_with_text_search:
            tokens = {w for w in re.findall(r"\w{4,}", q_lower) if w not in _STOPWORDS}
            if tokens:
                ranked = []
                for key, text in self._search_text.items():
                    if key[0] not in _NEW_CODES:
                        continue
                    score = sum(1 for tok in tokens if tok in text)
                    if score >= 2:
                        ranked.append((-score, key))
                ranked.sort()
                for _, key in ranked:
                    if add(self._records[key]):
                        break
        return results[:top_k]

    # ----- diagnostics ------------------------------------------------------ #

    def verify_integrity(self) -> list[str]:
        """Re-hash every record; returns descriptions of any mismatches (empty == healthy)."""

        return [
            f"{r.code} Section {r.section}: stored hash does not match exact_text"
            for r in self._records.values()
            if hashlib.sha256(r.exact_text.encode("utf-8")).hexdigest() != r.source_hash
        ]

    def audit_references(self) -> list[str]:
        """List concordance / concept-rule targets that are absent from the loaded corpus.

        Absence is not an error (the corpus is deliberately small) but is useful in CI
        to spot typos, e.g. a rule pointing at a section number that does not exist.
        """

        problems = []
        for (old_code, old_sec), (new_code, new_sec, _f, _t) in CONCORDANCE_MAP.items():
            if (new_code, new_sec) not in self._records:
                problems.append(f"concordance {old_code} {old_sec} -> {new_code} {new_sec}: not in corpus")
        for rule in CONCEPT_RULES:
            for target in rule["targets"]:
                if target not in self._records:
                    problems.append(f"concept rule {rule['keywords'][0]!r} -> {target[0]} {target[1]}: not in corpus")
        return problems

    # ----- container protocol ----------------------------------------------- #

    def __len__(self) -> int:
        return len(self._records)

    def __contains__(self, item: object) -> bool:
        if not (isinstance(item, tuple) and len(item) == 2):
            return False
        return (_normalize_code(item[0]), _normalize_section(item[1])[0]) in self._records

    def records(self) -> tuple[LawRecord, ...]:
        return tuple(self._records.values())


_registry: LawSourceRegistry | None = None
_registry_lock = threading.Lock()


def get_registry() -> LawSourceRegistry:
    """Return the process-wide registry, loading and validating it once (thread-safe)."""

    global _registry
    if _registry is None:
        with _registry_lock:
            if _registry is None:
                _registry = LawSourceRegistry.from_json()
    return _registry


def reload_registry(path: str | Path | None = None) -> LawSourceRegistry:
    """Rebuild the registry from disk. The old instance stays live if loading fails."""

    global _registry
    fresh = LawSourceRegistry.from_json(path) if path is not None else LawSourceRegistry.from_json()
    with _registry_lock:
        _registry = fresh
    return fresh
