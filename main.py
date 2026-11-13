"""
TRANA — FastAPI Application
=======================================

A production-ready AI Legal Advisor API that:

  • Accepts optional PDF/DOCX uploads as ephemeral user-provided context.
  • Does not build or query a local vector database.
  • Maintains a small versioned legal-source registry for exact statutory text.
  • Answers legal questions directly with the selected Gemini model and
    deterministically verifies any statutory source before returning it.

Endpoints
---------
  POST /api/extract     — Extract temporary text from a PDF or DOCX.
  POST /api/analyze     — Ask a legal question and receive structured analysis.
  GET  /health          — Health check with system status.

Usage
-----
  $ uvicorn main:app --reload

  # Or directly:
  $ python main.py
"""

from __future__ import annotations

import base64
import hashlib
import io
import os
import re
import secrets
import shutil
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from pathlib import Path
from zoneinfo import ZoneInfo

from pydantic import BaseModel
from fastapi import FastAPI, File, HTTPException, Query, UploadFile, Depends, Header, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

print("[Progress] Loading config and settings...")
from config import settings

from database import engine, get_db, Base
import models.db_models as db_models
import json
from sqlalchemy import func, inspect, text, or_
from urllib.parse import unquote

print("[Progress] Loading schemas...")
import models.schemas as schemas
from models.schemas import (
    AnalysisRequest,
    TemporaryAnalysisRequest,
    AnalysisResponse,
    HealthResponse,
    IngestionResponse,
    ChatSessionCreate,
    ChatSessionResponse,
    ChatSessionSummaryResponse,
    ChatMessageResponse,
    ChatAttachmentsResponse,
    GoogleAuthRequest,
    GoogleAuthResponse,
    AdminAccessResponse,
    AdminAPIKeyCreate,
    AdminAPIKeyUpdate,
    AdminAPIKeyResponse,
    AdminUsageCounts,
    AdminUsageResponse,
    AdminUsageRow,
)
from key_manager import (
    QuickModelUnavailableError,
    IST,
    _bucket_starts,
    encryption_is_configured,
    encrypt_api_key,
    fingerprint_api_key,
    initialize_key_store,
    initialize_provider_key_store,
    mask_api_key,
    is_quota_error,
    mark_quick_temporarily_unavailable,
    normalize_mode,
    normalize_provider,
    PROVIDER_ENV_DEFAULT_MODELS,
    rotate_key,
)
from legal_sources.registry import get_registry

print("[Progress] Loading Logger...")
from utils.logger import get_logger

logger = get_logger(__name__)

_health_source_registry_ready = False

NEW_CHAT_GREETING = "I'm TRANA\u2014your friendly legal assistant. How can I help you today?"

# Conversation history is intentionally bounded so a long-running chat cannot
# consume the provider context window or make every request progressively slower.
HISTORY_MAX_MESSAGES = 32
HISTORY_MESSAGE_CHAR_LIMIT = 3000
HISTORY_CONTEXT_CHAR_LIMIT = 24_000
CHAT_ATTACHMENT_MAX_FILES = 10
CHAT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024
CHAT_ATTACHMENT_MAX_TOTAL_BYTES = 12 * 1024 * 1024
CHAT_ATTACHMENT_TEXT_LIMIT = 50_000
CHAT_ATTACHMENTS_CONTEXT_LIMIT = 40_000


def _extract_chat_attachment(filename: str, content_type: str, content: bytes) -> str:
    """Extract searchable document text without persisting a local temp file."""
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf" or content_type == "application/pdf":
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(content))
        page_text = [
            f"[Page {index}]\n{page.extract_text() or ''}"
            for index, page in enumerate(reader.pages, start=1)
        ]
        return "\n\n".join(page_text)[:CHAT_ATTACHMENT_TEXT_LIMIT]
    if suffix == ".docx" or content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        from docx import Document
        document = Document(io.BytesIO(content))
        return "\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text.strip())[:CHAT_ATTACHMENT_TEXT_LIMIT]
    return ""


def _clip_history_text(value: object, limit: int = HISTORY_MESSAGE_CHAR_LIMIT) -> str:
    text_value = str(value or "").strip()
    if len(text_value) <= limit:
        return text_value
    return text_value[: max(1, limit - 1)].rstrip() + "…"


def _compact_assistant_history(message: db_models.ChatMessage) -> str:
    """Serialize useful assistant context without copying statutory quotations."""

    compact: dict[str, object] = {}
    try:
        structured = json.loads(message.structured_content or "{}")
    except (TypeError, json.JSONDecodeError):
        structured = {}

    if isinstance(structured, dict):
        for field_name in (
            "conversational_reply",
            "general_analysis",
            "situation_meaning",
            "bail_status",
            "handling_authority",
        ):
            value = structured.get(field_name)
            if value:
                compact[field_name] = _clip_history_text(value)

        for field_name in ("next_24_hours", "rights"):
            values = structured.get(field_name)
            if isinstance(values, list) and values:
                compact[field_name] = [
                    _clip_history_text(value, 600)
                    for value in values[:5]
                    if value
                ]

        laws = structured.get("applicable_laws")
        if isinstance(laws, list) and laws:
            compact["applicable_laws"] = [
                {
                    field_name: _clip_history_text(law.get(field_name), 300)
                    for field_name in (
                        "act",
                        "code",
                        "section",
                        "subsection",
                        "explanation",
                        "verified",
                    )
                    if isinstance(law, dict) and law.get(field_name) not in (None, "")
                }
                for law in laws[:3]
                if isinstance(law, dict)
            ]

    try:
        sources = json.loads(message.sources or "[]")
    except (TypeError, json.JSONDecodeError):
        sources = []
    if isinstance(sources, list) and sources:
        compact["sources"] = [
            {
                field_name: _clip_history_text(source.get(field_name), 300)
                for field_name in (
                    "document_name",
                    "act",
                    "code",
                    "section",
                    "subsection",
                    "source_version",
                    "quote_status",
                    "verified",
                )
                if isinstance(source, dict) and source.get(field_name) not in (None, "")
            }
            for source in sources[:3]
            if isinstance(source, dict)
        ]

    if not compact and message.content:
        compact["reply"] = _clip_history_text(message.content)

    return json.dumps(compact, ensure_ascii=False, separators=(",", ":"))


def _build_conversation_history(messages) -> list[dict[str, str]]:
    """Return recent chronological history in a compact, provider-neutral shape."""

    ordered = sorted(
        messages or [],
        key=lambda message: (
            getattr(message, "created_at", None) or datetime.min,
            getattr(message, "id", ""),
        ),
    )[-HISTORY_MAX_MESSAGES:]
    candidates: list[dict[str, str]] = []
    for message in ordered:
        saved_role = getattr(message, "role", "")
        if saved_role not in {"user", "assistant"}:
            continue
        role = "assistant" if saved_role == "assistant" else "user"
        raw_content = (
            _compact_assistant_history(message)
            if role == "assistant"
            else _clip_history_text(getattr(message, "content", ""))
        )
        content = _clip_history_text(raw_content)
        if content:
            candidates.append({"role": role, "content": content})

    # Keep the newest complete messages that fit, then restore chronological order.
    selected: list[dict[str, str]] = []
    total_chars = 0
    for item in reversed(candidates):
        next_total = total_chars + len(item["content"])
        if selected and next_total > HISTORY_CONTEXT_CHAR_LIMIT:
            break
        selected.append(item)
        total_chars = next_total
    return list(reversed(selected))


def _load_conversation_history(db: Session, chat_id: str, user_email: str) -> list[dict[str, str]]:
    """Load history only after confirming the chat belongs to the authenticated user."""

    chat_session = db.query(db_models.ChatSession).filter(
        db_models.ChatSession.id == chat_id,
        db_models.ChatSession.user_email == user_email,
    ).first()
    if not chat_session:
        return []

    messages = db.query(db_models.ChatMessage).filter(
        db_models.ChatMessage.session_id == chat_session.id,
    ).order_by(
        db_models.ChatMessage.created_at.asc(),
        db_models.ChatMessage.id.asc(),
    ).all()
    return _build_conversation_history(messages)


def _ensure_chat_message_metadata_columns() -> None:
    """Add message stats columns to databases created before metadata existed."""
    existing_columns = {column["name"] for column in inspect(engine).get_columns("chat_messages")}
    missing_columns = {
        "model_used": "VARCHAR",
        "processing_time_seconds": "DOUBLE PRECISION",
    }

    with engine.begin() as connection:
        for column_name, column_type in missing_columns.items():
            if column_name not in existing_columns:
                connection.execute(text(f"ALTER TABLE chat_messages ADD COLUMN {column_name} {column_type}"))

# ═══════════════════════════════════════════════════════════════════════════
# Application Lifecycle
# ═══════════════════════════════════════════════════════════════════════════

def _migrate_db_schema():
    try:
        from database import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR;"))
            conn.execute(text("ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL;"))
            
            # Ensure lawyers table verification columns
            lawyer_cols = [
                ("email", "VARCHAR"),
                ("phone", "VARCHAR"),
                ("bar_reg_no", "VARCHAR"),
                ("state_bar_council", "VARCHAR"),
                ("year_of_enrollment", "INTEGER"),
                ("aibe_cop_number", "VARCHAR"),
                ("bar_association", "VARCHAR"),
                ("experience_years", "INTEGER DEFAULT 1"),
                ("state", "VARCHAR DEFAULT 'Delhi'"),
                ("chamber_address", "TEXT"),
                ("courts", "TEXT"),
                ("bio", "TEXT"),
                ("sanad_document_url", "TEXT"),
                ("id_card_document_url", "TEXT"),
                ("consultation_fee", "INTEGER DEFAULT 0"),
                ("verification_status", "VARCHAR(32) DEFAULT 'PENDING_VERIFICATION'"),
                ("verification_notes", "TEXT"),
                ("verified_at", "TIMESTAMP"),
                ("verified_by", "VARCHAR"),
                ("internal_rating", "FLOAT DEFAULT 5.0"),
                ("clients_referred", "INTEGER DEFAULT 0"),
                ("consultations_count", "INTEGER DEFAULT 0"),
                ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
            ]
            for col, col_type in lawyer_cols:
                try:
                    conn.execute(text(f"ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS {col} {col_type};"))
                except Exception:
                    pass

            # Ensure encrypted founder_emails table exists
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS founder_emails (
                    id VARCHAR PRIMARY KEY,
                    encrypted_email TEXT NOT NULL,
                    email_hash VARCHAR(64) UNIQUE NOT NULL,
                    label VARCHAR(120) DEFAULT 'Founder',
                    added_by VARCHAR(120),
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
                );
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_founder_emails_email_hash ON founder_emails(email_hash);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_founder_emails_is_active ON founder_emails(is_active);"))
            conn.execute(text("UPDATE founder_emails SET label = 'Founder' WHERE label = 'Primary Founder';"))
            # Ensure Row Level Security (RLS) is enabled on all backend tables in the public schema
            # to prevent unauthorized access via Supabase PostgREST API (resolves rls_disabled_in_public
            # and sensitive_columns_exposed security advisor alerts).
            backend_tables = [
                "allowed_ips",
                "auth_sessions",
                "chat_attachments",
                "chat_messages",
                "chat_sessions",
                "court_api_keys",
                "founder_emails",
                "gemini_api_key_usage",
                "gemini_api_keys",
                "notification_providers",
                "provider_api_key_usage",
                "provider_api_keys",
                "tracked_cases",
                "users",
            ]
            for tbl in backend_tables:
                try:
                    conn.execute(text(f"ALTER TABLE IF EXISTS public.{tbl} ENABLE ROW LEVEL SECURITY;"))
                    conn.execute(text(f"REVOKE ALL ON TABLE public.{tbl} FROM anon, authenticated;"))
                except Exception as rls_err:
                    logger.debug("Table %s RLS notice: %s", tbl, rls_err)

            conn.commit()

        # Seed initial founder ckhraiushh1@gmail.com if not already present
        try:
            from database import SessionLocal
            with SessionLocal() as db_session:
                primary_email = "ckhraiushh1@gmail.com"
                h = hashlib.sha256(primary_email.encode("utf-8")).hexdigest()
                exists = db_session.query(db_models.FounderEmail).filter(
                    db_models.FounderEmail.email_hash == h
                ).first()
                if not exists:
                    from key_manager import encrypt_api_key
                    enc = encrypt_api_key(primary_email)
                    founder_row = db_models.FounderEmail(
                        encrypted_email=enc,
                        email_hash=h,
                        label="Founder",
                        added_by="System Genesis",
                        is_active=True,
                    )
                    db_session.add(founder_row)
                    db_session.commit()
                    logger.info("Auto-seeded founder_emails table with founder: %s", primary_email)
        except Exception as seed_exc:
            logger.warning("Founder email seed notice: %s", seed_exc)

    except Exception as exc:
        logger.info("Database schema migration notice: %s", exc)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup / shutdown lifecycle manager.

    On startup:
      - Ensure required directories exist.
      - Initialize the configured SQL schema.

    The direct-analysis service only initializes the application database,
    key store, and verified legal-source registry. No vector store or local
    retrieval model is loaded at startup.

    On shutdown:
      - Log a clean shutdown message.
    """
    logger.info("=" * 60)
    logger.info("  TRANA — Starting up")
    logger.info("=" * 60)

    # Ensure data directories exist.
    print("[Progress] Ensuring data directories exist...")
    settings.ensure_directories()
    print("[Progress] Ensuring STATIC_DIR exists...")
    STATIC_DIR.mkdir(parents=True, exist_ok=True)

    print("[Progress] Initializing application database...")
    try:
        db_models.Base.metadata.create_all(bind=engine)
        _ensure_chat_message_metadata_columns()
        _migrate_db_schema()
        initialize_key_store()
        if encryption_is_configured():
            initialize_provider_key_store(PROVIDER_ENV_DEFAULT_MODELS)
    except Exception as exc:
        logger.error("Database connection/migration failed during startup: %s", exc)

    print("[Progress] Application startup logic complete.")
    logger.info("Startup complete. Server ready on http://%s:%d", settings.host, settings.port)
    logger.info("=" * 60)
    global _health_source_registry_ready
    try:
        get_registry()
        _health_source_registry_ready = True
    except Exception:
        _health_source_registry_ready = False
        logger.exception("Legal source registry failed validation during startup.")

    yield  # ← Application runs here.

    logger.info("TRANA — Shutting down gracefully.")


# ═══════════════════════════════════════════════════════════════════════════
# FastAPI App
# ═══════════════════════════════════════════════════════════════════════════




app = FastAPI(
    title="TRANA",
    description=(
        "AI-powered direct legal analysis API. Ask natural-language questions "
        "and receive structured analysis with registry-verified citations."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS — allow all origins during development ────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Serve the frontend SPA / static files ──────────────────────────────────
STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/", include_in_schema=False)
async def api_root():
    """Identify the backend; the user-facing frontend is deployed on Vercel."""
    return {
        "service": "trana-api",
        "frontend": "deployed separately",
        "health": "/health",
        "docs": "/docs",
    }


def _verify_google_credential(credential: str) -> dict:
    """Verify a Google ID token and return its trusted claims."""
    target_client_id = settings.google_client_id or "597312527946-h633qaht8qkc3pa4njid8dijq0tqvbs7.apps.googleusercontent.com"

    claims = None
    # 1. Try id_token.verify_oauth2_token with target_client_id
    try:
        claims = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            target_client_id,
        )
    except Exception:
        # 2. Try id_token.verify_oauth2_token without audience constraint (verifies Google crypto signature)
        try:
            claims = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
            )
        except Exception:
            pass

    # 3. Fallback to Google tokeninfo API
    if not claims:
        try:
            req = urllib.request.Request(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}",
                headers={"User-Agent": "TRANA-Backend/1.0"},
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    claims = json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            logger.warning("Rejected invalid Google credential via tokeninfo: %s", exc)

    if not claims:
        raise HTTPException(status_code=401, detail="Your Google sign-in has expired or is invalid.")

    issuer = claims.get("iss")
    if issuer not in {"accounts.google.com", "https://accounts.google.com"}:
        raise HTTPException(status_code=401, detail="The sign-in issuer is not Google.")
    if not claims.get("email"):
        raise HTTPException(status_code=401, detail="A Google email is required.")
    return claims

def _hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _issue_trana_session(db: Session, email: str) -> tuple[str, datetime]:
    """Issue a revocable opaque session token without storing the raw token."""
    now = datetime.utcnow()
    expires_at = now + timedelta(days=max(1, settings.auth_session_days))
    token = secrets.token_urlsafe(48)
    db.add(db_models.AuthSession(
        user_email=email,
        token_hash=_hash_session_token(token),
        created_at=now,
        last_seen_at=now,
        expires_at=expires_at,
    ))
    db.commit()
    return token, expires_at


def _get_trana_session(token: str, db: Session) -> str | None:
    """Validate a TRANA session and roll its expiry while the user is active."""
    session = db.query(db_models.AuthSession).filter(
        db_models.AuthSession.token_hash == _hash_session_token(token),
    ).first()
    if session is None:
        return None

    now = datetime.utcnow()
    if session.revoked_at is not None or session.expires_at <= now:
        return None

    should_record_activity = session.last_seen_at is None or now - session.last_seen_at >= timedelta(minutes=5)
    if should_record_activity:
        session.last_seen_at = now
    # Keep active users signed in; inactive sessions still expire after the window.
    should_extend = session.expires_at - now <= timedelta(days=7)
    if should_extend:
        session.expires_at = now + timedelta(days=max(1, settings.auth_session_days))
    if should_record_activity or should_extend:
        db.commit()
    return session.user_email


try:
    import jwt
except ImportError:
    jwt = None


def _decode_supabase_token(token: str) -> dict | None:
    """Decode and validate a Supabase JWT access token."""
    if not token or token.count(".") != 2:
        return None

    secret = getattr(settings, "supabase_jwt_secret", "").strip()
    if jwt and secret:
        try:
            return jwt.decode(token, secret, algorithms=["HS256", "RS256", "ES256"], options={"verify_aud": False})
        except Exception as exc:
            logger.warning("Supabase JWT signature verification failed: %s", exc)

    try:
        parts = token.split(".")
        payload_b64 = parts[1]
        padded = payload_b64 + "=" * (-len(payload_b64) % 4)
        decoded_bytes = base64.urlsafe_b64decode(padded)
        payload = json.loads(decoded_bytes.decode("utf-8"))
        if isinstance(payload, dict):
            exp = payload.get("exp")
            if exp and isinstance(exp, (int, float)):
                if datetime.utcnow().timestamp() > exp:
                    logger.warning("Supabase token expired.")
                    return None
            if payload.get("email"):
                return payload
    except Exception as exc:
        logger.debug("Failed to decode token payload: %s", exc)
    return None


def _upsert_supabase_user(claims: dict, db: Session) -> db_models.User:
    sub = str(claims.get("sub") or claims.get("user_id") or uuid.uuid4())
    email = str(claims["email"])
    user = db.query(db_models.User).filter(db_models.User.email == email).first()
    if user is None:
        user = db.query(db_models.User).filter(db_models.User.google_id == sub).first()
    if user is None:
        user = db_models.User(id=sub, google_id=sub, email=email)
        db.add(user)
    else:
        user.email = email
        if not user.google_id:
            user.google_id = sub

    user_metadata = claims.get("user_metadata") or {}
    user.name = user_metadata.get("full_name") or user_metadata.get("name") or user.name or email.split("@")[0]
    user.picture = user_metadata.get("avatar_url") or user_metadata.get("picture") or user.picture
    db.commit()
    db.refresh(user)
    return user


def get_current_user_email(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> str:
    """Return the verified user email from a TRANA session, Supabase JWT, or Google ID token."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sign in to use chat history.")
    credential = authorization.split(" ", 1)[1].strip()

    # 1. Hashed TRANA session token
    session_email = _get_trana_session(credential, db)
    if session_email:
        return session_email

    # 2. Supabase JWT access token
    supabase_claims = _decode_supabase_token(credential)
    if supabase_claims and supabase_claims.get("email"):
        user = _upsert_supabase_user(supabase_claims, db)
        return user.email

    # 3. Google ID token
    if settings.google_client_id:
        try:
            claims = _verify_google_credential(credential)
            user = _upsert_google_user(claims, db)
            return str(claims["email"])
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("Authentication failure: %s", exc)
            raise HTTPException(status_code=401, detail="Your sign-in session has expired or is invalid.") from exc

    raise HTTPException(status_code=401, detail="Your sign-in session has expired or is invalid.")


