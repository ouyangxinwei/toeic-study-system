# TOEIC错题学习系统

一个基于HTML/CSS/JavaScript的TOEIC（托业）错题学习系统，支持15套模拟题的错题整理、复习、搜索和导出功能。

## 功能特点

- ✅ 15套模拟题，每套200题
- ✅ 听力4部分 + 阅读3部分
- ✅ 音频播放（本地文件 + 外部链接）
- ✅ 笔记功能
- ✅ 搜索与筛选
- ✅ 导出功能（CSV + JSON）
- ✅ 数据同步
- ✅ 移动端适配

## 使用方法

1. 访问网站：https://你的用户名.github.io/toeic-study-system/
2. 选择套题
3. 录入错题
4. 添加音频和笔记
5. 搜索、筛选、导出

## 技术栈

- HTML5 + CSS3 + JavaScript (ES6+)
- GitHub Pages 部署
- localStorage 本地存储
- RESTful API 数据同步

## 开发

```bash
# 克隆仓库
git clone https://github.com/你的用户名/toeic-study-system.git

# 本地测试（需要HTTP服务器）
python -m http.server 8000
# 访问 http://localhost:8000