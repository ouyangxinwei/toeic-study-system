# TOEIC 题库数据结构规范（DATA_SCHEMA）

- 规范版本：1.0
- 对应应用版本：22.1.0
- 状态：第二阶段基线规范（待后续按真实录入情况持续补充）
- 适用范围：16 套模拟题，每套 Test 1 / Test 2
- 当前开发样本：第 6 套 Test 1
- 本文档只定义规范，不代表已经迁移现有 JSON 或 Supabase 数据。

## 1. 设计原则

1. 保留现有文件组织和四层主结构：Set → Test → Part → Question。
2. Test 1 与 Test 2 是独立试卷；题号可以重复，不能跨 Test 覆盖。
3. 题目 ID 沿用现有值，不在本阶段重新编号。
4. 题目与共享材料通过稳定的 `materialId` 关联，不通过题号范围或题目数量猜测文章边界。
5. 固定题库内容与用户个人学习数据在逻辑上分离。
6. JSON 是当前第一阶段的本地数据来源；本规范不要求现在接入 Supabase。
7. 允许旧数据逐步兼容。未经专门迁移和兼容验证，不批量重写现有 JSON。

## 2. 文件与层级

当前文件布局：

```text
data/
  config.json
  sets/
    set01.json
    ...
    set16.json
```

标准层级：

```text
Set
└── tests[]
    ├── Test 1
    │   ├── parts[]
    │   │   └── questions[]
    │   └── materials[]
    └── Test 2
        ├── parts[]
        │   └── questions[]
        └── materials[]
```

每个套题文件只保存该套题的数据。材料只在所属 Test 内唯一，不跨 Test 共用 ID。

## 3. Set / Test / Part

### Set

| 字段 | 类型 | 规则 |
|---|---|---|
| `setId` | integer | 1–16，与文件编号一致 |
| `setName` | string | 显示名称 |
| `tests` | array | 必须包含 Test 1、Test 2 |
| `lastUpdated` | ISO 8601 string | 文件数据最后更新时间 |

### Test

| 字段 | 类型 | 规则 |
|---|---|---|
| `testId` | integer | 1 或 2 |
| `testName` | string | Test 1 / Test 2 |
| `parts` | array | Part 1–7，按顺序 |
| `materials` | array | 该 Test 的共享材料；无材料时为空数组 |

每份完整试卷目标为 200 题。配置中的预期题数与当前实际录入数必须区分：实际数量始终通过遍历各 Part 的 `questions.length` 计算，不得信任陈旧的 `totalQuestions` 或 `questionCount`。

### Part

| 字段 | 类型 | 规则 |
|---|---|---|
| `partId` | integer | 1–7 |
| `partName` | string | Part 英文名称 |
| `partType` | enum | `listening` / `reading` |
| `questions` | array | 本 Part 的题目，按题号顺序 |
| `questionCount` | integer | 缓存/展示字段；以数组实际长度为准 |

TOEIC 标准题量：

| Part | 题数 | 类型 |
|---|---:|---|
| 1 | 6 | Listening |
| 2 | 25 | Listening |
| 3 | 39 | Listening |
| 4 | 30 | Listening |
| 5 | 30 | Reading |
| 6 | 16 | Reading |
| 7 | 54 | Reading |
| 合计 | 200 | |

## 4. Question（题目）

### 规范字段

| 字段 | 类型 | 必需 | 说明 |
|---|---|---|---|
| `questionId` | string | 是 | 保留现有 ID；在同一 Set + Test 内唯一 |
| `title` | string | 是 | 题干；Part 1 可保留当前指令型题干 |
| `options` | object | 是 | 键为 A/B/C/D；Part 2 允许仅 A/B/C |
| `correctAnswer` | string | 是 | A/B/C/D；尚未确认时使用空字符串 |
| `explanation` | string | 否 | 答案解析；暂缺时为空字符串或省略 |
| `materialId` | string/null | 否 | 关联 Test.materials 中的共享材料 |
| `audio` | object | 否 | 题目专属音频；共享音频优先放在 Material |
| `note` | string | 兼容 | 现有字段暂时保留，见第 8 节 |
| `status` | string | 兼容 | 旧数据兼容字段，不作为未来用户学习状态的唯一来源 |
| `createdAt` | ISO 8601 string | 否 | 题目记录创建时间 |
| `updatedAt` | ISO 8601 string | 否 | 题目记录更新时间 |

### Question 示例

