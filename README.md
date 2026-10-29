# TOEIC错题学习系统

一个基于HTML/CSS/JavaScript的TOEIC（托业）错题学习系统，支持15套模拟题的错题整理、复习、搜索和导出功能。

## 功能特点

- ✅ 新增题目录入：题号、题干、A/B/C/D四个选项、正确答案、音频链接和笔记
- ✅ 新录入题目自动保存到浏览器 localStorage，并在对应 Part 中显示
- ✅ 题目数据合并时保留已录入题目，避免保存笔记/状态时覆盖新增题目

- ✅ 15套模拟题，每套200题
- ✅ 听力4部分 + 阅读3部分
- ✅ 音频播放（本地文件 + 外部链接）
- ✅ 笔记功能
- ✅ 搜索与筛选
- ✅ 导出功能（CSV + JSON）
- ✅ 数据同步
- ✅ 移动端适配

## 使用方法

### Windows 本地运行（推荐）

1. 将 ZIP 完整解压到一个文件夹。
2. 双击项目根目录中的 `启动系统.bat`。
3. 浏览器打开后，确认网址以 `http://127.0.0.1:8000/` 开头。
4. 点击“录入新题”，填写题干、A/B/C/D 选项及正确答案后保存。
5. 关闭系统时，按 `Ctrl+C` 结束启动系统的黑色命令窗口即可。

> **不要直接双击 `index.html` 打开。** 浏览器会限制 `file://` 页面通过 `fetch()` 读取 `data/config.json` 和 `data/sets/*.json`，从而出现 `NetworkError when attempting to fetch resource`。

如果启动脚本提示未检测到 Python，请安装 Python 3 并勾选 “Add Python to PATH”，或使用 VS Code 的 Live Server 插件。也可在项目根目录执行 `python -m http.server 8000`，然后访问 `http://localhost:8000/`。

### 网页部署

也可以将整个项目目录部署到支持静态文件的 HTTP/HTTPS 网站，例如 GitHub Pages。请确保 `index.html`、`data/`、`js/`、`css/` 都保留原有相对路径。

### 日常使用

1. 选择套题。
2. 录入错题。
3. 添加音频和笔记。
4. 搜索、筛选、导出。

## 技术栈

- HTML5 + CSS3 + JavaScript (ES6+)
- GitHub Pages 部署
- localStorage 本地存储
- RESTful API 数据同步

## 版本更新记录

### V2 - add_question_entry

- 将“录入新题”按钮放在搜索与筛选区域下方，方便直接找到。
- 补全第 1–15 套题的选择项。
- 修复新增题目仅写入 localStorage、却未合并进题目列表的问题。
- 保存状态和笔记时保留已有新增题目数据。
- 增加重复题号检查，并在保存成功后跳转到对应套题。
- 明确说明新增题目保存在当前浏览器；可通过导出 JSON 备份。

## 开发

```bash
# 克隆仓库
git clone https://github.com/你的用户名/toeic-study-system.git

# 本地测试（需要HTTP服务器）
python -m http.server 8000
# 访问 http://localhost:8000

## V3 故障修复说明

- 修复提交新题时，浏览器本地缓存解析异常会连带导致整套题加载失败的问题。
- 题库加载会检查 HTTP 状态和 JSON 数据结构，并给出更明确的错误提示。
- 请通过本地 HTTP 服务器运行项目（例如在项目根目录执行 `python -m http.server 8000`，然后访问 `http://localhost:8000`），不要直接双击 `index.html`。
- 录入内容仍保存在浏览器 `localStorage`；请定期使用“导出JSON”备份。


## V4 - fix_fetch_network_error

- 增加 Windows `启动系统.bat`，自动从项目根目录启动本地 HTTP 服务器并打开浏览器。
- 针对 `file://` 直接打开的情况显示明确提示，避免只看到通用的 NetworkError。
- 针对服务器路径不正确或 fetch 网络失败的情况补充排查提示。
- 本地题库仍通过 HTTP 读取，新增内容仍保存在浏览器 `localStorage`；请定期导出 JSON 备份。


## V5 - Supabase 云端数据库

### 配置步骤
1. 在 Supabase Dashboard 的 SQL Editor 执行项目根目录 `supabase_init.sql`。该脚本会创建 `public.toeic_questions` 表、索引、RLS 策略，并导入现有 JSON 中的示例题。
2. 打开 `js/supabase-client.js`，将 `url` 替换为项目 Project URL，将 `key` 替换为 publishable key（旧项目也可用 anon key）。**不要使用 service_role/secret key。**
3. 通过 HTTP/HTTPS 运行本项目，刷新页面。录入新题会写入 Supabase；打开套题时会读取并合并云端题目。状态和笔记更新也会尝试同步。
4. 浏览器开发者工具 Console 可查看 Supabase 错误详情。确认 Supabase 项目 API 已启用且 `toeic_questions` 表在 `public` schema。

