# TOEIC Study System — Set / Part 全仓库盘点报告

**盘点日期：** 2026-11-12  
**仓库：** `ouyangxinwei/toeic-study-system`  
**盘点分支：** `docs/phase2-data-schema-v22.1`  
**依据范围：** 当前分支可读取的代码、配置、JSON、测试和 SQL 文件；并用仓库代码搜索交叉定位。  
**本报告性质：** 只读盘点；没有修改应用代码、删除题库文件、运行 SQL、访问或修改线上 Supabase 数据。

> 本报告用于指导下一阶段重构。搜索索引可能反映默认分支版本，因此关键文件以本次明确指定分支的文件内容为准。本文列出已确认的命中点和高风险关联，不宣称已经完成对运行中云端数据库的审计。

---

## 1. 已确认的目标范围（作为盘点基线）

| 对象 | 新规则 |
|---|---|
| Set 1–5 | 从活动题库移除 |
| Set 6–15 | 保留编号和 Test 结构，题目与材料内容清空 |
| Set 16 | 用最新 Set 6 内容替换，作为开发 / 验收测试数据 |
| Part 1、6、7 | 从所有活动题库、录题、练习和导入导出流程移除 |
| Part 2、3、4、5 | 唯一支持的练习题型 |

这里的“移除”指活动产品和活动数据范围，不代表销毁用户已备份的历史资料。Set 16 应标识为开发测试样本，不得误称为官方真题。

---

## 2. 盘点摘要

已确认存在以下类别的旧范围依赖：

1. HTML 中存在多处 Set 1–16 和 Part 1–7 的静态选项。
2. 应用初始化、偏好恢复和套题切换把 Set 范围固定为 1–16。
3. 题目加载器按 `set01.json` 至 `set16.json` 的命名规则加载，并允许旧 localStorage 数据合并进静态题库。
4. 题目展示代码对 Part 3/4、Part 5、Part 6、Part 7 有独立分组逻辑；Part 6/7 还使用文章左右布局。
5. 搜索和导出会遍历数据中的所有 Part；批量导出会遍历 Set 1–16。
6. 同步模块批量上传 Set 1–16、下载并缓存云端所有 Set/Test 数据；当前同步策略主要是 upsert，不会自动清除云端多余题目。
7. 音频扫描、迁移和本地缓存逻辑遍历 Set 1–16、Test 1–2；音频资源通过题目引用表关联。
8. 配置、数据规范、旧材料转换器和单元测试仍以 Part 1–7、16 套、每 Test 200 题为假设。
9. SQL 文件中存在 Set 1–16、Part 1–7 的 CHECK 约束和旧样本数据；增量 SQL 还涉及音频引用、共享音频和清理任务。
10. 历史文档及 `MIT License.txt` 中还保留旧版 HTML 快照，后者并非真正的许可证正文，属于需单独确认的仓库卫生问题。

**总体判断：** 这是一次跨层重构，不是仅调整页面筛选器。最高风险在同步回流、Set 6 → Set 16 的身份迁移、旧学习记录和音频共享引用。

---

## 3. 代码文件命中清单

### 3.1 页面与入口：必须修改

