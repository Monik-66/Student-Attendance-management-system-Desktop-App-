@echo off
setlocal

cd /d "%~dp0"

if not exist "package.json" (
  echo package.json not found. Run this launcher from the project folder.
  pause
  exit /b 1
)

if not exist "node_modules\\electron\\dist\\electron.exe" (
  echo Electron is missing. Please run: npm.cmd install
  pause
  exit /b 1
)

start "" "node_modules\\electron\\dist\\electron.exe" .
exit /b 0
