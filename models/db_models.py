from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint, LargeBinary
from datetime import datetime
import uuid
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    google_id = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    picture = Column(String, nullable=True)
    password_hash = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuthSession(Base):
    """Hashed, revocable TRANA sessions issued after Google sign-in."""

    __tablename__ = "auth_sessions"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_email = Column(String, index=True, nullable=False)
    token_hash = Column(String(64), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_seen_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    revoked_at = Column(DateTime, nullable=True)

class AllowedIP(Base):
    __tablename__ = 'allowed_ips'

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    ip_address = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, index=True)
    user_email = Column(String, index=True, nullable=False)
    title = Column(String, nullable=False)
    deleted_by_user = Column(Boolean, default=False, nullable=False, server_default="false")
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, index=True, nullable=False)
    role = Column(String, nullable=False) # 'user' or 'assistant'
    content = Column(String, nullable=False)
    structured_content = Column(String, nullable=True) # JSON string
    sources = Column(String, nullable=True) # JSON string
    model_used = Column(String, nullable=True)
    processing_time_seconds = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ChatAttachment(Base):
    """User supplied document retained with its owning chat (database-backed)."""

    __tablename__ = "chat_attachments"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    chat_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    size = Column(Integer, nullable=False)
    content = Column(LargeBinary, nullable=False)
    extracted_text = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class GeminiAPIKey(Base):
    """Encrypted Gemini credentials managed by the admin console."""

    __tablename__ = "gemini_api_keys"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    label = Column(String(120), nullable=False)
    encrypted_key = Column(Text, nullable=False)
    fingerprint = Column(String(64), unique=True, index=True, nullable=False)
    masked_key = Column(String(32), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    rotation_order = Column(Integer, nullable=False, default=0, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_used_at = Column(DateTime, nullable=True)
    last_error_status = Column(String(32), nullable=True)
    last_error_at = Column(DateTime, nullable=True)


class GeminiAPIKeyUsage(Base):
    """Per-key/model counters in minute and IST-calendar-day buckets."""

    __tablename__ = "gemini_api_key_usage"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    api_key_id = Column(String, ForeignKey("gemini_api_keys.id"), nullable=False, index=True)
    model = Column(String(160), nullable=False, index=True)
    bucket_type = Column(String(16), nullable=False)
    bucket_start = Column(DateTime, nullable=False)
    total_requests = Column(Integer, nullable=False, default=0)
    successful_requests = Column(Integer, nullable=False, default=0)
    failed_requests = Column(Integer, nullable=False, default=0)
    quota_failures = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint(
            "api_key_id",
            "model",
            "bucket_type",
            "bucket_start",
            name="uq_gemini_key_usage_bucket",
        ),
        Index("ix_gemini_key_usage_lookup", "api_key_id", "model", "bucket_type", "bucket_start"),
    )


class ProviderAPIKey(Base):
    """Encrypted credentials for any model provider.

    This is an additive replacement for ``GeminiAPIKey``.  The legacy table is
    intentionally retained so old deployments and mixed-version processes can
    continue to read existing Gemini credentials during rollout.
    """

    __tablename__ = "provider_api_keys"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    provider = Column(String(64), nullable=False, index=True)
    model = Column(String(160), nullable=False, index=True)
    mode = Column(String(16), nullable=False, default="quick", index=True)
    base_url = Column(String(255), nullable=True)
    label = Column(String(120), nullable=False)
    encrypted_key = Column(Text, nullable=False)
    fingerprint = Column(String(64), nullable=False, index=True)
    masked_key = Column(String(32), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    rotation_order = Column(Integer, nullable=False, default=0, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_used_at = Column(DateTime, nullable=True)
    last_error_status = Column(String(32), nullable=True)
    last_error_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "provider",
            "fingerprint",
            name="uq_provider_api_key_fingerprint",
        ),
        Index("ix_provider_api_key_pool", "provider", "model", "mode", "is_active", "rotation_order"),
    )


class ProviderAPIKeyUsage(Base):
    """Per-provider-key/model counters in minute and IST-calendar-day buckets."""

    __tablename__ = "provider_api_key_usage"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    provider_key_id = Column(String, ForeignKey("provider_api_keys.id"), nullable=False, index=True)
    provider = Column(String(64), nullable=False, index=True)
    model = Column(String(160), nullable=False, index=True)
    mode = Column(String(16), nullable=False, default="quick", index=True)
    bucket_type = Column(String(16), nullable=False)
    bucket_start = Column(DateTime, nullable=False)
    total_requests = Column(Integer, nullable=False, default=0)
    successful_requests = Column(Integer, nullable=False, default=0)
    failed_requests = Column(Integer, nullable=False, default=0)
    quota_failures = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint(
            "provider_key_id",
            "model",
            "mode",
            "bucket_type",
            "bucket_start",
            name="uq_provider_key_usage_bucket",
        ),
        Index(
            "ix_provider_key_usage_lookup",
            "provider_key_id",
            "provider",
            "model",
            "mode",
            "bucket_type",
            "bucket_start",
        ),
    )