| 文件 | 已确认的旧范围依赖 | 后续工作 |
|---|---|---|
| `index.html` | 页头写“16套模拟题 / 每份200题”；搜索 Part 筛选包含 1–7；录题表单 Set 选择器包含 1–16；Part 选择器包含 1–7；当前套题选择器包含 1–16；Set 16 仍标为“原创听力100题”；Test 选择器说明每份200题 | 更新页头、Set 列表、Part 列表、Set 16 标识和空题提示；Set 6–15 仍需可选 |
| `js/app.js` | 默认 Set 为 1；读取本地 / 云端偏好时允许 1–16；切换校验 1–16；保存当前 Set/Test 偏好；录题入口从 HTML 获取 Set/Part；分组渲染含 Part 3/4、5、6、7 分支；Part 6/7 走阅读材料布局 | 使用明确的活动 Set ID 列表；默认值改为合理的保留 Set；移除 Part 1/6/7 分支与文章布局；保留 Part 3/4 材料分组 |
| `js/question-manager.js` | 静态 JSON 加载；合并 localStorage 新增题；Supabase 读取按 Set/Test；云端记录覆盖静态题目；删除墓碑；统计和列表渲染；删除/新增/编辑 | 增加范围校验和缓存版本策略；防止旧 Set/Part 缓存重新进入；空题套正常显示；Set 16 测试夹具与用户状态分离 |
| `js/sync-manager.js` | 上传确认文本写“本机16套”；上传循环 1–16、Test 1–2；下载云端全表并为 1–16 建 localStorage 分组；本地行生成可接纳旧 Part ID；冲突键为 set/test/question | 所有上传、下载和同步入口实施白名单；先过滤并报告范围外数据；处理云端旧记录，避免旧缓存回流；Set 16 复制必须有独立迁移步骤 |
| `js/search-engine.js` | 遍历所有加载 Part 并按 Part 筛选 / 分组 | 确保仅查询和展示 Part 2–5；空题时正常显示 |
| `js/export-manager.js` | 导出当前 Set 的全部 Part；JSON 记录 Part ID；批量导出循环 1–16、Test 1–2 | 导出仅含 Part 2–5；批量范围仅 Set 6–16；明确空白 Set 输出行为，避免误导 |
| `js/audio-player.js` | 音频上传从当前题目读取 Set/Test/Part；缺省 Set 回退到 1、Part 回退到 1；上传时写云端题目和音频引用 | 更新缺省值；只允许活动 Set/Part；Set 16 音频引用复制后重新核对 |
| `js/audio-storage-manager.js` | 本地音频扫描循环 Set 1–16 / Test 1–2；音频上传、迁移、清理按 Set/Test/Question 关联 | 扫描和迁移只处理新范围；删除旧数据前核对全局音频引用，不能按 Set/Part 直接删 Storage 对象 |

### 3.2 数据工具与测试：必须修改

| 文件 | 已确认的旧范围依赖 | 后续工作 |
|---|---|---|
| `scripts/validate_question_bank.py` | `EXPECTED_PART_COUNTS` 定义 Part 1–7 的标准题量；要求每 Test 有七个 Part、总计 200 题；ID 正则校验 Set-Part-三位编号；CLI 可指定 Set | 改为 Part 2–5；允许 Set 6–15 空题；Set 16 按真实样本做结构校验，不以 200 题作为无条件硬要求；校验 Set 6–16 白名单 |
| `tests/test_validate_question_bank.py` | fixture 生成 Part 1–7；示例 Set 1；测试用例验证旧七 Part 结构 | 重建为 Set 6–16 / Part 2–5 规则；覆盖空题 Set、范围外数据拒绝、ID 和材料引用 |
| `scripts/convert_legacy_materials.py` | `MATERIAL_PARTS=(3,4,6,7)`；包含 Part 6 文章提取与 Part 7 passages 转换 | 移除 Part 6/7 转换；保留必要的 Part 3/4 transcript 转换；Set 6 → Set 16 复制应独立实现并提供只读预览 |
| `tests/test_convert_legacy_materials.py` | fixture 明确建立 Part 3/4/6/7 材料；测试期望四种材料均转换 | 仅保留 Part 3/4 测试；增加 Part 6/7 被拒绝或被排除的测试 |
| `scripts/__init__.py` | 工具包标记，未发现 Set/Part 业务硬编码 | 仅在工具结构调整时检查 |

---

## 4. 配置与数据文件

### 4.1 配置

**`data/config.json`**

当前内容明确声明：

