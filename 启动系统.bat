@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo =============================================
echo   TOEIC 错题学习系统 - 本地启动
echo =============================================
echo.

where py >nul 2>nul
if %errorlevel%==0 (
    echo 正在启动本地服务器，浏览器将打开 http://127.0.0.1:8000
    start "TOEIC 错题学习系统" http://127.0.0.1:8000/
    py -3 -m http.server 8000 --bind 127.0.0.1
    goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
    echo 正在启动本地服务器，浏览器将打开 http://127.0.0.1:8000
    start "TOEIC 错题学习系统" http://127.0.0.1:8000/
    python -m http.server 8000 --bind 127.0.0.1
    goto :eof
)

echo 未检测到 Python。请安装 Python 3，安装时勾选 Add Python to PATH。
echo 也可以在项目目录中使用 VS Code 的 Live Server 插件启动。
echo.
pause
