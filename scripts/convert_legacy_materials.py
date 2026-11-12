#!/usr/bin/env python3
"""Prepare a safe, reviewable migration of legacy TOEIC shared materials.

Default behavior writes a preview report and a converted JSON copy. It never
modifies the source file. Replacing the source requires a separate --apply
invocation, an explicit confirmation token, and an unchanged source checksum.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import shutil
import sys
import tempfile
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PART3_PREFIX = "【共用对话转录】"
PART4_PREFIX = "【共用演讲/公告转录】"
PART6_PREFIX = "【共用文章】"
MATERIAL_PARTS = (3, 4, 6, 7)


class MigrationError(Exception):
    """Raised when legacy material data cannot be converted safely."""


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def read_json(path: Path) -> tuple[Any, bytes]:
    raw = path.read_bytes()
    return json.loads(raw.decode("utf-8-sig")), raw


def split_note(note: Any, prefix: str) -> tuple[str, str]:
    """Return (material text, remaining note), without discarding annotations."""
    if not isinstance(note, str) or not note.startswith(prefix):
        return "", note if isinstance(note, str) else ""
    body = note[len(prefix):]
    lines = body.splitlines()
    material = lines[0].strip() if lines else ""
    remainder = "\n".join(lines[1:]).strip()
    return material, remainder


def material_group_key(question: dict[str, Any], fallback: str) -> str:
    for field in ("materialId", "passageGroupId", "groupId"):
        value = question.get(field)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return fallback


def _new_material_id(set_id: int, test_id: int, part_id: int, index: int) -> str:
    return f"set{set_id:02d}-t{test_id}-p{part_id}-g{index:02d}"


def _append_material(test: dict[str, Any], material: dict[str, Any]) -> None:
    materials = test.setdefault("materials", [])
    if not isinstance(materials, list):
        raise MigrationError("Test.materials 已存在但不是数组，停止迁移")
    existing = {m.get("materialId") for m in materials if isinstance(m, dict)}
    if material["materialId"] in existing:
        raise MigrationError(f"Material ID 冲突：{material['materialId']}")
    materials.append(material)


def _group_questions(questions: list[dict[str, Any]], key_fn):
    groups: OrderedDict[str, list[dict[str, Any]]] = OrderedDict()
    for index, question in enumerate(questions):
        groups.setdefault(key_fn(question, index), []).append(question)
    return groups


def _convert_transcript_part(
    test: dict[str, Any], set_id: int, test_id: int,
    part: dict[str, Any], part_id: int, prefix: str, material_type: str,
    report: dict[str, Any],
) -> None:
    questions = part.get("questions")
    if not isinstance(questions, list):
        raise MigrationError(f"Part {part_id}.questions 不是数组")
    extracted: list[tuple[dict[str, Any], str, str]] = []
    for question in questions:
        if not isinstance(question, dict):
            raise MigrationError(f"Part {part_id} 存在非对象题目")
        if question.get("materialId"):
            continue
        material_text, remaining_note = split_note(question.get("note"), prefix)
        if material_text:
            extracted.append((question, material_text, remaining_note))

    groups = _group_questions(extracted, lambda item, _i: item[1])
    for index, (transcript, rows) in enumerate(groups.items(), start=1):
        if len(rows) != 3:
            report["warnings"].append(
                f"Part {part_id}: 转录材料组 {index} 关联 {len(rows)} 题（通常为 3 题），请人工核对"
            )
        material_id = _new_material_id(set_id, test_id, part_id, index)
        _append_material(test, {
            "materialId": material_id,
            "partId": part_id,
            "materialType": material_type,
            "title": "",
            "transcript": transcript,
        })
        for question, _text, remaining_note in rows:
            question["materialId"] = material_id
            # The transcript is moved to Material; keep all non-material note text.
            if remaining_note:
                question["note"] = remaining_note
            else:
                question.pop("note", None)
        report["materials"].append({
            "materialId": material_id,
            "partId": part_id,
            "materialType": material_type,
            "questionIds": [row[0].get("questionId") for row in rows],
            "textLength": len(transcript),
        })


def _convert_part6(
    test: dict[str, Any], set_id: int, test_id: int,
    part: dict[str, Any], report: dict[str, Any],
) -> None:
    questions = part.get("questions")
    if not isinstance(questions, list):
        raise MigrationError("Part 6.questions 不是数组")
    buckets: OrderedDict[str, list[tuple[dict[str, Any], str, str]]] = OrderedDict()
    for index, question in enumerate(questions):
        if not isinstance(question, dict):
            raise MigrationError("Part 6 存在非对象题目")
        material_text, remaining_note = split_note(question.get("note"), PART6_PREFIX)
        if not material_text:
            continue
        key = material_group_key(question, f"legacy-part6-group-{index + 1:02d}")
        buckets.setdefault(key, []).append((question, material_text, remaining_note))

    for index, (old_group_id, rows) in enumerate(buckets.items(), start=1):
        texts = {row[1] for row in rows}
        if len(texts) != 1:
            raise MigrationError(
                f"Part 6 材料组 {old_group_id} 的重复正文不一致，拒绝自动合并"
            )
        material_text = next(iter(texts))
        material_id = old_group_id
        if any(q.get("materialId") not in (None, material_id) for q, _, _ in rows):
            raise MigrationError(f"Part 6 材料组 {old_group_id} 存在 materialId 冲突")
        _append_material(test, {
            "materialId": material_id,
            "partId": 6,
            "materialType": "passage",
            "title": "",
            "passages": [{
                "passageId": "passage-01",
                "title": "",
                "content": material_text,
            }],
        })
        for question, _text, remaining_note in rows:
            question["materialId"] = material_id
            if remaining_note:
                question["note"] = remaining_note
            else:
                question.pop("note", None)
        report["materials"].append({
            "materialId": material_id,
            "partId": 6,
            "materialType": "passage",
            "questionIds": [row[0].get("questionId") for row in rows],
            "textLength": len(material_text),
        })


def _normalise_passages(passages: Any, material_id: str) -> list[dict[str, Any]]:
    if not isinstance(passages, list) or not passages:
        raise MigrationError(f"Part 7 材料组 {material_id} 缺少有效 passages 数组")
    converted = []
    for index, passage in enumerate(passages, start=1):
        if not isinstance(passage, dict):
            raise MigrationError(f"Part 7 材料组 {material_id} 的 passage 不是对象")
        item = copy.deepcopy(passage)
        if "content" not in item and isinstance(item.get("text"), str):
            item["content"] = item.pop("text")
        if not isinstance(item.get("content"), str):
            raise MigrationError(f"Part 7 材料组 {material_id} 的 passage 缺少文本")
        item.setdefault("passageId", f"doc{index}")
        converted.append(item)
    return converted


def _convert_part7(
    test: dict[str, Any], part: dict[str, Any], report: dict[str, Any],
) -> None:
    questions = part.get("questions")
    if not isinstance(questions, list):
        raise MigrationError("Part 7.questions 不是数组")
    buckets: OrderedDict[str, list[dict[str, Any]]] = OrderedDict()
    for index, question in enumerate(questions):
        if not isinstance(question, dict):
            raise MigrationError("Part 7 存在非对象题目")
        key = material_group_key(question, f"legacy-part7-group-{index + 1:02d}")
        buckets.setdefault(key, []).append(question)

    for old_group_id, rows in buckets.items():
        passage_sources = [q["passages"] for q in rows if isinstance(q.get("passages"), list)]
        if not passage_sources:
            if any(q.get("materialId") for q in rows):
                # Already converted or a material intentionally has no inline passage.
                continue
            report["warnings"].append(f"Part 7 材料组 {old_group_id} 未找到组首题 passages")
            continue
        normalized = [_normalise_passages(value, old_group_id) for value in passage_sources]
        if any(value != normalized[0] for value in normalized[1:]):
            raise MigrationError(f"Part 7 材料组 {old_group_id} 的 passages 在多道题中不一致")
        material_id = next(
            (q.get("materialId") for q in rows if isinstance(q.get("materialId"), str) and q["materialId"]),
            old_group_id,
        )
        if any(q.get("materialId") not in (None, material_id) for q in rows):
            raise MigrationError(f"Part 7 材料组 {old_group_id} 存在 materialId 冲突")
        _append_material(test, {
            "materialId": material_id,
            "partId": 7,
            "materialType": "document_set",
            "title": "",
            "passages": normalized[0],
        })
        for question in rows:
            question["materialId"] = material_id
            question.pop("passages", None)
        report["materials"].append({
            "materialId": material_id,
            "partId": 7,
            "materialType": "document_set",
            "questionIds": [q.get("questionId") for q in rows],
            "passageCount": len(normalized[0]),
        })


def convert_document(data: Any, set_id: int, test_id: int) -> tuple[dict[str, Any], dict[str, Any]]:
    if not isinstance(data, dict):
        raise MigrationError("JSON 根节点必须是对象")
    if data.get("setId") != set_id:
        raise MigrationError(f"文件 setId={data.get('setId')!r}，与指定 Set {set_id} 不一致")
    result = copy.deepcopy(data)
    tests = result.get("tests")
    if not isinstance(tests, list):
        raise MigrationError("缺少 tests 数组")
    selected = [t for t in tests if isinstance(t, dict) and t.get("testId") == test_id]
    if len(selected) != 1:
        raise MigrationError(f"必须且只能找到一个 Test {test_id}")
    test = selected[0]
    parts = test.get("parts")
    if not isinstance(parts, list):
        raise MigrationError("Test.parts 必须是数组")
    report: dict[str, Any] = {
        "setId": set_id,
        "testId": test_id,
        "materials": [],
        "warnings": [],
        "preservation": {
            "questionIds": "原样保留",
            "questionFields": "除迁移的共享材料 note / passages 外，其余字段原样保留",
            "answerExplanationAudioAndTimestamps": "原样保留",
        },
    }
    part_map = {p.get("partId"): p for p in parts if isinstance(p, dict)}
    if len(part_map) != len([p for p in parts if isinstance(p, dict)]):
        raise MigrationError("Test.parts 存在重复 Part ID")
    for part_id in MATERIAL_PARTS:
        if part_id not in part_map:
            raise MigrationError(f"缺少 Part {part_id}")
    _convert_transcript_part(test, set_id, test_id, part_map[3], 3, PART3_PREFIX, "conversation", report)
    _convert_transcript_part(test, set_id, test_id, part_map[4], 4, PART4_PREFIX, "talk", report)
    _convert_part6(test, set_id, test_id, part_map[6], report)
    _convert_part7(test, part_map[7], report)
    report["materialCount"] = len(report["materials"])
    report["questionCount"] = sum(
        len(p.get("questions", [])) for p in parts if isinstance(p, dict)
    )
    return result, report


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_preview(args: argparse.Namespace, source: Path, output: Path, preview: Path) -> None:
    data, raw = read_json(source)
    converted, report = convert_document(data, args.set_id, args.test_id)
    output_bytes = (json.dumps(converted, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    report.update({
        "source": str(source),
        "sourceSha256": sha256_bytes(raw),
        "output": str(output),
        "outputSha256": sha256_bytes(output_bytes),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceModified": False,
    })
    write_json(output, converted)
    write_json(preview, report)
    print(f"预览报告：{preview}")
    print(f"转换后 JSON：{output}")
    print(f"题目数：{report['questionCount']}；材料数：{report['materialCount']}")
    for item in report["materials"]:
        print(f"  Part {item['partId']} | {item['materialId']} | {len(item['questionIds'])} 题")
    for warning in report["warnings"]:
        print(f"WARN: {warning}")
    print("原始 JSON 未修改。人工检查两个输出文件后，才可执行 --apply。")


def apply_replacement(source: Path, output: Path, preview: Path, backup_dir: Path, token: str) -> None:
    if token != "REPLACE":
        raise MigrationError("替换操作必须显式传入 --confirm-replace REPLACE")
    if not source.is_file() or not output.is_file() or not preview.is_file():
        raise MigrationError("缺少源文件、转换文件或预览报告；请先运行默认预览模式")
    report = json.loads(preview.read_text(encoding="utf-8"))
    source_hash = sha256_bytes(source.read_bytes())
    output_hash = sha256_bytes(output.read_bytes())
    if source_hash != report.get("sourceSha256"):
        raise MigrationError("源 JSON 自生成预览后已变化；请重新生成预览并重新人工检查")
    if output_hash != report.get("outputSha256"):
        raise MigrationError("转换后 JSON 与预览报告不一致；请重新生成预览")
    # Validate the converted JSON before any source-file write.
    json.loads(output.read_text(encoding="utf-8"))
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = backup_dir / f"{source.stem}.{timestamp}.backup.json"
    backup.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, backup)
    fd, temporary_name = tempfile.mkstemp(prefix=f".{source.stem}.", suffix=".tmp", dir=source.parent)
    os.close(fd)
    temporary = Path(temporary_name)
    try:
        shutil.copy2(output, temporary)
        temporary.replace(source)
    finally:
        if temporary.exists():
            temporary.unlink()
    print(f"已替换源 JSON：{source}")
    print(f"原始备份：{backup}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="旧版 TOEIC 共享材料安全转换工具")
    parser.add_argument("--root", type=Path, default=Path.cwd(), help="项目根目录")
    parser.add_argument("--set", dest="set_id", type=int, default=6, help="Set 编号（默认 6）")
    parser.add_argument("--test", dest="test_id", type=int, default=1, choices=(1, 2), help="Test 编号（默认 1）")
    parser.add_argument("--input", type=Path, help="源 JSON 路径")
    parser.add_argument("--output", type=Path, help="转换后 JSON 路径")
    parser.add_argument("--preview", type=Path, help="预览报告 JSON 路径")
    parser.add_argument("--apply", action="store_true", help="将已审阅的转换文件替换源 JSON")
    parser.add_argument("--confirm-replace", default="", help="必须明确填写 REPLACE 才允许替换")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source = (args.input or (args.root / "data" / "sets" / f"set{args.set_id:02d}.json")).resolve()
    output = (args.output or (args.root / "migration_output" / f"set{args.set_id:02d}_test{args.test_id}.converted.json")).resolve()
    preview = (args.preview or (args.root / "migration_output" / f"set{args.set_id:02d}_test{args.test_id}.preview.json")).resolve()
    backup_dir = args.root / "migration_output" / "backups"
    try:
        if args.apply:
            apply_replacement(source, output, preview, backup_dir, args.confirm_replace)
        else:
            if source.resolve() == output.resolve() or source.resolve() == preview.resolve():
                raise MigrationError("输出文件不能与源 JSON 相同")
            build_preview(args, source, output, preview)
        return 0
    except (OSError, UnicodeError, json.JSONDecodeError, MigrationError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