- `sets.total = 16`
- `questionsPerSet = 400`
- `testsPerSet = 2`
- `questionsPerTest = 200`
- `parts[]` 含 Part 1–7
- Part 1–7 的 questionCount 分别为 6、25、39、30、30、16、54
- 应用描述为 16 套模拟题

后续应改成显式 Set ID 清单（6–16），避免把“11 个活动编号”误当作编号 1–11；Set 6–15 的空题结构与 Set 16 测试样本也应有不同的用途标识。Part 配置只保留 2–5。不要再把固定 200 题写成每个活动 Test 的必需条件。

### 4.2 JSON 题库文件

目录：`data/sets/`

仓库当前按命名规则维护：

- `set01.json` 至 `set05.json`：活动范围将移除。
- `set06.json` 至 `set15.json`：文件/编号保留，Test 层级保留，Part 2–5 置空。
- `set16.json`：目标是最新 Set 6 内容的 Part 2–5 副本。

已直接读取并确认：

- `data/sets/set06.json` 当前文件约 240 KB，Test 1 的数据仍包含 Part 1–7；题目 ID 使用 Set 6 前缀。
- `data/sets/set16.json` 当前文件约 96 KB，文件标题仍为“原创听力100题”；其旧内容不是新的 Set 6 复制版本。
- Set 16 旧历史版本曾以 Part 1–4、100 道原创听力题为主；README / CHANGELOG 也有此说明。
- Set 6 最新数据不能只依据先前上传的错题导出文件复制：该导出文件 200 题 correctAnswer 为空，69 题 options 为空。必须从仓库完整权威 JSON 或已确认的完整来源提取 Part 2–5。

需要在实施前对 Set 6 全部 Test 的 Part 2–5 做答案、选项、材料和音频完整性报告。不能把静态 JSON 中的状态字段当作用户学习状态继续带入 Set 16。

---

## 5. 关键功能链路及其依赖

### 5.1 套题选择 / 偏好记忆

涉及：`index.html`、`js/app.js`、`js/question-manager.js`、Supabase `toeic_user_preferences`。

- 当前偏好存储 selected_set_id / selected_test_id。
- 本地 localStorage 也保存当前 Set/Test。
- 当前读取范围允许 Set 1–16。
- 重构后应允许 Set 6–16；建议默认选择 Set 16（测试样本）或 Set 6（空白练习位），具体默认策略由产品决定。
- 旧账号偏好若仍指向 Set 1–5，应安全回退，不得让应用启动失败。

### 5.2 题目加载与旧缓存合并

涉及：`js/question-manager.js`、localStorage。

当前加载顺序大致是静态 JSON → 本地缓存合并 → Supabase 题目覆盖 → 删除墓碑过滤。

这带来关键风险：即使静态 Set 6–15 已清空，旧 localStorage 仍可能把题目重新合并回来；如果云端还有旧行，Supabase 读取也可能再次填充题目。

必须在加载层实施新范围白名单和缓存版本迁移。不能只清静态 JSON。

建议新缓存命名空间或 schema version：旧缓存保留为备份/迁移来源，但不直接自动合并到新题库。Set 16 不得继承 Set 6 的个人答题状态、笔记、错题次数和收藏。

### 5.3 录题 / 编辑 / 删除

涉及：`index.html` 表单、`js/app.js`、`js/question-manager.js`、`js/audio-player.js`。

- 当前表单允许 Set 1–16、Part 1–7。
- 题目新增根据 Part ID 定位 Part 节点。
- 删除题目可能同时更新 Supabase 题目表、删除墓碑、本地缓存和音频引用。
- 新范围必须在 UI 和业务 API 双重校验；不能仅依靠下拉框限制。
- Set 6–15 空题仍应允许后续录入 Part 2–5。
- Set 16 是否允许直接人工编辑应明确；推荐将其视为可重置测试夹具，避免日常练习改动污染基准样本。

### 5.4 Part 分组和材料展示

涉及：`js/app.js`、`data/config.json`、`DATA_SCHEMA.md`、`scripts/convert_legacy_materials.py`。

