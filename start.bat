@echo off
chcp 65001 >nul
title 图库 - 一键启动

echo.
echo  ╔══════════════════════════════════════╗
echo  ║       图库应用 - 一键启动            ║
echo  ╚══════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: ── 检查 venv ──
if not exist "venv\Scripts\python.exe" (
    echo [✗] 未找到虚拟环境，请先创建 venv
    pause
    exit /b 1
)

:: ── 安装后端依赖（静默） ──
echo [1/4] 检查后端依赖...
venv\Scripts\python.exe -c "import flask; import flask_cors; import flask_sqlalchemy; import flask_jwt_extended; import cv2; import PIL; import numpy" 2>nul
if %errorlevel% neq 0 (
    echo [→] 安装后端依赖...
    venv\Scripts\pip.exe install -r backend\requirements.txt -q
)
echo [✓] 后端依赖就绪

:: ── 安装前端依赖（静默） ──
echo [2/4] 检查前端依赖...
if not exist "frontend\node_modules\vue" (
    echo [→] 安装前端依赖...
    cd frontend
    call npm install -q
    cd ..
)
echo [✓] 前端依赖就绪

:: ── 启动后端 ──
echo [3/4] 启动后端 (Flask :5000)...
start "图库-Flask" /min venv\Scripts\python.exe backend\run.py

:: ── 等待后端就绪 ──
echo [→] 等待后端启动...
:wait_backend
timeout /t 1 /nobreak >nul
curl -s http://localhost:5000/api/images >nul 2>nul
if %errorlevel% neq 0 goto wait_backend
echo [✓] 后端已就绪

:: ── 启动前端 ──
echo [4/4] 启动前端 (Vite :5173)...
start "图库-Vue" /min cmd /c "cd /d %~dp0frontend && npx vite --host"

:: ── 等待前端就绪 ──
echo [→] 等待前端启动...
:wait_frontend
timeout /t 1 /nobreak >nul
curl -s http://localhost:5173 >nul 2>nul
if %errorlevel% neq 0 goto wait_frontend

:: ── 打开浏览器 ──
echo [✓] 启动完成，打开浏览器...
start http://localhost:5173

echo.
echo  ╔══════════════════════════════════════╗
echo  ║  后端:  http://localhost:5000       ║
echo  ║  前端:  http://localhost:5173       ║
echo  ║  管理员: admin / admin123           ║
echo  ║  关闭此窗口不会停止服务              ║
echo  ╚══════════════════════════════════════╝
echo.
echo 按任意键退出此窗口（服务继续运行）...
pause >nul



