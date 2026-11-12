#!/usr/bin/env python3
"""Read-only structural validator for the TOEIC question-bank JSON files.

Run from any directory:
    python scripts/validate_question_bank.py
    python scripts/validate_question_bank.py --set 6 --test 1
    python scripts/validate_question_bank.py --set 6 --json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

EXPECTED_PART_COUNTS = {1: 6, 2: 25, 3: 39, 4: 30, 5: 30, 6: 16, 7: 54}
VALID_AUDIO_TYPES = {"none", "local", "external", "cloud"}
QUESTION_ID_RE = re.compile(r"^(\d+)-(\d+)-(\d{3})$")


class BankValidator:
    """Validate structure and references without changing source files."""

    def __init__(self, root: Path):
        self.root = Path(root)
        self.issues: List[Dict[str, str]] = []
        self.summaries: List[Dict[str, Any]] = []

    def issue(self, level: str, code: str, location: str, message: str) -> None:
        self.issues.append({
            "level": level,
            "code": code,
            "location": location,
            "message": message,
        })

    def validate(self, set_ids: List[int], test_ids: Optional[List[int]] = None) -> Dict[str, Any]:
        self.issues = []
        self.summaries = []
        for set_id in set_ids:
            self._validate_set(set_id, test_ids)
        errors = sum(item["level"] == "ERROR" for item in self.issues)
        warnings = sum(item["level"] == "WARN" for item in self.issues)
        return {
            "root": str(self.root),
            "sets_checked": len(set_ids),
            "tests_checked": len(self.summaries),
            "errors": errors,
            "warnings": warnings,
            "summaries": self.summaries,
            "issues": self.issues,
        }

    def _validate_set(self, set_id: int, selected_tests: Optional[List[int]]) -> None:
        path = self.root / "data" / "sets" / f"set{set_id:02d}.json"
        if not path.is_file():
            self.issue("ERROR", "FILE_MISSING", str(path), "题库文件不存在")
            return
        try:
            data = json.loads(path.read_text(encoding="utf-8-sig"))
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            self.issue("ERROR", "JSON_INVALID", str(path), f"无法读取或解析 JSON：{exc}")
            return

        if not isinstance(data, dict):
            self.issue("ERROR", "ROOT_TYPE", str(path), "JSON 根节点必须是对象")
            return

        declared_set_id = data.get("setId")
        if declared_set_id is not None and self._as_int(declared_set_id) != set_id:
            self.issue("ERROR", "SET_ID_MISMATCH", str(path),
                       f"文件编号为 Set {set_id:02d}，内部 setId 却是 {declared_set_id!r}")

        tests = data.get("tests")
        if not isinstance(tests, list):
            self.issue("ERROR", "TESTS_NOT_ARRAY", str(path), "缺少 tests 数组")
            return

        test_ids_seen = set()
        for test in tests:
            if not isinstance(test, dict):
                self.issue("ERROR", "TEST_NOT_OBJECT", str(path), "tests 中存在非对象元素")
                continue
            test_id = self._as_int(test.get("testId"))
            if test_id is None:
                self.issue("ERROR", "TEST_ID_INVALID", str(path), "存在缺少有效 testId 的试卷")
                continue
            if test_id in test_ids_seen:
                self.issue("ERROR", "DUPLICATE_TEST_ID", f"Set {set_id:02d}",
                           f"Test {test_id} 重复")
                continue
            test_ids_seen.add(test_id)
            if selected_tests is not None and test_id not in selected_tests:
                continue
            self._validate_test(set_id, test_id, test, path)

        expected_test_ids = {1, 2}
        missing_tests = expected_test_ids - test_ids_seen
        for missing_id in sorted(missing_tests):
            if selected_tests is None or missing_id in selected_tests:
                self.issue("ERROR", "TEST_MISSING", str(path), f"缺少 Test {missing_id}")

    def _validate_test(self, set_id: int, test_id: int, test: Dict[str, Any], file_path: Path) -> None:
        location = f"Set {set_id:02d} / Test {test_id}"
        parts = test.get("parts")
        if not isinstance(parts, list):
            self.issue("ERROR", "PARTS_NOT_ARRAY", location, "parts 必须是数组")
            return

        part_map: Dict[int, Dict[str, Any]] = {}
        for part in parts:
            if not isinstance(part, dict):
                self.issue("ERROR", "PART_NOT_OBJECT", location, "parts 中存在非对象元素")
                continue
            part_id = self._as_int(part.get("partId"))
            if part_id is None or part_id not in EXPECTED_PART_COUNTS:
                self.issue("ERROR", "PART_ID_INVALID", location,
                           f"发现无效 partId：{part.get('partId')!r}")
                continue
            if part_id in part_map:
                self.issue("ERROR", "DUPLICATE_PART_ID", location, f"Part {part_id} 重复")
                continue
            part_map[part_id] = part

        for part_id in EXPECTED_PART_COUNTS:
            if part_id not in part_map:
                self.issue("ERROR", "PART_MISSING", location, f"缺少 Part {part_id}")

        question_ids = set()
        material_ids: Dict[str, int] = {}
        question_total = 0
        for part_id, part in sorted(part_map.items()):
            part_location = f"{location} / Part {part_id}"
            questions = part.get("questions")
            if not isinstance(questions, list):
                self.issue("ERROR", "QUESTIONS_NOT_ARRAY", part_location, "questions 必须是数组")
                continue

            actual_count = len(questions)
            question_total += actual_count
            expected_count = EXPECTED_PART_COUNTS[part_id]
            if actual_count < expected_count:
                self.issue("WARN", "PART_INCOMPLETE", part_location,
                           f"当前 {actual_count} 题，标准题量为 {expected_count}，尚缺 {expected_count - actual_count} 题")
            elif actual_count > expected_count:
                self.issue("ERROR", "PART_OVERFLOW", part_location,
                           f"当前 {actual_count} 题，超过标准题量 {expected_count}")

            declared_count = part.get("questionCount")
            if declared_count is not None and self._as_int(declared_count) != actual_count:
                self.issue("WARN", "QUESTION_COUNT_STALE", part_location,
                           f"questionCount={declared_count!r}，但 questions 实际为 {actual_count}")

            for index, question in enumerate(questions):
                q_location = f"{part_location} / 第 {index + 1} 项"
                if not isinstance(question, dict):
                    self.issue("ERROR", "QUESTION_NOT_OBJECT", q_location, "题目必须是对象")
                    continue
                question_id = question.get("questionId")
                if not isinstance(question_id, str) or not question_id.strip():
                    self.issue("ERROR", "QUESTION_ID_MISSING", q_location, "缺少 questionId")
                    continue
                if question_id in question_ids:
                    self.issue("ERROR", "QUESTION_ID_DUPLICATE", q_location,
                               f"同一 Test 内题号重复：{question_id}")
                question_ids.add(question_id)

                match = QUESTION_ID_RE.fullmatch(question_id)
                if not match:
                    self.issue("ERROR", "QUESTION_ID_FORMAT", q_location,
                               f"题号 {question_id!r} 不符合 Set-Part-三位序号 格式")
                else:
                    id_set, id_part, _ = map(int, match.groups())
                    if id_set != set_id or id_part != part_id:
                        self.issue("ERROR", "QUESTION_ID_SCOPE", q_location,
                                   f"题号 {question_id} 与当前 Set/Part 不匹配")

                self._validate_question(question, q_location, part_id)

                material_id = question.get("materialId")
                group_id = question.get("passageGroupId")
                if material_id:
                    material_ids[str(material_id)] = part_id
                if material_id and group_id and str(material_id) != str(group_id):
                    self.issue("WARN", "MATERIAL_GROUP_ID_DIFF", q_location,
                               "materialId 与 passageGroupId 不同，请确认是否有意区分")
                if group_id and not material_id:
                    self.issue("WARN", "LEGACY_GROUP_FIELD", q_location,
                               "存在 passageGroupId 但缺少 materialId，属于旧格式")

        actual_total = question_total
        expected_total = 200
        if actual_total < expected_total:
            self.issue("WARN", "TEST_INCOMPLETE", location,
                       f"当前共 {actual_total} 题，标准为 {expected_total} 题，尚缺 {expected_total - actual_total} 题")
        elif actual_total > expected_total:
            self.issue("ERROR", "TEST_OVERFLOW", location,
                       f"当前共 {actual_total} 题，超过标准 {expected_total}")

        declared_total = test.get("totalQuestions")
        if declared_total is not None and self._as_int(declared_total) != actual_total:
            self.issue("WARN", "TOTAL_QUESTIONS_STALE", location,
                       f"totalQuestions={declared_total!r}，实际题数为 {actual_total}")

        self._validate_materials(test, material_ids, location)
        self.summaries.append({
            "set": set_id,
            "test": test_id,
            "question_count": actual_total,
            "expected_question_count": expected_total,
            "complete": actual_total == expected_total
                and all(len((part_map.get(pid) or {}).get("questions", [])) == count
                        for pid, count in EXPECTED_PART_COUNTS.items()),
            "parts": {
                str(pid): len((part_map.get(pid) or {}).get("questions", []))
                if isinstance((part_map.get(pid) or {}).get("questions"), list) else None
                for pid in EXPECTED_PART_COUNTS
            },
        })

    def _validate_question(self, question: Dict[str, Any], location: str, part_id: int) -> None:
        title = question.get("title")
        if not isinstance(title, str) or not title.strip():
            self.issue("ERROR", "QUESTION_TITLE_MISSING", location, "题干 title 为空或不是字符串")

        options = question.get("options")
        if not isinstance(options, dict):
            self.issue("ERROR", "OPTIONS_INVALID", location, "options 必须是对象")
            options = {}
        elif not options:
            self.issue("WARN", "OPTIONS_EMPTY", location, "选项尚未录入")
        else:
            invalid_keys = [key for key in options if key not in {"A", "B", "C", "D"}]
            if invalid_keys:
                self.issue("ERROR", "OPTION_KEY_INVALID", location,
                           f"选项键只能为 A/B/C/D，发现：{invalid_keys}")
            blank_values = [key for key, value in options.items()
                            if not isinstance(value, str) or not value.strip()]
            if blank_values:
                self.issue("ERROR", "OPTION_TEXT_EMPTY", location,
                           f"以下选项文本为空或不是字符串：{blank_values}")
            if part_id == 2 and set(options) not in ({"A", "B", "C"}, {"A", "B", "C", "D"}):
                self.issue("WARN", "PART2_OPTION_SHAPE", location,
                           "Part 2 通常使用 A/B/C，请检查选项数量")
            elif part_id != 2 and set(options) and set(options) != {"A", "B", "C", "D"}:
                self.issue("WARN", "OPTION_SET_INCOMPLETE", location,
                           "当前选项不是完整的 A/B/C/D")

        answer = question.get("correctAnswer")
        if answer is None or answer == "":
            self.issue("WARN", "ANSWER_MISSING", location, "正确答案尚未录入")
        elif not isinstance(answer, str) or answer not in options:
            self.issue("ERROR", "ANSWER_INVALID", location,
                       f"correctAnswer={answer!r} 不存在于当前 options 中")

        audio = question.get("audio")
        if audio is None:
            self.issue("WARN", "AUDIO_MISSING", location, "未设置 audio 字段")
        elif not isinstance(audio, dict):
            self.issue("ERROR", "AUDIO_INVALID", location, "audio 必须是对象")
        else:
            audio_type = audio.get("type")
            if audio_type not in VALID_AUDIO_TYPES:
                self.issue("ERROR", "AUDIO_TYPE_INVALID", location,
                           f"不支持的 audio.type：{audio_type!r}")
            audio_path = audio.get("path")
            if audio_path is not None and not isinstance(audio_path, str):
                self.issue("ERROR", "AUDIO_PATH_INVALID", location, "audio.path 必须是字符串")
            elif audio_type in {"local", "external", "cloud"} and not audio_path:
                self.issue("WARN", "AUDIO_PATH_EMPTY", location,
                           f"audio.type={audio_type}，但 path 为空")

        for field in ("note", "explanation"):
            value = question.get(field)
            if value is not None and not isinstance(value, str):
                self.issue("WARN", "TEXT_FIELD_TYPE", location,
                           f"{field} 字段建议使用字符串")

        passages = question.get("passages")
        if passages is not None and not isinstance(passages, list):
            self.issue("ERROR", "PASSAGES_INVALID", location, "passages 必须是数组")

    def _validate_materials(self, test: Dict[str, Any], question_materials: Dict[str, int],
                            location: str) -> None:
        materials = test.get("materials")
        if materials is None:
            if question_materials:
                self.issue("WARN", "LEGACY_MATERIAL_LAYOUT", location,
                           f"发现 {len(question_materials)} 个 materialId，但 Test.materials[] 尚未建立；当前按旧格式兼容")
            return
        if not isinstance(materials, list):
            self.issue("ERROR", "MATERIALS_NOT_ARRAY", location, "materials 必须是数组")
            return

        known = set()
        material_parts: Dict[str, int] = {}
        for index, material in enumerate(materials):
            item_location = f"{location} / Material[{index}]"
            if not isinstance(material, dict):
                self.issue("ERROR", "MATERIAL_NOT_OBJECT", item_location, "材料必须是对象")
                continue
            material_id = material.get("materialId")
            if not isinstance(material_id, str) or not material_id.strip():
                self.issue("ERROR", "MATERIAL_ID_MISSING", item_location, "缺少 materialId")
                continue
            if material_id in known:
                self.issue("ERROR", "MATERIAL_ID_DUPLICATE", item_location,
                           f"materialId 重复：{material_id}")
            known.add(material_id)
            part_id = self._as_int(material.get("partId"))
            if part_id is not None:
                material_parts[material_id] = part_id
            passages = material.get("passages")
            if passages is not None and not isinstance(passages, list):
                self.issue("ERROR", "MATERIAL_PASSAGES_INVALID", item_location,
                           "materials[].passages 必须是数组")

        for material_id, question_part_id in question_materials.items():
            if material_id not in known:
                self.issue("ERROR", "MATERIAL_REFERENCE_MISSING", location,
                           f"题目引用的 materialId {material_id!r} 不存在于 Test.materials[]")
            elif material_id in material_parts and material_parts[material_id] != question_part_id:
                self.issue("ERROR", "MATERIAL_PART_MISMATCH", location,
                           f"材料 {material_id!r} 的 partId 与引用题目所属 Part 不一致")

    @staticmethod
    def _as_int(value: Any) -> Optional[int]:
        try:
            if isinstance(value, bool):
                return None
            return int(value)
        except (TypeError, ValueError):
            return None


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="只读检查 TOEIC 题库 JSON 结构；不会修改任何数据文件。"
    )
    parser.add_argument("--set", dest="sets", type=int, action="append",
                        help="只检查指定套题，可重复使用，例如 --set 6 --set 16；默认检查 1–16")
    parser.add_argument("--test", dest="tests", type=int, choices=(1, 2), action="append",
                        help="只检查 Test 1 或 Test 2；默认检查两份")
    parser.add_argument("--root", type=Path, default=None,
                        help="项目根目录；默认自动识别脚本所在仓库")
    parser.add_argument("--json", action="store_true",
                        help="输出 JSON 格式报告，便于后续自动化处理")
    parser.add_argument("--fail-on-warning", action="store_true",
                        help="存在 WARN 时也返回非零退出码")
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    if args.sets and any(set_id < 1 or set_id > 16 for set_id in args.sets):
        print("错误：--set 只允许 1–16。", file=sys.stderr)
        return 2

    root = args.root.resolve() if args.root else Path(__file__).resolve().parents[1]
    set_ids = sorted(set(args.sets or range(1, 17)))
    test_ids = sorted(set(args.tests)) if args.tests else None
    report = BankValidator(root).validate(set_ids, test_ids)

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print("TOEIC JSON 结构检查（只读）")
        print(f"项目目录：{report['root']}")
        print(f"检查套题：{', '.join(f'Set {n:02d}' for n in set_ids)}")
        print(f"检查试卷：{', '.join(f'Test {n}' for n in (test_ids or [1, 2]))}")
        print("\n实际题数：")
        for item in report["summaries"]:
            state = "完整" if item["complete"] else "未完成"
            print(f"  Set {item['set']:02d} Test {item['test']}: "
                  f"{item['question_count']}/200（{state}）")
        print(f"\n检查结果：{report['errors']} 个错误，{report['warnings']} 个警告")
        for item in report["issues"]:
            print(f"[{item['level']}] {item['code']} | {item['location']} | {item['message']}")
        if not report["issues"]:
            print("未发现结构问题。")

    if report["errors"] > 0:
        return 1
    if args.fail_on_warning and report["warnings"] > 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