当前已确认逻辑：

- Part 3/4：根据共享转录 / 材料关联分组；缺少关联时有每组三题兜底。
- Part 5：每五题一组。
- Part 6：按材料键分组，缺失时按每组四题兜底。
- Part 7：按材料键识别单篇 / 双篇 / 多篇文章，不按题数猜文章边界。
- Part 6/7：文章与问题左右分栏，窄屏上下排列。

重构后：
- 保留 Part 3/4 的 transcript / audio 材料关系和分组。
- 保留 Part 5 每组五题的展示（如仍符合产品交互）。
- 删除 Part 6/7 专属材料转换、文章面板、passages 展示和阅读分栏 CSS。
- 通用材料容器若仍被 Part 3/4 使用，不可整体删除。
- Part 2 的三选项结构应保留，不能把所有 Part 统一强制四选项。

### 5.5 搜索 / 错题 / 统计 / 导出

涉及：`js/search-engine.js`、`js/question-manager.js`、`js/export-manager.js`、`js/app.js`。

- 搜索当前遍历当前 Test 的 parts。
- 错题和状态统计在题目管理模块按当前题目数据计算。
- CSV/JSON 导出按所有 Part 遍历。
- 批量导出遍历 1–16。
- 空题 Set 6–15 必须显示 0 题 / 未录入，不应产生除零、100% 正确率或“已完成”误判。
- 导出 Set 6–16 时仅包含 Part 2–5；Set 1–5 不进入活动批量导出。
- Set 16 应有测试数据标识，避免被误认为正式用户练习成绩或官方标准分。

### 5.6 同步 / 上传 / 下载 / 云端缓存

涉及：`js/sync-manager.js`、`js/question-manager.js`、Supabase `toeic_questions`、localStorage。

当前风险尤其高：

- 上传本地到云端循环 Set 1–16、Test 1–2。
- 下载云端时读取全表，再初始化 1–16 的本地缓存分组。
- 上传用 upsert，不会自动删除云端多余行。
- 旧缓存可能在本地行构建时被并入上传内容。
- 题目范围校验目前主要依赖 UI 和数据结构，未形成统一的活动白名单。

后续必须：
1. 上传前严格只允许 Set 6–16 / Part 2–5。
2. 下载时将范围外云端行隔离并报告，不能写入活动缓存。
3. 设计一次性云端清理 / Set 16 替换迁移；不能期望 upsert 自动删除旧行。
4. 处理 `toeic_question_deletions` 删除墓碑，避免旧墓碑影响新 Set 16 题目。
5. 缓存 schema 版本升级，阻止旧数据静默回流。
6. 任何删除操作先生成数量与主键清单，再由用户确认执行。

### 5.7 音频与 Storage

涉及：`js/audio-player.js`、`js/audio-storage-manager.js`、Supabase 音频相关表和 Bucket。

历史设计包含：
- `toeic_audio_files`：云端音频文件索引。
- `toeic_question_audio`：题目与共享音频的多对多引用。
- `toeic_audio_cleanup_jobs`：异步清理任务。
- `toeic-audio`：Storage Bucket。
- IndexedDB：浏览器音频缓存。

已确认本地音频扫描遍历 Set 1–16、Test 1–2；音频引用会记录 set_id / test_id / question_id。

影响：
- Set 6 的 Part 2–4 音频要在 Set 16 新身份下建立有效引用。
- 不能只改题目 JSON 的 setId / questionId 而不更新云端引用表。
- 删除 Set 1–5 或 Part 1/6/7 的题目记录，不代表可以删除音频对象；音频可能被其他题目共用。
- Storage 对象只应在确认全局引用数为零、且备份覆盖对象后清理。
- 音频扫描、迁移、下载和缓存清理均需新范围过滤。

### 5.8 数据库与 SQL

已确认 SQL 文件命中：

