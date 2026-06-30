@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "PORT=3088"

if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
if exist "%LocalAppData%\Programs\nodejs\node.exe" set "PATH=%LocalAppData%\Programs\nodejs;%PATH%"
if exist "%AppData%\npm\npx.cmd" set "PATH=%AppData%\npm;%PATH%"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [ОШИБКА] Node.js не найден. Установите: https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\express" (
  echo  Установка зависимостей...
  call npm install
)

echo  Освобождаю порт %PORT%...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>nul

echo.
echo  WayBook — Г1алг1ай библиотека
echo  http://localhost:%PORT%
echo  Админ: http://localhost:%PORT%/admin.html
echo  Пароль: 123456789
echo.
echo  Остановка: Ctrl+C
echo.

node server.js
if errorlevel 1 (
  echo.
  echo  [ОШИБКА] Сервер не запустился.
  pause
  exit /b 1
)
