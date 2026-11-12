import json
import tempfile
import unittest
from pathlib import Path

from scripts.convert_legacy_materials import (
    MigrationError,
    apply_replacement,
    convert_document,
    sha256_bytes,
    write_json,
)


def question(qid, note="", **extra):
    value = {
        "questionId": qid,
        "title": f"Question {qid}",
        "options": {"A": "A", "B": "B", "C": "C", "D": "D"},
        "correctAnswer": "B",
        "explanation": "Keep this explanation",
        "audio": {"type": "local", "path": ""},
        "note": note,
        "status": "new",
        "createdAt": "2026-01-01T00:00:00Z",
    }
    value.update(extra)
    return value


def fixture():
    parts = []
    for part_id in range(1, 8):
        questions = []
        if part_id == 3:
            for n in range(1, 4):
                questions.append(question(
                    f"6-3-{n:03d}",
                    "【共用对话转录】Shared conversation\n【人工确认】Keep this annotation\n原始音频：source.mp3",
                ))
        elif part_id == 4:
            for n in range(1, 4):
                questions.append(question(
                    f"6-4-{n:03d}",
                    "【共用演讲/公告转录】Shared talk\n问题音频：questions.mp3",
                ))
        elif part_id == 6:
            for n in range(1, 5):
                questions.append(question(
                    f"6-6-{n:03d}",
                    "【共用文章】\nShared article body",
                    materialId="set06-t1-p6-passage-01",
                    passageGroupId="set06-t1-p6-passage-01",
                ))
        elif part_id == 7:
            for n in range(1, 3):
                questions.append(question(
                    f"6-7-{n:03d}",
                    "Source note must remain",
                    materialId="set06-t1-p7-g01",
                    passageGroupId="set06-t1-p7-g01",
                    passages=[{"title": "Email", "text": "Passage body"}] if n == 1 else None,
                ))
                if n > 1:
                    questions[-1].pop("passages")
        parts.append({"partId": part_id, "questions": questions, "questionCount": len(questions)})
    return {"setId": 6, "tests": [{"testId": 1, "parts": parts}, {"testId": 2, "parts": []}]}


class LegacyMaterialConverterTests(unittest.TestCase):
    def test_converts_all_four_material_parts_and_preserves_question_data(self):
        original = fixture()
        converted, report = convert_document(original, 6, 1)
        test = converted["tests"][0]
        materials = test["materials"]
        self.assertEqual(len(materials), 4)
        self.assertEqual(report["materialCount"], 4)
        self.assertEqual(report["questionCount"], 13)

        p3 = test["parts"][2]["questions"]
        self.assertEqual(p3[0]["materialId"], p3[2]["materialId"])
        self.assertEqual(p3[0]["note"], "【人工确认】Keep this annotation\n原始音频：source.mp3")
        self.assertEqual(p3[0]["correctAnswer"], original["tests"][0]["parts"][2]["questions"][0]["correctAnswer"])
        self.assertEqual(p3[0]["explanation"], "Keep this explanation")

        p4 = test["parts"][3]["questions"]
        self.assertEqual(p4[0]["note"], "问题音频：questions.mp3")

        p6 = test["parts"][5]["questions"]
        self.assertEqual(p6[0]["note"], "")
        self.assertEqual(p6[0]["materialId"], "set06-t1-p6-passage-01")
        p6_material = next(m for m in materials if m["partId"] == 6)
        self.assertEqual(p6_material["passages"][0]["content"], "Shared article body")

        p7 = test["parts"][6]["questions"]
        self.assertNotIn("passages", p7[0])
        p7_material = next(m for m in materials if m["partId"] == 7)
        self.assertEqual(p7_material["passages"][0]["content"], "Passage body")
        self.assertEqual(p7[0]["note"], "Source note must remain")
        self.assertEqual(original["tests"][0]["parts"][6]["questions"][0]["passages"][0]["text"], "Passage body")

    def test_rejects_inconsistent_repeated_part6_material(self):
        original = fixture()
        original["tests"][0]["parts"][5]["questions"][1]["note"] = "【共用文章】\nDifferent body"
        with self.assertRaises(MigrationError):
            convert_document(original, 6, 1)

    def test_apply_requires_explicit_confirmation_and_source_checksum(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.json"
            output = root / "converted.json"
            preview = root / "preview.json"
            original = fixture()
            converted, report = convert_document(original, 6, 1)
            source_bytes = (json.dumps(original, ensure_ascii=False, indent=2) + "\n").encode()
            source.write_bytes(source_bytes)
            write_json(output, converted)
            report.update({
                "source": str(source.resolve()),
                "output": str(output.resolve()),
                "sourceSha256": sha256_bytes(source_bytes),
                "outputSha256": sha256_bytes(output.read_bytes()),
            })
            write_json(preview, report)
            with self.assertRaises(MigrationError):
                apply_replacement(source, output, preview, root / "backups", "", 6, 1)
            self.assertEqual(source.read_bytes(), source_bytes)
            apply_replacement(source, output, preview, root / "backups", "REPLACE", 6, 1)
            self.assertEqual(json.loads(source.read_text())["tests"][0]["materials"], converted["tests"][0]["materials"])
            self.assertEqual(len(list((root / "backups").glob("*.backup.json"))), 1)

    def test_stale_source_blocks_replacement(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.json"
            output = root / "converted.json"
            preview = root / "preview.json"
            source.write_text('{"setId":6}', encoding="utf-8")
            output.write_text('{"setId":6}', encoding="utf-8")
            write_json(preview, {"setId": 6, "testId": 1, "source": str(source.resolve()), "output": str(output.resolve()), "sourceSha256": "not-current", "outputSha256": sha256_bytes(output.read_bytes())})
            with self.assertRaises(MigrationError):
                apply_replacement(source, output, preview, root / "backups", "REPLACE", 6, 1)


if __name__ == "__main__":
    unittest.main()
