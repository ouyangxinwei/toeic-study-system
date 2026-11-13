import json
import tempfile
import unittest
from pathlib import Path

from scripts.validate_question_bank import BankValidator


def sample_set():
    tests = []
    for test_id in (1, 2):
        parts = []
        for part_id, count in {1: 6, 2: 25, 3: 39, 4: 30, 5: 30, 6: 16, 7: 54}.items():
            questions = []
            if test_id == 1 and part_id == 1:
                questions = [{
                    "questionId": "1-1-001",
                    "title": "What can be seen?",
                    "options": {"A": "A", "B": "B", "C": "C", "D": "D"},
                    "correctAnswer": "B",
                    "audio": {"type": "none"}
                }]
            parts.append({
                "partId": part_id,
                "questionCount": len(questions),
                "questions": questions
            })
        tests.append({"testId": test_id, "totalQuestions": 1 if test_id == 1 else 0, "parts": parts})
    return {"setId": 1, "tests": tests}


class BankValidatorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "data" / "sets").mkdir(parents=True)
        self.path = self.root / "data" / "sets" / "set01.json"
        self.data = sample_set()
        self._write()

    def tearDown(self):
        self.temp.cleanup()

    def _write(self):
        self.path.write_text(json.dumps(self.data), encoding="utf-8")

    def test_valid_structure_has_no_errors(self):
        report = BankValidator(self.root).validate([1])
        self.assertEqual(report["errors"], 0)
        self.assertEqual(report["tests_checked"], 2)

    def test_duplicate_question_id_is_error(self):
        q = self.data["tests"][0]["parts"][0]["questions"][0]
        self.data["tests"][0]["parts"][1]["questions"] = [dict(q, questionId="1-1-001")]
        self._write()
        report = BankValidator(self.root).validate([1], [1])
        self.assertIn("QUESTION_ID_DUPLICATE", {item["code"] for item in report["issues"]})

    def test_missing_material_reference_is_error_when_material_registry_exists(self):
        test = self.data["tests"][0]
        test["materials"] = []
        q = test["parts"][0]["questions"][0]
        q["materialId"] = "missing-material"
        self._write()
        report = BankValidator(self.root).validate([1], [1])
        self.assertIn("MATERIAL_REFERENCE_MISSING", {item["code"] for item in report["issues"]})


    def test_unknown_test_id_is_error(self):
        self.data["tests"].append({"testId": 3, "parts": []})
        self._write()
        report = BankValidator(self.root).validate([1])
        self.assertIn("TEST_ID_INVALID", {item["code"] for item in report["issues"]})

    def test_empty_answer_is_warning_not_error(self):
        q = self.data["tests"][0]["parts"][0]["questions"][0]
        q["correctAnswer"] = ""
        self._write()
        report = BankValidator(self.root).validate([1], [1])
        self.assertEqual(report["errors"], 0)
        self.assertIn("ANSWER_MISSING", {item["code"] for item in report["issues"]})


if __name__ == "__main__":
    unittest.main()
