import unittest

from llm.chain import (
    _apply_bns_303_bail_rule,
    _ensure_custody_first_aid,
    _select_relevant_statutes,
)
from legal_sources.registry import get_registry
from models.schemas import ApplicableLaw, StructuredAnalysis


def theft_analysis() -> StructuredAnalysis:
    return StructuredAnalysis(
        applicable_laws=[ApplicableLaw(act="BNS", code="BNS", section="303", subsection="2")]
    )


class LegalAnswerRuleTests(unittest.TestCase):
    def test_303_2_defaults_non_bailable_but_bail_remains_available(self):
        analysis = theft_analysis()
        source = _apply_bns_303_bail_rule(analysis, "FIR says BNS 303(2); value unknown")

        self.assertIn("non-bailable", analysis.bail_status.lower())
        self.assertIn("bail is still possible", analysis.bail_status.lower())
        self.assertIn("BNSS 480", analysis.bail_status)
        self.assertEqual("unverified", source.quote_status)
        self.assertIn("ScheduleBNSS.html", source.source_url)

    def test_low_value_return_exception_is_separate(self):
        analysis = theft_analysis()
        _apply_bns_303_bail_rule(
            analysis,
            "The stolen property worth ₹4,500 was returned to its owner.",
        )

        self.assertIn("Bailable", analysis.bail_status)
        self.assertIn("first conviction", analysis.bail_status)

    def test_low_value_without_return_does_not_trigger_exception(self):
        analysis = theft_analysis()
        _apply_bns_303_bail_rule(analysis, "Value was less than 5,000 rupees; not returned")

        self.assertIn("non-bailable", analysis.bail_status.lower())

    def test_low_value_and_unrelated_property_return_do_not_trigger_exception(self):
        analysis = theft_analysis()
        _apply_bns_303_bail_rule(
            analysis,
            "A ₹4,500 item was stolen; a different property was returned.",
        )

        self.assertIn("non-bailable", analysis.bail_status.lower())

    def test_custody_response_fills_rights_and_action_plan(self):
        analysis = StructuredAnalysis()
        _ensure_custody_first_aid(analysis, "My brother was arrested today in Delhi")

        rights = " ".join(analysis.rights)
        self.assertIn("Section 35", rights)
        self.assertIn("Section 38", rights)
        self.assertIn("Section 48", rights)
        self.assertIn("24 hours", rights)
        self.assertIn("15100", rights)
        self.assertGreaterEqual(len(analysis.next_24_hours), 4)

    def test_custody_required_rights_replace_incomplete_model_items(self):
        analysis = StructuredAnalysis(rights=["BNSS Section 48 exists."])
        _ensure_custody_first_aid(analysis, "My brother was arrested")

        rights = " ".join(analysis.rights)
        self.assertIn("full grounds", rights)
        self.assertIn("meet an advocate", rights)
        self.assertIn("place of detention", rights)
        self.assertIn("24 hours", rights)
        self.assertIn("15100", rights)

    def test_negated_arrest_does_not_trigger_custody_playbook(self):
        analysis = StructuredAnalysis()
        _ensure_custody_first_aid(analysis, "My brother was not arrested")

        self.assertEqual([], analysis.rights)
        self.assertEqual([], analysis.next_24_hours)

    def test_personal_arrest_facts_survive_unrelated_negation(self):
        analysis = StructuredAnalysis()
        _ensure_custody_first_aid(
            analysis,
            "My brother was arrested. He is not in custody anymore.",
        )

        self.assertTrue(analysis.rights)
        self.assertTrue(analysis.next_24_hours)

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


if __name__ == "__main__":
    unittest.main()