| 文件 | 已确认内容 / 风险 |
|---|---|
| `supabase_init.sql` | `toeic_questions.set_id` CHECK 1–16；`part_id` CHECK 1–7；旧示例数据含 Set 1 / Part 1、Part 2；旧唯一键结构为 set_id + question_id，未包含 test_id |
| `supabase_v16_add_set16.sql` | 扩展 Set ID 到 1–16；偏好 selected_set_id 约束 1–16；写入 Set 16 旧原创 100 题（Part 1–4） |
| `supabase_v20_delete_audio.sql` | 音频引用、共享音频删除与清理策略相关 |
| `supabase_v20_1_audio_edit.sql` | 题目编辑、题目 ID / Set 变更与音频引用关系的 RPC |
| README / 历史 SQL 说明 | 还提及 `toeic_questions`、用户偏好、Storage 和 RLS |

注意：这些是仓库 SQL 文件，不等于线上数据库的完整现状。实施前必须在 Supabase 只读核对当前 schema、实际约束、索引、唯一键、RLS、RPC、记录分布、Storage 对象与引用表。特别是 Test 维度：当前代码使用 `set_id,test_id,question_id` upsert，但旧初始化 SQL 样本显示唯一键曾是 `set_id,question_id`，需核实增量迁移后线上实际约束，不能直接推断。

---

## 6. 文档与历史资料命中

| 文件 | 旧内容 | 后续处理 |
|---|---|---|
| `README.md` | 16 套 / 1–16、Part 1–7、Part 6/7 阅读布局、上传 16 套、200 题等说明 | 更新当前产品说明；历史版本内容可保留并注明历史 |
| `CHANGELOG.md` | V16 Set 16 原创 Part 1–4 100 题；V22 Part 6/7 材料布局 | 保留历史变更记录，不应伪装成新范围；追加新版本变更 |
| `DATA_SCHEMA.md` | 适用 16 套、Part 1–7、200 题、Part 6/7 passages | 按新范围重写规范 |
| `DATA_AUDIT_PHASE2.md` | 旧 16 套与七 Part 盘点基线 | 更新审计基线与迁移目标 |
| `V22.0_验收清单.md` | Set 6 Test 1 200 题，Part 1–7 的题量和材料检查 | 标注为历史检查记录；新增新范围验收清单 |
| `V20_需求与验收说明.md` | 音频删除、共享音频和旧题库行为 | 作为历史技术文档保留，必要时追加范围兼容说明 |
| `MIT License.txt` | 文件实际包含一份旧版 HTML / JavaScript 文档快照，并非标准 MIT License 正文；其中也有 Set / Part 旧选项 | 单独核实文件用途；不要在题库重构中误删或误改许可证 |

历史 CHANGELOG / 历史验收文档不一定要删除旧 Part 记录。建议保留历史事实，但明确它们不再代表当前支持范围。

---

## 7. 数据与当前状态的具体注意事项

### 7.1 Set 6 数据

当前 `data/sets/set06.json` 是完整套题格式，含 Test 1 / Test 2 与 Part 1–7。它是 Set 16 目标数据的来源候选，但在复制前仍需对 Part 2–5 做字段级核验。

先前用户上传的 `set06_test1_wrong_questions_20261112_1720.json` 是错题导出形态，200 题 correctAnswer 全为空、69 题 options 为空。该文件不能直接替代仓库权威 JSON。

### 7.2 Set 16 数据

当前 `data/sets/set16.json` 仍是旧原创听力练习数据，历史说明为 Part 1–4 共 100 题且未附音频。重构后需要完整替换活动内容，不能简单追加 Set 6 题目。

### 7.3 Set 6–15 清空

清空时不能只删 questions：
- 清除 Part 2–5 题目数组；
- 清除属于该 Test 的 materials；
- 重算 questionCount / totalQuestions；
- 保留 Test 1 / Test 2 与 Part 2–5 节点；
- 旧学习记录、旧缓存、云端记录单独处理，不自动与空白静态 JSON 合并。

