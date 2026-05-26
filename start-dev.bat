@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%frontend"
set "BACKEND_PYTHON=%BACKEND_DIR%\.venv\Scripts\python.exe"

if not exist "%BACKEND_PYTHON%" (
    set "BACKEND_PYTHON=%ROOT_DIR%\.venv\Scripts\python.exe"
)

if not exist "%BACKEND_DIR%" (
    echo Khong tim thay thu muc backend: "%BACKEND_DIR%"
    exit /b 1
)

if not exist "%FRONTEND_DIR%" (
    echo Khong tim thay thu muc frontend: "%FRONTEND_DIR%"
    exit /b 1
)

if exist "%BACKEND_PYTHON%" (
    start "scanweb-backend" cmd /k "cd /d ""%BACKEND_DIR%"" && ""%BACKEND_PYTHON%"" -m uvicorn app.main:app --reload"
) else (
    start "scanweb-backend" cmd /k "cd /d ""%BACKEND_DIR%"" && py -m uvicorn app.main:app --reload"
)

start "scanweb-frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm run dev"

echo Da mo backend va frontend trong 2 cua so rieng.
endlocal
