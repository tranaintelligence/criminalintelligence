import unittest

from llm.chain import (
    _apply_bns_303_bail_rule,
    _compose_custody_answer,
    _estimate_message_tokens,
    _ensure_custody_first_aid,
    _requested_law_record,
    _build_prompt_messages,
    run_analysis_pipeline,
    _ensure_custody_law_candidates,
    _select_relevant_statutes,
)
from legal_sources.registry import get_registry
from unittest.mock import patch
from models.schemas import ApplicableLaw, StructuredAnalysis


def theft_analysis() -> StructuredAnalysis:
    return StructuredAnalysis(
        applicable_laws=[ApplicableLaw(act="BNS", code="BNS", section="303", subsection="2")]
    )


class LegalAnswerRuleTests(unittest.TestCase):
    def test_303_2_is_non_bailable_but_bail_remains_available(self):
        analysis = theft_analysis()
        source = _apply_bns_303_bail_rule(analysis, "FIR says BNS 303(2); value unknown")

        self.assertIn("non-bailable", analysis.bail_status.lower())
        self.assertIn("bail is prohibited", analysis.bail_options.lower())
        self.assertIn("BNSS Section 480", analysis.bail_options)
        self.assertEqual("unverified", source.quote_status)
        self.assertIn("indiacode.nic.in", source.source_url)

    def test_low_value_return_exception_requires_first_conviction(self):
        analysis = theft_analysis()
        _apply_bns_303_bail_rule(
            analysis,
            "The stolen property worth \u20b94,500 was returned to its owner; he has no prior criminal record.",
        )

        self.assertIn("Bailable", analysis.bail_status)
        self.assertIn("first conviction", analysis.bail_status)

    def test_low_value_return_without_first_conviction_facts_does_not_trigger_exception(self):
        analysis = theft_analysis()
        _apply_bns_303_bail_rule(analysis, "The stolen property worth \u20b94,500 was returned.")
        self.assertIn("non-bailable", analysis.bail_status.lower())

    def test_thousand_suffix_is_parsed_before_threshold_check(self):
        analysis = theft_analysis()
        _apply_bns_303_bail_rule(
            analysis,
            "The stolen laptop worth \u20b94.5k was returned; first-time offender.",
        )
        self.assertIn("Bailable", analysis.bail_status)

    def test_low_value_without_return_does_not_trigger_exception(self):
        analysis = theft_analysis()
        _apply_bns_303_bail_rule(
            analysis,
            "Stolen property worth \u20b94,500; no prior criminal record; property not returned.",
        )
        self.assertIn("non-bailable", analysis.bail_status.lower())

    def test_low_value_and_unrelated_property_return_do_not_trigger_exception(self):
        analysis = theft_analysis()
        _apply_bns_303_bail_rule(
            analysis,
            "A \u20b94,500 item was stolen; a different property was returned; first-time offender.",
        )
        self.assertIn("non-bailable", analysis.bail_status.lower())

    def test_reported_case_facts_are_applied_without_changing_classification(self):
        analysis = theft_analysis()
        _apply_bns_303_bail_rule(
            analysis,
            "My 23-year-old brother is a daily-wage worker, has no criminal record, laptop worth \u20b935,000, FIR under BNS 303(2).",
        )
        self.assertIn("Non-bailable", analysis.bail_status)
        self.assertIn("\u20b935,000", analysis.bail_status)
        self.assertIn("no prior criminal record", analysis.bail_options)
        self.assertIn("daily-wage", analysis.bail_options)
        self.assertIn("his age of 23 (he is an adult)", analysis.legal_reasoning)
        self.assertIn("do not change", analysis.legal_reasoning)

    def test_custody_response_fills_rights_and_action_plan(self):
        analysis = StructuredAnalysis()
        _ensure_custody_first_aid(analysis, "My brother was arrested today in Delhi")

        rights = " ".join(analysis.rights)
        self.assertIn("Section 35", rights)
        self.assertIn("Section 47", rights)
        self.assertIn("Section 38", rights)
        self.assertIn("Section 48", rights)
        self.assertIn("24 hours", rights)
        self.assertIn("15100", analysis.legal_aid)
        self.assertIn("1516", analysis.legal_aid)
        self.assertGreaterEqual(len(analysis.next_24_hours), 4)

    def test_custody_answer_attaches_procedural_citations_even_if_model_omits_them(self):
        analysis = StructuredAnalysis()
        _ensure_custody_law_candidates(analysis, "My brother is under arrest", get_registry())
        sections = {(law.code, law.section) for law in analysis.applicable_laws}
        self.assertTrue({("BNSS", section) for section in ("35", "38", "47", "48", "57", "58", "480")}.issubset(sections))

    def test_custody_required_rights_replace_incomplete_model_items(self):
        analysis = StructuredAnalysis(rights=["BNSS Section 48 exists."])
        _ensure_custody_first_aid(analysis, "My brother was arrested")

        rights = " ".join(analysis.rights)
        self.assertIn("full grounds", rights)
        self.assertIn("meet an advocate", rights)
        self.assertIn("place of detention", rights)
        self.assertIn("24 hours", rights)
        self.assertIn("15100", analysis.legal_aid)

    def test_custody_answer_renders_custom_heading_and_removes_fallback(self):
        analysis = StructuredAnalysis(
            general_analysis="I received your message, but couldn't formulate a specific legal analysis.",
        )
        context = (
            "My 23-year-old brother, a daily-wage worker in Delhi, has been arrested for allegedly stealing "
            "a laptop worth \u20b935,000. Police registered an FIR under Section 303(2) BNS. He has no criminal record. "
            "Please explain: 1. Is the offence bailable? 2. Can he get bail? 3. What are his rights after arrest? "
            "4. Can he get free legal aid, and where in Delhi? 5. What should our family do in the next 24 hours?"
        )
        _apply_bns_303_bail_rule(analysis, context)
        _ensure_custody_first_aid(analysis, context)
        _compose_custody_answer(analysis, context)

        self.assertEqual(5, analysis.general_analysis.count("### "))
        self.assertIn("### 1. Is the offence bailable?", analysis.general_analysis)
        self.assertIn("### 2. Can he get bail?", analysis.general_analysis)
        self.assertIn("### 3. What are his rights after arrest?", analysis.general_analysis)
        self.assertIn("### 4. Can he get free legal aid, and where in Delhi?", analysis.general_analysis)
        self.assertIn("### 5. What should our family do in the next 24 hours?", analysis.general_analysis)
        self.assertIn("Non-bailable", analysis.general_analysis)
        self.assertIn("Yes. Non-bailable does not mean bail is prohibited", analysis.general_analysis)
        self.assertIn("BNSS Section 480", analysis.general_analysis)
        self.assertIn("\u20b935,000", analysis.general_analysis)
        self.assertIn("1516", analysis.general_analysis)
        self.assertIn("Section 12(g)", analysis.general_analysis)
        self.assertNotIn("family reports the family reports", analysis.general_analysis.lower())
        self.assertEqual(1, analysis.general_analysis.count("DSLSA 1516"))
        self.assertIn("Case application:", analysis.bail_options)
        self.assertEqual("", analysis.legal_reasoning)
        self.assertEqual("Can he get bail?", analysis.section_headings["bail_options"])
        self.assertNotIn("couldn't formulate", analysis.general_analysis)

    def test_schedule_citation_label_is_well_formed_and_officially_linked(self):
        source = _apply_bns_303_bail_rule(theft_analysis(), "BNS 303(2), laptop value \u20b935,000")
        self.assertEqual("First Schedule, Part I — BNS 303(2)", source.section)
        self.assertNotIn("?", source.section)
        self.assertIn("indiacode.nic.in", source.source_url)

    def test_negated_arrest_does_not_trigger_custody_playbook(self):
        analysis = StructuredAnalysis()
        _ensure_custody_first_aid(analysis, "My brother was not arrested")
        self.assertEqual([], analysis.rights)
        self.assertEqual([], analysis.next_24_hours)

    def test_personal_arrest_facts_survive_unrelated_negation(self):
        analysis = StructuredAnalysis()
        _ensure_custody_first_aid(analysis, "My brother was arrested. He is not in custody anymore.")
        self.assertTrue(analysis.rights)
        self.assertTrue(analysis.next_24_hours)

    def test_custody_questions_get_reviewed_fallback_when_no_provider_is_configured(self):
        query = (
            "My brother was arrested under BNS 303(2); laptop worth 35000 rupees; "
            "no criminal record; daily-wage worker in Delhi. Is it bailable and what should we do?"
        )
        with patch("llm.chain._quick_routes", return_value=[]):
            response = self._run_pipeline(query)

        self.assertEqual("deterministic:custody-provider-fallback", response.model_used)
        self.assertIn("Non-bailable", response.analysis.general_analysis)
        self.assertIn("BNSS Section 480", response.analysis.general_analysis)
        self.assertIn("1516", response.analysis.general_analysis)
        self.assertIn("24 hours", response.analysis.general_analysis)

    @staticmethod
    def _run_pipeline(query):
        import asyncio
        return asyncio.run(run_analysis_pipeline(query=query))

    def test_general_hypothetical_does_not_trigger_emergency_steps(self):
        analysis = StructuredAnalysis()
        _ensure_custody_first_aid(analysis, "Hypothetically, if someone is arrested, what happens?")
        self.assertEqual([], analysis.rights)
        self.assertEqual([], analysis.next_24_hours)

    def test_theft_retrieval_does_not_add_305_without_its_context(self):
        query = "My brother was arrested under BNS 303(2); what should family do in 24 hours?"
        records = _select_relevant_statutes(query, query, get_registry())
        sections = {(record.code, record.section) for record, _, _ in records}
        self.assertIn(("BNS", "303"), sections)
        self.assertNotIn(("BNS", "305"), sections)
        self.assertIn(("BNSS", "480"), sections)

    def test_section_305_is_retrieved_for_stated_dwelling_house_context(self):
        query = "Theft in a dwelling house under BNS 303(2)"
        records = _select_relevant_statutes(query, query, get_registry())
        self.assertIn(("BNS", "305"), {(record.code, record.section) for record, _, _ in records})

    def test_explicit_section_code_is_preserved_and_prompt_fits_tpm_reservation(self):
        query = "My brother was arrested for theft under BNS 303(2), laptop worth 35000 rupees, no prior criminal record. What bail and rights apply?"
        registry = get_registry()
        requested = _requested_law_record(query, registry)
        self.assertEqual("BNS", requested.code)
        statutes = _select_relevant_statutes(query, query, registry)
        messages = _build_prompt_messages(query, None, None, requested, statutes)
        self.assertLess(_estimate_message_tokens(messages) + 1200, 8000)


if __name__ == "__main__":
    unittest.main()
