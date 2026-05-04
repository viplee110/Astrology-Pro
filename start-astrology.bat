@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "ROOT=%~dp0"
set "PORT=4173"
set "APP_URL=http://localhost:%PORT%"
cd /d "%ROOT%"

set "NODE_EXE="
if exist "%ROOT%node.exe" set "NODE_EXE=%ROOT%node.exe"
if not defined NODE_EXE if exist "%ROOT%node\node.exe" set "NODE_EXE=%ROOT%node\node.exe"
if not defined NODE_EXE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined NODE_EXE for %%N in (node.exe) do if not "%%~$PATH:N"=="" set "NODE_EXE=%%~$PATH:N"

if not defined NODE_EXE (
  echo 未找到 Node.js，无法启动本地服务器。
  echo.
  choice /C YN /M "是否现在安装 Node.js LTS？这需要联网，并可能弹出系统授权提示"
  if errorlevel 2 (
    echo.
    echo 已取消安装。你也可以稍后手动安装 Node.js:
    echo https://nodejs.org/
    start "" "https://nodejs.org/"
    echo.
    pause
    exit /b 1
  )
  echo.
  where winget >nul 2>nul
  if errorlevel 1 (
    echo 这台电脑没有可用的 winget，无法自动安装。
    echo 我已打开 Node.js 官网，请手动安装 LTS 版本后重新双击本文件。
    start "" "https://nodejs.org/"
    echo.
    pause
    exit /b 1
  )
  echo 正在通过 winget 安装 Node.js LTS...
  winget install --id OpenJS.NodeJS.LTS -e --source winget
  if errorlevel 1 (
    echo.
    echo Node.js 自动安装失败。我已打开官网，请手动安装 LTS 版本后重新双击本文件。
    start "" "https://nodejs.org/"
    echo.
    pause
    exit /b 1
  )
  if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
  if not defined NODE_EXE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
  if not defined NODE_EXE for %%N in (node.exe) do if not "%%~$PATH:N"=="" set "NODE_EXE=%%~$PATH:N"
  if not defined NODE_EXE (
    echo.
    echo Node.js 已安装，但当前窗口还没读到新的 PATH。
    echo 请关闭这个窗口后重新双击 start-astrology.bat。
    echo.
    pause
    exit /b 1
  )
  echo.
)

if not exist "%ROOT%scripts\server.mjs" (
  echo 找不到服务器脚本: %ROOT%scripts\server.mjs
  echo 请确认这个 bat 文件放在 Astrology 项目根目录中。
  echo.
  pause
  exit /b 1
)

echo 正在检查本地星盘服务器...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$url='%APP_URL%'; try { $r = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1; if ($r.StatusCode -ge 200) { Start-Process $url; exit 0 } } catch {}; exit 1"
if "%ERRORLEVEL%"=="0" (
  echo 本地服务器已经在运行，已打开: %APP_URL%
  timeout /t 2 >nul
  exit /b 0
)

echo.
echo 正在启动本地高精度星盘...
echo 地址: %APP_URL%
echo.
echo 提示: 保持这个窗口打开即可使用；关闭这个窗口会停止本地服务器。
echo.

start "Open Astrology App" powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "$url='%APP_URL%'; for ($i = 0; $i -lt 60; $i++) { try { $r = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1; if ($r.StatusCode -ge 200) { Start-Process $url; exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; Start-Process $url"

"%NODE_EXE%" "%ROOT%scripts\server.mjs"

echo.
echo 本地服务器已停止。
if exist "%ROOT%.server.log" (
  echo.
  echo 最近日志:
  type "%ROOT%.server.log"
)
echo.
pause
