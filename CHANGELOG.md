# 更新日志

## V22.1.0 - 第二阶段数据结构规范初版
- 新增 `DATA_SCHEMA.md`，明确 Set / Test / Part / Question / Material / Audio / Asset 的目标数据结构。
- 确认 16 套题、每套 Test 1 / Test 2、每份试卷 200 题及 Part 1–7 的标准题量。
- 统一新录入材料通过 `materialId` 关联；共享对话、独白和阅读材料规划为 Test 级 `materials[]`。
- 明确固定题库内容与用户个人学习状态、答题记录分离的目标方向。
- 记录旧版 `passageGroupId`、`groupId`、`passages[]`、`passageText`、`articleText`、`transcript` 等字段的兼容策略。
- 增加未来 Supabase 字段映射建议；本版本不执行数据库迁移、不批量改写 JSON、不修改认证和 RLS。
- 本次为文档与版本声明更新，不改变现有运行时题库结构。

## V22.0 - 按 TOEIC 材料分组展示
- Part 3 / 4 按共享对话或独白转录分组，每组展示对应三道题；共享材料在组内只显示一次。
- Part 5 按每组五道题展示。
- Part 6 按每组四道题组织，并预留文章与问题分栏布局。
- Part 7 支持基于 passageGroupId / groupId / materialId 等关联字段分组，文章在左、问题在右；不按固定题数猜测文章边界。
- 桌面端左右分栏，移动端改为上下排列；文章和材料区域可独立滚动。
- 题目卡片增加随时显示 / 隐藏正确答案的快捷入口；不要求提交整组。
- 分组仅作用于展示层，不修改题目 JSON、题号、Test 结构或历史记录。
- 当前以第6套 Test 1 为样本；其 Part 5–7 尚无题目数据，因此对应布局已实现通用接入逻辑，待录入真实材料后再进行实际内容验收。