class AdvocateDisclaimer(Base):
    __tablename__ = "advocate_disclaimers"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=True, index=True)
    user_email = Column(String, nullable=True, index=True)
    user_name = Column(String, nullable=True)
    notice_text = Column(Text, nullable=True)
    accepted_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class TrackedCase(Base):
    """Litigation matters tracked by advocates and citizens with eCourts sync."""

    __tablename__ = "tracked_cases"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True, nullable=False)
    user_email = Column(String, index=True, nullable=False)
    cnr = Column(String(20), index=True, nullable=False)
    formatted_cnr = Column(String(30), nullable=False)
    case_type = Column(String(100), nullable=False)
    case_number = Column(String(50), nullable=False)
    court_name = Column(String(255), nullable=False)
    court_room = Column(String(100), nullable=True)
    judge = Column(String(255), nullable=True)
    petitioner = Column(String(255), nullable=False)
    respondent = Column(String(255), nullable=False)
    petitioner_advocate = Column(String(255), nullable=True)
    respondent_advocate = Column(String(255), nullable=True)
    current_stage = Column(String(255), nullable=True)
    next_hearing_date = Column(String(50), nullable=True)
    hearing_purpose = Column(String(255), nullable=True)
    case_status = Column(String(50), nullable=False, default="Pending")
    last_order_date = Column(String(50), nullable=True)
    last_order_summary = Column(Text, nullable=True)
    orders_history = Column(Text, nullable=True)
    raw_data = Column(Text, nullable=True)
    sms_phone = Column(String(50), nullable=True)
    email_alert = Column(String(120), nullable=True)
    reminder_status = Column(String(20), nullable=False, default="Active")
    source = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_email", "cnr", name="uq_user_cnr"),
        Index("ix_tracked_cases_user_cnr", "user_email", "cnr"),
    )


class CourtAPIKey(Base):
    """External Court Data and eCourts API Provider Credentials."""

    __tablename__ = "court_api_keys"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    provider = Column(String(64), nullable=False, default="surepass", index=True)
    label = Column(String(120), nullable=False)
    api_key = Column(Text, nullable=False)
    masked_key = Column(String(32), nullable=False)
    base_url = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_used_at = Column(DateTime, nullable=True)

class NotificationProvider(Base):
    """External SMS & Email Notification Credentials (Resend, SMTP, Twilio, Fast2SMS)."""

    __tablename__ = "notification_providers"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    channel = Column(String(32), nullable=False, index=True)  # "email" or "sms"
    provider = Column(String(64), nullable=False, index=True)  # "resend", "smtp", "twilio", "fast2sms"
    label = Column(String(120), nullable=False)
    config_json = Column(Text, nullable=False)  # JSON encoded credentials
    masked_key = Column(String(64), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_used_at = Column(DateTime, nullable=True)

