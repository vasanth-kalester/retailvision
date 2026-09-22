@echo off
title RetailVision Edge Launcher
color 0A

:: ============================================================
::  RetailVision — One-Click Local Launcher
::  Starts: FastAPI backend + React frontend + opens browser
:: ============================================================

set PROJECT_DIR=C:\Users\vasan\OneDrive\Desktop\rtefinal\retailvision\final_vision
set FRONTEND_DIR=%PROJECT_DIR%\frontend
set VENV_ACTIVATE=%PROJECT_DIR%\venv\Scripts\activate.bat
set BROWSER_URL=http://localhost:5173

echo.
echo  ██████╗ ███████╗████████╗ █████╗ ██╗██╗    ██╗   ██╗██╗███████╗██╗ ██████╗ ███╗   ██╗
echo  ██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██║██║    ██║   ██║██║██╔════╝██║██╔═══██╗████╗  ██║
echo  ██████╔╝█████╗     ██║   ███████║██║██║    ██║   ██║██║███████╗██║██║   ██║██╔██╗ ██║
echo  ██╔══██╗██╔══╝     ██║   ██╔══██║██║██║    ╚██╗ ██╔╝██║╚════██║██║██║   ██║██║╚██╗██║
echo  ██║  ██║███████╗   ██║   ██║  ██║██║███████╗╚████╔╝ ██║███████║██║╚██████╔╝██║ ╚████║
echo  ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝╚══════╝ ╚═══╝  ╚═╝╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝
echo.
echo  EDGE AI  ^|  Shopper Analytics  ^|  YOLO11s + ByteTrack
echo  ────────────────────────────────────────────────────────
echo.

:: ── Check venv exists ──────────────────────────────────────────────────
if not exist "%VENV_ACTIVATE%" (
    echo  [ERROR] Virtual environment not found at:
    echo          %VENV_ACTIVATE%
    echo.
    echo  Please run this first:
    echo    python -m venv venv
    echo    venv\Scripts\activate
    echo    pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

:: ── Check node_modules ─────────────────────────────────────────────────
if not exist "%FRONTEND_DIR%\node_modules" (
    echo  [SETUP] Installing frontend dependencies (first run only)...
    cd /d "%FRONTEND_DIR%"
    call npm install
    echo  [OK] Frontend dependencies installed.
    echo.
)

:: ── Kill any old instances on port 8000 / 5173 ─────────────────────────
echo  [1/4] Clearing old processes on ports 8000 and 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo  [OK] Ports cleared.
echo.

:: ── Start FastAPI Backend ──────────────────────────────────────────────
echo  [2/4] Starting FastAPI backend on http://localhost:8000 ...
start "RetailVision API" cmd /k "cd /d "%PROJECT_DIR%" && call "%VENV_ACTIVATE%" && echo [API] Starting uvicorn... && uvicorn api.main:app --host 127.0.0.1 --port 8000"
echo  [OK] API server window opened.
echo.

:: ── Wait for API to warm up ────────────────────────────────────────────
echo  [3/4] Waiting 5 seconds for API to initialise...
timeout /t 5 /nobreak >nul

:: ── Start React Frontend ───────────────────────────────────────────────
echo  [3/4] Starting React frontend on http://localhost:5173 ...
start "RetailVision Frontend" cmd /k "cd /d "%FRONTEND_DIR%" && echo [Frontend] Starting Vite dev server... && npm run dev"
echo  [OK] Frontend window opened.
echo.

:: ── Wait for frontend to spin up ───────────────────────────────────────
echo  [4/4] Waiting 4 seconds for frontend to compile...
timeout /t 4 /nobreak >nul

:: ── Open browser ───────────────────────────────────────────────────────
echo  [4/4] Opening dashboard in your browser...
start "" "%BROWSER_URL%"
echo  [OK] Browser launched: %BROWSER_URL%
echo.

:: ── Ask about live camera pipeline ─────────────────────────────────────
echo  ════════════════════════════════════════════════════════
echo   Dashboard is now LIVE at: %BROWSER_URL%
echo  ════════════════════════════════════════════════════════
echo.
echo  Do you want to start the LIVE CAMERA pipeline (YOLO11s tracking)?
echo  [Y] Yes — start live camera (opens OpenCV window)
echo  [N] No  — use the dashboard with video upload only
echo.
set /p CAMERA_CHOICE= Enter choice (Y/N): 

if /i "%CAMERA_CHOICE%"=="Y" (
    echo.
    echo  [CAMERA] Starting live tracking pipeline...
    echo  [CAMERA] Press Q in the camera window to stop.
    echo.
    start "RetailVision Camera" cmd /k "cd /d "%PROJECT_DIR%" && call "%VENV_ACTIVATE%" && echo [Camera] Starting YOLO11s live tracking... && python main.py"
    echo  [OK] Camera pipeline window opened.
) else (
    echo  [INFO] Camera pipeline skipped. Use Video Analysis tab in the dashboard.
)

echo.
echo  ════════════════════════════════════════════════════════
echo   RetailVision is running! All systems GO.
echo.
echo   Dashboard  :  http://localhost:5173
echo   API Docs   :  http://localhost:8000/docs
echo.
echo   To STOP: Close the API and Frontend terminal windows.
echo  ════════════════════════════════════════════════════════
echo.
pause
