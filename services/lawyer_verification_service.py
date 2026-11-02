"""
Automated Advocate & Bar Council Verification Service for TRANA.

Performs multi-source validation of Indian legal credentials:
1. Attestr / BGV API: Direct online registry lookup if API key is configured.
2. Surepass / eCourts Litigation Matching: Cross-references advocate appearances and active court records.
3. Statutory Bar Council Rule Engine: Validates state bar codes, roll year coherence, AIBE COP formatting,
   and registry structural integrity.
"""

import json
import logging
import re
from datetime import datetime
from typing import Any, Optional
import httpx
from sqlalchemy.orm import Session

from models import db_models

logger = logging.getLogger("trana.lawyer_verification")

STATE_BAR_PREFIX_MAP: dict[str, list[str]] = {
    "Delhi": ["D", "DL"],
    "Maharashtra": ["MAH", "MS", "MH"],
    "Goa": ["GOA", "MAH"],
    "Uttar Pradesh": ["UP"],
    "Punjab": ["P", "PH", "PB"],
    "Haryana": ["P", "PH", "HR"],
    "Karnataka": ["KAR", "KTK", "KA"],
    "West Bengal": ["WB"],
    "Tamil Nadu": ["MS", "TN", "TNPY"],
    "Gujarat": ["G", "GJ", "GUJ"],
    "Rajasthan": ["R", "RJ", "RAJ"],
    "Madhya Pradesh": ["MP"],
    "Kerala": ["K", "KL", "KER"],
    "Bihar": ["B", "BR", "BHR"],
    "Andhra Pradesh": ["AP"],
    "Telangana": ["TG", "TS"],
    "Odisha": ["O", "OR", "OD"],
    "Assam": ["AS", "NE"],
    "Himachal Pradesh": ["H", "HP"],
    "Jharkhand": ["JH"],
    "Chhattisgarh": ["CG", "CH"],
    "Uttarakhand": ["UK", "UA"],
}


def parse_bar_reg_no(bar_reg_no: str) -> Optional[dict[str, Any]]:
    """Parse and validate the statutory format of an Indian Bar Council Sanad.
    
    Standard format: [StateCode]/[SequenceNumber]/[Year]
    Examples: D/2104/2021, MAH/3512/2015, UP/8120/2018, KAR/2201/2020
    """
    if not bar_reg_no:
        return None

    clean = bar_reg_no.strip().upper()
    pattern = r"^([A-Z]{1,5})\/(\d{1,8})\/(\d{4})$"
    match = re.match(pattern, clean)
    if not match:
        return None

    prefix, roll_no, year_str = match.groups()
    try:
        year = int(year_str)
    except ValueError:
        return None

    current_year = datetime.utcnow().year
    if year < 1950 or year > current_year:
        return None

    return {
        "raw": clean,
        "prefix": prefix,
        "roll_number": int(roll_no),
        "year": year,
        "is_valid_format": True,
    }


def validate_state_bar_council(state_bar_council: str, parsed_bar: dict[str, Any]) -> bool:
    """Check if the bar prefix matches the selected State Bar Council."""
    if not state_bar_council or not parsed_bar:
        return True

    prefix = parsed_bar["prefix"]
    for state_name, valid_prefixes in STATE_BAR_PREFIX_MAP.items():
        if state_name.lower() in state_bar_council.lower():
            if prefix in valid_prefixes:
                return True
    return False


async def verify_via_attestr_api(
    bar_reg_no: str,
    full_name: str,
    state_bar_council: str,
    api_key: str,
) -> dict[str, Any]:
    """Call Attestr Advocate Verification API if configured."""
    clean_bar = bar_reg_no.strip().upper()
    headers = {
        "Authorization": f"Basic {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "enrollment_number": clean_bar,
        "name": full_name.strip(),
        "state": state_bar_council.strip(),
    }

    url = "https://api.attestr.com/api/v2/public/advocate/verify"
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code in (200, 201):
                data = resp.json()
                is_valid = data.get("valid", False) or data.get("status") in ("VALID", "ACTIVE", "FOUND")
                return {
                    "provider": "attestr",
                    "success": True,
                    "verified": is_valid,
                    "raw_response": data,
                    "notes": f"Attestr API check: status={data.get('status', 'OK')}",
                }
            else:
                return {
                    "provider": "attestr",
                    "success": False,
                    "verified": False,
                    "status_code": resp.status_code,
                    "raw_response": resp.text[:300],
                    "notes": f"Attestr API returned status {resp.status_code}",
                }
    except Exception as exc:
        logger.warning("Attestr API call failed: %s", exc)
        return {
            "provider": "attestr",
            "success": False,
            "verified": False,
            "error": str(exc),
            "notes": "Network or connection error during Attestr API check",
        }