```json
{
  "questionId": "6-7-147",
  "title": "What is the purpose of the notice?",
  "options": {
    "A": "To announce a schedule change",
    "B": "To introduce a new service",
    "C": "To explain a billing policy",
    "D": "To request customer feedback"
  },
  "correctAnswer": "B",
  "explanation": "The notice introduces a new service.",
  "materialId": "set06-t1-p7-g01",
  "audio": {
    "type": "none",
    "path": ""
  }
}
```

选项数量由题目所属 Part 决定，不强制所有题目都有四个选项。选项对象的键只允许 A、B、C、D，且不得有空选项文本。

## 5. Material（共享材料）

Part 3 / 4 / 6 / 7 使用独立材料记录。材料放在对应 Test 的 `materials[]`，题目通过 `materialId` 关联。

| 字段 | 类型 | 说明 |
|---|---|---|
| `materialId` | string | 在同一 Set + Test 内唯一 |
| `partId` | integer | 所属 Part |
| `materialType` | enum | `conversation` / `talk` / `passage` / `document_set` |
| `title` | string | 可选标题 |
| `transcript` | string | Part 3 / 4 共享听力转录 |
| `passages` | array | Part 6 / 7 的一篇或多篇文章 |
| `audio` | object | 共享听力音频引用 |
| `assets` | array | 可选的图片或其他材料资源 |

### Passage 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `passageId` | string | 材料组内唯一 |
| `title` | string | 文章/文件标题，可为空 |
| `content` | string | 文章正文 |
| `documentType` | string | 可选，如 email、notice、advertisement、article、chat |

### Material 示例

```json
{
  "materialId": "set06-t1-p7-g01",
  "partId": 7,
  "materialType": "document_set",
  "title": "",
  "passages": [
    {
      "passageId": "doc1",
      "title": "E-mail",
      "documentType": "email",
      "content": "Dear customer, ..."
    },
    {
      "passageId": "doc2",
      "title": "Schedule",
      "documentType": "notice",
      "content": "The updated schedule is ..."
    }
  ],
  "assets": []
}
```

### Part 与材料的对应规则

| Part | 组织方式 | 关联规则 |
|---|---|---|
| 1 | 单题 + 图片 | 图片可作为题目资源；如多题共用则使用 Material |
| 2 | 单题 + 问答音频 | 默认题目级音频 |
| 3 | 一段对话 + 3 题 | 一个 conversation Material 关联该组题目 |
| 4 | 一段独白/短文 + 3 题 | 一个 talk Material 关联该组题目 |
| 5 | 每 5 题一组展示 | 分组仅是展示规则，不强制创建 Material |
| 6 | 一篇文章 + 4 题 | 一个 passage Material 关联 4 题 |
| 7 | 单篇/双篇/多篇材料 + 对应题目 | 一个 document_set Material 关联该组题目 |

Material 的题目关联数量不写死。题数和文章篇数以真实试题为准。

## 6. Audio / Asset 资源引用

音频和图片必须保存为资源引用，不把大段 Base64 文件内容嵌入题目 JSON。

### 音频引用

| 字段 | 类型 | 说明 |
|---|---|---|
| `type` | enum | `none` / `local` / `external` / `cloud` |
| `path` | string | 本地相对路径、外部 URL 或云端 Storage path；无资源时为空 |
| `audioId` | string | 可选，云端共享音频索引 ID |
| `mimeType` | string | 可选，如 audio/mpeg |
| `durationSeconds` | number | 可选，时长秒数 |

规则：
- 单题专属音频放在 Question.audio。
- 多题共用音频放在 Material.audio，避免为每题复制材料本体。
- 云端资源使用稳定 Storage path / audioId，不把临时签名 URL 当作永久数据。
- 迁移到云端时，资源路径可改变，但逻辑资源 ID 与题目/材料关系必须保持。

### 图片及其他资源

资源放在 `assets[]`，字段建议为 `assetId`、`assetType`、`path`、`mimeType`、`altText`。当前阶段不要求所有旧题立刻转换为该格式。

## 7. 用户学习数据（与固定题库分离）

未来的个人数据不得继续作为共享题库内容的一部分：

- 用户笔记、收藏、掌握状态；
- 每次练习/正式测试的开始时间、结束时间、用时和成绩；
- 每题作答选项、是否正确、是否标记；
- 错题次数、复习次数及最后复习时间。

建议逻辑实体：

- `user_question_states`：用户对题目的笔记、收藏、掌握状态。
- `test_attempts`：一次完整测试/练习记录。
- `test_attempt_answers`：一次测试中每道题的作答结果。

