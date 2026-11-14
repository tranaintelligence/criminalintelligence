import unittest

from llm.legal_intake import extract_legal_references


class LegalIntakeTests(unittest.TestCase):
    def test_extracts_multiple_references_in_source_order(self):
        text = "FIR under BNS 303(2); grounds under BNSS Section 47; IPC 379."
        refs = extract_legal_references(text)
        self.assertEqual(
            [(r.code, r.section, r.subsection) for r in refs],
            [("BNS", "303", "2"), ("BNSS", "47", None), ("IPC", "379", None)],
        )

    def test_section_of_phrasing_and_original_span(self):
        ref, = extract_legal_references("Please review Section 35(3)(a) of BNSS.")
        self.assertEqual((ref.code, ref.section, ref.subsection), ("BNSS", "35", "3(a)"))
        self.assertEqual(ref.original_span, "Section 35(3)(a) of BNSS")
        ref, = extract_legal_references("Section 303(2) of the BNS")
        self.assertEqual((ref.code, ref.section, ref.subsection), ("BNS", "303", "2"))

    def test_accepts_abbreviation_variants_and_preserves_written_form(self):
        refs = extract_legal_references("B.N.S. Sec. 303 ( 2 ); sec 420 of I.P.C.")
        self.assertEqual([(r.code, r.section, r.subsection) for r in refs],
                         [("BNS", "303", "2"), ("IPC", "420", None)])
        self.assertEqual(refs[0].original_span, "B.N.S. Sec. 303 ( 2 )")
        self.assertEqual(refs[1].original_span, "sec 420 of I.P.C")

    def test_distinguishes_bns_and_bnss_even_when_section_numbers_repeat(self):
        refs = extract_legal_references("BNS 303(2), BNSS 303, then BNS Section 35.")
        self.assertEqual([(r.code, r.section, r.subsection) for r in refs],
                         [("BNS", "303", "2"), ("BNSS", "303", None), ("BNS", "35", None)])

    def test_does_not_assign_code_to_bare_sections_or_rewrite_concordance(self):
        refs = extract_legal_references("Section 303(2); old IPC 379; BNS 303(2)")
        self.assertEqual([(r.code, r.section, r.subsection) for r in refs],
                         [("IPC", "379", None), ("BNS", "303", "2")])

    def test_preserves_character_offsets_and_case_spacing(self):
        text = "charge: bNs   sEc. 303 ( 2 )"
        ref, = extract_legal_references(text)
        self.assertEqual(ref.original_span, "bNs   sEc. 303 ( 2 )")
        self.assertEqual(text[slice(*ref.span)], ref.original_span)

    def test_recognizes_bsa_without_confusing_bnss(self):
        refs = extract_legal_references("BSA 12 and BNSS 12")
        self.assertEqual([r.code for r in refs], ["BSA", "BNSS"])


if __name__ == "__main__":
    unittest.main()