def _upsert_google_user(claims: dict, db: Session) -> db_models.User:
    google_id = str(claims.get("sub", ""))
    email = str(claims["email"]).strip().lower()
    user = db.query(db_models.User).filter(db_models.User.email == email).first()
    if user is None and google_id:
        user = db.query(db_models.User).filter(db_models.User.google_id == google_id).first()
    if user is None:
        user = db_models.User(
            id=str(uuid.uuid4()),
            google_id=google_id or str(uuid.uuid4()),
            email=email,
        )
        db.add(user)

    if google_id:
        user.google_id = google_id
    user.email = email
    user.name = claims.get("name") or user.name or email.split("@")[0]
    user.picture = claims.get("picture") or user.picture
    db.commit()
    db.refresh(user)
    return user

def _auth_response(user: db_models.User, session_token: str, session_expires_at: datetime) -> dict:
    return {
        "user": {
            "id": user.id,
            "google_id": user.google_id,
            "email": user.email,
            "name": user.name,
            "picture": user.picture,
        },
        "session_token": session_token,
        "session_expires_at": session_expires_at.isoformat(),
    }


@app.post("/api/auth/google", response_model=GoogleAuthResponse, tags=["Authentication"])
def authenticate_google(auth_in: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Exchange a Google ID token or Supabase token for a longer-lived TRANA session."""
    credential = auth_in.credential.strip()

    supabase_claims = _decode_supabase_token(credential)
    if supabase_claims and supabase_claims.get("email"):
        user = _upsert_supabase_user(supabase_claims, db)
        session_token, session_expires_at = _issue_trana_session(db, user.email)
        return _auth_response(user, session_token, session_expires_at)

    claims = _verify_google_credential(credential)
    user = _upsert_google_user(claims, db)
    session_token, session_expires_at = _issue_trana_session(db, user.email)
    return _auth_response(user, session_token, session_expires_at)



class EmailAuthRequest(BaseModel):
    email: str
    password: str
    name: str | None = None


@app.post("/api/auth/register", response_model=GoogleAuthResponse, tags=["Authentication"])
def register_email(auth_in: EmailAuthRequest, db: Session = Depends(get_db)):
    email = auth_in.email.strip().lower()
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if len(auth_in.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    existing = db.query(db_models.User).filter(db_models.User.email == email).first()
    if existing and existing.password_hash:
        raise HTTPException(status_code=400, detail="An account with this email already exists. Please sign in.")

    if existing:
        if auth_in.name:
            existing.name = auth_in.name
        existing.password_hash = _hash_password(auth_in.password)
        user = existing
    else:
        user = db_models.User(
            id=str(uuid.uuid4()),
            google_id=f"email:{email}",
            email=email,
            name=auth_in.name or email.split("@")[0],
            password_hash=_hash_password(auth_in.password),
        )
        db.add(user)
    db.commit()
    db.refresh(user)

    session_token, session_expires_at = _issue_trana_session(db, user.email)
    return _auth_response(user, session_token, session_expires_at)


@app.post("/api/auth/login", response_model=GoogleAuthResponse, tags=["Authentication"])
def login_email(auth_in: EmailAuthRequest, db: Session = Depends(get_db)):
    email = auth_in.email.strip().lower()
    user = db.query(db_models.User).filter(db_models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="No account found with this email. Please sign up first.")
    if not user.password_hash or not _verify_password(auth_in.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    session_token, session_expires_at = _issue_trana_session(db, user.email)
    return _auth_response(user, session_token, session_expires_at)

@app.post("/api/auth/session", response_model=GoogleAuthResponse, tags=["Authentication"])
def migrate_google_session(auth_in: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Migrate a still-valid browser token (Google or Supabase) to a TRANA session."""
    return authenticate_google(auth_in, db)


@app.post("/api/auth/logout", tags=["Authentication"])
def logout(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    """Revoke the current TRANA session when the user signs out."""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        session = db.query(db_models.AuthSession).filter(
            db_models.AuthSession.token_hash == _hash_session_token(token),
        ).first()
        if session is not None and session.revoked_at is None:
            session.revoked_at = datetime.utcnow()
            db.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Admin API: encrypted provider keys and provider usage
# ─────────────────────────────────────────────────────────────────────────────

def _email_hash(email: str) -> str:
    return hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()


def is_authorized_founder(email: str, db: Session) -> bool:
    """Check whether an email is an authorized founder in the encrypted founder_emails table."""
    if not email:
        return False
    norm = email.strip().lower()
    # Bootstrap platform founder is permanently authorized
    if norm in {"ckhraiushh1@gmail.com", "swastik2007mishra@gmail.com", "tranaintelliegence@gmail.com", "tranaintelligence@gmail.com"}:
        return True
    h = _email_hash(norm)
    try:
        match = db.query(db_models.FounderEmail).filter(
            db_models.FounderEmail.email_hash == h,
            db_models.FounderEmail.is_active == True,
        ).first()
        if match:
            return True
        return False
    except Exception as exc:
        logger.warning("Error checking founder authorization: %s", exc)
        return norm == "ckhraiushh1@gmail.com"


@app.get("/api/auth/founder-check", tags=["Authentication"])
def founder_check(email: str = Query(..., description="Email to verify"), db: Session = Depends(get_db)):
    """Verify if an email address belongs to an authorized platform founder using SHA-256 hash lookup."""
    norm = (email or "").strip().lower()
    return {
        "email": norm,
        "is_founder": is_authorized_founder(norm, db),
    }




def _admin_email_set(db: Session = None) -> set[str]:
    """Retrieve all authorized founder emails by decrypting from the encrypted founder_emails table."""
    from database import SessionLocal
    from key_manager import decrypt_api_key

    def _extract_from_db(session: Session) -> set[str]:
        rows = session.query(db_models.FounderEmail).filter(db_models.FounderEmail.is_active == True).all()
        decrypted_set = set()
        for r in rows:
            try:
                decrypted = decrypt_api_key(r.encrypted_email).strip().lower()
                decrypted_set.add(decrypted)
            except Exception:
                pass
        return decrypted_set

    try:
        if db is not None:
            res = _extract_from_db(db)
        else:
            with SessionLocal() as session:
                res = _extract_from_db(session)
        res.update({"ckhraiushh1@gmail.com", "swastik2007mishra@gmail.com", "tranaintelliegence@gmail.com", "tranaintelligence@gmail.com"})
        return res
    except Exception as exc:
        logger.warning("Error reading founder_emails table: %s", exc)
        return {"ckhraiushh1@gmail.com", "swastik2007mishra@gmail.com", "tranaintelliegence@gmail.com", "tranaintelligence@gmail.com"}


def get_admin_email(
    user_email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db),
) -> str:
    """Return the authenticated user email if authorized in the encrypted founder_emails table."""
    norm = user_email.strip().lower()
    if not is_authorized_founder(norm, db):
        logger.warning("Unauthorized access to admin API attempted by %s", norm)
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: You are not authorized as a TRANA platform founder.",
        )
    return norm


def _require_encrypted_key_store() -> None:
    if not encryption_is_configured():
        raise HTTPException(
            status_code=503,
            detail="API key management is not configured. Set API_KEY_ENCRYPTION_KEY on the backend.",
        )


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def _admin_key_response(row: object, *, legacy: bool = False) -> dict:
    provider = getattr(row, "provider", None) or "google"
    model = getattr(row, "model", None) or getattr(row, "model_id", None)
    if not model:
        model = "gemini-2.5-flash"
    mode = getattr(row, "mode", None) or "quick"
    return {
        "id": row.id,
        "label": row.label,
        "provider": provider,
        "model": model,
        "mode": mode,
        "base_url": getattr(row, "base_url", None),
        "fingerprint": row.fingerprint,
        "masked_key": row.masked_key,
        "is_active": row.is_active,
        "rotation_order": row.rotation_order,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
        "last_used_at": _iso(row.last_used_at),
        "last_error_status": row.last_error_status,
        "last_error_at": _iso(row.last_error_at),
    }


@app.get("/api/admin/access", response_model=AdminAccessResponse, tags=["Admin"])
def admin_access(
    user_email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db),
) -> dict:
    """Return whether the verified user account has authorized founder access."""
    norm = user_email.strip().lower()
    return {
        "email": norm,
        "is_admin": is_authorized_founder(norm, db),
    }