### 安全提醒
当前版本尚未实现用户登录。为了让现有界面可直接使用，SQL 给 `anon` 角色开放了题库读取、插入和更新权限，任何人拿到网站地址及公开 key 都可能修改共享题库。该策略只适合个人测试/可信小范围使用。正式公开部署前应加入 Supabase Auth，并把写入策略限制为 `authenticated` 用户，最好再按用户/角色细分权限。公开 key 可用于浏览器，service_role/secret key 绝不能放进前端。

### 数据说明
SQL 初始数据仅导入项目现有 JSON 文件中实际存在的示例题（当前为少量演示题），不会凭空生成完整 15 套 200 题。重复执行 SQL 会按套题和题号更新现有记录。


## V6 - Supabase 登录验证

1. 更新 `js/supabase-client.js` 中的 Project URL 与 Publishable/anon Key。
2. 在 Supabase Dashboard → Authentication → Users → Add user 中创建用户：Email `oooo@example.com`，Password `683253`。如可选，启用/确认 Email Confirmed。
3. 在 SQL Editor 执行项目根目录 `supabase_auth_v6.sql`。它会建立用户资料表、将 `oooo` 绑定到 Auth 用户，并把题库读写权限限制为已登录用户。**必须先创建 Auth 用户，再执行 SQL 中的绑定语句**；如果整段 SQL 在创建用户前执行，需在创建用户后重新执行其中的 `insert into public.toeic_profiles...` 语句。
4. 通过 `启动系统.bat` 打开页面，使用用户名 `oooo`、密码 `683253` 登录。登录验证由 Supabase Auth 完成，密码不会存入自建资料表。

**安全说明：** Supabase Auth 用户不能通过普通 SQL 安全地创建/设置密码；请在 Dashboard 的 Authentication → Users 中创建用户。当前用户名登录通过 `username@example.com` 映射，因此当前映射用户名为 `oooo`。题库 RLS 策略适用于所有已登录用户（共享题库），并非每个用户独立隔离。


## V7 新题保存排查
- 保存时按钮会显示“正在保存…”。
- 只有 Supabase upsert 成功才提示“已写入 Supabase 云端数据库”。
- 若云端失败，页面仍显示已保存在当前浏览器的题目，并显示 Supabase 返回的错误；请按错误检查 `toeic_questions` 表、authenticated 角色权限及 RLS。
- 浏览器开发者工具（F12 → Console）会记录完整错误。

### V8 题目数量与删除
- 每个 Part 的显示题数以当前加载到的实际题目数组为准。
- 题目卡片的“删除题目”会先弹出确认框；确认后删除本地缓存并尝试删除 Supabase `toeic_questions` 对应记录。请谨慎操作，删除无法撤销。


## V9 题数统计说明

当 Supabase 连接成功时，云端 `toeic_questions` 表是题目数据的唯一来源；程序不会再将旧浏览器缓存中多余的题目合并进题库，以避免题数虚高或已删除题目重新出现。若某套题显示 0，请在 Supabase Table Editor 中按 `set_id` 检查该套题是否确实没有记录。删除题目时会先删除云端记录，成功后才更新本地显示。


## V10 本机/云端数据传输
- **上传本机数据到云**：读取 `data/sets/set01.json` 至 `set15.json`，并合并浏览器 `localStorage` 中各套题数据后上传；相同 `set_id + question_id` 会被更新，不会删除云端多出的题目。
- **下载云端数据到本机**：从 Supabase 分页读取 `toeic_questions` 全表，将每套题写入浏览器 `localStorage`，并下载一份带时间戳的 JSON 备份。浏览器无法直接覆盖项目中的静态 JSON 文件。
- 下载功能会覆盖浏览器内对应套题的缓存，操作前会二次确认。建议重要数据先下载备份。


## V11 启动加载优化
- 首页启动时先分页读取 `toeic_questions` 全表，再按 `set_id` 分组；不再为 15 套题分别发起云端请求。
- 静态 JSON 并行加载，题目卡片统一渲染。
- 如果云端数据超过 1000 行，会自动分页读取。
- 新增/删除题目后会更新或失效内存缓存，避免列表继续显示旧数据。


## V12：只加载当前套题
页面顶部新增“当前显示套题”下拉框。选择第 1–15 套后，页面只加载对应的一套，降低启动等待时间。选择会先保存在浏览器本地，并同步保存到 Supabase 用户偏好表。

首次使用 V12，请在 Supabase SQL Editor 执行项目中的 `supabase_v12_preferences.sql`。该 SQL 只新增 `toeic_user_preferences` 表，不修改现有题库数据。RLS 限制用户只能读写自己的偏好。
