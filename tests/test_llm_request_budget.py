import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from langchain_core.messages import SystemMessage

from llm.chain import _invoke_openai_compatible, _run_quick_provider_pipeline
from models.schemas import StructuredAnalysis


class FakeResponse:
    status_code = 429
    text = "rate limited"

    def json(self):
        return {"error": {"message": "rate limited"}}


class FakeClient:
    def __init__(self, *args, **kwargs):
        self.calls = 0

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, *args, **kwargs):
        self.calls += 1
        return FakeResponse()


class ProviderRequestBudgetTests(unittest.IsolatedAsyncioTestCase):
    async def test_quick_dispatch_reserves_and_reconciles_exactly_one_request(self):
        record = SimpleNamespace(
            provider="groq", id="key-1", model="test-model", mode="quick", secret="test-secret"
        )
        reservation = Mock()
        analysis = StructuredAnalysis(general_analysis="A grounded answer.")
        invoke = AsyncMock(return_value=(analysis, 77))
        with (
            patch("llm.chain._quick_routes", return_value=[record]),
            patch("llm.chain.default_token_budget.reserve", return_value=reservation) as reserve,
            patch("llm.chain._estimate_message_tokens", return_value=123),
            patch("llm.chain._invoke_openai_compatible", invoke),
            patch("llm.chain.record_provider_key_attempt"),
            patch("llm.chain.clear_quick_temporarily_unavailable"),
        ):
            result, _ = await _run_quick_provider_pipeline([SystemMessage(content="json")], None)

        self.assertIsInstance(result, StructuredAnalysis)
        reserve.assert_called_once_with(123, 1200)
        invoke.assert_awaited_once()
        reservation.reconcile.assert_called_once_with(77)

    async def test_openai_compatible_rate_limit_is_not_retried(self):
        record = SimpleNamespace(
            provider="groq",
            base_url="https://provider.example/v1",
            model="test-model",
            secret="test-secret",
        )
        client = FakeClient()
        with patch("llm.chain.httpx.AsyncClient", return_value=client):
            with self.assertRaisesRegex(RuntimeError, "HTTP 429"):
                await _invoke_openai_compatible(
                    record,
                    [SystemMessage(content="Return JSON")],
                    timeout=2,
                )
        self.assertEqual(1, client.calls)


if __name__ == "__main__":
    unittest.main()
