"""Atomic shared rolling-minute token admission backed by SQLAlchemy.

The provider call must happen only after :meth:`TokenBudgetLedger.reserve`
returns. Each ledger operation owns and closes its own short-lived session, so
no transaction or database lock is held while awaiting a provider.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional
import uuid

from sqlalchemy import and_, case, func, or_, text
from sqlalchemy.orm import Session

from database import SessionLocal
from models.db_models import LLMTokenReservation


DEFAULT_TPM_LIMIT = 8_000
WINDOW = timedelta(seconds=60)
# A single stable lock key serializes all admissions across workers/processes.
_POSTGRES_ADVISORY_LOCK_KEY = 7_348_202_611


class TokenBudgetError(RuntimeError):
    """Base error for token-budget admission and persistence failures."""


class TokenBudgetExceeded(TokenBudgetError):
    """The requested conservative reservation does not fit in the window."""


class TokenBudgetUnavailable(TokenBudgetError):
    """Admission could not be verified safely; callers must not call a provider."""


class InvalidReservationState(TokenBudgetError):
    """A reservation is missing or has already been reconciled."""


def conservative_token_estimate(prompt_tokens: int, output_tokens: int) -> int:
    """Return the admission charge from caller-supplied conservative counts."""
    prompt_tokens = _nonnegative_int(prompt_tokens, "prompt_tokens")
    output_tokens = _nonnegative_int(output_tokens, "output_tokens")
    return prompt_tokens + output_tokens


def _nonnegative_int(value: int, name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f"{name} must be a non-negative integer")
    return value


def _utc_naive(value: datetime) -> datetime:
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


@dataclass(frozen=True)
class TokenReservation:
    """Handle for a durable reservation; methods open fresh DB sessions."""

    reservation_id: str
    reserved_tokens: int
    _ledger: "TokenBudgetLedger"

    def reconcile(self, actual_tokens: Optional[int]) -> int:
        """Settle with actual provider usage; ``None`` safely keeps the estimate.

        Pass the provider-reported prompt-plus-completion total. Missing usage,
        timeouts, and unknown outcomes should pass ``None`` or call
        :meth:`mark_unknown`, retaining the full reservation for one window.
        """
        return self._ledger._settle(self.reservation_id, actual_tokens)

    def reconcile_usage(self, prompt_tokens: Optional[int], output_tokens: Optional[int]) -> int:
        """Settle from provider-reported input and output usage fields."""
        if prompt_tokens is None or output_tokens is None:
            return self.reconcile(None)
        return self.reconcile(
            _nonnegative_int(prompt_tokens, "prompt_tokens")
            + _nonnegative_int(output_tokens, "output_tokens")
        )

    def mark_unknown(self) -> int:
        """Record an unknown provider outcome without releasing reserved tokens."""
        return self.reconcile(None)


class TokenBudgetLedger:
    """Shared atomic TPM ledger using PostgreSQL or serialized SQLite writes."""

    def __init__(
        self,
        session_factory: Callable[[], Session] = SessionLocal,
        *,
        limit: int = DEFAULT_TPM_LIMIT,
        clock: Callable[[], datetime] = datetime.utcnow,
    ) -> None:
        self._session_factory = session_factory
        self.limit = _nonnegative_int(limit, "limit")
        if self.limit == 0:
            raise ValueError("limit must be greater than zero")
        self._clock = clock

    def reserve(self, prompt_tokens: int, output_tokens: int) -> TokenReservation:
        """Atomically reserve prompt estimate plus maximum output before a call.

        Raises :class:`TokenBudgetExceeded` when the 60-second shared ceiling
        would be exceeded and :class:`TokenBudgetUnavailable` on database
        errors or unsupported dialects (fail closed).
        """
        estimate = conservative_token_estimate(prompt_tokens, output_tokens)
        if estimate > self.limit:
            raise TokenBudgetExceeded(
                f"Reservation of {estimate} tokens exceeds the {self.limit}-token limit"
            )

        now = _utc_naive(self._clock())
        reservation_id = str(uuid.uuid4())
        session: Optional[Session] = None
        try:
            session = self._session_factory()
            dialect = session.get_bind().dialect.name
            self._begin_serialized_transaction(session, dialect)
            now = self._database_now(session, dialect, now)
            cutoff = now - WINDOW
            self._cleanup_expired_in_transaction(session, cutoff)
            used = self._window_usage(session, cutoff)
            if used + estimate > self.limit:
                raise TokenBudgetExceeded(
                    f"Only {max(0, self.limit - used)} tokens remain in the rolling 60-second window"
                )
            session.add(LLMTokenReservation(
                id=reservation_id,
                reserved_tokens=estimate,
                actual_tokens=None,
                created_at=now,
            ))
            session.commit()
            return TokenReservation(reservation_id, estimate, self)
        except TokenBudgetExceeded:
            if session is not None:
                session.rollback()
            raise
        except Exception as exc:
            if session is not None:
                session.rollback()
            raise TokenBudgetUnavailable("Could not safely reserve shared token budget") from exc
        finally:
            if session is not None:
                session.close()

    def _settle(self, reservation_id: str, actual_tokens: Optional[int]) -> int:
        if actual_tokens is not None:
            actual_tokens = _nonnegative_int(actual_tokens, "actual_tokens")
        now = _utc_naive(self._clock())
        session: Optional[Session] = None
        try:
            session = self._session_factory()
            dialect = session.get_bind().dialect.name
            self._begin_serialized_transaction(session, dialect)
            now = self._database_now(session, dialect, now)
            row = session.get(LLMTokenReservation, reservation_id)
            if row is None or row.settled_at is not None:
                raise InvalidReservationState("Reservation is missing or already settled")
            # Missing/unknown usage remains charged at the conservative estimate.
            row.actual_tokens = row.reserved_tokens if actual_tokens is None else actual_tokens
            row.settled_at = now
            charged = row.actual_tokens
            session.commit()
            return charged
        except InvalidReservationState:
            if session is not None:
                session.rollback()
            raise
        except Exception as exc:
            if session is not None:
                session.rollback()
            raise TokenBudgetUnavailable("Could not safely reconcile token usage") from exc
        finally:
            if session is not None:
                session.close()

    def cleanup_expired(self) -> int:
        """Delete only settled rows whose conservative 60-second charge expired."""
        now = _utc_naive(self._clock())
        session: Optional[Session] = None
        try:
            session = self._session_factory()
            dialect = session.get_bind().dialect.name
            self._begin_serialized_transaction(session, dialect)
            now = self._database_now(session, dialect, now)
            deleted = self._cleanup_expired_in_transaction(session, now - WINDOW)
            session.commit()
            return deleted
        except Exception as exc:
            if session is not None:
                session.rollback()
            raise TokenBudgetUnavailable("Could not safely clean token reservations") from exc
        finally:
            if session is not None:
                session.close()

    @staticmethod
    def _begin_serialized_transaction(session: Session, dialect: str) -> None:
        if dialect == "postgresql":
            # Transaction-scoped lock: released by commit/rollback, never held
            # during the actual provider request.
            session.execute(
                text("SELECT pg_advisory_xact_lock(:lock_key)"),
                {"lock_key": _POSTGRES_ADVISORY_LOCK_KEY},
            )
        elif dialect == "sqlite":
            # SQLite local/test fallback serializes writers at transaction start.
            session.execute(text("BEGIN IMMEDIATE"))
        else:
            raise TokenBudgetUnavailable(f"Unsupported database dialect: {dialect}")

    @staticmethod
    def _database_now(session: Session, dialect: str, fallback: datetime) -> datetime:
        if dialect == "postgresql":
            value = session.execute(text("SELECT CURRENT_TIMESTAMP")).scalar()
            if not isinstance(value, datetime):
                raise TokenBudgetUnavailable("Database did not return its current timestamp")
            return _utc_naive(value)
        return fallback

    @staticmethod
    def _window_usage(session: Session, cutoff: datetime) -> int:
        charged_tokens = case(
            (LLMTokenReservation.actual_tokens.is_(None), LLMTokenReservation.reserved_tokens),
            else_=LLMTokenReservation.actual_tokens,
        )
        total = session.query(func.coalesce(func.sum(charged_tokens), 0)).filter(
            or_(
                LLMTokenReservation.settled_at >= cutoff,
                and_(
                    LLMTokenReservation.settled_at.is_(None),
                    LLMTokenReservation.created_at >= cutoff,
                ),
            )
        ).scalar()
        return int(total or 0)

    @staticmethod
    def _cleanup_expired_in_transaction(session: Session, cutoff: datetime) -> int:
        deleted = session.query(LLMTokenReservation).filter(
            or_(
                and_(
                    LLMTokenReservation.settled_at.is_not(None),
                    LLMTokenReservation.settled_at < cutoff,
                ),
                and_(
                    LLMTokenReservation.settled_at.is_(None),
                    LLMTokenReservation.created_at < cutoff,
                ),
            )
        ).delete(synchronize_session=False)
        return int(deleted)


default_token_budget = TokenBudgetLedger()
