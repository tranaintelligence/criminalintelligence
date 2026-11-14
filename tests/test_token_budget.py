import os
import tempfile
import unittest
from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from llm.token_budget import (
    InvalidReservationState,
    TokenBudgetExceeded,
    TokenBudgetLedger,
    TokenBudgetUnavailable,
    conservative_token_estimate,
)
from models.db_models import LLMTokenReservation


class MutableClock:
    def __init__(self):
        self.value = datetime(2026, 1, 1, 12, 0, 0)

    def __call__(self):
        return self.value


class TokenBudgetTests(unittest.TestCase):
    def setUp(self):
        handle, self.db_path = tempfile.mkstemp(suffix=".sqlite3")
        os.close(handle)
        self.engine = create_engine(f"sqlite:///{self.db_path}", connect_args={"timeout": 5})
        Base.metadata.create_all(self.engine, tables=[LLMTokenReservation.__table__])
        self.sessions = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.clock = MutableClock()
        self.ledger = TokenBudgetLedger(self.sessions, limit=8_000, clock=self.clock)

    def tearDown(self):
        self.engine.dispose()
        os.remove(self.db_path)

    def test_estimate_is_prompt_plus_output(self):
        self.assertEqual(conservative_token_estimate(1_200, 900), 2_100)
        with self.assertRaises(ValueError):
            conservative_token_estimate(-1, 2)

    def test_admission_enforces_shared_rolling_ceiling(self):
        reservation = self.ledger.reserve(5_000, 2_000)
        with self.assertRaises(TokenBudgetExceeded):
            self.ledger.reserve(500, 501)

        reservation.reconcile(4_000)
        next_reservation = self.ledger.reserve(3_000, 1_000)
        self.assertEqual(next_reservation.reserved_tokens, 4_000)

    def test_unknown_usage_keeps_full_estimate_for_full_window(self):
        reservation = self.ledger.reserve(2_000, 1_000)
        self.assertEqual(reservation.mark_unknown(), 3_000)

        with self.assertRaises(TokenBudgetExceeded):
            self.ledger.reserve(4_500, 1_000)

        self.clock.value += timedelta(seconds=61)
        self.assertEqual(self.ledger.cleanup_expired(), 1)
        later = self.ledger.reserve(4_500, 1_000)
        self.assertEqual(later.reserved_tokens, 5_500)

    def test_missing_provider_usage_retains_estimate_and_cleans_only_after_window(self):
        reservation = self.ledger.reserve(1_000, 500)
        self.assertEqual(reservation.reconcile_usage(None, 300), 1_500)

        self.clock.value += timedelta(seconds=59)
        self.assertEqual(self.ledger.cleanup_expired(), 0)
        self.clock.value += timedelta(seconds=2)
        self.assertEqual(self.ledger.cleanup_expired(), 1)

    def test_crashed_worker_reservation_expires_after_full_window(self):
        self.ledger.reserve(7_000, 500)
        self.clock.value += timedelta(seconds=59)
        self.assertEqual(self.ledger.cleanup_expired(), 0)
        with self.assertRaises(TokenBudgetExceeded):
            self.ledger.reserve(400, 200)

        self.clock.value += timedelta(seconds=2)
        self.assertEqual(self.ledger.cleanup_expired(), 1)
        replacement = self.ledger.reserve(400, 200)
        self.assertEqual(replacement.reserved_tokens, 600)

    def test_settlement_is_one_time(self):
        reservation = self.ledger.reserve(100, 100)
        reservation.reconcile(150)
        with self.assertRaises(InvalidReservationState):
            reservation.reconcile(150)

    def test_database_errors_fail_closed(self):
        def unavailable_session():
            raise OSError("database unavailable")

        ledger = TokenBudgetLedger(unavailable_session, limit=8_000, clock=self.clock)
        with self.assertRaises(TokenBudgetUnavailable):
            ledger.reserve(100, 100)


if __name__ == "__main__":
    unittest.main()