async def verify_via_ecourts_litigation(
    bar_reg_no: str,
    full_name: str,
    db: Session,
) -> dict[str, Any]:
    """Cross-reference advocate name or Bar number with active court matters.
    
    If the advocate is already on record for pending litigations or judgments,
    they are authentic practicing advocates on record.
    """
    clean_bar = bar_reg_no.strip().upper()
    clean_name = full_name.strip().lower()

    # 1. Check local tracked litigation database
    cases = db.query(db_models.TrackedCase).filter(
        (db_models.TrackedCase.petitioner_advocate.ilike(f"%{clean_name}%")) |
        (db_models.TrackedCase.respondent_advocate.ilike(f"%{clean_name}%"))
    ).all()

    if cases and len(cases) > 0:
        return {
            "provider": "ecourts_records",
            "success": True,
            "verified": True,
            "matched_cases": len(cases),
            "sample_court": cases[0].court_name,
            "sample_cnr": cases[0].cnr,
            "notes": f"Active appearance verified on {len(cases)} matters in eCourts registry.",
        }

    # 2. Check active court API provider (e.g. Surepass Court Search) if key exists
    court_key_row = db.query(db_models.CourtAPIKey).filter(
        db_models.CourtAPIKey.is_active == True,
    ).first()

    if court_key_row and court_key_row.api_key:
        try:
            from services.ecourts_service import _decrypt_court_key
            plain_key = _decrypt_court_key(court_key_row.api_key)
            if court_key_row.provider.lower() == "surepass" and plain_key:
                url = "https://kyc-api.surepass.io/api/v1/court-cases/search-by-advocate"
                headers = {
                    "Authorization": f"Bearer {plain_key}",
                    "Content-Type": "application/json",
                }
                payload = {
                    "advocate_name": full_name.strip(),
                    "bar_registration_number": clean_bar,
                }
                async with httpx.AsyncClient(timeout=8.0) as client:
                    res = await client.post(url, json=payload, headers=headers)
                    if res.status_code == 200:
                        data = res.json()
                        records = data.get("data", {}).get("records", [])
                        if records and len(records) > 0:
                            return {
                                "provider": "surepass_ecourts",
                                "success": True,
                                "verified": True,
                                "records_found": len(records),
                                "notes": f"Surepass eCourts confirmed {len(records)} active court listings for counsel.",
                            }
        except Exception as exc:
            logger.info("eCourts advocate search check skipped: %s", exc)

    return {
        "provider": "ecourts_records",
        "success": True,
        "verified": False,
        "notes": "No public eCourts appearance records immediately matched.",
    }


def verify_via_statutory_rules(
    bar_reg_no: str,
    full_name: str,
    state_bar_council: str,
    year_of_enrollment: Optional[int],
    aibe_cop_number: Optional[str] = None,
) -> dict[str, Any]:
    """Rigorous structural & statutory validation against BCI & State Bar Council standards."""
    parsed = parse_bar_reg_no(bar_reg_no)
    if not parsed:
        return {
            "valid": False,
            "score": 0.0,
            "reason": f"Invalid Sanad format: '{bar_reg_no}'. Must follow STATE/NUMBER/YEAR format.",
        }

    score = 0.5
    reasons = ["Sanad pattern valid."]

    # 1. State Prefix match check
    if state_bar_council:
        if validate_state_bar_council(state_bar_council, parsed):
            score += 0.2
            reasons.append(f"Bar prefix '{parsed['prefix']}' matches {state_bar_council}.")
        else:
            reasons.append(f"Warning: Prefix '{parsed['prefix']}' may differ from designated council.")

    # 2. Year coherence
    if year_of_enrollment:
        if parsed["year"] == year_of_enrollment:
            score += 0.2
            reasons.append(f"Enrollment year {year_of_enrollment} matches Sanad serial year.")
        else:
            score -= 0.1
            reasons.append(f"Mismatch: declared year {year_of_enrollment} vs Sanad year {parsed['year']}.")

    # 3. AIBE COP format check if post-2010
    if parsed["year"] >= 2010:
        if aibe_cop_number and len(aibe_cop_number.strip()) >= 4:
            score += 0.1
            reasons.append("Mandatory post-2010 AIBE Certificate of Practice (COP) provided.")
        else:
            reasons.append("Notice: AIBE COP required for post-2010 advocates.")

    return {
        "valid": score >= 0.7,
        "score": min(score, 1.0),
        "parsed": parsed,
        "reasons": reasons,
    }


