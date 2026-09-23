@echo off
title RetailVision Edge Launcher
color 0A
mode con: cols=68 lines=45

:: ============================================================
::  RetailVision -- One-Click Local Launcher
::  Double-click this file to start the entire project.
::  No IDE required.
:: ============================================================

setlocal EnableDelayedExpansion

set "PROJECT_DIR=C:\Users\vasan\OneDrive\Desktop\rtefinal\retailvision\final_vision"
set "FRONTEND_DIR=%PROJECT_DIR%\frontend"
set "VENV_ACTIVATE=%PROJECT_DIR%\venv\Scripts\activate.bat"
set "BROWSER_URL=http://localhost:5173"
set "API_URL=http://localhost:8000"

cls
echo.
echo  ============================================================
echo    RETAILVISION EDGE  --  One-Click Launcher
echo    EDGE AI  ^|  Shopper Analytics  ^|  YOLO11s + ByteTrack
echo  ============================================================
echo.


:: ── STEP 0: Navigate to project root ─────────────────────────────────
cd /d "%PROJECT_DIR%"
echo  [*] Working directory: %PROJECT_DIR%
echo.


:: ── STEP 1: Check Python venv ─────────────────────────────────────────
echo  [1/5] Checking Python virtual environment...
if not exist "%VENV_ACTIVATE%" (
    echo.
    echo  [!] Virtual environment NOT found. Creating it now...
    python -m venv venv
    if errorlevel 1 (
        echo  [ERROR] Failed to create venv. Is Python installed?
        echo          Download from https://www.python.org/downloads/
        pause
        exit /b 1
    )
    echo  [OK] venv created. Installing Python dependencies...
    call "%VENV_ACTIVATE%"
    pip install -r requirements.txt
    if errorlevel 1 (
        echo  [ERROR] pip install failed. Check requirements.txt
        pause
        exit /b 1
    )
    echo  [OK] Python dependencies installed.
) else (
    echo  [OK] Virtual environment found.
)
echo.


:: ── STEP 2: Check / install Node modules ──────────────────────────────
echo  [2/5] Checking frontend Node.js dependencies...
if not exist "%FRONTEND_DIR%\node_modules" (
    echo  [!] node_modules not found. Running npm install ^(first-run only^)...
    cd /d "%FRONTEND_DIR%"
    call npm install
    if errorlevel 1 (
        echo  [ERROR] npm install failed. Is Node.js installed?
        echo          Download from https://nodejs.org/
        pause
        exit /b 1
    )
    echo  [OK] Frontend dependencies installed.
    cd /d "%PROJECT_DIR%"
) else (
    echo  [OK] node_modules found.
)
echo.


:: ── STEP 3: Kill stale processes on ports 8000 / 5173 ─────────────────
echo  [3/5] Clearing stale processes on ports 8000 and 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo  [OK] Ports cleared.
echo.


:: ── STEP 4: Launch FastAPI backend in its own window ──────────────────
echo  [4/5] Starting FastAPI backend on %API_URL% ...
start "RetailVision API Server" cmd /k "color 0B && title RetailVision API && cd /d "%PROJECT_DIR%" && call "%VENV_ACTIVATE%" && echo. && echo  [API] uvicorn starting on http://127.0.0.1:8000 ... && echo  [API] Press Ctrl+C to stop. && echo. && uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload"
echo  [OK] API window opened (cyan).
echo.

:: Poll until API responds (up to 20s)
echo  Waiting for API to become ready...
set "READY=0"
for /L %%i in (1,1,20) do (
    if "!READY!"=="0" (
        timeout /t 1 /nobreak >nul
        curl -s -o nul -w "%%{http_code}" %API_URL%/docs > "%TEMP%\rv_api_check.txt" 2>nul
        set /p HTTP_CODE=<"%TEMP%\rv_api_check.txt"
        if "!HTTP_CODE!"=="200" (
            set "READY=1"
            echo  [OK] API is live!
        )
    )
)
if "!READY!"=="0" echo  [WARN] API did not respond in 20s -- check the API window.
echo.


:: ── STEP 5: Launch React / Vite frontend in its own window ────────────
echo  [5/5] Starting React frontend on %BROWSER_URL% ...
start "RetailVision Frontend" cmd /k "color 0E && title RetailVision Frontend && cd /d "%FRONTEND_DIR%" && echo. && echo  [Frontend] Vite dev server starting... && echo  [Frontend] Press Ctrl+C to stop. && echo. && npm run dev"
echo  [OK] Frontend window opened (yellow).
echo.

:: Poll until Vite responds (up to 30s)
echo  Waiting for Vite to compile...
set "VREADY=0"
for /L %%j in (1,1,30) do (
    if "!VREADY!"=="0" (
        timeout /t 1 /nobreak >nul
        curl -s -o nul -w "%%{http_code}" %BROWSER_URL% > "%TEMP%\rv_fe_check.txt" 2>nul
        set /p FE_CODE=<"%TEMP%\rv_fe_check.txt"
        if "!FE_CODE!"=="200" (
            set "VREADY=1"
            echo  [OK] Frontend is live!
        )
    )
)
if "!VREADY!"=="0" echo  [WARN] Frontend did not respond in 30s -- check the Frontend window.
echo.


:: ── Open browser automatically ─────────────────────────────────────────
echo  Opening dashboard in your default browser...
start "" "%BROWSER_URL%"
echo  [OK] Browser launched: %BROWSER_URL%
echo.


:: ── Optional: Live camera pipeline ────────────────────────────────────
echo  ============================================================
echo   Dashboard is LIVE at: %BROWSER_URL%
echo   API Docs  :  %API_URL%/docs
echo  ============================================================
echo.
echo  Start the LIVE CAMERA pipeline? (YOLO11s + ByteTrack)
echo.
echo    [Y]  Yes -- opens an OpenCV preview window
echo    [N]  No  -- use Video Upload tab in the dashboard
echo.
set /p CAMERA_CHOICE=  Enter choice (Y/N): 

if /i "%CAMERA_CHOICE%"=="Y" (
    echo.
    echo  [CAMERA] Launching live tracking pipeline...
    start "RetailVision Camera" cmd /k "color 0C && title RetailVision Camera && cd /d "%PROJECT_DIR%" && call "%VENV_ACTIVATE%" && echo. && echo  [Camera] YOLO11s + ByteTrack starting... && echo  [Camera] Press Q in the OpenCV window to stop. && echo. && python main.py"
    echo  [OK] Camera window opened (red).
) else (
    echo  [INFO] Camera skipped. Use the Video Analysis tab.
)
echo.


:: ── Final status ───────────────────────────────────────────────────────
echo.
echo  ============================================================
echo   RetailVision is RUNNING  --  All systems GO!
echo.
echo   Dashboard  :  http://localhost:5173
echo   API Docs   :  http://localhost:8000/docs
echo   API Health :  http://localhost:8000/api/metrics/system-status
echo.
echo   To STOP: Close the API Server and Frontend windows.
echo   This launcher window can now be closed safely.
echo  ============================================================
echo.
pause