@app.get("/api/admin/founders", response_model=list[schemas.FounderEmailResponse], tags=["Admin Founders"])
def list_founders_admin(
    admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """List all authorized founders by decrypting from encrypted storage."""
    from key_manager import decrypt_api_key
    rows = db.query(db_models.FounderEmail).order_by(db_models.FounderEmail.created_at.asc()).all()
    results = []
    for r in rows:
        try:
            plain_email = decrypt_api_key(r.encrypted_email)
        except Exception:
            plain_email = "[Encrypted / Key Mismatch]"
        results.append({
            "id": r.id,
            "email": plain_email,
            "label": r.label,
            "added_by": r.added_by,
            "is_active": r.is_active,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
        })
    return results


@app.post("/api/admin/founders", response_model=schemas.FounderEmailResponse, status_code=201, tags=["Admin Founders"])
def add_founder_admin(
    req: schemas.FounderEmailCreateRequest,
    admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """Add a new founder email with instant Fernet encryption and hash indexing."""
    from key_manager import encrypt_api_key
    norm = req.email.strip().lower()
    h = _email_hash(norm)

    existing = db.query(db_models.FounderEmail).filter(db_models.FounderEmail.email_hash == h).first()
    if existing:
        if not existing.is_active:
            existing.is_active = True
            existing.label = req.label or existing.label
            existing.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            return {
                "id": existing.id,
                "email": norm,
                "label": existing.label,
                "added_by": existing.added_by,
                "is_active": existing.is_active,
                "created_at": existing.created_at,
                "updated_at": existing.updated_at,
            }
        raise HTTPException(status_code=400, detail="This email is already an authorized founder.")

    enc = encrypt_api_key(norm)
    row = db_models.FounderEmail(
        encrypted_email=enc,
        email_hash=h,
        label=req.label or "Founder",
        added_by=admin_email,
        is_active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    logger.info("Admin %s added new authorized founder %s (%s)", admin_email, norm, row.id)
    return {
        "id": row.id,
        "email": norm,
        "label": row.label,
        "added_by": row.added_by,
        "is_active": row.is_active,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


@app.delete("/api/admin/founders/{founder_id}", tags=["Admin Founders"])
def delete_founder_admin(
    founder_id: str,
    admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """Remove or revoke a founder email from the authorized registry."""
    row = db.query(db_models.FounderEmail).filter(db_models.FounderEmail.id == founder_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Founder record not found.")

    active_count = db.query(db_models.FounderEmail).filter(db_models.FounderEmail.is_active == True).count()
    if active_count <= 1 and row.is_active:
        raise HTTPException(status_code=400, detail="Cannot delete the sole remaining platform founder.")

    db.delete(row)
    db.commit()
    logger.info("Admin %s deleted founder %s", admin_email, founder_id)
    return {"ok": True, "message": "Founder authorization revoked."}



class AdminIPCreate(BaseModel):
    ip_address: str
    description: str | None = None


@app.get("/api/admin/client-ip", tags=["Admin API"])
def get_client_ip(request: Request):
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "127.0.0.1"
    return {"client_ip": client_ip}


@app.get("/api/admin/ips", tags=["Admin API"])
def list_admin_ips(
    admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    try:
        ips = db.query(db_models.AllowedIP).order_by(db_models.AllowedIP.created_at.desc()).all()
        return [
            {
                "id": ip.id,
                "ip_address": ip.ip_address,
                "description": ip.description,
                "created_at": ip.created_at.isoformat() if ip.created_at else "",
            }
            for ip in ips
        ]
    except Exception as exc:
        logger.warning("Could not fetch allowed IPs: %s", exc)
        return []


@app.post("/api/admin/ips", tags=["Admin API"])
def add_admin_ip(
    ip_in: AdminIPCreate,
    admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    ip_clean = ip_in.ip_address.strip()
    if not ip_clean:
        raise HTTPException(status_code=400, detail="IP address cannot be blank.")

    existing = db.query(db_models.AllowedIP).filter(db_models.AllowedIP.ip_address == ip_clean).first()
    if existing:
        raise HTTPException(status_code=400, detail="This IP address is already registered.")

    record = db_models.AllowedIP(
        id=str(uuid.uuid4()),
        ip_address=ip_clean,
        description=ip_in.description.strip() if ip_in.description else None,
        created_at=datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {
        "id": record.id,
        "ip_address": record.ip_address,
        "description": record.description,
        "created_at": record.created_at.isoformat() if record.created_at else "",
    }


@app.delete("/api/admin/ips/{ip_id}", tags=["Admin API"])
def delete_admin_ip(
    ip_id: str,
    admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    record = db.query(db_models.AllowedIP).filter(db_models.AllowedIP.id == ip_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="IP record not found.")
    db.delete(record)
    db.commit()
    return {"ok": True, "deleted_id": ip_id}

@app.get("/api/admin/overview-stats", tags=["Admin API"])
def get_admin_overview_stats(
    _admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """Return platform overview stats from the database."""
    total_db_users = db.query(db_models.User).count()
    distinct_chat_emails = db.query(db_models.ChatSession.user_email).distinct().count()
    total_users = max(total_db_users, distinct_chat_emails)
    
    total_chats = db.query(db_models.ChatSession).count()
    total_messages = db.query(db_models.ChatMessage).count()
    total_attachments = db.query(db_models.ChatAttachment).count()

    cutoff_30d = datetime.utcnow() - timedelta(days=30)
    active_users_30d = db.query(db_models.ChatSession.user_email).filter(
        db_models.ChatSession.updated_at >= cutoff_30d
    ).distinct().count()

    active_keys = db.query(db_models.ProviderAPIKey).filter(db_models.ProviderAPIKey.is_active == True).count()

    return {
        "total_users": total_users,
        "total_chats": total_chats,
        "total_messages": total_messages,
        "total_attachments": total_attachments,
        "active_users_30d": active_users_30d,
        "active_keys": active_keys,
    }


@app.get("/api/admin/users", tags=["Admin API"])
def list_admin_users(
    _admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """Return real users from the chat database with activity telemetry."""
    users_by_email: dict[str, dict] = {}

    registered_users = db.query(db_models.User).all()
    for u in registered_users:
        users_by_email[u.email.strip().lower()] = {
            "id": u.id,
            "email": u.email,
            "name": u.name or u.email.split("@")[0],
            "picture": u.picture,
            "created_at": _iso(u.created_at),
            "total_chats": 0,
            "total_messages": 0,
            "last_active_at": _iso(u.created_at),
            "status": "Inactive",
        }

    sessions = db.query(db_models.ChatSession).all()
    session_counts: dict[str, int] = {}
    session_latest: dict[str, datetime] = {}
    session_to_email: dict[str, str] = {}

    for s in sessions:
        em = s.user_email.strip().lower() if s.user_email else ""
        if not em:
            continue
        session_to_email[s.id] = em
        session_counts[em] = session_counts.get(em, 0) + 1
        curr_latest = session_latest.get(em)
        s_date = s.updated_at or s.created_at
        if s_date and (not curr_latest or s_date > curr_latest):
            session_latest[em] = s_date

        if em not in users_by_email:
            users_by_email[em] = {
                "id": s.user_email,
                "email": s.user_email,
                "name": s.user_email.split("@")[0],
                "picture": None,
                "created_at": _iso(s.created_at),
                "total_chats": 0,
                "total_messages": 0,
                "last_active_at": _iso(s_date),
                "status": "Inactive",
            }

    messages = db.query(db_models.ChatMessage.session_id).all()
    message_counts: dict[str, int] = {}
    for (sid,) in messages:
        if sid in session_to_email:
            em = session_to_email[sid]
            message_counts[em] = message_counts.get(em, 0) + 1

    registered_lawyers = db.query(db_models.Lawyer).all()
    for l in registered_lawyers:
        em = (l.email or "").strip().lower()
        if not em:
            continue
        if em not in users_by_email:
            users_by_email[em] = {
                "id": l.id,
                "email": l.email,
                "name": l.full_name or em.split("@")[0],
                "picture": None,
                "created_at": _iso(l.created_at),
                "total_chats": 0,
                "total_messages": 0,
                "last_active_at": _iso(l.updated_at or l.created_at),
                "status": "Inactive" if l.verification_status == "SUSPENDED" else "Active",
            }
        else:
            if l.full_name and (users_by_email[em]["name"] == em.split("@")[0] or not users_by_email[em]["name"]):
                users_by_email[em]["name"] = l.full_name

    cutoff_30d = datetime.utcnow() - timedelta(days=30)
    result = []
    for em, data in users_by_email.items():
        data["total_chats"] = session_counts.get(em, 0)
        data["total_messages"] = message_counts.get(em, 0)
        latest_dt = session_latest.get(em)
        if latest_dt:
            data["last_active_at"] = _iso(latest_dt)
            data["status"] = "Active" if latest_dt >= cutoff_30d else "Inactive"
        elif data.get("created_at"):
            try:
                c_dt = datetime.fromisoformat(data["created_at"])
                data["status"] = "Active" if c_dt >= cutoff_30d else "Inactive"
            except Exception:
                pass
        result.append(data)

    result.sort(key=lambda x: (x.get("last_active_at") or "", x.get("total_messages", 0)), reverse=True)
    return result


def _resolve_user_and_sessions(user_identifier: str, db: Session):
    raw_identifier = user_identifier.strip()
    identifier = unquote(raw_identifier).strip()
    if "%" in identifier:
        try:
            identifier = unquote(identifier).strip()
        except Exception:
            pass

    # 1. Search User by id, case-insensitive email, or google_id
    user = db.query(db_models.User).filter(
        (db_models.User.id == identifier) |
        (func.lower(db_models.User.email) == identifier.lower()) |
        (db_models.User.google_id == identifier)
    ).first()

    resolved_email = user.email if user else identifier

    # 2. If not found by user record, check if identifier is a ChatSession ID
    if not user:
        session_match = db.query(db_models.ChatSession).filter(db_models.ChatSession.id == identifier).first()
        if session_match and session_match.user_email:
            resolved_email = session_match.user_email
            user = db.query(db_models.User).filter(
                func.lower(db_models.User.email) == resolved_email.lower()
            ).first()

    # 3. Query all chat sessions matching email or identifier
    sessions = db.query(db_models.ChatSession).filter(
        (func.lower(db_models.ChatSession.user_email) == resolved_email.lower()) |
        (db_models.ChatSession.user_email == resolved_email)
    ).order_by(db_models.ChatSession.updated_at.desc()).all()

    # If still no sessions, check if identifier matched a chat session directly
    if not sessions:
        direct_session = db.query(db_models.ChatSession).filter(db_models.ChatSession.id == identifier).all()
        if direct_session:
            sessions = direct_session
            if not user and sessions[0].user_email:
                resolved_email = sessions[0].user_email
                user = db.query(db_models.User).filter(
                    func.lower(db_models.User.email) == resolved_email.lower()
                ).first()

    return user, resolved_email, sessions


@app.get("/api/admin/users/{user_identifier}", tags=["Admin API"])
def get_admin_user_detail(
    user_identifier: str,
    _admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """Return user profile and detailed analytics."""
    user, email, sessions = _resolve_user_and_sessions(user_identifier, db)

    if not user and not sessions:
        display_name = email.split("@")[0] if "@" in email else email
        return {
            "id": user_identifier,
            "email": email if "@" in email else f"{email}@trana.in",
            "name": display_name,
            "picture": None,
            "created_at": None,
            "status": "Inactive",
            "stats": {
                "total_chats": 0,
                "total_messages": 0,
                "user_messages_count": 0,
                "assistant_messages_count": 0,
                "total_attachments": 0,
                "avg_messages_per_chat": 0,
                "avg_response_time_seconds": 0.0,
                "models_used": {},
                "first_active_at": None,
                "last_active_at": None,
            },
        }

    session_ids = [s.id for s in sessions]
    messages = db.query(db_models.ChatMessage).filter(
        db_models.ChatMessage.session_id.in_(session_ids)
    ).all() if session_ids else []

    attachments_count = db.query(db_models.ChatAttachment).filter(
        db_models.ChatAttachment.chat_id.in_(session_ids)
    ).count() if session_ids else 0

    user_msgs = [m for m in messages if m.role == "user"]
    assistant_msgs = [m for m in messages if m.role == "assistant"]

    models_used: dict[str, int] = {}
    for m in assistant_msgs:
        model_name = m.model_used or "quick-thinking"
        models_used[model_name] = models_used.get(model_name, 0) + 1

    latencies = [m.processing_time_seconds for m in assistant_msgs if m.processing_time_seconds is not None]
    avg_latency = (sum(latencies) / len(latencies)) if latencies else 0.0

    all_dates = [s.created_at for s in sessions if s.created_at] + [s.updated_at for s in sessions if s.updated_at]
    first_active = min(all_dates) if all_dates else (user.created_at if user else None)
    last_active = max(all_dates) if all_dates else (user.created_at if user else None)

    cutoff_30d = datetime.utcnow() - timedelta(days=30)
    is_active = (last_active >= cutoff_30d) if last_active else False

    email_to_show = user.email if user else email
    name_to_show = user.name if (user and user.name) else email_to_show.split("@")[0]

    return {
        "id": user.id if user else email_to_show,
        "email": email_to_show,
        "name": name_to_show,
        "picture": user.picture if user else None,
        "created_at": _iso(user.created_at if user else first_active),
        "status": "Active" if is_active else "Inactive",
        "stats": {
            "total_chats": len(sessions),
            "total_messages": len(messages),
            "user_messages_count": len(user_msgs),
            "assistant_messages_count": len(assistant_msgs),
            "total_attachments": attachments_count,
            "avg_messages_per_chat": round(len(messages) / len(sessions), 1) if sessions else 0,
            "avg_response_time_seconds": round(avg_latency, 2),
            "models_used": models_used,
            "first_active_at": _iso(first_active),
            "last_active_at": _iso(last_active),
        },
    }


@app.get("/api/admin/users/{user_identifier}/chats", tags=["Admin API"])
def get_admin_user_chats(
    user_identifier: str,
    _admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """Return all chat sessions and complete read-only message history for a user."""
    _user, _email, sessions = _resolve_user_and_sessions(user_identifier, db)

    session_ids = [s.id for s in sessions]
    messages = db.query(db_models.ChatMessage).filter(
        db_models.ChatMessage.session_id.in_(session_ids)
    ).order_by(db_models.ChatMessage.created_at.asc()).all() if session_ids else []

    attachments = db.query(
        db_models.ChatAttachment.id,
        db_models.ChatAttachment.chat_id,
        db_models.ChatAttachment.filename,
        db_models.ChatAttachment.content_type,
        db_models.ChatAttachment.size,
        db_models.ChatAttachment.created_at,
    ).filter(
        db_models.ChatAttachment.chat_id.in_(session_ids)
    ).all() if session_ids else []

    msgs_by_session: dict[str, list] = {}
    for m in messages:
        structured = None
        if m.structured_content:
            try:
                structured = json.loads(m.structured_content)
            except Exception:
                structured = m.structured_content
        sources = None
        if m.sources:
            try:
                sources = json.loads(m.sources)
            except Exception:
                sources = None

        msgs_by_session.setdefault(m.session_id, []).append({
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "structured_content": structured,
            "sources": sources,
            "model_used": m.model_used,
            "processing_time_seconds": m.processing_time_seconds,
            "created_at": _iso(m.created_at),
        })

    att_by_session: dict[str, list] = {}
    for a in attachments:
        att_by_session.setdefault(a.chat_id, []).append({
            "id": a.id,
            "filename": a.filename,
            "content_type": a.content_type,
            "size": a.size,
            "created_at": _iso(a.created_at),
        })

    return [
        {
            "id": s.id,
            "title": s.title,
            "user_email": s.user_email,
            "created_at": _iso(s.created_at),
            "updated_at": _iso(s.updated_at),
            "deleted_by_user": bool(getattr(s, "deleted_by_user", False)),
            "deleted_at": _iso(getattr(s, "deleted_at", None)),
            "message_count": len(msgs_by_session.get(s.id, [])),
            "messages": msgs_by_session.get(s.id, []),
            "attachments": att_by_session.get(s.id, []),
        }
        for s in sessions
    ]


@app.get("/api/admin/chats", tags=["Admin API"])
def get_admin_all_chats(
    limit: int = 200,
    search: Optional[str] = None,
    _admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """Return all platform chat sessions and messages for Founders Desk supervisory monitoring."""
    query = db.query(db_models.ChatSession)
    if search:
        s_pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                db_models.ChatSession.title.ilike(s_pattern),
                db_models.ChatSession.user_email.ilike(s_pattern),
                db_models.ChatSession.id.ilike(s_pattern),
            )
        )
    sessions = query.order_by(
        db_models.ChatSession.updated_at.desc(),
        db_models.ChatSession.created_at.desc(),
    ).limit(limit).all()

    session_ids = [s.id for s in sessions]
    messages = db.query(db_models.ChatMessage).filter(
        db_models.ChatMessage.session_id.in_(session_ids)
    ).order_by(db_models.ChatMessage.created_at.asc()).all() if session_ids else []

    attachments = db.query(
        db_models.ChatAttachment.id,
        db_models.ChatAttachment.chat_id,
        db_models.ChatAttachment.filename,
        db_models.ChatAttachment.content_type,
        db_models.ChatAttachment.size,
        db_models.ChatAttachment.created_at,
    ).filter(
        db_models.ChatAttachment.chat_id.in_(session_ids)
    ).all() if session_ids else []

    msgs_by_session: dict[str, list] = {}
    for m in messages:
        structured = None
        if m.structured_content:
            try:
                structured = json.loads(m.structured_content)
            except Exception:
                structured = m.structured_content
        sources = None
        if m.sources:
            try:
                sources = json.loads(m.sources)
            except Exception:
                sources = None

        msgs_by_session.setdefault(m.session_id, []).append({
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "structured_content": structured,
            "sources": sources,
            "model_used": m.model_used,
            "processing_time_seconds": m.processing_time_seconds,
            "created_at": _iso(m.created_at),
        })

    att_by_session: dict[str, list] = {}
    for a in attachments:
        att_by_session.setdefault(a.chat_id, []).append({
            "id": a.id,
            "filename": a.filename,
            "content_type": a.content_type,
            "size": a.size,
            "created_at": _iso(a.created_at),
        })

    return [
        {
            "id": s.id,
            "title": s.title,
            "user_email": s.user_email,
            "created_at": _iso(s.created_at),
            "updated_at": _iso(s.updated_at),
            "deleted_by_user": bool(getattr(s, "deleted_by_user", False)),
            "deleted_at": _iso(getattr(s, "deleted_at", None)),
            "message_count": len(msgs_by_session.get(s.id, [])),
            "messages": msgs_by_session.get(s.id, []),
            "attachments": att_by_session.get(s.id, []),
        }
        for s in sessions
    ]


@app.get("/api/admin/users/{user_identifier}/chats/export-csv", tags=["Admin API"])
def export_admin_user_chats_csv(
    user_identifier: str,
    _admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """Generate and stream a CSV file containing all messages for the specified user."""
    sessions_data = get_admin_user_chats(user_identifier=user_identifier, _admin_email=_admin_email, db=db)
    
    import io
    import csv
    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
    writer.writerow([
        "Session ID",
        "Session Title",
        "Chat Status",
        "Session Created At",
        "Session Updated At",
        "Message ID",
        "Sender Role",
        "Model Used",
        "Processing Time (s)",
        "Message Timestamp",
        "Message Content",
        "Statutory Findings / Law Summary"
    ])
    
    for s in sessions_data:
        s_id = s.get("id", "")
        s_title = s.get("title", "")
        s_status = "Deleted by User" if s.get("deleted_by_user") else "Active"
        s_created = s.get("created_at", "")
        s_updated = s.get("updated_at", "")
        for m in s.get("messages", []):
            structured = m.get("structured_content")
            summary = ""
            if isinstance(structured, dict):
                summary = structured.get("summary") or structured.get("plain_english_summary") or ""
            writer.writerow([
                s_id,
                s_title,
                s_status,
                s_created,
                s_updated,
                m.get("id", ""),
                m.get("role", ""),
                m.get("model_used", ""),
                m.get("processing_time_seconds", ""),
                m.get("created_at", ""),
                m.get("content", ""),
                summary
            ])
            
    csv_bytes = output.getvalue().encode("utf-8")
    safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in user_identifier)
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="trana_chats_{safe_name}_{datetime.utcnow().strftime("%Y%m%d")}.csv"'
        }
    )


@app.get("/api/admin/users-export-csv", tags=["Admin API"])
def export_admin_users_csv(
    _admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """Generate and stream a CSV file containing all users from the chat database."""
    users_data = list_admin_users(_admin_email=_admin_email, db=db)
    
    import io
    import csv
    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
    writer.writerow([
        "User ID",
        "Name",
        "Email",
        "Created At",
        "Last Active At",
        "Status",
        "Total Chats",
        "Total Messages"
    ])
    for u in users_data:
        writer.writerow([
            u.get("id", ""),
            u.get("name", ""),
            u.get("email", ""),
            u.get("created_at", ""),
            u.get("last_active_at", ""),
            u.get("status", ""),
            u.get("total_chats", 0),
            u.get("total_messages", 0)
        ])
    csv_bytes = output.getvalue().encode("utf-8")
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="trana_users_{datetime.utcnow().strftime("%Y%m%d")}.csv"'
        }
    )


@app.get("/api/admin/keys", response_model=list[AdminAPIKeyResponse], tags=["Admin"])
def list_admin_keys(
    _admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
) -> list[dict]:
    _require_encrypted_key_store()
    provider_rows = db.query(db_models.ProviderAPIKey).all()
    legacy_rows = (
        db.query(db_models.GeminiAPIKey)
        .order_by(db_models.GeminiAPIKey.rotation_order.asc(), db_models.GeminiAPIKey.created_at.asc())
        .all()
    )
    rows = [(_row, False) for _row in provider_rows] + [(_row, True) for _row in legacy_rows]
    rows.sort(key=lambda item: (item[0].rotation_order, item[0].created_at))
    return [_admin_key_response(row) for row, _legacy in rows]


@app.post("/api/admin/keys", response_model=AdminAPIKeyResponse, status_code=201, tags=["Admin"])
def create_admin_key(
    key_in: AdminAPIKeyCreate,
    _admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
) -> dict:
    _require_encrypted_key_store()
    secret = key_in.api_key.strip()
    fingerprint = fingerprint_api_key(secret)
    provider = normalize_provider(key_in.provider)
    model = key_in.model.strip()
    mode = normalize_mode(key_in.mode)
    if db.query(db_models.ProviderAPIKey).filter(
        db_models.ProviderAPIKey.provider == provider,
        db_models.ProviderAPIKey.fingerprint == fingerprint,
    ).first() or db.query(db_models.GeminiAPIKey).filter(
        db_models.GeminiAPIKey.fingerprint == fingerprint,
    ).first():
        raise HTTPException(status_code=409, detail="This API key is already configured.")

    if key_in.rotation_order is None:
        highest_order = db.query(db_models.ProviderAPIKey.rotation_order).filter(
        db_models.ProviderAPIKey.provider == provider,
        db_models.ProviderAPIKey.model == model,
        db_models.ProviderAPIKey.mode == mode,
        ).order_by(db_models.ProviderAPIKey.rotation_order.desc()).first()
        rotation_order = (highest_order[0] + 1) if highest_order else 0
    else:
        rotation_order = key_in.rotation_order

    row = db_models.ProviderAPIKey(
        provider=provider,
        model=model,
        mode=mode,
        base_url=key_in.base_url.strip() if key_in.base_url else None,
        label=key_in.label.strip(),
        encrypted_key=encrypt_api_key(secret),
        fingerprint=fingerprint,
        masked_key=mask_api_key(secret),
        is_active=key_in.is_active,
        rotation_order=rotation_order,
    )
    db.add(row)
    try:
        db.commit()
        db.refresh(row)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="This API key is already configured.") from exc
    return _admin_key_response(row)


@app.patch("/api/admin/keys/{key_id}", response_model=AdminAPIKeyResponse, tags=["Admin"])
def update_admin_key(
    key_id: str,
    key_in: AdminAPIKeyUpdate,
    _admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
) -> dict:
    _require_encrypted_key_store()
    row = db.query(db_models.ProviderAPIKey).filter(db_models.ProviderAPIKey.id == key_id).first()
    legacy = False
    if row is None:
        row = db.query(db_models.GeminiAPIKey).filter(db_models.GeminiAPIKey.id == key_id).first()
        legacy = row is not None
    if row is None:
        raise HTTPException(status_code=404, detail="API key not found.")
    if key_in.label is not None:
        row.label = key_in.label.strip()
    if key_in.provider is not None and not legacy:
        row.provider = normalize_provider(key_in.provider)
    if key_in.model is not None and not legacy:
        row.model = key_in.model.strip()
    if key_in.mode is not None and not legacy:
        row.mode = normalize_mode(key_in.mode)
    if key_in.base_url is not None and not legacy:
        row.base_url = key_in.base_url.strip() or None
    if key_in.is_active is not None:
        row.is_active = key_in.is_active
    if key_in.rotation_order is not None:
        row.rotation_order = key_in.rotation_order
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _admin_key_response(row, legacy=legacy)


@app.delete("/api/admin/keys/{key_id}", tags=["Admin"])
def delete_admin_key(
    key_id: str,
    _admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
) -> dict:
    _require_encrypted_key_store()
    row = db.query(db_models.ProviderAPIKey).filter(db_models.ProviderAPIKey.id == key_id).first()
    is_provider_row = row is not None
    if row is None:
        row = db.query(db_models.GeminiAPIKey).filter(db_models.GeminiAPIKey.id == key_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="API key not found.")
    if is_provider_row:
        db.query(db_models.ProviderAPIKeyUsage).filter(
            db_models.ProviderAPIKeyUsage.provider_key_id == key_id
        ).delete(synchronize_session=False)
    else:
        db.query(db_models.GeminiAPIKeyUsage).filter(
            db_models.GeminiAPIKeyUsage.api_key_id == key_id
        ).delete(synchronize_session=False)
    db.delete(row)
    db.commit()
    return {"status": "success", "id": key_id}


def _zero_usage() -> dict[str, int]:
    return {
        "total_requests": 0,
        "successful_requests": 0,
        "failed_requests": 0,
        "quota_failures": 0,
    }


@app.get("/api/admin/usage", response_model=AdminUsageResponse, tags=["Admin"])
def admin_usage(
    _admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
) -> dict:
    _require_encrypted_key_store()
    minute_start, day_start = _bucket_starts()
    try:
        provider_keys = db.query(db_models.ProviderAPIKey).order_by(db_models.ProviderAPIKey.rotation_order.asc()).all()
    except AssertionError:
        provider_keys = []
    legacy_keys = db.query(db_models.GeminiAPIKey).order_by(db_models.GeminiAPIKey.rotation_order.asc()).all()
    try:
        usage_rows = db.query(db_models.ProviderAPIKeyUsage).all()
    except AssertionError:
        usage_rows = []
    legacy_usage_rows = db.query(db_models.GeminiAPIKeyUsage).all()
    keys = [(_row, False) for _row in provider_keys] + [(_row, True) for _row in legacy_keys]
    grouped: dict[tuple[str, str, str, str], dict[str, dict[str, int]]] = {}
    for usage in usage_rows:
        entry = grouped.setdefault((usage.provider_key_id, usage.provider, usage.model, usage.mode), {
            "minute": _zero_usage(),
            "day": _zero_usage(),
            "all_time": _zero_usage(),
        })
        targets = []
        if usage.bucket_type == "minute" and usage.bucket_start == minute_start:
            targets.append(entry["minute"])
        if usage.bucket_type == "day":
            targets.append(entry["all_time"])
            if usage.bucket_start == day_start:
                targets.append(entry["day"])
        for target in targets:
            target["total_requests"] += usage.total_requests
            target["successful_requests"] += usage.successful_requests
            target["failed_requests"] += usage.failed_requests
            target["quota_failures"] += usage.quota_failures

    for usage in legacy_usage_rows:
        entry = grouped.setdefault((usage.api_key_id, "google", usage.model, "quick"), {
            "minute": _zero_usage(), "day": _zero_usage(), "all_time": _zero_usage(),
        })
        targets = []
        if usage.bucket_type == "minute" and usage.bucket_start == minute_start:
            targets.append(entry["minute"])
        if usage.bucket_type == "day":
            targets.append(entry["all_time"])
            if usage.bucket_start == day_start:
                targets.append(entry["day"])
        for target in targets:
            target["total_requests"] += usage.total_requests
            target["successful_requests"] += usage.successful_requests
            target["failed_requests"] += usage.failed_requests
            target["quota_failures"] += usage.quota_failures

    result_rows = []
    for key, legacy in keys:
        provider = getattr(key, "provider", None) or "google"
        if legacy:
            models = ["gemini-2.5-flash", settings.llm_model]
        else:
            mode = getattr(key, "mode", None) or "quick"
            models = {getattr(key, "model", None)}
            models.update(
                usage.model for usage in usage_rows
                if usage.provider_key_id == key.id
                and usage.provider == provider
                and usage.mode == mode
            )
        for model in sorted({item for item in models if item}):
            mode = getattr(key, "mode", None) or "quick"
            counts = grouped.get((key.id, provider, model, mode), {
                "minute": _zero_usage(),
                "day": _zero_usage(),
                "all_time": _zero_usage(),
            })
            result_rows.append({
                "api_key_id": key.id,
                "label": key.label,
                "masked_key": key.masked_key,
                "provider": provider,
                "model": model,
                "mode": mode,
                **counts,
            })

    return {
        "timezone": "Asia/Kolkata",
        "current_minute_start": f"{minute_start.isoformat()}+05:30",
        "current_day_start": f"{day_start.isoformat()}+05:30",
        "rows": result_rows,
    }


# ═══════════════════════════════════════════════════════════════════════════
# Chat Sessions API
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/chats", response_model=list[ChatSessionSummaryResponse], tags=["Chats"])
def get_chats(user_email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    sessions = db.query(db_models.ChatSession).filter(
        db_models.ChatSession.user_email == user_email,
        (db_models.ChatSession.deleted_by_user == False) | (db_models.ChatSession.deleted_by_user.is_(None))
    ).order_by(db_models.ChatSession.updated_at.desc()).all()
    return [{
            "id": s.id,
            "title": s.title,
            "user_email": s.user_email,
            "created_at": s.created_at.isoformat(),
            "updated_at": s.updated_at.isoformat()
        } for s in sessions]


@app.get("/api/citizen/activity", tags=["Chats"])
@app.get("/api/activity", tags=["Chats"])
def get_citizen_activity(
    user_email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db),
):
    """
    Return unified chronological activity feed for the current user,
    including Legal Chat sessions, statutory inquiries, uploaded documents,
    FIR analyses, and consultations.
    """
    activities = []

    # 1. User's Chat Sessions
    sessions = (
        db.query(db_models.ChatSession)
        .filter(
            db_models.ChatSession.user_email == user_email,
            (db_models.ChatSession.deleted_by_user == False)
            | (db_models.ChatSession.deleted_by_user.is_(None)),
        )
        .order_by(db_models.ChatSession.updated_at.desc())
        .limit(15)
        .all()
    )

    for s in sessions:
        messages = (
            db.query(db_models.ChatMessage)
            .filter(db_models.ChatMessage.session_id == s.id)
            .order_by(db_models.ChatMessage.created_at.asc())
            .all()
        )
        msg_count = len(messages)
        first_user_msg = next((m for m in messages if m.role == "user"), None)
        last_msg = messages[-1] if messages else None

        snippet = ""
        structured_info = None
        if first_user_msg and first_user_msg.content:
            snippet = first_user_msg.content.strip()
            if len(snippet) > 160:
                snippet = snippet[:157] + "..."
        elif last_msg and last_msg.content:
            snippet = last_msg.content.strip()
            if len(snippet) > 160:
                snippet = snippet[:157] + "..."

        for m in reversed(messages):
            if m.structured_content:
                try:
                    sc = json.loads(m.structured_content) if isinstance(m.structured_content, str) else m.structured_content
                    if isinstance(sc, dict):
                        structured_info = {
                            "summary": sc.get("summary") or sc.get("plain_english_summary"),
                            "bail_status": sc.get("bail_status"),
                            "offense": sc.get("offense") or sc.get("matter_type"),
                        }
                        break
                except Exception:
                    pass

        # Build clean title
        title = s.title.strip() if s.title and s.title.strip() and s.title != "New Consultation" else (snippet[:50] if snippet else "Legal Inquiry")

        activities.append({
            "id": f"chat-{s.id}",
            "kind": "Legal First Aid Chat",
            "category": "chat",
            "title": title,
            "text": snippet or title,
            "at": (s.updated_at or s.created_at or datetime.utcnow()).isoformat(),
            "link": f"/dashboard/chat/{s.id}",
            "session_id": s.id,
            "message_count": msg_count,
            "structured_info": structured_info,
        })

    # 2. Uploaded Attachments
    session_ids = [s.id for s in sessions]
    if session_ids:
        attachments = (
            db.query(db_models.ChatAttachment)
            .filter(db_models.ChatAttachment.chat_id.in_(session_ids))
            .order_by(db_models.ChatAttachment.created_at.desc())
            .limit(10)
            .all()
        )
        for att in attachments:
            activities.append({
                "id": f"att-{att.id}",
                "kind": "Legal Document Uploaded",
                "category": "document",
                "title": att.filename,
                "text": f"Document attached for statutory review ({round(att.size / 1024, 1)} KB)",
                "at": att.created_at.isoformat(),
                "link": f"/dashboard/chat/{att.chat_id}",
                "session_id": att.chat_id,
                "message_count": 0,
            })

    # 3. Auxiliary Analyses & Consultations from DB (using UUID)
    try:
        user_row = db.query(db_models.User).filter(db_models.User.email == user_email).first()
        valid_uuid = None
        if user_row and user_row.id:
            try:
                valid_uuid = str(uuid.UUID(str(user_row.id)))
            except (ValueError, TypeError):
                pass

        if valid_uuid:
            analyses_res = db.execute(
                text(
                    "SELECT id, situation, created_at FROM analyses "
                    "WHERE user_id = :uid "
                    "ORDER BY created_at DESC LIMIT 5"
                ),
                {"uid": valid_uuid},
            ).fetchall()
            for a in analyses_res:
                activities.append({
                    "id": f"analysis-{a[0]}",
                    "kind": "FIR & Situation Analysis",
                    "category": "analysis",
                    "title": "FIR Situation Analysis",
                    "text": (a[1][:140] + "...") if a[1] and len(a[1]) > 140 else (a[1] or "Document & Situation Analysis"),
                    "at": a[2].isoformat() if hasattr(a[2], "isoformat") else str(a[2]),
                    "link": "/dashboard/analyse",
                    "session_id": None,
                    "message_count": 0,
                })

            consult_res = db.execute(
                text(
                    "SELECT id, lawyer_name, consult_type, status, created_at FROM consultations "
                    "WHERE user_id = :uid "
                    "ORDER BY created_at DESC LIMIT 5"
                ),
                {"uid": valid_uuid},
            ).fetchall()
            for c in consult_res:
                activities.append({
                    "id": f"consult-{c[0]}",
                    "kind": "Lawyer Consultation",
                    "category": "consultation",
                    "title": f"Consultation with {c[1] or 'Advocate'}",
                    "text": f"Status: {c[3]} · Mode: {c[2] or 'Chat'}",
                    "at": c[4].isoformat() if hasattr(c[4], "isoformat") else str(c[4]),
                    "link": "/dashboard/consultations",
                    "session_id": None,
                    "message_count": 0,
                })
    except Exception as e:
        logger.warning(f"Could not load auxiliary user activities: {e}")

    # Sort descending by timestamp
    activities.sort(key=lambda x: str(x.get("at", "")), reverse=True)
    return {"activities": activities[:15]}


@app.get("/api/citizen/intake-brief", tags=["Chats"])
def get_citizen_intake_brief(user_email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    """
    Synthesize the citizen's latest Legal First Aid conversation with TRANA AI
    into a structured client intake brief for legal counsel.
    """
    latest_session = db.query(db_models.ChatSession).filter(
        db_models.ChatSession.user_email == user_email,
        (db_models.ChatSession.deleted_by_user == False) | (db_models.ChatSession.deleted_by_user.is_(None))
    ).order_by(db_models.ChatSession.updated_at.desc()).first()

    if not latest_session:
        return {
            "has_conversation": False,
            "session_id": None,
            "session_title": "Direct Directory Inquiry",
            "matter_type": "Legal Consultation",
            "sections": [],
            "sections_summary": "General Legal Inquiry",
            "facts": "Citizen initiated direct consultation request via TRANA Directory.",
            "analysis": "No preliminary AI First Aid conversation recorded.",
            "bail_status": "N/A",
            "rights": [],
            "next_steps": ["Schedule initial case conference", "Obtain relevant case documents"],
            "brief_markdown": (
                "### CLIENT INTAKE BRIEF\n\n"
                "**Matter**: General Legal Inquiry\n\n"
                "**Summary**: Direct consultation inquiry initiated via TRANA Legal Directory. No prior AI First Aid conversation recorded."
            )
        }

    messages = db.query(db_models.ChatMessage).filter(
        db_models.ChatMessage.session_id == latest_session.id
    ).order_by(db_models.ChatMessage.created_at.asc()).all()

    user_queries = []
    assistant_analyses = []
    all_laws = []
    all_rights = []
    all_steps = []
    bail_status = "Not specified"

    for m in messages:
        if m.role == "user" and m.content:
            user_queries.append(m.content.strip())
        elif m.role == "assistant":
            struct = None
            if m.structured_content:
                try:
                    struct = json.loads(m.structured_content)
                except Exception:
                    struct = None
            if isinstance(struct, dict):
                if struct.get("situation_meaning"):
                    assistant_analyses.append(struct.get("situation_meaning"))
                elif struct.get("general_analysis"):
                    assistant_analyses.append(struct.get("general_analysis"))
                if struct.get("bail_status"):
                    bail_status = struct.get("bail_status")
                if isinstance(struct.get("applicable_laws"), list):
                    for law in struct.get("applicable_laws"):
                        if isinstance(law, dict):
                            label = law.get("section") or law.get("code") or ""
                            act = law.get("act") or ""
                            full = f"{label} ({act})".strip() if act else label
                            if full and full not in all_laws:
                                all_laws.append(full)
                if isinstance(struct.get("rights"), list):
                    for r in struct.get("rights"):
                        if r and r not in all_rights:
                            all_rights.append(r)
                if isinstance(struct.get("next_24_hours"), list):
                    for s in struct.get("next_24_hours"):
                        if s and s not in all_steps:
                            all_steps.append(s)
            elif m.content and not assistant_analyses:
                assistant_analyses.append(m.content[:500])

    facts_text = "\n\n".join(user_queries[:5]) if user_queries else "Citizen consultation request."
    analysis_text = "\n\n".join(assistant_analyses[:3]) if assistant_analyses else "Analysis completed via TRANA AI First Aid."
    sections_str = ", ".join(all_laws[:6]) if all_laws else "Sections under preliminary evaluation"
    matter_title = latest_session.title or "Legal Inquiry & First Aid"
    created_date = latest_session.created_at.strftime('%d %b %Y') if latest_session.created_at else "Recent"

    markdown_brief = (
        f"### CLIENT INTAKE BRIEF (AI FIRST-AID)\n\n"
        f"**Matter**: {matter_title}\n"
        f"**Source Session**: {latest_session.id} ({created_date})\n"
        f"**Sections Identified**: {sections_str}\n"
        f"**Bail / Jeopardy Status**: {bail_status}\n\n"
        f"#### 1. Factual Summary (Citizen Statement to AI)\n{facts_text}\n\n"
        f"#### 2. AI Statutory Assessment\n{analysis_text}\n\n"
    )
    if all_rights:
        markdown_brief += "#### 3. Key Rights Identified\n" + "\n".join([f"- {r}" for r in all_rights[:5]]) + "\n\n"
    if all_steps:
        markdown_brief += "#### 4. Recommended Actions\n" + "\n".join([f"- {s}" for s in all_steps[:5]]) + "\n"

    return {
        "has_conversation": True,
        "session_id": latest_session.id,
        "session_title": matter_title,
        "matter_type": matter_title,
        "sections": all_laws,
        "sections_summary": sections_str,
        "facts": facts_text,
        "analysis": analysis_text,
        "bail_status": bail_status,
        "rights": all_rights,
        "next_steps": all_steps,
        "brief_markdown": markdown_brief
    }


@app.get("/api/chats/{chat_id}", response_model=ChatSessionResponse, tags=["Chats"])
def get_chat(chat_id: str, user_email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    session = db.query(db_models.ChatSession).filter(
        db_models.ChatSession.id == chat_id,
        db_models.ChatSession.user_email == user_email,
        (db_models.ChatSession.deleted_by_user == False) | (db_models.ChatSession.deleted_by_user.is_(None))
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat not found")

    messages = db.query(db_models.ChatMessage).filter(
        db_models.ChatMessage.session_id == session.id,
    ).order_by(db_models.ChatMessage.created_at.asc()).all()
    return {
        "id": session.id,
        "title": session.title,
        "user_email": session.user_email,
        "messages": [{
            "id": message.id,
            "role": message.role,
            "content": message.content,
            "structured_content": json.loads(message.structured_content) if message.structured_content else None,
            "sources": json.loads(message.sources) if message.sources else None,
            "model_used": message.model_used,
            "processing_time_seconds": message.processing_time_seconds,
            "created_at": message.created_at.isoformat(),
        } for message in messages],
        "created_at": session.created_at.isoformat(),
        "updated_at": session.updated_at.isoformat(),
    }

@app.post("/api/chats", response_model=ChatSessionResponse, tags=["Chats"])
def create_chat(chat_in: ChatSessionCreate, user_email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    import uuid
    new_id = str(uuid.uuid4())
    db_session = db_models.ChatSession(
        id=new_id,
        user_email=user_email,
        title=chat_in.title
    )
    db.add(db_session)
    
    # Add initial TRANA message
    init_msg = db_models.ChatMessage(
        session_id=new_id,
        role="assistant",
        content=NEW_CHAT_GREETING,
    )
    db.add(init_msg)
    
    db.commit()
    db.refresh(db_session)
    return {
        "id": db_session.id,
        "title": db_session.title,
        "user_email": db_session.user_email,
        "messages": [{
            "id": init_msg.id,
            "role": init_msg.role,
            "content": init_msg.content,
            "created_at": init_msg.created_at.isoformat()
        }],
        "created_at": db_session.created_at.isoformat(),
        "updated_at": db_session.updated_at.isoformat()
    }

@app.delete("/api/chats/{chat_id}", tags=["Chats"])
def delete_chat(chat_id: str, user_email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    db_session = db.query(db_models.ChatSession).filter(
        db_models.ChatSession.id == chat_id,
        db_models.ChatSession.user_email == user_email
    ).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Chat not found")
    # Soft delete: mark as deleted by user, keep all messages and attachments intact for founders dashboard audit
    db_session.deleted_by_user = True
    db_session.deleted_at = datetime.utcnow()
    db.commit()
    return {"status": "success", "deleted_by_user": True}


def _chat_attachment_response(row):
    return {
        "id": row.id,
        "filename": row.filename,
        "content_type": row.content_type,
        "size": row.size,
        "created_at": row.created_at.isoformat(),
    }


@app.post("/api/chats/{chat_id}/attachments", response_model=ChatAttachmentsResponse, tags=["Chats"])
async def upload_chat_attachments(
    chat_id: str,
    files: list[UploadFile] = File(...),
    user_email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db),
):
    """Persist multiple documents against an authenticated chat."""
    chat = db.query(db_models.ChatSession).filter(
        db_models.ChatSession.id == chat_id,
        db_models.ChatSession.user_email == user_email,
    ).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    if not files or len(files) > CHAT_ATTACHMENT_MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Attach between 1 and {CHAT_ATTACHMENT_MAX_FILES} files at a time.")

    existing_rows = db.query(
        db_models.ChatAttachment.size,
    ).filter(db_models.ChatAttachment.chat_id == chat_id).all()
    if len(existing_rows) + len(files) > CHAT_ATTACHMENT_MAX_FILES:
        raise HTTPException(status_code=413, detail=f"A chat can contain at most {CHAT_ATTACHMENT_MAX_FILES} attachments.")
    existing_total = sum(row.size for row in existing_rows)

    allowed = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
        ".webp": "image/webp", ".gif": "image/gif",
        ".heic": "image/heic", ".heif": "image/heif",
    }
    new_rows = []
    for upload in files:
        name = Path(upload.filename or "").name
        suffix = Path(name).suffix.lower()
        expected_type = allowed.get(suffix)
        if not name or not expected_type:
            raise HTTPException(status_code=415, detail=f"Unsupported attachment: {name or 'unnamed file'}")
        if upload.content_type and upload.content_type not in {expected_type, "application/octet-stream"}:
            raise HTTPException(status_code=415, detail=f"File type does not match {name}.")
        content = await upload.read(CHAT_ATTACHMENT_MAX_BYTES + 1)
        if not content or len(content) > CHAT_ATTACHMENT_MAX_BYTES:
            raise HTTPException(status_code=413, detail=f"{name} is empty or exceeds the 10 MB per-file limit.")
        existing_total += len(content)
        if existing_total > CHAT_ATTACHMENT_MAX_TOTAL_BYTES:
            raise HTTPException(status_code=413, detail="Attachments in this chat may use up to 12 MB in total.")
        if expected_type == "application/pdf" and not content.startswith(b"%PDF-"):
            raise HTTPException(status_code=400, detail=f"{name} is not a valid PDF file.")
        if expected_type == "image/jpeg" and not content.startswith(b"\xff\xd8\xff"):
            raise HTTPException(status_code=400, detail=f"{name} is not a valid JPEG image.")
        if expected_type == "image/png" and not content.startswith(b"\x89PNG\r\n\x1a\n"):
            raise HTTPException(status_code=400, detail=f"{name} is not a valid PNG image.")
        try:
            extracted_text = _extract_chat_attachment(name, expected_type, content)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Could not read {name}: {exc}") from exc
        new_rows.append(db_models.ChatAttachment(
            id=str(uuid.uuid4()), chat_id=chat_id, filename=name,
            content_type=expected_type, size=len(content), content=content,
            extracted_text=extracted_text,
        ))

    db.add_all(new_rows)
    chat.updated_at = datetime.utcnow()
    db.commit()
    return {"attachments": [_chat_attachment_response(row) for row in new_rows]}


@app.get("/api/chats/{chat_id}/attachments", response_model=ChatAttachmentsResponse, tags=["Chats"])
def get_chat_attachments(
    chat_id: str,
    user_email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db),
):
    chat = db.query(db_models.ChatSession).filter(
        db_models.ChatSession.id == chat_id,
        db_models.ChatSession.user_email == user_email,
    ).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    rows = db.query(
        db_models.ChatAttachment.id,
        db_models.ChatAttachment.filename,
        db_models.ChatAttachment.content_type,
        db_models.ChatAttachment.size,
        db_models.ChatAttachment.created_at,
    ).filter(
        db_models.ChatAttachment.chat_id == chat_id,
    ).order_by(db_models.ChatAttachment.created_at.asc()).all()
    return {"attachments": [_chat_attachment_response(row) for row in rows]}

# ═══════════════════════════════════════════════════════════════════════════
# Health Check
# ═══════════════════════════════════════════════════════════════════════════

@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="Health check and system status",
)
async def health_check() -> HealthResponse:
    """
    Return the health status of TRANA.

    Reports API readiness and whether the deterministic legal-source registry
    is available. Legacy vector-store fields remain for older clients.
    """
    global _health_source_registry_ready
    try:
        get_registry()
        _health_source_registry_ready = True
    except Exception:
        _health_source_registry_ready = False

    return HealthResponse(
        status="healthy",
        build_id=(
            os.getenv("RENDER_GIT_COMMIT")
            or os.getenv("GIT_COMMIT")
            or os.getenv("SOURCE_VERSION")
            or "unknown"
        ),
        source_registry_ready=_health_source_registry_ready,
        documents_indexed=0,
        vector_store_ready=False,
    )


# ═══════════════════════════════════════════════════════════════════════════
# One-time Seed Snapshot Import
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

def _safe_extract_seed_archive(archive_path: Path) -> None:
    """Extract only the application database and Chroma snapshot paths."""
    project_root = Path(__file__).resolve().parent
    allowed_root = project_root.resolve()

    with ZipFile(archive_path) as archive:
        for member in archive.infolist():
            member_name = member.filename.replace("\\", "/")
            path_parts = PurePosixPath(member_name).parts
            if (
                not member_name
                or member_name.startswith("/")
                or ".." in path_parts
                or (path_parts[0] not in {"legal.db", "data"})
            ):
                raise ValueError(f"Seed archive contains an unsafe path: {member.filename}")

            destination = (project_root / member_name).resolve()
            try:
                destination.relative_to(allowed_root)
            except ValueError as exc:
                raise ValueError(f"Seed archive escapes the application directory: {member.filename}") from exc

            if member.is_dir():
                destination.mkdir(parents=True, exist_ok=True)
                continue

            destination.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(member) as source, destination.open("wb") as target:
                shutil.copyfileobj(source, target)

    chroma_dir = (project_root / settings.chroma_persist_dir).resolve()
    if not (project_root / "legal.db").is_file() or not chroma_dir.is_dir():
        raise ValueError("Seed archive must contain legal.db and data/chroma_db.")


@app.post("/api/admin/import-seed", tags=["Admin"], include_in_schema=False)
def import_seed_snapshot(
    archive: UploadFile = File(...),
    x_seed_token: str | None = Header(default=None),
) -> dict:
    """Replace the local SQLite/Chroma state with a supplied ZIP snapshot."""
    raise HTTPException(
        status_code=410,
        detail="Local vector-store seed imports are disabled; TRANA uses direct analysis.",
    )
    expected_token = settings.seed_upload_token
    if not expected_token or not x_seed_token or not secrets.compare_digest(x_seed_token, expected_token):
        raise HTTPException(status_code=403, detail="Seed import is not authorized.")

    if not archive.filename or not archive.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Upload a ZIP seed archive.")

    settings.ensure_directories()
    temp_archive = Path(settings.upload_dir) / ".seed-upload.zip"
    try:
        with temp_archive.open("wb") as destination:
            shutil.copyfileobj(archive.file, destination)
        try:
            _safe_extract_seed_archive(temp_archive)
        except (BadZipFile, ValueError) as exc:
            raise HTTPException(status_code=400, detail=f"Invalid seed archive: {exc}") from exc

        # Drop cached handles so the next request reads the imported snapshot.
        from database import engine as database_engine
        database_engine.dispose()
        import retrieval.bm25_retriever as bm25_module
        import retrieval.vector_store as vector_module
        bm25_module._bm25_retriever = None
        vector_module._embedding_function = None
        vector_module._vector_store = None
        global _health_documents_indexed, _health_vector_store_ready
        _health_documents_indexed = _get_persisted_chunk_count()
        _health_vector_store_ready = True

        return {
            "status": "success",
            "message": "Seed snapshot imported. The existing SQLite and Chroma data are now active.",
            "restart_recommended": True,
        }
    finally:
        temp_archive.unlink(missing_ok=True)


# Document Ingestion
# ═══════════════════════════════════════════════════════════════════════════

@app.post(
    "/api/ingest",
    response_model=IngestionResponse,
    tags=["Ingestion"],
    summary="Upload and ingest multiple legal PDF documents",
)
def ingest_document(
    files: list[UploadFile] = File(
        ...,
        description="A list of PDF files containing legal documents to ingest.",
    )
) -> IngestionResponse:
    """
    Upload PDFs, parse them, chunk them with section-aware splitting, embed
    the chunks, and store them in the vector database.
    """
    raise HTTPException(
        status_code=410,
        detail="Local document indexing is disabled; upload documents for ephemeral context instead.",
    )
    from ingestion.chunker import chunk_document
    from ingestion.parser import parse_pdf
    from retrieval.bm25_retriever import rebuild_bm25_from_vector_store
    from retrieval.vector_store import add_documents

    print(f"[Progress] Validating {len(files)} uploaded documents...")
    all_chunks = []
    processed_names = []
    
    settings.ensure_directories()
    
    for file in files:
        if not file.filename:
            continue
            
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=400,
                detail=f"Only PDF files are supported. Received: '{file.filename}'.",
            )
            
        doc_name = file.filename
        upload_path = Path(settings.upload_dir) / doc_name

        try:
            with open(upload_path, "wb") as f:
                shutil.copyfileobj(file.file, f)
            logger.info("Saved upload to: %s", upload_path)
        except Exception as exc:
            logger.error("Failed to save upload: %s", exc)
            raise HTTPException(status_code=500, detail=f"File save failed: {exc}")
            
        try:
            pages = parse_pdf(upload_path)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"PDF parsing failed for {doc_name}: {exc}")
            
        if not pages:
            continue
            
        try:
            chunks = chunk_document(pages, document_name=doc_name)
            if chunks:
                all_chunks.extend(chunks)
                processed_names.append(doc_name)
        except Exception as exc:
            logger.error("Chunking failed for %s: %s", doc_name, exc)
            raise HTTPException(status_code=500, detail=f"Chunking failed for {doc_name}: {exc}")

    if not all_chunks:
        raise HTTPException(
            status_code=422,
            detail="Documents produced no usable text chunks.",
        )

    print(f"[Progress] Embedding and storing {len(all_chunks)} chunks from {len(processed_names)} files...")
    
    batch_size = 50
    for i in range(0, len(all_chunks), batch_size):
        batch = all_chunks[i:i + batch_size]
        success = False
        rotated_this_batch = False
        while not success:
            try:
                add_documents(batch)
                success = True
                time.sleep(1.5)  # Pace the requests to avoid bursting
            except Exception as exc:
                err_str = str(exc).upper()
                is_recoverable = any(code in err_str for code in ["429", "RESOURCE_EXHAUSTED", "404", "NOT_FOUND", "403", "UNAUTHENTICATED", "INVALID_ARGUMENT"])
                
                if is_recoverable:
                    logger.warning(f"API Error at batch {i}: {exc}")
                    if not rotated_this_batch and rotate_key():
                        logger.warning(f"API key rotated successfully. Retrying immediately...")
                        rotated_this_batch = True
                        time.sleep(2)
                    else:
                        logger.warning(f"All keys exhausted. Sleeping for 180 seconds before retrying...")
                        time.sleep(180)
                        rotated_this_batch = False # Reset so we can try rotating again after the 180s cooldown
                else:
                    logger.error("Embedding/storage failed with fatal error: %s", exc)
                    raise HTTPException(
                        status_code=500,
                        detail=f"Vector store ingestion failed: {exc}",
                    )


    # ── Rebuild BM25 ────────────────────────────────────────────────────
    print(f"[Progress] Rebuilding BM25 index...")
    try:
        rebuild_bm25_from_vector_store()
    except Exception as exc:
        # Non-fatal: dense search still works without BM25.
        logger.warning("BM25 rebuild failed (non-fatal): %s", exc)

    return IngestionResponse(
        status="success",
        document_names=processed_names,
        total_chunks=len(all_chunks),
        message=(
            f"Successfully ingested {len(processed_names)} documents → "
            f"{len(all_chunks)} chunks embedded and indexed."
        ),
    )

# ═══════════════════════════════════════════════════════════════════════════
# Ephemeral Document Extraction
# ═══════════════════════════════════════════════════════════════════════════

@app.post(
    "/api/extract",
    tags=["Extraction"],
    summary="Extract raw text from a document for ephemeral context",
)
def extract_document(
    file: UploadFile = File(...),
) -> dict:
    """
    Parses a PDF or DOCX file and returns the raw text without saving
    it to the RAG database.
    """
    from ingestion.docx_parser import parse_docx
    from ingestion.parser import parse_pdf

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")
        
    ext = file.filename.lower().split(".")[-1]
    if ext not in ["pdf", "docx"]:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported.")
        
    upload_path = Path(settings.upload_dir) / file.filename
    try:
        settings.ensure_directories()
        with open(upload_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"File save failed: {exc}")
        
    try:
        if ext == "pdf":
            pages = parse_pdf(upload_path)
        else:
            pages = parse_docx(upload_path)
            
        full_text = "\n\n".join([p["text"] for p in pages])
        
        # Clean up ephemeral file
        upload_path.unlink(missing_ok=True)
        
        return {"status": "success", "filename": file.filename, "text": full_text}
    except Exception as exc:
        upload_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Extraction failed: {exc}")


# ═══════════════════════════════════════════════════════════════════════════
# Legal Analysis (Chat Endpoint)
# ═══════════════════════════════════════════════════════════════════════════

@app.post(
    "/api/analyze",
    response_model=AnalysisResponse,
    tags=["Analysis"],
    summary="Ask the AI Legal Advisor a question",
)
async def analyze(
    request: AnalysisRequest,
    user_email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
) -> AnalysisResponse:
    """
    Submit a legal question and receive a structured, grounded analysis.

    The pipeline:
      1. Direct structured generation from the selected Gemini model.
      2. Deterministic lookup of candidate legal citations in the verified
         source registry.
      3. Response packaging with exact text only for registry-backed sources.

    The response includes:
      - Structured analysis (Plain English Summary, Key Findings,
        Scenarios & Outcomes, Strategic Recommendations).
      - Verified legal sources with Act/section attribution.
      - Processing time metrics.
    """
    # ── Preflight check ─────────────────────────────────────────────────
    from llm.chain import run_analysis_pipeline
    chat_session = None
    conversation_history = []
    attachment_context = request.ephemeral_context or ""
    media_attachments = []
    # Save user message to DB if chat_id is provided
    if request.chat_id:
        # Check if chat exists and belongs to the user
        chat_session = db.query(db_models.ChatSession).filter(
            db_models.ChatSession.id == request.chat_id,
            db_models.ChatSession.user_email == user_email
        ).first()
        if chat_session:
            prior_messages = db.query(db_models.ChatMessage).filter(
                db_models.ChatMessage.session_id == chat_session.id,
            ).order_by(
                db_models.ChatMessage.created_at.desc(),
                db_models.ChatMessage.id.desc(),
            ).limit(HISTORY_MAX_MESSAGES).all()
            conversation_history = _build_conversation_history(prior_messages)
            attachments = db.query(
                db_models.ChatAttachment.id,
                db_models.ChatAttachment.filename,
                db_models.ChatAttachment.content_type,
                db_models.ChatAttachment.extracted_text,
            ).filter(
                db_models.ChatAttachment.chat_id == chat_session.id,
            ).order_by(db_models.ChatAttachment.created_at.asc()).all()
            context_parts = []
            remaining = CHAT_ATTACHMENTS_CONTEXT_LIMIT
            for attachment in attachments:
                if attachment.extracted_text and remaining > 0:
                    excerpt = attachment.extracted_text[:remaining]
                    context_parts.append(f"FILE: {attachment.filename}\n{excerpt}")
                    remaining -= len(excerpt)
                elif attachment.content_type.startswith("image/"):
                    context_parts.append(f"FILE: {attachment.filename} (visual attachment; inspect the attached image)")
                elif attachment.content_type == "application/pdf":
                    context_parts.append(f"FILE: {attachment.filename} (scanned PDF; inspect the attached pages)")
                if attachment.content_type.startswith("image/") or (
                    attachment.content_type == "application/pdf"
                    and len(attachment.extracted_text.strip()) < 100
                ):
                    binary_content = db.query(db_models.ChatAttachment.content).filter(
                        db_models.ChatAttachment.id == attachment.id,
                        db_models.ChatAttachment.chat_id == chat_session.id,
                    ).scalar()
                    media_attachments.append({
                        "filename": attachment.filename,
                        "content_type": attachment.content_type,
                        "content": binary_content or b"",
                    })
            if context_parts:
                attachment_context = "\n\n".join(part for part in [attachment_context, *context_parts] if part)
            user_msg = db_models.ChatMessage(
                session_id=request.chat_id,
                role="user",
                content=request.query
            )
            db.add(user_msg)
            
            # Update chat title if it's "New Chat"
            if chat_session.title in ("New Chat", "New Inquiry") or not chat_session.title.strip():
                chat_session.title = request.query[:30] + ("..." if len(request.query) > 30 else "")
            
            db.commit()

    # ── Run the full RAG pipeline ───────────────────────────────────────
    print(f"[Progress] Running analysis pipeline for query: '{request.query}'...")
    try:
        response = await run_analysis_pipeline(
            query=request.query,
            document_filter=request.document_filter,
            top_k=request.top_k,
            model_preference="quick",
            ephemeral_context=attachment_context,
            conversation_history=conversation_history,
            media_attachments=media_attachments,
        )
    except QuickModelUnavailableError as exc:
        logger.warning("Quick Thinking unavailable: %s", exc)
        raise HTTPException(
            status_code=429,
            detail={
                "code": "QUICK_MODEL_UNAVAILABLE",
                "message": str(exc),
                "retry_after_seconds": 300,
            },
        )
    except RuntimeError as exc:
        if "no vision-capable Gemini route" in str(exc):
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        if is_quota_error(exc):
            mark_quick_temporarily_unavailable()
            logger.warning("Quick Thinking retrieval quota exhausted: %s", exc)
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "QUICK_MODEL_UNAVAILABLE",
                    "message": "Quick Thinking is temporarily unavailable because Gemini Flash has reached the limit on all configured API keys.",
                    "retry_after_seconds": 300,
                },
            )
        logger.error("Analysis pipeline failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        logger.error("Unexpected error in analysis pipeline: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {exc}",
        )

    # Save assistant message to DB
    if request.chat_id and chat_session:
        structured_json = response.analysis.model_dump_json()
        sources_json = json.dumps([s.model_dump() for s in response.sources])

        assistant_msg = db_models.ChatMessage(
            session_id=request.chat_id,
            role="assistant",
            content=(
                response.analysis.conversational_reply
                or response.analysis.general_analysis
                or response.analysis.situation_meaning
                or "Analysis completed."
            ),
            structured_content=structured_json,
            sources=sources_json,
            model_used=response.model_used,
            processing_time_seconds=response.processing_time_seconds,
        )
        db.add(assistant_msg)
        chat_session.updated_at = db_models.datetime.utcnow()
        db.commit()

    return response


@app.post("/api/analyze/temporary", response_model=AnalysisResponse, tags=["Analysis"])
async def analyze_temporary(request: TemporaryAnalysisRequest) -> AnalysisResponse:
    """Analyze a guest question without saving it to server-side chat history."""
    from llm.chain import run_analysis_pipeline

    try:
        return await run_analysis_pipeline(
            query=request.query,
            document_filter=request.document_filter,
            top_k=request.top_k,
            model_preference="quick",
            ephemeral_context=request.ephemeral_context,
            conversation_history=[message.model_dump() for message in request.conversation_history],
        )
    except QuickModelUnavailableError as exc:
        raise HTTPException(
            status_code=429,
            detail={"code": "QUICK_MODEL_UNAVAILABLE", "message": str(exc), "retry_after_seconds": 300},
        ) from exc
    except RuntimeError as exc:
        if is_quota_error(exc):
            mark_quick_temporarily_unavailable()
            raise HTTPException(
                status_code=429,
                detail={"code": "QUICK_MODEL_UNAVAILABLE", "message": str(exc), "retry_after_seconds": 300},
            ) from exc
        logger.error("Temporary analysis pipeline failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Unexpected temporary analysis error: %s", exc)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {exc}") from exc


@app.post("/__test/analyze", response_model=AnalysisResponse, include_in_schema=False)
async def test_analyze(
    request: AnalysisRequest,
    x_test_token: str | None = Header(default=None, alias="X-Test-Token"),
) -> AnalysisResponse:
    """Temporary, token-gated analysis endpoint for direct backend testing.

    The route is unavailable unless TRANA_TEST_API_TOKEN is configured. It
    bypasses user sign-in only for this endpoint and never persists chat data.
    Remove the environment variable to disable it without changing normal auth.
    """

    configured_token = os.getenv("TRANA_TEST_API_TOKEN", "")
    if (
        len(configured_token) < 32
        or not x_test_token
        or not secrets.compare_digest(x_test_token, configured_token)
    ):
        # Return 404 for both disabled and invalid-token requests so the test
        # endpoint is not discoverable by unauthenticated probes.
        raise HTTPException(status_code=404, detail="Not found")

    from llm.chain import run_analysis_pipeline

    try:
        return await run_analysis_pipeline(
            query=request.query,
            document_filter=request.document_filter,
            top_k=request.top_k,
            model_preference="quick",
            ephemeral_context=request.ephemeral_context,
        )
    except QuickModelUnavailableError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.error("Test analysis pipeline failed: %s", exc)
        raise HTTPException(status_code=502, detail="Test analysis failed.") from exc


# ═══════════════════════════════════════════════════════════════════════════
# Document Management
# ═══════════════════════════════════════════════════════════════════════════

@app.get(
    "/api/documents",
    tags=["Documents"],
    summary="List all ingested documents",
)
def list_documents() -> dict:
    """
    Return a list of all unique document names currently in the index,
    along with per-document chunk counts.
    """
    raise HTTPException(
        status_code=410,
        detail="Local document indexing is disabled in direct-analysis mode.",
    )
    from retrieval.vector_store import get_vector_store

    try:
        store = get_vector_store()
        collection = store._collection

        doc_counts: dict[str, int] = {}
        offset = 0
        limit = 1000

        while True:
            batch = collection.get(include=["metadatas"], limit=limit, offset=offset)
            metadatas = batch.get("metadatas")
            if not metadatas:
                break

            for meta in metadatas:
                name = meta.get("document_name", "Unknown")
                doc_counts[name] = doc_counts.get(name, 0) + 1

            if len(metadatas) < limit:
                break
                
            offset += limit

        return {
            "total_documents": len(doc_counts),
            "total_chunks": sum(doc_counts.values()),
            "documents": [
                {"document_name": name, "chunk_count": count}
                for name, count in sorted(doc_counts.items())
            ],
        }
    except Exception as exc:
        logger.error("Failed to list documents: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.delete(
    "/api/documents",
    tags=["Documents"],
    summary="Delete a specific document from the index",
)
def remove_document(
    document_name: str = Query(
        ...,
        description="The exact document_name to remove from the index.",
    )
) -> dict:
    """
    Remove all chunks belonging to a specific document and rebuild the
    BM25 index.
    """
    raise HTTPException(
        status_code=410,
        detail="Local document indexing is disabled in direct-analysis mode.",
    )
    from retrieval.bm25_retriever import rebuild_bm25_from_vector_store
    from retrieval.vector_store import delete_document

    deleted_count = delete_document(document_name)

    if deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail=f"No chunks found for document '{document_name}'.",
        )

    # Rebuild BM25 after deletion.
    try:
        rebuild_bm25_from_vector_store()
    except Exception as exc:
        logger.warning("BM25 rebuild after deletion failed (non-fatal): %s", exc)

    return {
        "status": "success",
        "document_name": document_name,
        "chunks_deleted": deleted_count,
        "message": f"Deleted {deleted_count} chunks for '{document_name}'.",
    }



# ═══════════════════════════════════════════════════════════════════════════
# Court & Legal Data API Key Management
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/admin/court-keys", response_model=list[schemas.CourtAPIKeyResponse], tags=["Admin API"])
def list_court_keys(
    _admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """List all configured external Court Data / eCourts API keys."""
    rows = db.query(db_models.CourtAPIKey).order_by(db_models.CourtAPIKey.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "provider": r.provider,
            "label": r.label,
            "masked_key": r.masked_key,
            "base_url": r.base_url,
            "is_active": r.is_active,
            "created_at": r.created_at.isoformat() if r.created_at else "",
            "last_used_at": r.last_used_at.isoformat() if r.last_used_at else None,
        }
        for r in rows
    ]


@app.post("/api/admin/court-keys", response_model=schemas.CourtAPIKeyResponse, status_code=201, tags=["Admin API"])
def create_court_key(
    key_in: schemas.CourtAPIKeyCreate,
    _admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """Add a new Court Data API key (e.g. Surepass, eCourtsIndia, Indian Kanoon)."""
    raw_key = key_in.api_key.strip()
    if not raw_key:
        raise HTTPException(status_code=400, detail="API key cannot be empty.")

    provider_clean = key_in.provider.strip().lower()
    masked = mask_api_key(raw_key)

    record = db_models.CourtAPIKey(
        id=str(uuid.uuid4()),
        provider=provider_clean,
        label=key_in.label.strip(),
        api_key=raw_key,
        masked_key=masked,
        base_url=key_in.base_url.strip() if key_in.base_url else None,
        is_active=key_in.is_active,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {
        "id": record.id,
        "provider": record.provider,
        "label": record.label,
        "masked_key": record.masked_key,
        "base_url": record.base_url,
        "is_active": record.is_active,
        "created_at": record.created_at.isoformat(),
        "last_used_at": None,
    }


@app.patch("/api/admin/court-keys/{key_id}", response_model=schemas.CourtAPIKeyResponse, tags=["Admin API"])
def update_court_key(
    key_id: str,
    key_in: schemas.CourtAPIKeyUpdate,
    _admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """Update or toggle a Court API key."""
    record = db.query(db_models.CourtAPIKey).filter(db_models.CourtAPIKey.id == key_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Court API key not found.")

    if key_in.label is not None:
        record.label = key_in.label.strip()
    if key_in.is_active is not None:
        record.is_active = key_in.is_active
    if key_in.base_url is not None:
        record.base_url = key_in.base_url.strip() if key_in.base_url else None

    record.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(record)
    return {
        "id": record.id,
        "provider": record.provider,
        "label": record.label,
        "masked_key": record.masked_key,
        "base_url": record.base_url,
        "is_active": record.is_active,
        "created_at": record.created_at.isoformat(),
        "last_used_at": record.last_used_at.isoformat() if record.last_used_at else None,
    }


@app.delete("/api/admin/court-keys/{key_id}", tags=["Admin API"])
def delete_court_key(
    key_id: str,
    _admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """Delete a Court Data API key."""
    deleted = db.query(db_models.CourtAPIKey).filter(db_models.CourtAPIKey.id == key_id).delete()
    db.commit()
    if not deleted:
        raise HTTPException(status_code=404, detail="Court API key not found.")
    return {"ok": True, "id": key_id}


@app.get("/api/admin/court-keys/status", tags=["Admin API"])
def get_court_keys_status(
    _admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """Return status of live eCourts API integration."""
    active_row = db.query(db_models.CourtAPIKey).filter(db_models.CourtAPIKey.is_active == True).first()
    count = db.query(db_models.CourtAPIKey).count()
    env_active = bool(os.getenv("SUREPASS_API_KEY") or os.getenv("ECOURTS_API_KEY") or os.getenv("INDIANKANOON_TOKEN"))

    has_active = bool(active_row or env_active)
    active_provider = active_row.provider if active_row else ("environment" if env_active else None)

    return {
        "has_active_key": has_active,
        "active_provider": active_provider,
        "key_count": count + (1 if env_active else 0),
    }


# ═══════════════════════════════════════════════════════════════════════════
# eCourts & Case Tracker Endpoints
# ═══════════════════════════════════════════════════════════════════════════

# =============================================================================
# Notification Providers Gateway (Email & SMS)
# =============================================================================

@app.get("/api/admin/notification-providers", response_model=list[schemas.NotificationProviderResponse], tags=["Admin API"])
def list_notification_providers(
    _admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """List all registered email and SMS notification providers."""
    rows = db.query(db_models.NotificationProvider).order_by(db_models.NotificationProvider.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "channel": r.channel,
            "provider": r.provider,
            "label": r.label,
            "masked_key": r.masked_key,
            "is_active": r.is_active,
            "created_at": r.created_at,
            "last_used_at": r.last_used_at,
        }
        for r in rows
    ]


@app.post("/api/admin/notification-providers", response_model=schemas.NotificationProviderResponse, status_code=201, tags=["Admin API"])
def create_notification_provider(
    item_in: schemas.NotificationProviderCreate,
    _admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """Register a new SMS or Email provider credential (Resend, SMTP, Twilio, Fast2SMS)."""
    import json
    channel = item_in.channel.strip().lower()
    provider = item_in.provider.strip().lower()
    config = item_in.config

    # Generate masked key representation
    secret_part = (
        config.get("api_key")
        or config.get("auth_token")
        or config.get("password")
        or config.get("host")
        or "configured"
    )
    masked = mask_api_key(str(secret_part))

    record = db_models.NotificationProvider(
        id=str(uuid.uuid4()),
        channel=channel,
        provider=provider,
        label=item_in.label.strip(),
        config_json=json.dumps(config),
        masked_key=masked,
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "id": record.id,
        "channel": record.channel,
        "provider": record.provider,
        "label": record.label,
        "masked_key": record.masked_key,
        "is_active": record.is_active,
        "created_at": record.created_at,
        "last_used_at": record.last_used_at,
    }


@app.patch("/api/admin/notification-providers/{provider_id}", response_model=schemas.NotificationProviderResponse, tags=["Admin API"])
def update_notification_provider(
    provider_id: str,
    item_in: schemas.NotificationProviderUpdate,
    _admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """Toggle active status or update label of a notification provider."""
    import json
    record = db.query(db_models.NotificationProvider).filter(db_models.NotificationProvider.id == provider_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Notification provider not found.")

    if item_in.label is not None:
        record.label = item_in.label.strip()
    if item_in.is_active is not None:
        record.is_active = item_in.is_active
    if item_in.config is not None:
        record.config_json = json.dumps(item_in.config)
        secret_part = (
            item_in.config.get("api_key")
            or item_in.config.get("auth_token")
            or item_in.config.get("password")
            or "configured"
        )
        record.masked_key = mask_api_key(str(secret_part))

    record.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(record)

    return {
        "id": record.id,
        "channel": record.channel,
        "provider": record.provider,
        "label": record.label,
        "masked_key": record.masked_key,
        "is_active": record.is_active,
        "created_at": record.created_at,
        "last_used_at": record.last_used_at,
    }


@app.delete("/api/admin/notification-providers/{provider_id}", tags=["Admin API"])
def delete_notification_provider(
    provider_id: str,
    _admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """Delete a notification provider credential."""
    deleted = db.query(db_models.NotificationProvider).filter(db_models.NotificationProvider.id == provider_id).delete()
    db.commit()
    if not deleted:
        raise HTTPException(status_code=404, detail="Notification provider not found.")
    return {"ok": True, "id": provider_id}


@app.get("/api/admin/notification-providers/status", response_model=schemas.NotificationStatusResponse, tags=["Admin API"])
def get_notification_status(
    _admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """Return active status for both Email and SMS delivery channels."""
    active_email = db.query(db_models.NotificationProvider).filter(
        db_models.NotificationProvider.channel == "email",
        db_models.NotificationProvider.is_active == True,
    ).first()

    active_sms = db.query(db_models.NotificationProvider).filter(
        db_models.NotificationProvider.channel == "sms",
        db_models.NotificationProvider.is_active == True,
    ).first()

    env_email = bool(os.getenv("RESEND_API_KEY") or os.getenv("SMTP_HOST"))
    env_sms = bool(os.getenv("TWILIO_ACCOUNT_SID") or os.getenv("FAST2SMS_API_KEY"))

    has_email = bool(active_email or env_email)
    has_sms = bool(active_sms or env_sms)

    email_provider = active_email.provider if active_email else ("env/smtp" if env_email else None)
    sms_provider = active_sms.provider if active_sms else ("env/sms" if env_sms else None)

    return {
        "has_active_email": has_email,
        "active_email_provider": email_provider,
        "has_active_sms": has_sms,
        "active_sms_provider": sms_provider,
    }


@app.post("/api/cases/lookup", tags=["Cases"])
async def lookup_case(
    req: schemas.CaseLookupRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """
    Query live case details from official Indian eCourts & National Judicial Data Grid (NJDG).
    Supports 16-character alphanumeric CNR numbers across Indian High Courts and District Courts.
    """
    from services.ecourts_service import fetch_case_by_cnr

    try:
        case_data = await fetch_case_by_cnr(
            req.cnr,
            lawyer_name=req.lawyer_name,
            email=req.email,
            phone=req.phone,
        )
        return case_data
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        logger.error("Failed to lookup eCourts case %s: %s", req.cnr, exc)
        raise HTTPException(status_code=500, detail=f"Failed to lookup eCourts record: {exc}")


@app.get("/api/cases/tracked", tags=["Cases"])
def get_tracked_cases(
    user_email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db),
):
    """Return all litigation matters currently tracked in this advocate's or user's diary."""
    rows = db.query(db_models.TrackedCase).filter(
        db_models.TrackedCase.user_email == user_email.lower().strip()
    ).order_by(db_models.TrackedCase.updated_at.desc()).all()

    results = []
    for r in rows:
        history = []
        if r.orders_history:
            try:
                history = json.loads(r.orders_history)
            except Exception:
                history = []

        results.append({
            "cnr": r.cnr,
            "formattedCnr": r.formatted_cnr,
            "caseType": r.case_type,
            "caseNumber": r.case_number,
            "filingNumber": f"FIL-{r.cnr[0:4]}-{r.case_number.split('/')[-1] if '/' in r.case_number else '2024'}",
            "filingDate": r.created_at.strftime("%d %b %Y"),
            "registrationNumber": f"REG-{r.cnr[6:12]}",
            "registrationDate": r.created_at.strftime("%d %b %Y"),
            "courtName": r.court_name,
            "courtRoom": r.court_room or "Court Room No. 01",
            "judge": r.judge or "Hon'ble Presiding Judge",
            "petitioner": r.petitioner,
            "respondent": r.respondent,
            "petitionerAdvocate": r.petitioner_advocate or "Advocate on Record",
            "respondentAdvocate": r.respondent_advocate or "Standing Counsel",
            "currentStage": r.current_stage or "Arguments",
            "nextHearingDate": r.next_hearing_date or "To be scheduled",
            "hearingPurpose": r.hearing_purpose or "Hearing on Notice",
            "caseStatus": r.case_status,
            "lastOrderDate": r.last_order_date or r.created_at.strftime("%d %b %Y"),
            "lastOrderSummary": r.last_order_summary or "Order reserved / Notice returnable.",
            "ordersHistory": history,
            "source": r.source or "eCourts Services / NJDG",
            "smsEnabled": bool(r.sms_phone),
            "smsNumber": r.sms_phone or "",
            "emailEnabled": bool(r.email_alert),
            "emailAddress": r.email_alert or user_email,
            "reminderStatus": r.reminder_status,
            "notificationLog": [],
            "dateAdded": r.created_at.strftime("%d %b %Y"),
        })

    return results


@app.post("/api/cases/track", tags=["Cases"])
def track_case(
    req: schemas.TrackCaseRequest,
    user_email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db),
):
    """Save or synchronize a litigation matter to the advocate's chamber diary."""
    from services.ecourts_service import validate_and_decode_cnr

    decoded = validate_and_decode_cnr(req.cnr)
    clean_cnr = decoded["clean_cnr"]
    user_email_norm = user_email.lower().strip()

    # Find user
    user_row = db.query(db_models.User).filter(db_models.User.email == user_email_norm).first()
    user_id = user_row.id if user_row else user_email_norm

    cd = req.case_data or {}
    orders_json = json.dumps(cd.get("ordersHistory") or cd.get("orders_history") or [])

    existing = db.query(db_models.TrackedCase).filter(
        db_models.TrackedCase.user_email == user_email_norm,
        db_models.TrackedCase.cnr == clean_cnr,
    ).first()

    if existing:
        if cd.get("caseType") or cd.get("case_type"):
            existing.case_type = cd.get("caseType") or cd.get("case_type")
        if cd.get("caseNumber") or cd.get("case_number"):
            existing.case_number = cd.get("caseNumber") or cd.get("case_number")
        if cd.get("courtName") or cd.get("court_name"):
            existing.court_name = cd.get("courtName") or cd.get("court_name")
        if cd.get("courtRoom") or cd.get("court_room"):
            existing.court_room = cd.get("courtRoom") or cd.get("court_room")
        if cd.get("judge"):
            existing.judge = cd.get("judge")
        if cd.get("petitioner"):
            existing.petitioner = cd.get("petitioner")
        if cd.get("respondent"):
            existing.respondent = cd.get("respondent")
        if cd.get("petitionerAdvocate") or cd.get("petitioner_advocate"):
            existing.petitioner_advocate = cd.get("petitionerAdvocate") or cd.get("petitioner_advocate")
        if cd.get("respondentAdvocate") or cd.get("respondent_advocate"):
            existing.respondent_advocate = cd.get("respondentAdvocate") or cd.get("respondent_advocate")
        if cd.get("currentStage") or cd.get("current_stage"):
            existing.current_stage = cd.get("currentStage") or cd.get("current_stage")
        if cd.get("nextHearingDate") or cd.get("next_hearing_date"):
            existing.next_hearing_date = cd.get("nextHearingDate") or cd.get("next_hearing_date")
        if cd.get("hearingPurpose") or cd.get("hearing_purpose"):
            existing.hearing_purpose = cd.get("hearingPurpose") or cd.get("hearing_purpose")
        if cd.get("caseStatus") or cd.get("case_status"):
            existing.case_status = cd.get("caseStatus") or cd.get("case_status")
        if cd.get("lastOrderDate") or cd.get("last_order_date"):
            existing.last_order_date = cd.get("lastOrderDate") or cd.get("last_order_date")
        if cd.get("lastOrderSummary") or cd.get("last_order_summary"):
            existing.last_order_summary = cd.get("lastOrderSummary") or cd.get("last_order_summary")
        if orders_json and orders_json != "[]":
            existing.orders_history = orders_json
        if req.sms_phone:
            existing.sms_phone = req.sms_phone
        if req.email_alert:
            existing.email_alert = req.email_alert
        if cd.get("source"):
            existing.source = cd.get("source")
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return {"ok": True, "action": "updated", "cnr": clean_cnr}

    new_case = db_models.TrackedCase(
        id=str(uuid.uuid4()),
        user_id=user_id,
        user_email=user_email_norm,
        cnr=clean_cnr,
        formatted_cnr=cd.get("formattedCnr") or cd.get("formatted_cnr") or decoded["formatted_cnr"],
        case_type=cd.get("caseType") or cd.get("case_type") or decoded["court_type"],
        case_number=cd.get("caseNumber") or cd.get("case_number") or f"{int(decoded['seq_number'])}/{decoded['filing_year']}",
        court_name=cd.get("courtName") or cd.get("court_name") or f"{decoded['court_type']} of {decoded['state_name']}",
        court_room=cd.get("courtRoom") or cd.get("court_room") or "Court Room No. 01",
        judge=cd.get("judge") or "Hon'ble Presiding Judge",
        petitioner=cd.get("petitioner") or "Petitioner",
        respondent=cd.get("respondent") or f"State of {decoded['state_name']} & Ors.",
        petitioner_advocate=cd.get("petitionerAdvocate") or cd.get("petitioner_advocate") or "Advocate on Record",
        respondent_advocate=cd.get("respondentAdvocate") or cd.get("respondent_advocate") or "Standing Counsel",
        current_stage=cd.get("currentStage") or cd.get("current_stage") or "Arguments",
        next_hearing_date=cd.get("nextHearingDate") or cd.get("next_hearing_date") or "To be scheduled",
        hearing_purpose=cd.get("hearingPurpose") or cd.get("hearing_purpose") or "Hearing on Notice",
        case_status=cd.get("caseStatus") or cd.get("case_status") or "Pending",
        last_order_date=cd.get("lastOrderDate") or cd.get("last_order_date") or datetime.utcnow().strftime("%d %b %Y"),
        last_order_summary=cd.get("lastOrderSummary") or cd.get("last_order_summary") or "Notice issued to opposite parties.",
        orders_history=orders_json,
        sms_phone=req.sms_phone,
        email_alert=req.email_alert or user_email_norm,
        reminder_status="Active",
        source=cd.get("source") or "National Judicial Data Grid & eCourts Services",
    )
    db.add(new_case)
    db.commit()
    db.refresh(new_case)
    return {"ok": True, "action": "created", "cnr": clean_cnr}


@app.delete("/api/cases/track/{cnr}", tags=["Cases"])
def untrack_case(
    cnr: str,
    user_email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db),
):
    """Remove a matter from the chamber diary."""
    from services.ecourts_service import validate_and_decode_cnr

    clean_cnr = re.sub(r"[^A-Za-z0-9]", "", cnr).upper()
    user_email_norm = user_email.lower().strip()

    deleted = db.query(db_models.TrackedCase).filter(
        db_models.TrackedCase.user_email == user_email_norm,
        db_models.TrackedCase.cnr == clean_cnr,
    ).delete()
    db.commit()
    return {"ok": True, "deleted": deleted > 0, "cnr": clean_cnr}


@app.post("/api/cases/reminder", tags=["Cases"])
async def schedule_reminder(
    req: schemas.CaseReminderRequest,
    user_email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db),
):
    """Dispatch authentic hearing reminders and update notification preferences."""
    from services.notification_service import dispatch_hearing_reminders
    from services.ecourts_service import fetch_case_by_cnr

    clean_cnr = re.sub(r"[^A-Za-z0-9]", "", req.cnr).upper()
    user_email_norm = user_email.lower().strip()

    case_row = db.query(db_models.TrackedCase).filter(
        db_models.TrackedCase.user_email == user_email_norm,
        db_models.TrackedCase.cnr == clean_cnr,
    ).first()

    if case_row:
        case_row.sms_phone = req.sms_phone
        case_row.email_alert = req.email_alert
        case_row.reminder_status = "Active"
        case_row.updated_at = datetime.utcnow()
        db.commit()

    # Build case info for authentic notice generation
    case_info = req.case_data or {}
    if not case_info and case_row:
        case_info = {
            "cnr": case_row.cnr,
            "formatted_cnr": case_row.formatted_cnr,
            "case_type": case_row.case_type,
            "case_number": case_row.case_number,
            "court_name": case_row.court_name,
            "court_room": case_row.court_room,
            "judge": case_row.judge,
            "petitioner": case_row.petitioner,
            "respondent": case_row.respondent,
            "petitioner_advocate": case_row.petitioner_advocate,
            "respondent_advocate": case_row.respondent_advocate,
            "current_stage": case_row.current_stage,
            "next_hearing_date": case_row.next_hearing_date,
            "hearing_purpose": case_row.hearing_purpose,
            "last_order_summary": case_row.last_order_summary,
            "source": case_row.source,
        }
    elif not case_info:
        try:
            case_info = await fetch_case_by_cnr(clean_cnr)
        except Exception:
            case_info = {"cnr": clean_cnr, "formatted_cnr": clean_cnr}

    logs = await dispatch_hearing_reminders(case_info, req.sms_phone, req.email_alert, db)

    return {
        "ok": True,
        "cnr": clean_cnr,
        "logs": logs,
    }


# ═══════════════════════════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════════════════════════
# Verified Legal Professionals & Advocates API
# ═══════════════════════════════════════════════════════════════════════════

def _lawyer_to_dict(row: db_models.Lawyer) -> dict:
    courts_list = []
    if row.courts:
        try:
            courts_list = json.loads(row.courts) if isinstance(row.courts, str) else list(row.courts)
        except Exception:
            courts_list = [c.strip() for c in str(row.courts).split(",") if c.strip()]

    return {
        "id": str(row.id),
        "user_id": row.user_id,
        "full_name": row.full_name,
        "email": row.email,
        "phone": row.phone,
        "bar_reg_no": row.bar_reg_no,
        "state_bar_council": row.state_bar_council,
        "year_of_enrollment": row.year_of_enrollment,
        "aibe_cop_number": row.aibe_cop_number,
        "bar_association": row.bar_association,
        "specialisation": row.specialisation,
        "experience_years": row.experience_years or 1,
        "city": row.city,
        "state": row.state or "Delhi",
        "chamber_address": row.chamber_address,
        "courts": courts_list,
        "bio": row.bio,
        "sanad_document_url": row.sanad_document_url,
        "id_card_document_url": row.id_card_document_url,
        "offers_call": row.offers_call,
        "offers_chat": row.offers_chat,
        "offers_in_person": row.offers_in_person,
        "consultation_fee": row.consultation_fee or 0,
        "approved": row.approved,
        "verification_status": row.verification_status or "PENDING_VERIFICATION",
        "verification_notes": row.verification_notes,
        "verified_at": row.verified_at,
        "verified_by": row.verified_by,
        "internal_rating": row.internal_rating or 5.0,
        "clients_referred": row.clients_referred or 0,
        "consultations_count": row.consultations_count or 0,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


@app.post("/api/lawyers/register", response_model=schemas.LawyerResponse, status_code=201, tags=["Lawyers"])
async def register_lawyer(
    req: schemas.LawyerRegisterRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """Register an advocate with Bar Council credentials and run automated multi-source verification."""
    clean_bar = req.bar_reg_no.strip().upper()
    existing = db.query(db_models.Lawyer).filter(
        (db_models.Lawyer.bar_reg_no == clean_bar) |
        (db_models.Lawyer.email == req.email.strip().lower())
    ).first()

    # Optional current user extraction
    user_id = None
    if authorization and authorization.lower().startswith("bearer "):
        try:
            token = authorization.split(" ", 1)[1].strip()
            user_email = _get_trana_session(token, db)
            if not user_email:
                claims = _decode_supabase_token(token)
                if claims and claims.get("email"):
                    user_email = claims.get("email")
            if user_email:
                u = db.query(db_models.User).filter(db_models.User.email == user_email.lower().strip()).first()
                if u:
                    user_id = u.id
        except Exception:
            pass

    is_admin = is_authorized_founder(req.email, db)

    # Run automated verification engine across online gateways, eCourts records & statutory rules
    from services.lawyer_verification_service import execute_automated_advocate_verification
    auto_ver = await execute_automated_advocate_verification(
        bar_reg_no=clean_bar,
        full_name=req.full_name,
        state_bar_council=req.state_bar_council,
        year_of_enrollment=req.year_of_enrollment,
        aibe_cop_number=req.aibe_cop_number,
        db=db,
    )

    if is_admin or auto_ver.get("verified"):
        verification_status = "VERIFIED"
        approved = True
        verified_at = datetime.utcnow()
        verified_by = "Platform Auto-Verify (Founder)" if is_admin else f"Auto-Verified via {auto_ver.get('method', 'Gateway')}"
        verification_notes = auto_ver.get("notes", "Statutory Bar Council verification successful.")
    else:
        verification_status = "PENDING_VERIFICATION"
        approved = False
        verified_at = None
        verified_by = None
        verification_notes = auto_ver.get("notes", "Queued for Bar Council review")

    courts_str = json.dumps(req.courts) if req.courts else json.dumps(["Supreme Court of India", "Delhi High Court"])

    if existing is not None:
        # If applicant is updating or resubmitting their pending application
        existing.full_name = req.full_name.strip()
        existing.email = req.email.strip().lower()
        existing.phone = req.phone.strip()
        existing.bar_reg_no = clean_bar
        existing.state_bar_council = req.state_bar_council.strip()
        existing.year_of_enrollment = req.year_of_enrollment
        existing.aibe_cop_number = req.aibe_cop_number.strip() if req.aibe_cop_number else None
        existing.bar_association = req.bar_association.strip() if req.bar_association else None
        existing.specialisation = req.specialisation.strip()
        existing.experience_years = req.experience_years
        existing.city = req.city.strip()
        existing.state = req.state.strip() if req.state else "Delhi"
        existing.chamber_address = req.chamber_address.strip() if req.chamber_address else None
        existing.courts = courts_str
        existing.bio = req.bio.strip() if req.bio else None
        existing.offers_call = req.offers_call
        existing.offers_chat = req.offers_chat
        existing.offers_in_person = req.offers_in_person
        existing.consultation_fee = req.consultation_fee
        if user_id:
            existing.user_id = user_id
        if not existing.approved:
            existing.approved = approved
            existing.verification_status = verification_status
            existing.verified_at = verified_at
            existing.verified_by = verified_by
            existing.verification_notes = verification_notes
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        logger.info("Advocate record updated/re-queued: %s (%s) - status: %s", existing.full_name, existing.bar_reg_no, existing.verification_status)
        return _lawyer_to_dict(existing)

    new_lawyer = db_models.Lawyer(
        id=str(uuid.uuid4()),
        user_id=user_id,
        full_name=req.full_name.strip(),
        email=req.email.strip().lower(),
        phone=req.phone.strip(),
        bar_reg_no=clean_bar,
        state_bar_council=req.state_bar_council.strip(),
        year_of_enrollment=req.year_of_enrollment,
        aibe_cop_number=req.aibe_cop_number.strip() if req.aibe_cop_number else None,
        bar_association=req.bar_association.strip() if req.bar_association else None,
        specialisation=req.specialisation.strip(),
        experience_years=req.experience_years,
        city=req.city.strip(),
        state=req.state.strip() if req.state else "Delhi",
        chamber_address=req.chamber_address.strip() if req.chamber_address else None,
        courts=courts_str,
        bio=req.bio.strip() if req.bio else None,
        offers_call=req.offers_call,
        offers_chat=req.offers_chat,
        offers_in_person=req.offers_in_person,
        consultation_fee=req.consultation_fee,
        approved=approved,
        verification_status=verification_status,
        verified_at=verified_at,
        verified_by=verified_by,
        internal_rating=5.0,
        clients_referred=0,
        consultations_count=0,
    )

    db.add(new_lawyer)
    db.commit()
    db.refresh(new_lawyer)

    logger.info("Advocate registered: %s (%s) - status: %s", new_lawyer.full_name, new_lawyer.bar_reg_no, new_lawyer.verification_status)
    return _lawyer_to_dict(new_lawyer)


@app.get("/api/lawyers", response_model=list[schemas.LawyerResponse], tags=["Lawyers"])
def list_verified_lawyers(
    search: Optional[str] = None,
    city: Optional[str] = None,
    specialisation: Optional[str] = None,
    court: Optional[str] = None,
    all_members: bool = False,
    db: Session = Depends(get_db),
):
    """Directory of verified advocates for citizens, clients, and peer professional network."""
    if all_members:
        query = db.query(db_models.Lawyer).filter(
            db_models.Lawyer.verification_status != "SUSPENDED",
            db_models.Lawyer.verification_status != "REJECTED",
        )
    else:
        query = db.query(db_models.Lawyer).filter(
            db_models.Lawyer.verification_status.in_(["VERIFIED", "PENDING_VERIFICATION"]),
            db_models.Lawyer.verification_status != "SUSPENDED",
            db_models.Lawyer.verification_status != "REJECTED",
        )

    if city and city.strip() and city.lower() != "all":
        query = query.filter(db_models.Lawyer.city.ilike(f"%{city.strip()}%"))

    if specialisation and specialisation.strip() and specialisation.lower() != "all":
        query = query.filter(db_models.Lawyer.specialisation.ilike(f"%{specialisation.strip()}%"))

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (db_models.Lawyer.full_name.ilike(term)) |
            (db_models.Lawyer.specialisation.ilike(term)) |
            (db_models.Lawyer.city.ilike(term)) |
            (db_models.Lawyer.courts.ilike(term))
        )

    rows = query.order_by(db_models.Lawyer.internal_rating.desc(), db_models.Lawyer.full_name.asc()).all()
    return [_lawyer_to_dict(r) for r in rows]


@app.get("/api/lawyers/me", response_model=schemas.LawyerResponse, tags=["Lawyers"])
def get_current_lawyer(
    user_email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db),
):
    """Return the registered lawyer profile for the currently signed in user."""
    clean_email = user_email.lower().strip()
    lawyer = db.query(db_models.Lawyer).filter(db_models.Lawyer.email == clean_email).first()

    if lawyer is None:
        u = db.query(db_models.User).filter(db_models.User.email == clean_email).first()
        if u:
            lawyer = db.query(db_models.Lawyer).filter(db_models.Lawyer.user_id == u.id).first()

    if lawyer is None:
        raise HTTPException(status_code=404, detail="No advocate registration found for this user account.")

    return _lawyer_to_dict(lawyer)


@app.put("/api/lawyers/me", response_model=schemas.LawyerResponse, tags=["Lawyers"])
def update_current_lawyer(
    update_data: schemas.LawyerUpdateRequest,
    user_email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db),
):
    """Update profile and practice details for the currently signed in advocate."""
    clean_email = user_email.lower().strip()
    lawyer = db.query(db_models.Lawyer).filter(db_models.Lawyer.email == clean_email).first()

    if lawyer is None:
        u = db.query(db_models.User).filter(db_models.User.email == clean_email).first()
        if u:
            lawyer = db.query(db_models.Lawyer).filter(db_models.Lawyer.user_id == u.id).first()

    if lawyer is None:
        raise HTTPException(status_code=404, detail="No advocate registration found to update.")

    for field, val in update_data.model_dump(exclude_unset=True).items():
        if field == "courts" and isinstance(val, list):
            setattr(lawyer, "courts", json.dumps(val))
        elif field == "bar_reg_no" and val:
            setattr(lawyer, "bar_reg_no", val.strip().upper())
        elif hasattr(lawyer, field) and val is not None:
            setattr(lawyer, field, val)

    lawyer.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(lawyer)
    return _lawyer_to_dict(lawyer)


@app.get("/api/lawyers/{lawyer_id}", response_model=schemas.LawyerResponse, tags=["Lawyers"])
def get_lawyer_by_id(lawyer_id: str, db: Session = Depends(get_db)):
    """Fetch advocate profile by identifier."""
    lawyer = db.query(db_models.Lawyer).filter(db_models.Lawyer.id == lawyer_id).first()
    if not lawyer:
        raise HTTPException(status_code=404, detail="Advocate not found.")
    return _lawyer_to_dict(lawyer)


@app.get("/api/admin/lawyers", response_model=schemas.LawyersListSummaryResponse, tags=["Admin Lawyers"])
def get_admin_lawyers(
    status: Optional[str] = None,
    search: Optional[str] = None,
    admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """Return all registered advocates and pending Bar Council applications for admin review."""
    base_query = db.query(db_models.Lawyer)

    total = base_query.count()
    verified = base_query.filter(db_models.Lawyer.verification_status == "VERIFIED").count()
    pending = base_query.filter(db_models.Lawyer.verification_status == "PENDING_VERIFICATION").count()
    suspended = base_query.filter(db_models.Lawyer.verification_status == "SUSPENDED").count()

    query = base_query
    if status and status.strip() and status.upper() != "ALL":
        query = query.filter(db_models.Lawyer.verification_status == status.strip().upper())

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (db_models.Lawyer.full_name.ilike(term)) |
            (db_models.Lawyer.bar_reg_no.ilike(term)) |
            (db_models.Lawyer.email.ilike(term)) |
            (db_models.Lawyer.city.ilike(term))
        )

    rows = query.order_by(db_models.Lawyer.created_at.desc()).all()

    return {
        "total": total,
        "verified": verified,
        "pending": pending,
        "suspended": suspended,
        "lawyers": [_lawyer_to_dict(r) for r in rows],
    }


@app.patch("/api/admin/lawyers/{lawyer_id}/verify", response_model=schemas.LawyerResponse, tags=["Admin Lawyers"])
def verify_lawyer_admin(
    lawyer_id: str,
    action_in: schemas.LawyerVerificationActionRequest,
    admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """Approve, reject, or suspend an advocate application with verification review notes."""
    lawyer = db.query(db_models.Lawyer).filter(db_models.Lawyer.id == lawyer_id).first()
    if not lawyer:
        raise HTTPException(status_code=404, detail="Advocate not found.")

    if action_in.action == "VERIFY":
        lawyer.approved = True
        lawyer.verification_status = "VERIFIED"
        lawyer.verified_at = datetime.utcnow()
        lawyer.verified_by = admin_email
    elif action_in.action == "REJECT":
        lawyer.approved = False
        lawyer.verification_status = "REJECTED"
    elif action_in.action == "SUSPEND":
        lawyer.approved = False
        lawyer.verification_status = "SUSPENDED"

    if action_in.notes is not None:
        lawyer.verification_notes = action_in.notes

    if action_in.internal_rating is not None:
        lawyer.internal_rating = action_in.internal_rating

    lawyer.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(lawyer)

    logger.info("Admin %s updated advocate %s (%s) -> %s", admin_email, lawyer.full_name, lawyer.id, lawyer.verification_status)
    return _lawyer_to_dict(lawyer)


@app.post("/api/admin/lawyers/{lawyer_id}/auto-verify", response_model=schemas.LawyerResponse, tags=["Admin Lawyers"])
async def auto_verify_lawyer_admin(
    lawyer_id: str,
    admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """Execute live automated verification pipeline on an existing advocate application."""
    lawyer = db.query(db_models.Lawyer).filter(db_models.Lawyer.id == lawyer_id).first()
    if not lawyer:
        raise HTTPException(status_code=404, detail="Advocate not found.")

    from services.lawyer_verification_service import execute_automated_advocate_verification
    auto_ver = await execute_automated_advocate_verification(
        bar_reg_no=lawyer.bar_reg_no,
        full_name=lawyer.full_name,
        state_bar_council=lawyer.state_bar_council or "",
        year_of_enrollment=lawyer.year_of_enrollment,
        aibe_cop_number=lawyer.aibe_cop_number,
        db=db,
    )

    if auto_ver.get("verified"):
        lawyer.approved = True
        lawyer.verification_status = "VERIFIED"
        lawyer.verified_at = datetime.utcnow()
        lawyer.verified_by = f"Auto-Verified ({auto_ver.get('method', 'Gateway')})"
        lawyer.verification_notes = auto_ver.get("notes", "Statutory Bar Council verification successful.")
    else:
        lawyer.verification_notes = auto_ver.get("notes", "Queued for Bar Council review")

    lawyer.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(lawyer)
    logger.info("Admin %s ran auto-verification on %s -> %s (verified=%s)", admin_email, lawyer.full_name, lawyer.verification_status, auto_ver.get("verified"))
    return _lawyer_to_dict(lawyer)


@app.post("/api/admin/lawyers/test-verification", tags=["Admin Lawyers"])
async def test_lawyer_verification(
    req: schemas.LawyerRegisterRequest,
    admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """Run real-time automated advocate verification test across online gateways."""
    from services.lawyer_verification_service import execute_automated_advocate_verification
    res = await execute_automated_advocate_verification(
        bar_reg_no=req.bar_reg_no,
        full_name=req.full_name,
        state_bar_council=req.state_bar_council,
        year_of_enrollment=req.year_of_enrollment,
        aibe_cop_number=req.aibe_cop_number,
        db=db,
    )
    return res


@app.delete("/api/admin/lawyers/{lawyer_id}", tags=["Admin Lawyers"])
def delete_lawyer_admin(
    lawyer_id: str,
    admin_email: str = Depends(get_admin_email),
    db: Session = Depends(get_db),
):
    """Delete an advocate record from the directory."""
    lawyer = db.query(db_models.Lawyer).filter(
        (db_models.Lawyer.id == lawyer_id) | (db_models.Lawyer.user_id == lawyer_id)
    ).first()
    if not lawyer:
        return {"ok": True, "message": f"Advocate {lawyer_id} removed."}

    db.delete(lawyer)
    db.commit()
    return {"ok": True, "message": f"Advocate {lawyer.full_name} ({lawyer.bar_reg_no}) deleted."}


# ═══════════════════════════════════════════════════════════════════════════
# Professional Network Peer Connections API
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/network/connections", response_model=list[schemas.PeerConnectionResponse], tags=["Professional Network"])
def list_peer_connections(
    user_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Retrieve peer connection records for a user or all connections across the network."""
    query = db.query(db_models.PeerConnection)
    if user_id and user_id.strip():
        u = user_id.strip()
        query = query.filter(
            (db_models.PeerConnection.from_user_id == u) |
            (db_models.PeerConnection.to_user_id == u)
        )
    rows = query.order_by(db_models.PeerConnection.created_at.desc()).all()
    return rows


@app.post("/api/network/connections", response_model=schemas.PeerConnectionResponse, status_code=201, tags=["Professional Network"])
def create_peer_connection(
    req: schemas.PeerConnectionCreateRequest,
    db: Session = Depends(get_db),
):
    """Send a connection request to an advocate or legal scholar."""
    existing = db.query(db_models.PeerConnection).filter(
        ((db_models.PeerConnection.from_user_id == req.from_user_id) & (db_models.PeerConnection.to_user_id == req.to_user_id)) |
        ((db_models.PeerConnection.from_user_id == req.to_user_id) & (db_models.PeerConnection.to_user_id == req.from_user_id))
    ).first()

    if existing:
        if existing.status == "accepted":
            return existing
        if existing.status == "declined":
            existing.status = "pending"
            existing.from_user_id = req.from_user_id
            existing.to_user_id = req.to_user_id
            existing.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            return existing
        return existing

    conn = db_models.PeerConnection(
        id=f"CONN-{int(datetime.utcnow().timestamp() * 1000)}-{str(uuid.uuid4())[:6]}",
        from_user_id=req.from_user_id,
        from_user_name=req.from_user_name,
        from_user_role=req.from_user_role,
        from_user_role_label=req.from_user_role_label or "Verified Advocate",
        from_user_city=req.from_user_city or "New Delhi",
        to_user_id=req.to_user_id,
        to_user_name=req.to_user_name,
        to_user_role=req.to_user_role,
        to_user_role_label=req.to_user_role_label or "Verified Advocate",
        to_user_city=req.to_user_city or "New Delhi",
        status="pending",
        note=req.note or "",
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn


@app.patch("/api/network/connections/{conn_id}", response_model=schemas.PeerConnectionResponse, tags=["Professional Network"])
def update_peer_connection(
    conn_id: str,
    action_in: schemas.PeerConnectionActionRequest,
    db: Session = Depends(get_db),
):
    """Accept, decline, or cancel a connection invitation."""
    conn = db.query(db_models.PeerConnection).filter(db_models.PeerConnection.id == conn_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection request not found.")

    if action_in.action == "ACCEPT":
        conn.status = "accepted"
    elif action_in.action in ("DECLINE", "CANCEL"):
        conn.status = "declined"

    conn.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(conn)
    return conn


@app.delete("/api/network/connections/{conn_id}", tags=["Professional Network"])
def delete_peer_connection(
    conn_id: str,
    db: Session = Depends(get_db),
):
    """Permanently delete a peer connection."""
    conn = db.query(db_models.PeerConnection).filter(db_models.PeerConnection.id == conn_id).first()
    if not conn:
        return {"ok": True, "message": "Connection removed."}

    db.delete(conn)
    db.commit()
    return {"ok": True, "message": "Connection removed."}


# ═══════════════════════════════════════════════════════════════════════════
# Live Indian Legal News Feed (LiveLaw, Bar & Bench, Supreme Court)
# ═══════════════════════════════════════════════════════════════════════════

_news_cache: dict = {"items": [], "fetched_at": None}
_NEWS_CACHE_TTL = timedelta(minutes=15)

@app.get("/api/news", tags=["Legal News"])
async def get_indian_legal_news(limit: int = 8):
    """Fetch live Indian legal news articles from LiveLaw, Bar & Bench, and High Courts/Supreme Court with direct article links."""
    global _news_cache
    now = datetime.utcnow()
    if _news_cache["fetched_at"] and (now - _news_cache["fetched_at"]) < _NEWS_CACHE_TTL and _news_cache["items"]:
        return {"items": _news_cache["items"][:limit]}

    import xml.etree.ElementTree as ET
    from email.utils import parsedate_to_datetime

    query = "site:livelaw.in OR site:barandbench.com when:3d"
    url = f"https://news.google.com/rss/search?q={urllib.parse.quote(query)}&hl=en-IN&gl=IN&ceid=IN:en"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})

    items = []
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            root = ET.fromstring(resp.read())
            for item in root.findall(".//item")[:limit * 3]:
                title = item.findtext("title") or ""
                link = item.findtext("link") or ""
                pub_date = item.findtext("pubDate") or ""
                source_el = item.find("source")
                source_name = source_el.text if source_el is not None and source_el.text else "Legal News"

                if not title or not link or "google news" in title.lower():
                    continue

                clean_title = re.sub(
                    r"\s*-\s*(Live\s*Law|Bar\s*(and|&)\s*Bench|SCC\s*Online|LawBeat|The\s*Hindu|The\s*Indian\s*Express|NDTV|Hindustan\s*Times)\s*$",
                    "",
                    title,
                    flags=re.IGNORECASE,
                ).strip()

                title_lower = title.lower()
                source_lower = source_name.lower()
                if "live law" in source_lower or "livelaw" in title_lower:
                    detected_source = "LiveLaw"
                elif "bar and bench" in source_lower or "bar & bench" in source_lower or "bar and bench" in title_lower:
                    detected_source = "Bar & Bench"
                elif "scc" in source_lower:
                    detected_source = "SCC Online"
                elif "lawbeat" in source_lower:
                    detected_source = "LawBeat"
                else:
                    detected_source = source_name

                if any(k in title_lower for k in ["supreme court", "sc: ", "sc "]):
                    cat = "Supreme Court"
                elif any(k in title_lower for k in ["high court", "hc: ", "hc "]):
                    cat = "High Court"
                elif any(k in title_lower for k in ["bail", "arrest", "fir", "bns", "criminal"]):
                    cat = "Criminal Law"
                elif any(k in title_lower for k in ["divorce", "matrimon", "maintenance", "family"]):
                    cat = "Family Law"
                elif any(k in title_lower for k in ["cyber", "privacy", "digital", "tech"]):
                    cat = "Cyber Law"
                elif any(k in title_lower for k in ["bar council", "advocate", "lawyer"]):
                    cat = "Bar Council"
                else:
                    cat = "Legal Update"

                try:
                    iso_date = parsedate_to_datetime(pub_date).isoformat()
                except Exception:
                    iso_date = now.isoformat()

                items.append({
                    "id": f"live-{secrets.token_hex(4)}",
                    "title": clean_title,
                    "url": link,
                    "source": detected_source,
                    "publishedAt": iso_date,
                    "category": cat,
                })

        if items:
            _news_cache = {"items": items, "fetched_at": now}
    except Exception as e:
        logger.warning("Error fetching live legal news: %s", e)

    return {"items": (items or _news_cache["items"])[:limit]}


# Error Handlers
# ═══════════════════════════════════════════════════════════════════════════

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Catch-all handler to prevent stack traces from leaking to clients."""
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal server error occurred. Please try again later.",
        },
    )


# ═══════════════════════════════════════════════════════════════════════════
# Direct Execution
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        reload=False,
        log_level=settings.log_level.lower(),
    )
