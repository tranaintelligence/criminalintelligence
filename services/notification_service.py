"""
TRANA Notification Gateway Service
Dispatches real transactional hearing advisories via Email (Resend / SMTP)
and cellular SMS (Twilio / Fast2SMS) with embedded RFC 5545 iCalendar (.ics) invites.
"""

from __future__ import annotations

import base64
from datetime import datetime, timedelta
import email.message
import json
import logging
import os
import re
import smtplib
import ssl
from typing import Any, Optional
import uuid

import httpx
from sqlalchemy.orm import Session

logger = logging.getLogger("trana.notifications")


def _clean_phone(phone: str) -> str:
    """Normalize phone string into digits."""
    return re.sub(r"[^\d+]", "", phone.strip())


def _extract_10_digit(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if len(digits) >= 10:
        return digits[-10:]
    return digits


def generate_ics_calendar(case_info: dict[str, Any]) -> str:
    """Generate standard RFC 5545 iCalendar data for the hearing."""
    cnr = str(case_info.get("cnr") or case_info.get("formatted_cnr") or "UNKNOWN")
    case_type = str(case_info.get("case_type") or "Court Matter")
    case_number = str(case_info.get("case_number") or "Hearing")
    court_name = str(case_info.get("court_name") or "District & Sessions Court")
    court_room = str(case_info.get("court_room") or "Court Room No. 01")
    judge = str(case_info.get("judge") or "Hon'ble Presiding Judge")
    purpose = str(case_info.get("hearing_purpose") or "Hearing / Orders")
    petitioner = str(case_info.get("petitioner") or "Petitioner")
    respondent = str(case_info.get("respondent") or "Respondent")
    next_date_str = str(case_info.get("next_hearing_date") or "").strip()

    # Try parsing hearing date
    event_date = None
    for fmt in ("%Y-%m-%d", "%d %b %Y", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            event_date = datetime.strptime(next_date_str, fmt)
            break
        except ValueError:
            continue

    if not event_date:
        event_date = datetime.utcnow() + timedelta(days=1)

    start_dt = event_date.replace(hour=10, minute=0, second=0)
    end_dt = event_date.replace(hour=13, minute=0, second=0)

    start_str = start_dt.strftime("%Y%m%dT%H%M00")
    end_str = end_dt.strftime("%Y%m%dT%H%M00")
    stamp_str = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    uid = f"trana-hearing-{cnr}-{start_dt.strftime('%Y%m%d')}@trana.in"

    description = (
        f"CNR: {cnr}\\n"
        f"Matter: {case_type} {case_number}\\n"
        f"Court: {court_name} ({court_room})\\n"
        f"Judicial Officer: {judge}\\n"
        f"Purpose: {purpose}\\n"
        f"Petitioner: {petitioner}\\n"
        f"Respondent: {respondent}\\n\\n"
        f"Synchronized automatically by TRANA eCourts Intelligence."
    )

    ics = (
        "BEGIN:VCALENDAR\r\n"
        "VERSION:2.0\r\n"
        "PRODID:-//TRANA Intelligence//eCourts Hearing Diary//EN\r\n"
        "CALSCALE:GREGORIAN\r\n"
        "METHOD:PUBLISH\r\n"
        "BEGIN:VEVENT\r\n"
        f"UID:{uid}\r\n"
        f"DTSTAMP:{stamp_str}\r\n"
        f"DTSTART:{start_str}\r\n"
        f"DTEND:{end_str}\r\n"
        f"SUMMARY:[Court Hearing] {case_type} {case_number} - {court_name}\r\n"
        f"LOCATION:{court_name}\\, {court_room}\r\n"
        f"DESCRIPTION:{description}\r\n"
        "STATUS:CONFIRMED\r\n"
        "BEGIN:VALARM\r\n"
        "ACTION:DISPLAY\r\n"
        "DESCRIPTION:Upcoming Court Hearing in 24 Hours\r\n"
        "TRIGGER:-P1D\r\n"
        "END:VALARM\r\n"
        "END:VEVENT\r\n"
        "END:VCALENDAR\r\n"
    )
    return ics


def generate_hearing_email_html(case_info: dict[str, Any], recipient: str) -> tuple[str, str]:
    """Return (subject, html_body) for formal hearing notice."""
    cnr = str(case_info.get("formatted_cnr") or case_info.get("cnr") or "CNR")
    case_type = str(case_info.get("case_type") or "Matter")
    case_number = str(case_info.get("case_number") or "")
    court_name = str(case_info.get("court_name") or "District Court")
    court_room = str(case_info.get("court_room") or "Court Room")
    judge = str(case_info.get("judge") or "Presiding Judge")
    next_date = str(case_info.get("next_hearing_date") or "Pending Listing")
    purpose = str(case_info.get("hearing_purpose") or "Hearing on Merits")
    petitioner = str(case_info.get("petitioner") or "Petitioner")
    respondent = str(case_info.get("respondent") or "Respondent")
    pet_adv = str(case_info.get("petitioner_advocate") or "Advocate on Record")
    resp_adv = str(case_info.get("respondent_advocate") or "Opposite Counsel")
    stage = str(case_info.get("current_stage") or "Pleadings")
    last_order = str(case_info.get("last_order_summary") or "Matter listed on eCourts registry.")
    source = str(case_info.get("source") or "National Judicial Data Grid (NJDG)")

    subject = f"[TRANA eCourts Alert] Court Listing: {case_type} {case_number} ({cnr}) — {next_date}"

    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0d0d0d;
      color: #e5e5e5;
      margin: 0;
      padding: 24px;
    }}
    .container {{
      max-width: 620px;
      margin: 0 auto;
      background: #141414;
      border: 1px solid #262626;
      border-radius: 12px;
      overflow: hidden;
    }}
    .header {{
      background: #1a1a1a;
      padding: 24px 28px;
      border-bottom: 1px solid #282828;
    }}
    .brand {{
      font-size: 13px;
      font-family: monospace;
      letter-spacing: 2px;
      color: #f59e0b;
      text-transform: uppercase;
      font-weight: 700;
    }}
    .title {{
      font-size: 20px;
      font-weight: 600;
      color: #ffffff;
      margin: 8px 0 0 0;
    }}
    .badge {{
      display: inline-block;
      font-size: 11px;
      font-family: monospace;
      padding: 3px 8px;
      border-radius: 4px;
      background: #202020;
      border: 1px solid #333333;
      color: #d4d4d4;
      margin-top: 6px;
    }}
    .content {{
      padding: 28px;
    }}
    .highlight-card {{
      background: #1a1813;
      border: 1px solid #78350f;
      border-radius: 8px;
      padding: 18px 20px;
      margin-bottom: 24px;
    }}
    .date-label {{
      font-size: 11px;
      font-family: monospace;
      text-transform: uppercase;
      color: #fbbf24;
      letter-spacing: 1px;
    }}
    .date-value {{
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      margin: 4px 0 8px 0;
    }}
    .purpose {{
      font-size: 13px;
      color: #d4d4d4;
    }}
    .info-table {{
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 13px;
    }}
    .info-table td {{
      padding: 10px 0;
      border-bottom: 1px solid #222222;
      vertical-align: top;
    }}
    .info-label {{
      color: #888888;
      width: 35%;
      font-size: 12px;
    }}
    .info-value {{
      color: #f3f4f6;
      font-weight: 500;
    }}
    .calendar-note {{
      background: #111827;
      border: 1px solid #1e3a8a;
      border-radius: 6px;
      padding: 12px 16px;
      font-size: 12px;
      color: #93c5fd;
      margin-top: 20px;
    }}
    .footer {{
      padding: 20px 28px;
      background: #0f0f0f;
      border-top: 1px solid #222222;
      font-size: 11px;
      color: #666666;
      font-family: monospace;
      text-align: center;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">TRANA • eCourts Intelligence</div>
      <h1 class="title">Official Hearing Listing Advisory</h1>
      <div class="badge">CNR: {cnr}</div>
    </div>
    <div class="content">
      <div class="highlight-card">
        <div class="date-label">Next Date of Listing</div>
        <div class="date-value">{next_date}</div>
        <div class="purpose"><strong>Purpose:</strong> {purpose}</div>
      </div>

      <table class="info-table">
        <tr>
          <td class="info-label">Court Complex</td>
          <td class="info-value">{court_name}</td>
        </tr>
        <tr>
          <td class="info-label">Court Room / Bench</td>
          <td class="info-value">{court_room} • {judge}</td>
        </tr>
        <tr>
          <td class="info-label">Case Classification</td>
          <td class="info-value">{case_type} (No. {case_number})</td>
        </tr>
        <tr>
          <td class="info-label">Petitioner / Complainant</td>
          <td class="info-value">{petitioner}<br><span style="color:#9ca3af; font-size:11px;">Counsel: {pet_adv}</span></td>
        </tr>
        <tr>
          <td class="info-label">Respondent / Accused</td>
          <td class="info-value">{respondent}<br><span style="color:#9ca3af; font-size:11px;">Counsel: {resp_adv}</span></td>
        </tr>
        <tr>
          <td class="info-label">Current Stage</td>
          <td class="info-value">{stage}</td>
        </tr>
        <tr>
          <td class="info-label">Last Judicial Direction</td>
          <td class="info-value">{last_order}</td>
        </tr>
      </table>

      <div class="calendar-note">
        📅 <strong>Calendar Sync Enclosed:</strong> An iCalendar (.ics) invite is attached with this email. Open it to add this listing directly to Google Calendar, Outlook, or Apple Calendar with automated reminders.
      </div>
    </div>
    <div class="footer">
      Source: {source}<br>
      Dispatched by TRANA Automated Legal Registry System for {recipient}.
    </div>
  </div>
</body>
</html>"""
    return subject, html


def generate_hearing_sms_text(case_info: dict[str, Any]) -> str:
    """Generate concise cellular SMS text (<160 chars per segment)."""
    cnr = str(case_info.get("formatted_cnr") or case_info.get("cnr") or "")
    case_type = str(case_info.get("case_type") or "Case")
    case_number = str(case_info.get("case_number") or "")
    court_name = str(case_info.get("court_name") or "Court")
    court_room = str(case_info.get("court_room") or "")
    next_date = str(case_info.get("next_hearing_date") or "Soon")
    purpose = str(case_info.get("hearing_purpose") or "Hearing")

    return (
        f"[TRANA Alert] Hearing scheduled for CNR {cnr} ({case_type} {case_number}) "
        f"on {next_date} at {court_name} ({court_room}). "
        f"Purpose: {purpose}."
    )


def _get_notification_credential(channel: str, db: Optional[Session] = None) -> Optional[dict[str, Any]]:
    """Fetch active notification provider credential from DB."""
    if not db:
        try:
            from database import SessionLocal
            with SessionLocal() as session:
                return _get_notification_credential(channel, session)
        except Exception:
            return None

    try:
        import models.db_models as db_models
        row = db.query(db_models.NotificationProvider).filter(
            db_models.NotificationProvider.channel == channel,
            db_models.NotificationProvider.is_active == True,
        ).order_by(db_models.NotificationProvider.created_at.desc()).first()

        if row:
            config = json.loads(row.config_json) if row.config_json else {}
            return {
                "id": row.id,
                "provider": row.provider,
                "label": row.label,
                "config": config,
            }
    except Exception as exc:
        logger.debug("Could not query notification provider: %s", exc)

    return None


async def send_email_notification(
    to_email: str,
    case_info: dict[str, Any],
    db: Optional[Session] = None,
) -> dict[str, Any]:
    """
    Send an authentic hearing reminder email via Resend API or SMTP.
    Attaches RFC 5545 iCalendar invite.
    """
    clean_to = to_email.strip()
    if not clean_to or "@" not in clean_to:
        return {"success": False, "provider": "None", "error": "Invalid recipient email address"}

    subject, html_content = generate_hearing_email_html(case_info, clean_to)
    ics_content = generate_ics_calendar(case_info)
    ics_filename = f"Court_Hearing_{str(case_info.get('cnr') or 'Notice')[:12]}.ics"

    # 1. Check DB configured provider
    db_cred = _get_notification_credential("email", db)
    provider_name = (db_cred.get("provider") if db_cred else "").lower()
    config = db_cred.get("config", {}) if db_cred else {}

    # Check environment variables fallback
    resend_key = config.get("api_key") or os.getenv("RESEND_API_KEY")
    smtp_host = config.get("host") or os.getenv("SMTP_HOST")
    smtp_port = int(config.get("port") or os.getenv("SMTP_PORT") or 587)
    smtp_user = config.get("username") or os.getenv("SMTP_USER")
    smtp_pass = config.get("password") or os.getenv("SMTP_PASSWORD")
    smtp_from = config.get("from_email") or os.getenv("SMTP_FROM") or "TRANA eCourts <advisories@trana.in>"

    # ─── Option A: Resend API ──────────────────────────────────────────
    if (provider_name == "resend" or resend_key) and resend_key:
        from_addr = config.get("from_email") or os.getenv("RESEND_FROM") or "TRANA eCourts <onboarding@resend.dev>"
        payload = {
            "from": from_addr,
            "to": [clean_to],
            "subject": subject,
            "html": html_content,
            "attachments": [
                {
                    "filename": ics_filename,
                    "content": base64.b64encode(ics_content.encode("utf-8")).decode("utf-8"),
                }
            ],
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {resend_key.strip()}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                if res.status_code in (200, 201):
                    data = res.json()
                    logger.info("Dispatched email via Resend to %s (id: %s)", clean_to, data.get("id"))
                    return {
                        "success": True,
                        "provider": "Resend",
                        "message_id": data.get("id"),
                        "message": f"Email delivered to {clean_to} with Calendar invite (.ics)",
                    }
                else:
                    err_msg = res.text[:200]
                    logger.warning("Resend email failed: %s", err_msg)
                    return {"success": False, "provider": "Resend", "error": f"Resend API error: {err_msg}"}
        except Exception as exc:
            logger.error("Resend dispatch exception: %s", exc)
            return {"success": False, "provider": "Resend", "error": str(exc)}

    # ─── Option B: Standard SMTP ───────────────────────────────────────
    if (provider_name == "smtp" or smtp_host) and smtp_host:
        try:
            msg = email.message.EmailMessage()
            msg["Subject"] = subject
            msg["From"] = smtp_from
            msg["To"] = clean_to

            # Plain text fallback
            plain_summary = generate_hearing_sms_text(case_info)
            msg.set_content(plain_summary)
            msg.add_alternative(html_content, subtype="html")

            # Attach .ics calendar
            msg.add_attachment(
                ics_content.encode("utf-8"),
                maintype="text",
                subtype="calendar",
                filename=ics_filename,
            )

            # SMTP send
            use_ssl = config.get("use_ssl", False) or smtp_port == 465
            if use_ssl:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context, timeout=12.0) as server:
                    if smtp_user and smtp_pass:
                        server.login(smtp_user, smtp_pass)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(smtp_host, smtp_port, timeout=12.0) as server:
                    server.ehlo()
                    try:
                        server.starttls()
                        server.ehlo()
                    except Exception:
                        pass
                    if smtp_user and smtp_pass:
                        server.login(smtp_user, smtp_pass)
                    server.send_message(msg)

            logger.info("Dispatched email via SMTP (%s) to %s", smtp_host, clean_to)
            return {
                "success": True,
                "provider": f"SMTP ({smtp_host})",
                "message": f"Advisory delivered to {clean_to} with Calendar invite (.ics)",
            }
        except Exception as exc:
            logger.error("SMTP dispatch failed: %s", exc)
            return {"success": False, "provider": "SMTP", "error": f"SMTP delivery failed: {exc}"}

    # ─── No email provider active ─────────────────────────────────────
    return {
        "success": False,
        "provider": "None",
        "error": "No email provider configured. Add Resend API Key or SMTP credentials in Founders Console -> Notification Gateway.",
    }


async def send_sms_notification(
    to_phone: str,
    case_info: dict[str, Any],
    db: Optional[Session] = None,
) -> dict[str, Any]:
    """
    Send cellular SMS via Twilio or Fast2SMS.
    """
    clean_phone_str = _clean_phone(to_phone)
    if not clean_phone_str:
        return {"success": False, "provider": "None", "error": "Invalid phone number"}

    sms_text = generate_hearing_sms_text(case_info)

    # 1. Check DB configured provider
    db_cred = _get_notification_credential("sms", db)
    provider_name = (db_cred.get("provider") if db_cred else "").lower()
    config = db_cred.get("config", {}) if db_cred else {}

    # Check environment variables fallback
    twilio_sid = config.get("account_sid") or os.getenv("TWILIO_ACCOUNT_SID")
    twilio_token = config.get("auth_token") or os.getenv("TWILIO_AUTH_TOKEN")
    twilio_from = config.get("from_number") or os.getenv("TWILIO_FROM_NUMBER")

    fast2sms_key = config.get("api_key") or os.getenv("FAST2SMS_API_KEY")

    # ─── Option A: Twilio SMS ──────────────────────────────────────────
    if (provider_name == "twilio" or twilio_sid) and twilio_sid and twilio_token and twilio_from:
        e164_to = clean_phone_str if clean_phone_str.startswith("+") else f"+91{_extract_10_digit(clean_phone_str)}"
        url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Messages.json"

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(
                    url,
                    auth=(twilio_sid, twilio_token),
                    data={
                        "From": twilio_from,
                        "To": e164_to,
                        "Body": sms_text,
                    },
                )
                if res.status_code in (200, 201):
                    data = res.json()
                    logger.info("Dispatched Twilio SMS to %s (sid: %s)", e164_to, data.get("sid"))
                    return {
                        "success": True,
                        "provider": "Twilio",
                        "message_id": data.get("sid"),
                        "message": f"SMS dispatched to {e164_to} via Twilio",
                    }
                else:
                    err_msg = res.text[:200]
                    logger.warning("Twilio SMS failed: %s", err_msg)
                    return {"success": False, "provider": "Twilio", "error": f"Twilio error: {err_msg}"}
        except Exception as exc:
            logger.error("Twilio exception: %s", exc)
            return {"success": False, "provider": "Twilio", "error": str(exc)}

    # ─── Option B: Fast2SMS (Indian Gateway) ───────────────────────────
    if (provider_name == "fast2sms" or fast2sms_key) and fast2sms_key:
        ten_digits = _extract_10_digit(clean_phone_str)
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(
                    "https://www.fast2sms.com/dev/bulkV2",
                    headers={
                        "authorization": fast2sms_key.strip(),
                        "Content-Type": "application/json",
                    },
                    json={
                        "route": "q",
                        "message": sms_text,
                        "numbers": ten_digits,
                    },
                )
                if res.status_code == 200:
                    data = res.json()
                    if data.get("return") is True:
                        logger.info("Dispatched Fast2SMS to %s", ten_digits)
                        return {
                            "success": True,
                            "provider": "Fast2SMS",
                            "message_id": str(data.get("request_id") or ""),
                            "message": f"SMS delivered to +91-{ten_digits} via Fast2SMS",
                        }
                    else:
                        return {"success": False, "provider": "Fast2SMS", "error": str(data.get("message") or "Fast2SMS rejected dispatch")}
                else:
                    return {"success": False, "provider": "Fast2SMS", "error": f"Fast2SMS HTTP {res.status_code}: {res.text[:150]}"}
        except Exception as exc:
            logger.error("Fast2SMS exception: %s", exc)
            return {"success": False, "provider": "Fast2SMS", "error": str(exc)}

    # ─── No SMS provider active ────────────────────────────────────────
    return {
        "success": False,
        "provider": "None",
        "error": "No cellular SMS provider configured. Add Twilio or Fast2SMS credentials in Founders Console -> Notification Gateway.",
    }


async def dispatch_hearing_reminders(
    case_info: dict[str, Any],
    sms_phone: Optional[str] = None,
    email_alert: Optional[str] = None,
    db: Optional[Session] = None,
) -> list[dict[str, str]]:
    """
    Execute on-demand reminder dispatch for both SMS and Email.
    Returns audit log entries with real provider telemetry.
    """
    now_str = datetime.now().strftime("%I:%M %p")
    logs: list[dict[str, str]] = []

    # 1. SMS Dispatch
    if sms_phone and sms_phone.strip():
        sms_res = await send_sms_notification(sms_phone, case_info, db)
        if sms_res.get("success"):
            logs.append({
                "timestamp": now_str,
                "channel": "SMS",
                "recipient": sms_phone.strip(),
                "message": sms_res.get("message") or f"Dispatched via {sms_res.get('provider')}",
                "status": "Delivered",
            })
        else:
            err = sms_res.get("error") or "Gateway error"
            logs.append({
                "timestamp": now_str,
                "channel": "SMS",
                "recipient": sms_phone.strip(),
                "message": f"[Pending Gateway] {err}",
                "status": "Pending Gateway" if "No cellular SMS" in err else "Failed",
            })

    # 2. Email Dispatch
    if email_alert and email_alert.strip():
        email_res = await send_email_notification(email_alert, case_info, db)
        if email_res.get("success"):
            logs.append({
                "timestamp": now_str,
                "channel": "Email",
                "recipient": email_alert.strip(),
                "message": email_res.get("message") or f"Dispatched via {email_res.get('provider')}",
                "status": "Delivered",
            })
        else:
            err = email_res.get("error") or "Gateway error"
            logs.append({
                "timestamp": now_str,
                "channel": "Email",
                "recipient": email_alert.strip(),
                "message": f"[Pending Gateway] {err}",
                "status": "Pending Gateway" if "No email provider" in err else "Failed",
            })

    return logs

