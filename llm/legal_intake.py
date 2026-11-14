"""Compact, deterministic intake of explicitly code-qualified law references."""

from dataclasses import dataclass
import re


@dataclass(frozen=True, slots=True)
class LegalReference:
    """A statute section, optional nested subsection, and exact source location."""

    code: str
    section: str
    subsection: str | None
    original_span: str
    span: tuple[int, int]


# Named codes only: a bare section number is never assigned a guessed statute.
_CODE = (
    r"B\s*\.?N\s*\.?S\s*\.?S?\.?|B\s*\.?S\s*\.?A\.?|"
    r"I\s*\.?P\s*\.?C\.?|I\s*\.?E\s*\.?A\.?|C\s*\.?R\s*\.?P\s*\.?C\.?"
)
_SECTION_WORD = r"(?:sections?|secs?\.?)\s*"
_SUFFIX = r"(?:\s*\(\s*[A-Za-z0-9]+\s*\))*"
_REFERENCE = re.compile(
    rf"(?<![\w])(?:"
    rf"(?P<code1>{_CODE})\s*(?:{_SECTION_WORD})?"
    rf"(?P<section1>\d+[A-Za-z]?)(?P<subsections1>{_SUFFIX})"
    rf"|{_SECTION_WORD}(?P<section2>\d+[A-Za-z]?)(?P<subsections2>{_SUFFIX})"
    rf"\s+(?:of\s+(?:the\s+)?)?(?P<code2>{_CODE})"
    rf")(?![\w])",
    re.IGNORECASE,
)


def _canonical_code(label: str) -> str:
    compact = re.sub(r"[^A-Z]", "", label.upper())
    return {"BNS": "BNS", "BNSS": "BNSS", "BSA": "BSA", "IPC": "IPC",
            "IEA": "IEA", "CRPC": "CrPC"}[compact]


def extract_legal_references(text: str) -> tuple[LegalReference, ...]:
    """Extract explicit BNS/BNSS/BSA/IPC/IEA/CrPC references in source order.

    ``section`` is the main number; ``subsection`` keeps nested parentheses in
    source order (``3(a)``). No statutory concordance is inferred or rewritten.
    """
    found: list[LegalReference] = []
    for match in _REFERENCE.finditer(text or ""):
        code_label = match.group("code1") or match.group("code2")
        section = match.group("section1") or match.group("section2")
        suffix = match.group("subsections1") or match.group("subsections2") or ""
        parts = re.findall(r"\(\s*([A-Za-z0-9]+)\s*\)", suffix)
        subsection = parts[0] + "".join(f"({part})" for part in parts[1:]) if parts else None
        start, end = match.span()
        while end > start and text[end - 1] in ".,;:":
            end -= 1
        found.append(LegalReference(
            code=_canonical_code(code_label),
            section=section,
            subsection=subsection,
            original_span=text[start:end],
            span=(start, end),
        ))
    return tuple(found)
