@echo off
REM Restore working codebase from backup
REM Usage: restore-working.bat

set BACKUP_DIR=%~dp0.backup\working-2026-04-13
set TARGET_DIR=%~dp0

if not exist "%BACKUP_DIR%" (
    echo ERROR: Backup directory not found: %BACKUP_DIR%
    echo.
    echo Available backups:
    dir /b %~dp0.backup 2>nul
    pause
    exit /b 1
)

echo ============================================
echo  VIVIM POC — Restore Working Codebase
echo ============================================
echo.
echo Restoring from: %BACKUP_DIR%
echo.

copy /Y "%BACKUP_DIR%\inject-web.js" "%TARGET_DIR%\inject-web.js"
copy /Y "%BACKUP_DIR%\content.js" "%TARGET_DIR%\content.js"
copy /Y "%BACKUP_DIR%\background.js" "%TARGET_DIR%\background.js"
copy /Y "%BACKUP_DIR%\sidepanel.js" "%TARGET_DIR%\sidepanel.js"
copy /Y "%BACKUP_DIR%\manifest.json" "%TARGET_DIR%\manifest.json"
copy /Y "%BACKUP_DIR%\sidepanel.html" "%TARGET_DIR%\sidepanel.html"

echo.
echo ============================================
echo  Restore complete!
echo ============================================
echo.
echo Files restored:
echo   - inject-web.js  (SSE delta parser)
echo   - content.js     (Message bridge)
echo   - background.js  (Message router)
echo   - sidepanel.js   (UI)
echo   - manifest.json  (Extension config)
echo   - sidepanel.html (Side panel HTML)
echo.
echo To restore via git instead, run:
echo   git checkout working-chatgpt-streaming-2026-04-13 -- .
echo.
pause
