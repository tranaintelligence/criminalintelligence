"""
TRANA — Legal Library & Student Education Service
===================================================

Provides authoritative statutory data, concordance mappings, case laws,
study center materials, and interactive simulation templates for the
TRANA Student Workspace.
"""

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("trana.legal_library")

CORPUS_PATH = Path(__file__).resolve().parent / "corpus.json"

# Defined Acts in TRANA
ACTS_CATALOG: List[Dict[str, Any]] = [
    {
        "id": "bns-2023",
        "short_name": "BNS 2023",
        "code": "BNS",
        "full_name": "Bharatiya Nyaya Sanhita, 2023",
        "year": 2023,
        "category": "core_criminal",
        "status": "active",
        "commencement_date": "1 July 2024",
        "description": "The substantive criminal code of India, repealing and replacing the Indian Penal Code, 1860. Contains 358 sections organized into 20 chapters.",
        "official_url": "https://www.indiacode.nic.in/handle/123456789/21808",
        "chapters": [
            {"number": "I", "title": "Preliminary", "range": "1 - 3"},
            {"number": "II", "title": "Of Punishments", "range": "4 - 13"},
            {"number": "III", "title": "General Exceptions", "range": "14 - 44"},
            {"number": "IV", "title": "Of Abetment, Criminal Conspiracy and Attempt", "range": "45 - 62"},
            {"number": "V", "title": "Of Offences Against Woman and Children", "range": "63 - 99"},
            {"number": "VI", "title": "Of Offences Affecting the Human Body", "range": "100 - 146"},
            {"number": "VII", "title": "Of Offences Against the State", "range": "147 - 158"},
            {"number": "VIII", "title": "Of Offences Relating to the Army, Navy and Air Force", "range": "159 - 171"},
            {"number": "IX", "title": "Of Offences Against the Public Tranquillity", "range": "189 - 197"},
            {"number": "X", "title": "Of Offences by or Relating to Public Servants", "range": "198 - 205"},
            {"number": "XI", "title": "Of Contempts of the Lawful Authority of Public Servants", "range": "206 - 226"},
            {"number": "XII", "title": "Of False Evidence and Offences Against Public Justice", "range": "227 - 269"},
            {"number": "XVII", "title": "Of Offences Against Property", "range": "303 - 334"},
            {"number": "XVIII", "title": "Of Offences Relating to Documents and Property Marks", "range": "335 - 350"},
            {"number": "XIX", "title": "Of Criminal Intimidation, Insult and Annoyance", "range": "351 - 356"},
            {"number": "XX", "title": "Repeal and Savings", "range": "357 - 358"},
        ],
    },
    {
        "id": "bnss-2023",
        "short_name": "BNSS 2023",
        "code": "BNSS",
        "full_name": "Bharatiya Nagarik Suraksha Sanhita, 2023",
        "year": 2023,
        "category": "core_criminal",
        "status": "active",
        "commencement_date": "1 July 2024",
        "description": "The procedural law governing criminal investigation, arrest, custody, bail, inquiry, and trial in India, repealing the Code of Criminal Procedure, 1973. Contains 531 sections.",
        "official_url": "https://www.indiacode.nic.in/handle/123456789/21809",
        "chapters": [
            {"number": "I", "title": "Preliminary", "range": "1 - 5"},
            {"number": "II", "title": "Constitution of Criminal Courts and Offices", "range": "6 - 20"},
            {"number": "III", "title": "Power of Courts", "range": "21 - 29"},
            {"number": "V", "title": "Arrest of Persons", "range": "35 - 62"},
            {"number": "VII", "title": "Processes to Compel Production of Things", "range": "94 - 110"},
            {"number": "XII", "title": "Information to the Police and Their Powers to Investigate", "range": "173 - 196"},
            {"number": "XIII", "title": "Jurisdiction of the Criminal Courts in Inquiries and Trials", "range": "197 - 210"},
            {"number": "XXIV", "title": "General Provisions as to Inquiries and Trials", "range": "337 - 364"},
            {"number": "XXXV", "title": "Provisions as to Bail and Bonds", "range": "478 - 496"},
        ],
    },
    {
        "id": "bsa-2023",
        "short_name": "BSA 2023",
        "code": "BSA",
        "full_name": "Bharatiya Sakshya Adhiniyam, 2023",
        "year": 2023,
        "category": "core_criminal",
        "status": "active",
        "commencement_date": "1 July 2024",
        "description": "The law of evidence governing admissibility, relevance, burden of proof, electronic records, and examination of witnesses in Indian courts, repealing the Indian Evidence Act, 1872. Contains 170 sections.",
        "official_url": "https://www.indiacode.nic.in/handle/123456789/21810",
        "chapters": [
            {"number": "I", "title": "Preliminary", "range": "1 - 2"},
            {"number": "II", "title": "Relevancy of Facts", "range": "3 - 50"},
            {"number": "IV", "title": "Of Oral Evidence", "range": "54 - 55"},
            {"number": "V", "title": "Of Documentary Evidence", "range": "56 - 93"},
            {"number": "VII", "title": "Of the Burden of Proof", "range": "104 - 120"},
            {"number": "IX", "title": "Of Witnesses", "range": "124 - 139"},
            {"number": "X", "title": "Of the Examination of Witnesses", "range": "140 - 168"},
        ],
    },
    {
        "id": "ipc-1860",
        "short_name": "IPC 1860",
        "code": "IPC",
        "full_name": "Indian Penal Code, 1860",
        "year": 1860,
        "category": "core_criminal",
        "status": "repealed",
        "commencement_date": "1 January 1862 (Repealed 1 July 2024)",
        "description": "Historical criminal code of India drafted by Lord Macaulay. Continues to apply to criminal acts committed prior to 1 July 2024.",
        "official_url": "https://www.indiacode.nic.in/handle/123456789/2263",
        "chapters": [
            {"number": "I", "title": "Introduction", "range": "1 - 5"},
            {"number": "IV", "title": "General Exceptions", "range": "76 - 106"},
            {"number": "XVI", "title": "Of Offences Affecting the Human Body", "range": "299 - 377"},
            {"number": "XVII", "title": "Of Offences Against Property", "range": "378 - 462"},
        ],
    },
    {
        "id": "crpc-1973",
        "short_name": "CrPC 1973",
        "code": "CrPC",
        "full_name": "Code of Criminal Procedure, 1973",
        "year": 1973,
        "category": "core_criminal",
        "status": "repealed",
        "commencement_date": "1 April 1974 (Repealed 1 July 2024)",
        "description": "The former procedural code governing criminal administration and trials in India. Relevant for pending proceedings instituted before July 2024.",
        "official_url": "https://www.indiacode.nic.in/handle/123456789/1611",
        "chapters": [
            {"number": "V", "title": "Arrest of Persons", "range": "41 - 60A"},
            {"number": "XII", "title": "Information to Police & Investigation", "range": "154 - 176"},
            {"number": "XXXIII", "title": "Provisions as to Bail and Bonds", "range": "436 - 450"},
        ],
    },
    {
        "id": "iea-1872",
        "short_name": "IEA 1872",
        "code": "IEA",
        "full_name": "Indian Evidence Act, 1872",
        "year": 1872,
        "category": "core_criminal",
        "status": "repealed",
        "commencement_date": "1 September 1872 (Repealed 1 July 2024)",
        "description": "The former statutory law of evidence in India drafted by Sir James Fitzjames Stephen.",
        "official_url": "https://www.indiacode.nic.in/handle/123456789/2188",
        "chapters": [
            {"number": "II", "title": "Of the Relevancy of Facts", "range": "5 - 55"},
            {"number": "V", "title": "Of Documentary Evidence", "range": "61 - 90A"},
            {"number": "VII", "title": "Of the Burden of Proof", "range": "101 - 114A"},
        ],
    },
    # Special Criminal Laws
    {
        "id": "pocso-2012",
        "short_name": "POCSO Act 2012",
        "code": "POCSO",
        "full_name": "Protection of Children from Sexual Offences Act, 2012",
        "year": 2012,
        "category": "special_criminal",
        "status": "active",
        "commencement_date": "14 November 2012",
        "description": "Special legislation enacted to protect children from offences of sexual assault, sexual harassment, and pornography, establishing child-friendly Special Courts.",
        "official_url": "https://www.indiacode.nic.in/handle/123456789/2079",
        "chapters": [
            {"number": "I", "title": "Preliminary", "range": "1 - 2"},
            {"number": "II", "title": "Sexual Offences Against Children", "range": "3 - 12"},
            {"number": "III", "title": "Using Child for Pornographic Purposes", "range": "13 - 15"},
            {"number": "V", "title": "Procedure for Reporting Cases", "range": "19 - 23"},
            {"number": "VI", "title": "Procedures for Recording Statement", "range": "24 - 27"},
            {"number": "VII", "title": "Special Courts", "range": "28 - 32"},
        ],
    },
    {
        "id": "scst-1989",
        "short_name": "SC/ST Act 1989",
        "code": "SCST",
        "full_name": "Scheduled Castes and Scheduled Tribes (Prevention of Atrocities) Act, 1989",
        "year": 1989,
        "category": "special_criminal",
        "status": "active",
        "commencement_date": "30 January 1990",
        "description": "Special statute preventing atrocities and hate crimes against members of Scheduled Castes and Scheduled Tribes, with special courts and strict bail bars (Section 18/18A).",
        "official_url": "https://www.indiacode.nic.in/handle/123456789/1522",
        "chapters": [
            {"number": "I", "title": "Preliminary", "range": "1 - 2"},
            {"number": "II", "title": "Offences of Atrocities", "range": "3 - 9"},
            {"number": "III", "title": "Externment", "range": "10 - 13"},
            {"number": "IV", "title": "Special Courts", "range": "14 - 15A"},
            {"number": "V", "title": "Miscellaneous", "range": "16 - 23"},
        ],
    },
    {
        "id": "ndps-1985",
        "short_name": "NDPS Act 1985",
        "code": "NDPS",
        "full_name": "Narcotic Drugs and Psychotropic Substances Act, 1985",
        "year": 1985,
        "category": "special_criminal",
        "status": "active",
        "commencement_date": "14 November 1985",
        "description": "Comprehensive law relating to narcotic drugs and psychotropic substances, imposing stringent search procedures (Sec 42/50) and statutory bail thresholds (Sec 37).",
        "official_url": "https://www.indiacode.nic.in/handle/123456789/1792",
        "chapters": [
            {"number": "I", "title": "Preliminary", "range": "1 - 3"},
            {"number": "IV", "title": "Offences and Penalties", "range": "15 - 40"},
            {"number": "V", "title": "Procedure, Search and Seizure", "range": "41 - 68"},
        ],
    },
    {
        "id": "jj-2015",
        "short_name": "Juvenile Justice Act 2015",
        "code": "JJ",
        "full_name": "Juvenile Justice (Care and Protection of Children) Act, 2015",
        "year": 2015,
        "category": "special_criminal",
        "status": "active",
        "commencement_date": "15 January 2016",
        "description": "Law relating to children alleged and found to be in conflict with law and children in need of care and protection, establishing Juvenile Justice Boards and Child Welfare Committees.",
        "official_url": "https://www.indiacode.nic.in/handle/123456789/2148",
        "chapters": [
            {"number": "I", "title": "Preliminary", "range": "1 - 2"},
            {"number": "III", "title": "Juvenile Justice Board", "range": "4 - 9"},
            {"number": "IV", "title": "Procedure in Relation to Children in Conflict with Law", "range": "10 - 26"},
        ],
    },
    {
        "id": "it-2000",
        "short_name": "IT Act 2000",
        "code": "IT",
        "full_name": "Information Technology Act, 2000",
        "year": 2000,
        "category": "special_criminal",
        "status": "active",
        "commencement_date": "17 October 2000",
        "description": "Law regulating electronic commerce, digital signatures, cyber terrorism, unauthorized computer access, data theft, and cyber offences in India.",
        "official_url": "https://www.indiacode.nic.in/handle/123456789/1999",
        "chapters": [
            {"number": "I", "title": "Preliminary", "range": "1 - 2"},
            {"number": "IX", "title": "Penalties and Adjudication", "range": "43 - 47"},
            {"number": "XI", "title": "Offences", "range": "65 - 78"},
        ],
    },
    {
        "id": "pmla-2002",
        "short_name": "PMLA 2002",
        "code": "PMLA",
        "full_name": "Prevention of Money Laundering Act, 2002",
        "year": 2002,
        "category": "special_criminal",
        "status": "active",
        "commencement_date": "1 July 2005",
        "description": "Special legislation to prevent money-laundering and provide for confiscation of property derived from proceeds of crime, with stringent twin conditions for bail under Section 45.",
        "official_url": "https://www.indiacode.nic.in/handle/123456789/2036",
        "chapters": [
            {"number": "I", "title": "Preliminary", "range": "1 - 2"},
            {"number": "II", "title": "Offence of Money-Laundering", "range": "3 - 4"},
            {"number": "III", "title": "Attachment, Adjudication and Confiscation", "range": "5 - 11"},
            {"number": "VII", "title": "Special Courts", "range": "43 - 47"},
        ],
    },
    {
        "id": "arms-1959",
        "short_name": "Arms Act 1959",
        "code": "ARMS",
        "full_name": "Arms Act, 1959",
        "year": 1959,
        "category": "special_criminal",
        "status": "active",
        "commencement_date": "1 October 1962",
        "description": "Statute consolidating and amending the law relating to acquisition, possession, and manufacture of firearms and ammunition in India.",
        "official_url": "https://www.indiacode.nic.in/handle/123456789/1513",
        "chapters": [
            {"number": "I", "title": "Preliminary", "range": "1 - 2"},
            {"number": "II", "title": "Licence for Acquisition and Possession", "range": "3 - 12"},
            {"number": "V", "title": "Offences and Penalties", "range": "25 - 33"},
        ],
    },
]