每条用户数据至少需要可关联用户、Set、Test 和 Question。一次答题记录还应关联 attempt。具体字段在第三阶段结合实际学习流程确定。

## 8. 旧字段兼容与迁移规则

当前题库已存在历史字段和不同版本的材料表达方式。第二阶段采用“规范先行、兼容读取”，不立即批量改写 JSON。

| 旧字段/形式 | 处理规则 |
|---|---|
| `passageGroupId` / `groupId` / `materialId` | 旧数据读取时可作为分组线索；新数据统一写 `materialId` |
| `passages[]` 放在组内首题 | 旧格式继续可读；未来迁移时提升为 Test.materials[] |
| `passageText` / `articleText` / `readingText` | 作为旧格式材料文本读取；迁移后放入 Material.passages |
| `transcript` / `materialText` | 旧格式共享转录；迁移后放入 Material.transcript |
| `audio` | 保留当前题目级对象；共享音频迁移到 Material.audio |
| `note` | 暂时保留。现有内容可能包含录入来源、ASR 校正说明；未来需与用户个人笔记分开 |
| `status` | 暂时兼容旧值；未来个人掌握/作答状态迁移到用户数据实体 |
| `questionCount` / `totalQuestions` | 仅作缓存或预期数量；实际题数由 questions 数组计算 |

迁移必须满足：
1. 保留原始 `setId`、`testId`、`partId`、`questionId`。
2. 迁移前后题目数量、选项、答案、解析、笔记、音频引用和材料正文一致。
3. 共享材料只保存一份；所有关联题目都能找到对应 Material。
4. 旧 JSON、localStorage、导入/导出、Supabase 同步在切换前都要有兼容方案。
5. 先对第 6 套 Test 1 做迁移演练和人工核对，再考虑其他套题。
6. 任何迁移都先备份；迁移失败不得覆盖原始数据。

## 9. 唯一性与完整性约束

- 题目唯一键：`setId + testId + questionId`。
- 材料唯一键：`setId + testId + materialId`。
- 每道题的 `materialId` 若非空，必须能在同一 Test 的 `materials[]` 中找到。
- 每个 Material 的 `partId` 必须与所关联题目的 Part 一致。
- `correctAnswer` 必须是当前题目 options 中存在的键；答案未录入时允许空字符串。
- Question.options 至少包含 A、B、C；Part 1、3、4、5、6、7 通常包含 A–D，Part 2 使用 A–C。
- 时间字段使用 ISO 8601；推荐 UTC 时间并保留 `Z`。
- Test 1 与 Test 2 的题目、材料、音频关联完全隔离。

## 10. 当前阶段边界

本阶段只完成规范和兼容性盘点：
- 不执行 Supabase 数据库迁移。
- 不改变认证机制、RLS 或 Storage policy。
- 不批量重写 16 套 JSON。
- 不删除现有 `groupId`、`passages`、`note`、`status` 等旧字段。
- 后续如需修改运行时代码，先提供旧结构兼容读取，再逐步让新录入遵循本规范。

## 11. Supabase 映射建议（第三阶段实施依据）

以下为目标映射，不代表当前数据库已具备这些表或字段：

| JSON 实体/字段 | 云端目标实体 | 说明 |
|---|---|---|
| Set / Test / Part | 试卷目录或由题目复合键表达 | 保留 set_id、test_id、part_id |
| Question.questionId | `toeic_questions.question_id` | 与 set_id、test_id 组成唯一键 |
| Question.title | `toeic_questions.title` | 题干 |
| Question.options | `toeic_questions.options` | JSONB |
| Question.correctAnswer | `toeic_questions.correct_answer` | 答案 |
| Question.explanation | `toeic_questions.explanation` | 后续需确认当前表是否有该列 |
| Question.materialId | `toeic_questions.material_id` | 外键指向材料表 |
| Test.materials[] | 建议新增 `toeic_materials` | 保存 transcript、passages、part_id |
| Question.audio / Material.audio | `toeic_audio_files` + `toeic_question_audio` 或材料音频关联 | 继续使用现有音频索引/Storage 设计 |
| 用户笔记/掌握状态 | 建议独立用户状态表 | user_id + set_id + test_id + question_id |
| 测试成绩与逐题作答 | 建议 attempts / attempt_answers | 每次测试独立记录 |

第三阶段开始前，必须重新核对实际 Supabase schema、RLS 和 SQL migration；不得仅凭本表直接执行 ALTER TABLE 或数据迁移。