### 7.4 Set 1–5 移除

需要区分：
- 活动题库文件 / 运行时选择器 / 导入导出；
- Supabase 活动题目行；
- 用户历史答题记录；
- Storage 音频对象；
- 用户备份和 Git 历史。

本次产品决策不意味着所有历史数据都必须物理销毁。优先让其退出活动系统；云端删除按迁移清单和确认执行。

---

## 8. 优先级与建议修改顺序

### P0 — 防止数据回流与身份错乱

1. 定义唯一范围常量：Set ID 6–16，Part ID 2–5。
2. 在加载、保存、上传、下载、导入、导出、音频扫描各入口做业务校验。
3. 对 localStorage 引入新 schema version / namespace；旧缓存不自动合并。
4. 设计 Set 6 → Set 16 的只读复制报告：题数、ID、答案、选项、材料和音频引用。
5. 核实 Set 16 的 ID 重写规则和音频引用表迁移方案。

### P1 — 本地题库与 UI

1. Set 6–15 生成空结构。
2. Set 16 预览并核验复制数据。
3. 修改 HTML 下拉、偏好默认值和 Set 标签。
4. 修改题目分组渲染，只保留 Part 2–5。
5. 修改空题提示、统计、搜索、错题和导出。

### P2 — 校验、材料和测试

1. 更新 config / DATA_SCHEMA / DATA_AUDIT。
2. 更新 validator 和 converter。
3. 重写单元测试 fixture。
4. 保留 Part 3/4 transcript 材料和 Part 5 展示。
5. 移除 Part 6/7 专用阅读布局与材料结构。

### P3 — Supabase 与音频

1. 只读检查线上 schema / constraints / indexes / RLS / RPC。
2. 统计 Set / Part 记录分布和音频引用。
3. 生成云端迁移预览和回滚方案。
4. 迁移 Set 16，清理活动范围外题目行。
5. 验证上传、下载、同步、音频播放与共享音频删除。

---

## 9. 盘点阶段的结论与边界

### 已确认

- `index.html`、`js/app.js`、`js/question-manager.js`、`js/sync-manager.js`、`js/search-engine.js`、`js/export-manager.js`、`js/audio-player.js`、`js/audio-storage-manager.js` 是主要代码修改点。
- `data/config.json`、`data/sets/set01.json` 至 `set16.json` 是本地题库核心数据位置。
- validator、converter 与对应单元测试均以旧七 Part 范围为基础。
- Supabase SQL / 音频索引 / 清理队列是高风险迁移层。
- README、CHANGELOG、DATA_SCHEMA、DATA_AUDIT 和历史验收文档存在旧范围说明。

### 尚未做 / 不应误报

- 没有对 Supabase 线上数据库进行查询或核实。
- 没有读取全部 16 份 JSON 并生成完整题目数量统计；本次重点读取 Set 6 / Set 16 并检索代表性旧文件。
- 没有全量扫描所有 CSS 选择器、所有 Markdown 历史文件、所有 SQL 函数和 RPC 的每一处引用。
- 没有运行单元测试、浏览器验收或 GitHub Actions。
- 没有修改、删除或迁移任何正式数据。
- 没有部署。

因此，这是一份**已定位主要改动面与高风险链路的第一轮全仓库盘点**。在正式编码前，仍应对 CSS、所有 SQL 增量文件和线上 Supabase schema 做最后一次针对性核对。

---

## 10. 下一步

下一步不建议马上清空文件。先根据本文建立逐文件修改任务表，并优先处理 P0：

1. 统一范围常量和导入 / 同步白名单；
2. 缓存隔离；
3. Set 6 → Set 16 复制预览；
4. 然后才是本地 JSON 和 UI 重构。

**本报告提交仅记录调查结果，不代表重构已经实施。**
