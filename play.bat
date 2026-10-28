@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python 3 is required. Install it from https://www.python.org/ and try again.
  pause
  exit /b 1
)
echo Starting Road Rash local server at http://localhost:8080/
start "Road Rash server" /min cmd /c "python -m http.server 8080 --bind 127.0.0.1 --directory web"
timeout /t 1 /nobreak >nul
start "" "http://localhost:8080/"
echo.
echo The game is open in your browser.
echo Close the minimized "Road Rash server" window to stop the server.
timeout /t 4 /nobreak >nul
endlocal
