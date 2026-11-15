import unittest
from legal_sources import library_service as ls


class TestLegalLibraryService(unittest.TestCase):
    def test_get_all_acts(self):
        acts = ls.get_all_acts()
        self.assertGreaterEqual(len(acts), 13)
        short_names = {a["short_name"] for a in acts}
        self.assertIn("BNS 2023", short_names)
        self.assertIn("BNSS 2023", short_names)
        self.assertIn("BSA 2023", short_names)
        self.assertIn("IPC 1860", short_names)
        self.assertIn("CrPC 1973", short_names)
        self.assertIn("IEA 1872", short_names)
        self.assertIn("POCSO Act 2012", short_names)
        self.assertIn("NDPS Act 1985", short_names)
        self.assertIn("SC/ST Act 1989", short_names)
        self.assertIn("Juvenile Justice Act 2015", short_names)
        self.assertIn("IT Act 2000", short_names)
        self.assertIn("PMLA 2002", short_names)
        self.assertIn("Arms Act 1959", short_names)

    def test_get_acts_filtered_by_category(self):
        core = ls.get_all_acts(category="core_criminal")
        self.assertEqual(len(core), 6)
        special = ls.get_all_acts(category="special_criminal")
        self.assertEqual(len(special), 7)

    def test_get_act_by_id(self):
        bns = ls.get_act_by_id("bns-2023")
        self.assertIsNotNone(bns)
        self.assertEqual(bns["code"], "BNS")
        self.assertGreater(len(bns["chapters"]), 5)

        bnss = ls.get_act_by_id("bnss")
        self.assertIsNotNone(bnss)
        self.assertEqual(bnss["short_name"], "BNSS 2023")

    def test_get_section_detail_bns_303(self):
        detail = ls.get_section_detail("BNS", "303")
        self.assertIsNotNone(detail)
        self.assertEqual(detail["act_code"], "BNS")
        self.assertEqual(detail["section_number"], "303")
        self.assertTrue(len(detail["bare_act_text"]) > 20)
        self.assertTrue(detail["is_official_gazette"])
        self.assertGreaterEqual(len(detail["ingredients"]), 3)
        self.assertIn("dishonest", detail["ingredients"][0].lower())
        self.assertIn("community service", detail["punishment"].lower())

    def test_get_section_detail_bnss_35(self):
        detail = ls.get_section_detail("BNSS", "35")
        self.assertIsNotNone(detail)
        self.assertEqual(detail["section_number"], "35")
        self.assertIn("Notice of appearance", detail["heading"])
        self.assertTrue(len(detail["case_laws"]) > 0)
        self.assertEqual(detail["case_laws"][0]["case_name"], "Arnesh Kumar v. State of Bihar & Anr.")

    def test_search_legal_library(self):
        results = ls.search_legal_library("theft")
        self.assertTrue(len(results) > 0)
        self.assertTrue(any("303" in r["title"] for r in results))

    def test_law_concordance_mappings(self):
        ipc_bns = ls.get_law_concordance_mappings("IPC")
        self.assertGreater(len(ipc_bns), 50)
        # Check mapping for 302/103 (murder)
        murder_mapping = [m for m in ipc_bns if m["src_sec"] == "302" and m["tgt_sec"] == "103"]
        self.assertEqual(len(murder_mapping), 1)

        crpc_bnss = ls.get_law_concordance_mappings("CRPC")
        self.assertGreater(len(crpc_bnss), 25)

        iea_bsa = ls.get_law_concordance_mappings("IEA")
        self.assertGreater(len(iea_bsa), 5)

    def test_study_center_materials(self):
        daily = ls.get_daily_question()
        self.assertIsNotNone(daily)
        self.assertIn("scenario", daily)
        self.assertEqual(len(daily["options"]), 4)

        jotd = ls.get_judgment_of_the_day()
        self.assertIsNotNone(jotd)
        self.assertIn("SMW (Crl) No. 4/2021", jotd["citation"])

        mcqs = ls.get_study_mcqs()
        self.assertGreaterEqual(len(mcqs), 5)

    def test_simulation_templates(self):
        templates = ls.get_simulation_templates()
        self.assertGreaterEqual(len(templates), 3)
        roles = {t["role"] for t in templates}
        self.assertIn("defense_counsel", roles)


if __name__ == "__main__":
    unittest.main()
