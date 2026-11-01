@echo off
setlocal
cd /d "%~dp0"
echo Muse Studio - local preview
echo Open this address in your browser: http://127.0.0.1:8765
echo Keep this window open. Press Ctrl+C to stop.
echo.
py -3 --version >nul 2>&1
if not errorlevel 1 (
  py -3 -m http.server 8765 --bind 127.0.0.1 --directory dist
  goto end
)
python --version >nul 2>&1
if not errorlevel 1 (
  python -m http.server 8765 --bind 127.0.0.1 --directory dist
  goto end
)
echo Python was not found. Install Python or run from the VS Code terminal.
:end
echo.
pause