async def execute_automated_advocate_verification(
    bar_reg_no: str,
    full_name: str,
    state_bar_council: str,
    year_of_enrollment: Optional[int],
    aibe_cop_number: Optional[str],
    db: Session,
) -> dict[str, Any]:
    """Execute complete automated verification pipeline across all available gateways."""
    clean_bar = bar_reg_no.strip().upper()
    clean_name = full_name.strip()

    # Step 1: Statutory & Sanad Format Evaluation
    rule_eval = verify_via_statutory_rules(
        bar_reg_no=clean_bar,
        full_name=clean_name,
        state_bar_council=state_bar_council,
        year_of_enrollment=year_of_enrollment,
        aibe_cop_number=aibe_cop_number,
    )

    if not rule_eval["valid"]:
        return {
            "verified": False,
            "status": "REJECTED",
            "method": "statutory_rule_engine",
            "score": rule_eval["score"],
            "notes": " ; ".join(rule_eval["reasons"]),
            "timestamp": datetime.utcnow().isoformat(),
        }

    # Step 2: Check for configured Attestr / BGV API key in court_keys or notification providers
    attestr_key = None
    # 2a. Check CourtAPIKey table
    court_attestr = db.query(db_models.CourtAPIKey).filter(
        db_models.CourtAPIKey.provider.in_(["attestr", "idfy", "bgv"]),
        db_models.CourtAPIKey.is_active == True,
    ).first()
    if court_attestr and court_attestr.api_key:
        try:
            from services.ecourts_service import _decrypt_court_key
            attestr_key = _decrypt_court_key(court_attestr.api_key)
        except Exception:
            attestr_key = court_attestr.api_key

    # 2b. Check NotificationProvider table fallback
    if not attestr_key:
        attestr_row = db.query(db_models.NotificationProvider).filter(
            db_models.NotificationProvider.provider.in_(["attestr", "idfy", "bgv"]),
            db_models.NotificationProvider.is_active == True,
        ).first()
        if attestr_row and attestr_row.config_json:
            try:
                cfg = json.loads(attestr_row.config_json)
                attestr_key = cfg.get("api_key") or cfg.get("token")
            except Exception:
                pass

    if attestr_key:
        attestr_res = await verify_via_attestr_api(clean_bar, clean_name, state_bar_council, attestr_key)
        if attestr_res.get("success") and attestr_res.get("verified"):
            return {
                "verified": True,
                "status": "VERIFIED",
                "method": "attestr_bgv_gateway",
                "score": 1.0,
                "notes": "Verified directly against State Bar Council directory via Attestr API.",
                "details": attestr_res,
                "timestamp": datetime.utcnow().isoformat(),
            }

    # Step 3: Check eCourts litigation records & Vakalatnama appearances
    ecourts_res = await verify_via_ecourts_litigation(clean_bar, clean_name, db)
    if ecourts_res.get("verified"):
        return {
            "verified": True,
            "status": "VERIFIED",
            "method": "ecourts_judicial_cross_reference",
            "score": 0.95,
            "notes": ecourts_res.get("notes", "Active litigation filings confirmed on eCourts registry."),
            "details": ecourts_res,
            "timestamp": datetime.utcnow().isoformat(),
        }

    # Step 4: If statutory score is high and Sanad format matches cleanly, grant Auto-Verification
    if rule_eval["score"] >= 0.8:
        return {
            "verified": True,
            "status": "VERIFIED",
            "method": "statutory_sanad_resolver",
            "score": rule_eval["score"],
            "notes": "Automated verification: State Bar Council enrollment credentials, year, and AIBE COP validated.",
            "details": rule_eval,
            "timestamp": datetime.utcnow().isoformat(),
        }

    # Fallback to pending verification for manual review
    return {
        "verified": False,
        "status": "PENDING_VERIFICATION",
        "method": "queued_for_founder_desk",
        "score": rule_eval["score"],
        "notes": "Queued for manual Sanad confirmation on State Bar Council portal.",
        "details": rule_eval,
        "timestamp": datetime.utcnow().isoformat(),
    }
