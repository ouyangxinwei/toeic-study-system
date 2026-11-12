# 第二阶段数据结构兼容性盘点

- 盘点基准：`main` 分支当前数据
- 盘点范围：`data/sets/set01.json` 至 `set16.json`
- 盘点日期：2026-11-12
- 对应规范：`DATA_SCHEMA.md` 1.0
- 性质：只读盘点；没有修改任何题库 JSON。

## 1. 16 套题实际录入情况

统计口径：逐个 Test 遍历 Part 1–7 的 `questions[]`，不使用文件中的声明题数代替实际题数。

| 套题 | Test 1 实际题数 | Test 2 实际题数 | 当前情况 |
|---|---:|---:|---|
| Set 01 | 3 | 0 | Part 1 有 2 题，Part 2 有 1 题 |
| Set 02–05 | 0 | 0 | 空结构 |
| Set 06 | 200 | 0 | 当前完整开发样本 |
| Set 07–15 | 0 | 0 | 空结构 |
| Set 16 | 100 | 0 | Part 1–4 原创听力题 |
| **合计** | **303** | **0** | 其余均为预留结构 |

确认事项：
- 16 个文件均包含 Test 1 和 Test 2。
- 每个 Test 均预留 Part 1–7。
- 当前只有 Set 06 Test 1 达到完整 200 题。
- Set 01 Test 1 的实际数量为 3，不能把其声明题量当作实际题量。
- Set 16 Test 1 目前为 100 题，集中在 Part 1–4。
- 所有 Test 2 当前均为空；空题不应复制 Test 1 内容。

## 2. 现有字段差异

### 基础题目字段

大部分已录入题目使用：
- `questionId`
- `title`
- `options`
- `correctAnswer`
- `audio`
- `note`
- `status`
- `createdAt`
- `updatedAt`

Set 06 Test 1 的 Part 5–7 另外使用 `explanation`。Part 6 / 7 使用 `materialId` 与 `passageGroupId`。

### Part 3 / 4：共享转录

- 当前没有独立的 `materialId`。
- 共享转录以 `note` 中的 `【共用对话转录】` 或 `【共用演讲/公告转录】` 前缀保存。
- 同组多道题的 note 中重复保存共享转录。
- 当前音频字段为题目级 `audio` 对象；样本中路径为空。
- 后续录入应改为一个独立 Material，组内题目统一关联其 `materialId`，共享音频也放在 Material.audio。

### Part 6：共享文章

- 16 道题分为 4 组，每组 4 题。
- 使用 `materialId` 和 `passageGroupId` 标识文章组。
- 文章正文目前嵌在每道题的 `note`（以 `【共用文章】` 开头），因此存在重复。
- 后续迁移时将正文提取到 Test.materials[]，题目只保留 materialId。

### Part 7：共享文章组

- 54 道题分为 15 组，组内题数依次为 2、2、2、2、3、3、3、4、4、4、5、5、5、5、5。
- 使用 `materialId` 和 `passageGroupId` 关联材料组。
- 每组首题保存 `passages[]`；同组其他题目只保留关联 ID。
- 该模式已经接近规范目标，但材料仍嵌套在题目对象中，未来应迁移到 Test.materials[]。

## 3. 当前规范需要保留的兼容规则

1. `note` 是历史混合字段，可能包含来源说明、ASR 校正信息、共享转录或共享文章正文。不能直接当作纯用户笔记，也不能在未解析前删除。
2. `materialId` / `passageGroupId` 已用于 Part 6 / 7。迁移时必须保留其逻辑分组关系；新写入统一使用 `materialId`。
3. Part 3 / 4 需要从 note 前缀识别旧共享材料，但只在迁移工具中做一次明确转换；运行时不得依赖模糊文本猜测材料边界。
4. Part 6 的重复文章正文应在迁移时核对同组一致后提取；若同组正文不一致，列为人工处理，不自动选择覆盖。
5. Part 7 的 `passages[]` 从组首题提取；提取后逐题检查 materialId 指向的材料确实存在。
6. `explanation` 当前在 Set 06 Test 1 Part 5–7 出现；旧题没有该字段时按空值处理。
7. 当前所有文件均没有 Test 级 `materials[]`；它是目标结构，不是现有结构。

## 4. 第二阶段结论

**建议冻结目标结构，暂不重写数据。**

- Set / Test / Part / Question 四层结构可继续保留。
- 在 Test 层新增 `materials[]` 作为未来共享材料的唯一归属位置。
- 新录入的 Part 3 / 4 / 6 / 7 应使用 `materialId`，材料只保存一份。
- 旧 JSON 继续按兼容方式读取；待完成适配器和备份策略后，再单独安排 Set 06 Test 1 的迁移演练。
- 用户笔记、答题状态、测试历史与固定题库内容在云端阶段分离；现有 `note` / `status` 先保留，不做破坏性清理。

## 5. 暂不处理的问题

- 不补录 Set 01、Set 16 或其他套题的缺失题目。
- 不修改 Set 06 的现有题干、答案、解析和材料。
- 不把 Test 1 内容复制到 Test 2。
- 不执行 Supabase SQL、RLS 或 Storage 变更。
- 不更改认证系统。