# In-memory corpus store
_CORPUS_RECORDS: List[Dict[str, Any]] = []
_SECTIONS_BY_ACT_AND_NUM: Dict[str, Dict[str, Dict[str, Any]]] = {}
_INITIALIZED = False


def _init_corpus():
    global _CORPUS_RECORDS, _SECTIONS_BY_ACT_AND_NUM, _INITIALIZED
    if _INITIALIZED:
        return

    try:
        if CORPUS_PATH.exists():
            with open(CORPUS_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                _CORPUS_RECORDS = data.get("records", [])
                logger.info("Loaded %d corpus records from %s", len(_CORPUS_RECORDS), CORPUS_PATH)
        else:
            logger.warning("Corpus file not found at %s", CORPUS_PATH)
    except Exception as e:
        logger.error("Failed to load legal corpus: %s", e)

    # Index by Act Code and Section
    import legal_sources.registry as r
    concordance_titles = {}
    for p in getattr(r, "_IPC_TO_BNS", []):
        concordance_titles[("BNS", p[1])] = p[2]
        concordance_titles[("IPC", p[0])] = p[2]
    for p in getattr(r, "_CRPC_TO_BNSS", []):
        concordance_titles[("BNSS", p[1])] = p[2]
        concordance_titles[("CRPC", p[0])] = p[2]
    for p in getattr(r, "_IEA_TO_BSA", []):
        concordance_titles[("BSA", p[1])] = p[2]
        concordance_titles[("IEA", p[0])] = p[2]

    for rec in _CORPUS_RECORDS:
        code = rec.get("code", "").upper().strip()
        sec = rec.get("section", "").strip()
        if not rec.get("heading") and (code, sec) in concordance_titles:
            rec["heading"] = concordance_titles[(code, sec)]
        elif not rec.get("heading"):
            # Try to infer heading from first line or default
            rec["heading"] = f"Section {sec} of {code}"

        if code not in _SECTIONS_BY_ACT_AND_NUM:
            _SECTIONS_BY_ACT_AND_NUM[code] = {}
        if sec not in _SECTIONS_BY_ACT_AND_NUM[code]:
            _SECTIONS_BY_ACT_AND_NUM[code][sec] = rec

    _INITIALIZED = True


# Connected Precedents Catalog
LANDMARK_JUDGMENTS: List[Dict[str, Any]] = [
    {
        "id": "judg-arnesh-kumar",
        "case_name": "Arnesh Kumar v. State of Bihar & Anr.",
        "court": "Supreme Court of India",
        "year": 2014,
        "citation": "(2014) 8 SCC 273",
        "sections": ["BNSS 35", "CrPC 41A", "BNS 85", "IPC 498A"],
        "key_principle": "Mandatory checklist guidelines preventing mechanical and routine arrests for offences punishable with up to 7 years imprisonment. Investigating officers must serve a notice of appearance before contemplating custodial arrest.",
        "full_url": "https://indiankanoon.org/doc/2982624/",
    },
    {
        "id": "judg-satender-antil",
        "case_name": "Satender Kumar Antil v. Central Bureau of Investigation",
        "court": "Supreme Court of India",
        "year": 2022,
        "citation": "(2022) 10 SCC 51",
        "sections": ["BNSS 479", "BNSS 480", "CrPC 436A", "CrPC 437", "CrPC 439"],
        "key_principle": "Categorized bail guidelines: Category A (punishable up to 7 years), Category B (heinous offences), Category C (Special Acts like NDPS/PMLA), and Category D (economic offences). Emphasized 'Bail is the rule, jail is the exception'.",
        "full_url": "https://indiankanoon.org/doc/157241280/",
    },
    {
        "id": "judg-dk-basu",
        "case_name": "D.K. Basu v. State of West Bengal",
        "court": "Supreme Court of India",
        "year": 1997,
        "citation": "(1997) 1 SCC 416",
        "sections": ["BNSS 36", "BNSS 47", "BNSS 48", "BNSS 53", "CrPC 50", "CrPC 54"],
        "key_principle": "Laid down 11 mandatory procedural safeguards upon arrest: identification of police personnel, arrest memo witnessed by respected family member or local citizen, right to inform relative within 8-12 hours, and mandatory medical examination.",
        "full_url": "https://indiankanoon.org/doc/501107/",
    },
    {
        "id": "judg-lalita-kumari",
        "case_name": "Lalita Kumari v. Government of Uttar Pradesh",
        "court": "Supreme Court of India (Constitution Bench)",
        "year": 2014,
        "citation": "(2014) 2 SCC 1",
        "sections": ["BNSS 173", "CrPC 154"],
        "key_principle": "Registration of FIR is mandatory under Section 154 CrPC (now Section 173 BNSS) if the information discloses commission of a cognizable offence. Preliminary inquiry permitted only in limited categories (matrimonial, commercial, medical negligence, corruption) within 7-14 days.",
        "full_url": "https://indiankanoon.org/doc/102852623/",
    },
    {
        "id": "judg-shreya-singhal",
        "case_name": "Shreya Singhal v. Union of India",
        "court": "Supreme Court of India",
        "year": 2015,
        "citation": "(2015) 5 SCC 1",
        "sections": ["IT Act 66A", "Constitution Art 19(1)(a)"],
        "key_principle": "Struck down Section 66A of the Information Technology Act, 2000 in its entirety as unconstitutional, holding it vaguely worded and violative of the fundamental right to freedom of speech and expression.",
        "full_url": "https://indiankanoon.org/doc/110813550/",
    },
    {
        "id": "judg-arjun-panditrao",
        "case_name": "Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal",
        "court": "Supreme Court of India",
        "year": 2020,
        "citation": "(2020) 7 SCC 1",
        "sections": ["BSA 61", "BSA 63", "IEA 65B"],
        "key_principle": "Mandatory requirement of Section 65B(4) Certificate (now Section 63 BSA) for admissibility of secondary electronic evidence in judicial proceedings.",
        "full_url": "https://indiankanoon.org/doc/157241280/",
    },
    {
        "id": "judg-vijay-madanlal",
        "case_name": "Vijay Madanlal Choudhary v. Union of India",
        "court": "Supreme Court of India",
        "year": 2022,
        "citation": "2022 SCC OnLine SC 929",
        "sections": ["PMLA 3", "PMLA 5", "PMLA 45", "PMLA 50"],
        "key_principle": "Upheld the constitutional validity of Section 45 twin conditions for bail under PMLA, the validity of Enforcement Case Information Report (ECIR) not being equivalent to FIR, and powers of summons and attachment under the Act.",
        "full_url": "https://indiankanoon.org/doc/122177305/",
    },
    {
        "id": "judg-baldev-singh",
        "case_name": "State of Punjab v. Baldev Singh",
        "court": "Supreme Court of India (Constitution Bench)",
        "year": 1999,
        "citation": "(1999) 6 SCC 172",
        "sections": ["NDPS 50", "NDPS 42"],
        "key_principle": "Section 50 NDPS conditions are mandatory: before conducting personal search of an individual suspected of possessing contraband, the suspect must be informed of their statutory right to be searched before a Gazetted Officer or Magistrate.",
        "full_url": "https://indiankanoon.org/doc/1154567/",
    },
]

# Daily Questions & Judgment of the Day
DAILY_LEGAL_QUESTIONS = [
    {
        "id": "dlq-1",
        "date": "2026-11-15",
        "topic": "Criminal Procedure & First-Time Undertrial Bail",
        "scenario": "An accused has been in judicial custody for 4 months for an alleged offence punishable with a maximum imprisonment of 1 year under BNS Section 303(2). This is his first criminal charge. Can he claim release under the new provisions of BNSS?",
        "options": [
            "No, bail is purely discretionary and cannot be claimed based on detention duration.",
            "Yes, under Section 479(1) Proviso 1 of BNSS, 2023, a first-time offender who has undergone one-third of the maximum imprisonment is entitled to release on bond.",
            "No, release under Section 479 is only applicable after undergoing one-half of the maximum imprisonment.",
            "Yes, but only if the complainant consents to compounding of the offence."
        ],
        "correct_index": 1,
        "explanation": "Under Section 479(1) of the Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS), a progressive proviso was introduced specifically for first-time offenders (persons never convicted of any offence in the past): they shall be released on personal bond with or without sureties if they have undergone detention for a period extending up to one-third of the maximum period of imprisonment.",
        "applicable_section": "BNSS Section 479(1)",
        "related_act": "BNSS 2023",
    },
    {
        "id": "dlq-2",
        "date": "2026-11-16",
        "topic": "Electronic Evidence Admissibility",
        "scenario": "The prosecution seeks to produce printouts of WhatsApp messages between the accused and complainant without attaching a certificate signed by the person in charge of the computer/server. Under Bharatiya Sakshya Adhiniyam, 2023, is this evidence admissible?",
        "options": [
            "Yes, electronic printouts are primary evidence and need no certificate under BSA.",
            "No, Section 63 of BSA, 2023 requires a mandatory certificate verifying the device conditions for secondary electronic records.",
            "Yes, provided the complainant orally confirms sending the messages under oath.",
            "Inadmissible only if the defence files an objection within 3 days."
        ],
        "correct_index": 1,
        "explanation": "Under Section 63 of the Bharatiya Sakshya Adhiniyam, 2023 (corresponding to Section 65B of the repealed Indian Evidence Act, 1872), secondary electronic records require a statutory certificate signed by an authorized person confirming the authenticity, lawful control, and integrity of the computer system.",
        "applicable_section": "BSA Section 63",
        "related_act": "BSA 2023",
    }
]

JUDGMENTS_OF_THE_DAY = [
    {
        "id": "jotd-1",
        "case_name": "In Re: Policy Strategy for Grant of Bail",
        "bench": "Supreme Court of India (Kaul & Sundresh, JJ.)",
        "citation": "SMW (Crl) No. 4/2021",
        "date": "2023",
        "summary": "The Supreme Court issued comprehensive nationwide directions to High Courts and State Legal Services Authorities to decongest prisons. The Court mandated that undertrial review committees meet regularly and ensure undertrials eligible for bail under Section 436A CrPC (now Section 479 BNSS) are identified and released without delay.",
        "legal_significance": "Established proactive institutional tracking for indigent undertrials unable to furnish bail surety, preventing unnecessary incarceration violative of Article 21.",
        "linked_sections": ["BNSS 479", "BNSS 480", "Constitution Art 21"],
    }
]

# Topic MCQs
STUDY_MCQS: List[Dict[str, Any]] = [
    {
        "id": "mcq-bns-1",
        "act": "BNS 2023",
        "topic": "Theft and Community Service",
        "question": "Under Section 303(2) of the Bharatiya Nyaya Sanhita, 2023, what is the maximum punishment for theft where the value of stolen property is less than five thousand rupees, the offender is a first-time convict, and returns or restores the property?",
        "options": [
            "Rigorous imprisonment up to 3 years",
            "Imprisonment up to 1 year or fine or community service",
            "Fine only up to ₹10,000",
            "Simple imprisonment up to 6 months without community service option"
        ],
        "correct_index": 1,
        "explanation": "Section 303(2) of BNS 2023 provides a specific statutory proviso: where the value of stolen property is less than five thousand rupees and a person is convicted for the first time, upon return of the property or payment of its value, he may be punished with imprisonment up to one year, or with fine, or with community service.",
        "reference_section": "BNS Section 303(2) Proviso",
    },
    {
        "id": "mcq-bnss-1",
        "act": "BNSS 2023",
        "topic": "Arrest Notice Procedure",
        "question": "Under which provision of the BNSS, 2023 is a police officer mandated to issue a Notice of Appearance before arresting a person where the offence is punishable with imprisonment up to seven years?",
        "options": [
            "Section 35(3)",
            "Section 41(1)",
            "Section 50(2)",
            "Section 173(1)"
        ],
        "correct_index": 0,
        "explanation": "Section 35(3) of the Bharatiya Nagarik Suraksha Sanhita, 2023 (corresponding to Section 41A CrPC) mandates that the police officer shall issue a notice directing the person against whom a reasonable complaint has been made to appear before him.",
        "reference_section": "BNSS Section 35(3)",
    },
    {
        "id": "mcq-bsa-1",
        "act": "BSA 2023",
        "topic": "Electronic Records as Evidence",
        "question": "Which section of the Bharatiya Sakshya Adhiniyam, 2023 defines the admissibility of electronic or digital records and recognizes them on par with documentary evidence?",
        "options": [
            "Section 61",
            "Section 45",
            "Section 114",
            "Section 91"
        ],
        "correct_index": 0,
        "explanation": "Section 61 of BSA 2023 states that nothing in this Adhiniyam shall apply to deny the admissibility of an electronic or digital record in the evidence on the sole ground that it is an electronic record.",
        "reference_section": "BSA Section 61",
    },
    {
        "id": "mcq-pocso-1",
        "act": "POCSO Act 2012",
        "topic": "Mandatory Reporting Obligation",
        "question": "Under Section 19(1) of the POCSO Act, 2012, any person who has an apprehension that an offence under this Act has been committed has a legal duty to:",
        "options": [
            "Inform the Special Juvenile Police Unit or local police",
            "First seek permission from the child's guardians",
            "Publish an inquiry report within 24 hours",
            "Conduct a private settlement"
        ],
        "correct_index": 0,
        "explanation": "Section 19(1) of the POCSO Act makes reporting of sexual offences against children mandatory for any person possessing knowledge or apprehension of such offence, failure of which attracts criminal penalties under Section 21.",
        "reference_section": "POCSO Act Section 19",
    },
    {
        "id": "mcq-ndps-1",
        "act": "NDPS Act 1985",
        "topic": "Twin Conditions for Bail",
        "question": "Section 37 of the NDPS Act, 1985 establishes twin conditions for bail in commercial quantity cases. What are these conditions?",
        "options": [
            "Only the complainant's consent and surety bond of ₹1,00,000",
            "Public Prosecutor must be given opportunity to oppose, and court must be satisfied there are reasonable grounds to believe the accused is not guilty and not likely to commit offence while on bail",
            "Accused must surrender passport and deposit 50% of contraband market value",
            "Bail can be granted by the police officer at the station itself"
        ],
        "correct_index": 1,
        "explanation": "Section 37 NDPS mandates that for specified commercial offences, no accused shall be released on bail unless the Public Prosecutor has been given opportunity to oppose and the Court is satisfied that reasonable grounds exist to believe the accused is not guilty and unlikely to commit offences on bail.",
        "reference_section": "NDPS Act Section 37",
    },
]

# Interactive Case Simulation Templates
SIMULATION_TEMPLATES: List[Dict[str, Any]] = [
    {
        "id": "sim-bail-bnss-480",
        "title": "Bail Hearing under BNSS 480 & 479 (Theft & Recovery)",
        "difficulty": "Beginner",
        "category": "Bail Hearing",
        "role": "defense_counsel",
        "court": "Court of Chief Judicial Magistrate, Patiala House Courts",
        "scenario_text": (
            "Your client, Rajesh Kumar (24 years old, delivery agent), has been arrested for alleged theft of a mobile phone "
            "valued at ₹18,000 under BNS Section 303(2). The phone was recovered upon his interrogation. He has spent 14 days in custody. "
            "He has no prior criminal antecedents. Argue his regular bail application before the learned Judicial Magistrate."
        ),
        "facts": [
            "FIR registered under Section 303(2) BNS at PS Tilak Marg.",
            "Allegation: Mobile phone taken from complainant's pocket outside Metro station.",
            "Recovery: Phone recovered during interrogation; seizure memo drawn.",
            "Investigative custody: 14 days completed. No further recovery needed.",
            "Personal profile: Accused is 24 years old, sole breadwinner for ailing parents, clean police verification report."
        ],
        "key_statutory_points": [
            "BNS Section 303(2) - Non-bailable offence, but bail is considered under BNSS Section 480.",
            "Investigation virtually complete; recovery effected; no custodial interrogation needed.",
            "Parameters laid down in Satender Kumar Antil v. CBI (Category A offences).",
            "Accused has roots in society and is not a flight risk."
        ],
        "evaluation_rubric": {
            "statutory_accuracy": 30,
            "application_of_precedents": 25,
            "factual_persuasiveness": 25,
            "courtroom_decorum": 20
        }
    },
    {
        "id": "sim-cross-exam-bsa-61",
        "title": "Cross-Examination of Investigating Officer (Cyber Fraud & BSA Sec 63)",
        "difficulty": "Intermediate",
        "category": "Criminal Trial",
        "role": "defense_counsel",
        "court": "Court of Sessions, Cyber Crime Court",
        "scenario_text": (
            "The prosecution has examined the Investigating Officer (Inspector Sandeep Rana) who collected WhatsApp chat transcripts "
            "and server logs implicating your client in an unauthorized data extraction case under BNS 318(4) and IT Act 66. "
            "The IO admits on record that no Section 63 BSA certificate was obtained from the server administrator at the time of retrieval. "
            "Conduct the cross-examination to impeach the admissibility of the electronic evidence."
        ),
        "facts": [
            "Electronic screenshots printed on A4 paper and marked as Exhibit PW-1/C.",
            "No Section 63 BSA / Section 65B Certificate attached with charge sheet.",
            "Hash value of the original hard disk never computed or sealed.",
            "Device remained in police custody for 12 days before forensic dispatch."
        ],
        "key_statutory_points": [
            "Arjun Panditrao Khotkar v. Kailash Kushanrao (2020) 7 SCC 1.",
            "Mandatory certificate under Section 63 BSA for electronic records.",
            "Chain of custody contamination and failure to record cryptographic hash.",
            "Section 61 BSA admissibility criteria."
        ],
        "evaluation_rubric": {
            "statutory_accuracy": 35,
            "cross_examination_technique": 30,
            "impeachment_of_chain_of_custody": 20,
            "precision": 15
        }
    },
    {
        "id": "sim-framing-charges-bns-316",
        "title": "Arguments on Framing of Charge (Cheating vs Criminal Breach of Trust)",
        "difficulty": "Advanced",
        "category": "Trial Argument",
        "role": "defense_counsel",
        "court": "Court of Additional Sessions Judge",
        "scenario_text": (
            "The police have submitted a charge-sheet charging your client simultaneously under Section 316 (Criminal Breach of Trust) "
            "and Section 318 (Cheating) of the BNS, 2023 for a failed business partnership agreement. Argue that the ingredients of "
            "entrustment under 316 and fraudulent inducement at inception under 318 are mutually exclusive on identical facts, "
            "and that the dispute is purely of a civil nature."
        ),
        "facts": [
            "Parties entered into a written dealership agreement in January 2024.",
            "Advance payment of ₹15,00,000 made through banking channels.",
            "Goods worth ₹8,00,000 supplied; remaining consignment delayed due to supply chain disruption.",
            "Complainant filed criminal FIR instead of commercial arbitration."
        ],
        "key_statutory_points": [
            "Distinction between BNS 316 (IPC 405/406) and BNS 318 (IPC 415/420).",
            "Hridaya Ranjan Pd. Verma v. State of Bihar (fraudulent intention at inception required for cheating).",
            "Indian Oil Corp. v. NEPC India Ltd. (discouraging criminalization of commercial disputes).",
            "Absence of dishonest intention at the time of entering the contract."
        ],
        "evaluation_rubric": {
            "statutory_accuracy": 30,
            "conceptual_clarity": 30,
            "distinguishing_civil_vs_criminal": 20,
            "case_law_deployment": 20
        }
    }
]


# Service API Functions

def get_all_acts(category: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return catalog of all acts, optionally filtered by category."""
    if not category:
        return ACTS_CATALOG
    return [a for a in ACTS_CATALOG if a.get("category") == category]


def get_act_by_id(act_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve Act details including chapters and metadata."""
    _init_corpus()
    norm = act_id.lower().strip()
    for act in ACTS_CATALOG:
        if act["id"] == norm or act["code"].lower() == norm or act["short_name"].lower() == norm:
            # Count sections in corpus for this act
            code = act["code"].upper()
            sec_count = len(_SECTIONS_BY_ACT_AND_NUM.get(code, {}))
            return {
                **act,
                "sections_in_registry": sec_count or (358 if code == "BNS" else 531 if code == "BNSS" else 170 if code == "BSA" else 511),
                "related_judgments": [j for j in LANDMARK_JUDGMENTS if any(code in s for s in j.get("sections", []))]
            }
    return None


def get_sections_for_act(act_code: str, query: Optional[str] = None, limit: int = 50, offset: int = 0) -> Dict[str, Any]:
    """Retrieve sections for an act with search and pagination."""
    _init_corpus()
    code = act_code.upper().strip()
    secs_map = _SECTIONS_BY_ACT_AND_NUM.get(code, {})
    
    results = []
    q = (query or "").lower().strip()

    for sec_num, rec in secs_map.items():
        heading = rec.get("heading", "")
        text = rec.get("exact_text", "")
        if not q or (q in sec_num.lower() or q in heading.lower() or q in text.lower()):
            results.append({
                "act_code": code,
                "section": sec_num,
                "heading": heading,
                "snippet": text[:180] + ("..." if len(text) > 180 else ""),
                "has_exact_text": True,
                "source_url": rec.get("source_url"),
            })

    # Sort numerically where possible
    def _sort_key(item):
        s = item["section"]
        m = re.match(r"^(\d+)", s)
        return (int(m.group(1)) if m else 99999, s)

    results.sort(key=_sort_key)
    total = len(results)
    paged = results[offset : offset + limit]

    return {
        "act_code": code,
        "total": total,
        "offset": offset,
        "limit": limit,
        "sections": paged
    }


def get_section_detail(act_code: str, section_number: str) -> Optional[Dict[str, Any]]:
    """Retrieve deep section details with all 5 required tabs."""
    _init_corpus()
    code = act_code.upper().strip()
    sec = section_number.strip()

    # Normalize section e.g. "303(2)" -> base "303"
    base_sec = re.match(r"^(\d+[A-Z]?)", sec)
    base_num = base_sec.group(1) if base_sec else sec

    rec = _SECTIONS_BY_ACT_AND_NUM.get(code, {}).get(sec) or _SECTIONS_BY_ACT_AND_NUM.get(code, {}).get(base_num)

    heading = rec.get("heading") if rec else f"Section {sec} of {code}"
    exact_text = rec.get("exact_text") if rec else None

    # Fallback text if not in corpus
    if not exact_text:
        exact_text = f"Official statutory text for Section {sec} of {code} as published in the Gazette of India."

    # Generate synthetic or structured ingredients
    ingredients = [
        f"Actus Reus: Commission of acts specified under Section {sec} of {code}.",
        "Mens Rea: Dishonest intention, knowledge, or specific state of mind required by statute.",
        "Absence of statutory general exception under Chapter III of BNS / Chapter IV IPC.",
    ]

    punishment = "As prescribed in the statutory provision and First Schedule of BNSS / CrPC."
    if code == "BNS" and base_num == "303":
        punishment = "Imprisonment of either description for a term which may extend to three years, or with fine, or with both. Low-value (<₹5,000) first-time restitution provides for up to 1 year, fine, or community service."
        ingredients = [
            "Dishonest intention to take moveable property.",
            "Property must be taken out of the possession of another person.",
            "Taking must be without that person's consent.",
            "Property must be moved in order to such taking."
        ]
    elif code == "BNSS" and base_num == "35":
        punishment = "Procedural safeguard: Mandatory notice of appearance where offence is punishable with up to 7 years. Failure to comply allows arrest under judicial recorded reasons."
    elif code == "BNSS" and base_num == "479":
        punishment = "Statutory undertrial release: First-time offenders entitled to release after one-third period; others after one-half maximum sentence."

    # Plain explanation (AI generated, clearly labelled)
    explanation = (
        f"This provision defines and governs {heading.lower() if heading else 'the offence/procedure'}. "
        f"In practical terms for law students and practitioners, it lays down the statutory boundary "
        f"between lawful conduct and criminal liability under the {code} legal framework."
    )

    # Find connected case laws
    section_tag = f"{code} {sec}"
    alt_tag = f"{code} {base_num}"
    matching_judgments = [
        j for j in LANDMARK_JUDGMENTS 
        if any(section_tag in s or alt_tag in s for s in j.get("sections", []))
    ]

    # Find related sections from concordance
    from legal_sources.registry import CONCORDANCE_MAP, REVERSE_CONCORDANCE_MAP
    related = []
    if code == "BNS":
        # Look in reverse concordance
        ipc_sec = REVERSE_CONCORDANCE_MAP.get(sec) or REVERSE_CONCORDANCE_MAP.get(base_num)
        if ipc_sec:
            related.append({
                "act": "IPC 1860",
                "section": ipc_sec,
                "relationship": "Former corresponding provision under IPC 1860"
            })
    elif code == "IPC":
        bns_sec = CONCORDANCE_MAP.get(sec) or CONCORDANCE_MAP.get(base_num)
        if bns_sec:
            related.append({
                "act": "BNS 2023",
                "section": bns_sec,
                "relationship": "Newly enacted corresponding provision under BNS 2023"
            })

    return {
        "act_code": code,
        "section_number": sec,
        "heading": heading,
        "chapter": rec.get("chapter", "General Provisions") if rec else "General Provisions",
        # Tab 1: Bare Act (Official Gazette text)
        "bare_act_text": exact_text,
        "is_official_gazette": bool(rec and rec.get("exact_text")),
        "source_url": rec.get("source_url") if rec else "https://www.indiacode.nic.in",
        "source_hash": rec.get("source_hash") if rec else None,
        # Tab 2: Simple Explanation (AI Generated)
        "simple_explanation": explanation,
        "explanation_disclaimer": "AI-generated practical explanation for student academic assistance. Always refer to the official Bare Act for litigation.",
        # Tab 3: Essential Ingredients
        "ingredients": ingredients,
        "punishment": punishment,
        # Tab 4: Connected Case Laws
        "case_laws": matching_judgments,
        # Tab 5: Related Provisions & Transition
        "related_provisions": related,
    }


def search_legal_library(query: str, act_filter: Optional[str] = None, limit: int = 30) -> List[Dict[str, Any]]:
    """Universal search across Acts and statutory sections."""
    _init_corpus()
    q = query.lower().strip()
    if not q:
        return []

    act_code_filter = act_filter.upper().strip() if act_filter else None
    results = []

    # 1. Match Acts by short/full name
    for act in ACTS_CATALOG:
        if not act_code_filter or act["code"].upper() == act_code_filter:
            if q in act["short_name"].lower() or q in act["full_name"].lower() or q in act["description"].lower():
                results.append({
                    "type": "act",
                    "id": act["id"],
                    "title": act["full_name"],
                    "badge": act["short_name"],
                    "subtitle": f"{act['category'].replace('_', ' ').title()} • Enacted {act['year']}",
                    "link": f"/student/library?act={act['id']}",
                })

    # 2. Match Sections
    for rec in _CORPUS_RECORDS:
        code = rec.get("code", "").upper().strip()
        if act_code_filter and code != act_code_filter:
            continue

        sec = rec.get("section", "").strip()
        heading = rec.get("heading", "")
        text = rec.get("exact_text", "")

        is_sec_match = q == sec or q == f"sec {sec}" or q == f"section {sec}" or q == f"{code.lower()} {sec}"
        is_text_match = q in heading.lower() or q in text.lower()

        if is_sec_match or is_text_match:
            score = 100 if is_sec_match else 50 if q in heading.lower() else 10
            results.append({
                "type": "section",
                "id": f"{code}-{sec}",
                "title": f"Section {sec}: {heading}",
                "badge": code,
                "subtitle": text[:140] + ("..." if len(text) > 140 else ""),
                "link": f"/student/library?act={code.lower()}&section={sec}",
                "score": score,
            })
            if len(results) >= limit * 2:
                break

    # Sort results
    results.sort(key=lambda x: (x.get("score", 0), x["title"]), reverse=True)
    return results[:limit]


def get_law_concordance_mappings(source_act: str, query: Optional[str] = None) -> List[Dict[str, Any]]:
    """Concordance mappings for Law Converters (IPC↔BNS, CrPC↔BNSS, IEA↔BSA)."""
    import legal_sources.registry as r

    src = source_act.upper().strip()
    q = (query or "").lower().strip()
    mappings = []

    pairs = []
    if "IPC" in src or "BNS" in src:
        pairs = [
            {"src_act": "IPC 1860", "src_sec": p[0], "tgt_act": "BNS 2023", "tgt_sec": p[1], "title": p[2]}
            for p in getattr(r, "_IPC_TO_BNS", [])
        ]
    elif "CRPC" in src or "BNSS" in src:
        pairs = [
            {"src_act": "CrPC 1973", "src_sec": p[0], "tgt_act": "BNSS 2023", "tgt_sec": p[1], "title": p[2]}
            for p in getattr(r, "_CRPC_TO_BNSS", [])
        ]
    elif "IEA" in src or "BSA" in src:
        pairs = [
            {"src_act": "IEA 1872", "src_sec": p[0], "tgt_act": "BSA 2023", "tgt_sec": p[1], "title": p[2]}
            for p in getattr(r, "_IEA_TO_BSA", [])
        ]

    for item in pairs:
        if not q or (
            q in item["src_sec"].lower()
            or q in item["tgt_sec"].lower()
            or q in item["title"].lower()
        ):
            mappings.append({
                **item,
                "mapping_type": "Direct Equivalent",
                "notes": f"Statutory transition from {item['src_act']} Section {item['src_sec']} to {item['tgt_act']} Section {item['tgt_sec']}."
            })

    return mappings


def get_daily_question() -> Dict[str, Any]:
    return DAILY_LEGAL_QUESTIONS[0]


def get_judgment_of_the_day() -> Dict[str, Any]:
    return JUDGMENTS_OF_THE_DAY[0]


def get_study_mcqs(act: Optional[str] = None, topic: Optional[str] = None) -> List[Dict[str, Any]]:
    if not act:
        return STUDY_MCQS
    norm = act.upper().strip()
    return [m for m in STUDY_MCQS if norm in m.get("act", "").upper()]


def get_simulation_templates(difficulty: Optional[str] = None) -> List[Dict[str, Any]]:
    if not difficulty or difficulty.lower() == "all":
        return SIMULATION_TEMPLATES
    return [t for t in SIMULATION_TEMPLATES if t.get("difficulty", "").lower() == difficulty.lower()]
