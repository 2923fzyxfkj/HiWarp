@echo off
setlocal enabledelayedexpansion

rem ============================================================
rem  HiWarp 一键编译脚本（Windows 本机 + WSL 构建 Linux 包）
rem
rem  用法:  compile.bat <version>
rem  例子:  compile.bat 1.3.0-alpha.1
rem  自检:  compile.bat <version> --check   (只检查环境, 不构建)
rem
rem  产物 (./dist/):
rem    HiWarp windows-<version> Portable x64.exe
rem    HiWarp windows-<version> Setup x64.exe
rem    HiWarp Linux-<core>-AppImage[-<pre>] x64.AppImage
rem    HiWarp Linux-<core>-deb[-<pre>] amd64.deb
rem    HiWarp Linux-<core>-tar.gz[-<pre>] x64.tar.gz
rem
rem  说明: Linux 包在 WSL 内部文件系统构建, 避免 electron-builder
rem        在 /mnt/c 上扫描 node_modules 极慢导致卡死的问题。
rem ============================================================

set "VERSION=%~1"
if "%VERSION%"=="" (
    echo 用法: compile.bat ^<version^>
    echo 例子: compile.bat 1.3.0-alpha.1
    exit /b 1
)

rem ---- 校验版本格式 (semver: x.y.z[-prerelease]) ----
echo %VERSION%| findstr /r /c:"^[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*" >nul
if errorlevel 1 (
    echo 版本格式不正确: %VERSION%
    echo 应为 semver 格式, 例如 1.3.0 或 1.3.0-alpha.1
    exit /b 1
)

rem ---- 拆分主版本与预发布部分: 1.3.0-alpha.1 -> CORE=1.3.0, PRE=alpha.1 ----
set "CORE=%VERSION%"
set "PRE="
for /f "tokens=1,* delims=-" %%a in ("%VERSION%") do (
    set "CORE=%%a"
    set "PRE=%%b"
)

rem ---- 前置检查 ----
where node >nul 2>nul || (echo 未找到 node, 请先安装 Node.js & exit /b 1)
where npx >nul 2>nul || (echo 未找到 npx & exit /b 1)
where wsl >nul 2>nul || (echo 未找到 WSL, 无法构建 Linux 包 & exit /b 1)
where powershell >nul 2>nul || (echo 未找到 PowerShell & exit /b 1)

cd /d "%~dp0.."
set "ROOT=%CD%"

rem ---- 转换项目路径为 WSL 路径 (如 /mnt/c/Users/...) ----
set "WSL_PATH="
for /f "usebackq delims=" %%p in (`wsl wslpath -a -u "%ROOT%"`) do set "WSL_PATH=%%p"
if "%WSL_PATH%"=="" (
    echo 无法将路径转换为 WSL 路径: %ROOT%
    goto :error
)

rem ---- 探测 WSL 用户, 确定 WSL 内部构建目录 ----
set "WSL_USER="
for /f %%u in ('wsl bash -lc "id -un" 2^>nul') do set "WSL_USER=%%u"
if "%WSL_USER%"=="" (
    echo 无法探测 WSL 用户名, 请确认 WSL 可用
    goto :error
)
if /i "%WSL_USER%"=="root" (
    set "WSL_BUILD=/root/hiwarp-build"
) else (
    set "WSL_BUILD=/home/%WSL_USER%/hiwarp-build"
)

if /i "%~2"=="--check" (
    echo.
    echo ====== 环境自检 ======
    echo 版本参数 : %VERSION%
    echo 主版本   : %CORE%
    echo 预发布   : %PRE%
    echo 项目目录 : %ROOT%
    echo WSL 路径 : %WSL_PATH%
    echo WSL 用户 : %WSL_USER%
    echo WSL 构建 : %WSL_BUILD%
    echo.
    wsl bash -lc "node --version && npm --version"
    echo node_modules - Windows:
    wsl bash -lc "test -x '%WSL_PATH%/node_modules/.bin/electron-builder' && echo READY || echo NEED_INSTALL"
    echo node_modules - WSL缓存:
    wsl bash -lc "test -x '%WSL_BUILD%/node_modules/.bin/electron-builder' && echo READY || echo NEED"
    echo.
    echo 自检完成。
    exit /b 0
)

echo ============================================================
echo  HiWarp 编译开始
echo  版本: %VERSION%
echo  目录: %ROOT%
echo ============================================================

rem ---- 生成临时 electron-builder 配置 (注入版本号) ----
echo [准备] 生成临时构建配置...
powershell -NoProfile -Command "$c = Get-Content -Raw 'electron-builder.hiwarp-alpha.cjs'; $c = $c.Replace('1.2.2-alpha.1', '%VERSION%'); [System.IO.File]::WriteAllText((Join-Path (Get-Location) 'electron-builder.hiwarp-win.tmp.cjs'), $c, (New-Object System.Text.UTF8Encoding($false)))"
if errorlevel 1 goto :error
powershell -NoProfile -Command "$c = Get-Content -Raw 'electron-builder.hiwarp-linux-alpha.cjs'; $c = $c.Replace('1.2.2-alpha.1', '%VERSION%'); $c = $c.Replace('Linux-1.2.2-', 'Linux-%CORE%-'); if ('%PRE%' -eq '') { $c = $c.Replace('-alpha.1.${ext}', '.${ext}') } else { $c = $c.Replace('-alpha.1.${ext}', '-%PRE%.${ext}') }; [System.IO.File]::WriteAllText((Join-Path (Get-Location) 'electron-builder.hiwarp-linux.tmp.cjs'), $c, (New-Object System.Text.UTF8Encoding($false)))"
if errorlevel 1 goto :error

rem 使用国内镜像, 加速 Electron 及打包工具下载
set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
set "ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/"

rem ---- 1/4 编译 webpack 产物 ----
echo [1/4] 编译 webpack 产物...
call npm run webpack:prod
if errorlevel 1 goto :error

rem ---- 2/4 构建 Windows 包 ----
echo [2/4] 构建 Windows 安装包 (nsis + portable)...
call npx electron-builder --win nsis portable --x64 --config electron-builder.hiwarp-win.tmp.cjs --publish never
if errorlevel 1 goto :error

rem ---- 3/4 通过 WSL 构建 Linux 包 ----
echo [3/4] 通过 WSL 构建 Linux 包 (deb + AppImage + tar.gz)...
echo  WSL 构建目录: %WSL_BUILD%

rem 3.1 同步源码到 WSL 内部文件系统 (ext4, 避免 /mnt/c 扫描缓慢)
echo  [3/4.1] 同步源码到 WSL...
wsl bash -lc "mkdir -p '%WSL_BUILD%' && rsync -a --delete --exclude node_modules --exclude .git --exclude dist --exclude dist-web --exclude SpeedScript --exclude webpack-out.txt '%WSL_PATH%/' '%WSL_BUILD%/' && rsync -a --delete '%WSL_PATH%/dist-renderer-webpack/' '%WSL_BUILD%/dist-renderer-webpack/'"
if errorlevel 1 goto :error

rem 3.2 检查 WSL 构建目录中的 node_modules, 首次从 Windows 同步 (之后缓存复用)
wsl bash -lc "test -x '%WSL_BUILD%/node_modules/.bin/electron-builder' && echo READY || echo NEED" 2>nul >"%TEMP%\hiwarp-wsl-check.txt"
set /p WSL_STATE=<"%TEMP%\hiwarp-wsl-check.txt"
if "%WSL_STATE%"=="NEED" (
    echo  [3/4.2] 首次构建: 同步 node_modules 到 WSL, 约 10 分钟, 之后会缓存...
    wsl bash -lc "rsync -a '%WSL_PATH%/node_modules/' '%WSL_BUILD%/node_modules/'"
    if errorlevel 1 goto :error
) else (
    echo  [3/4.2] 复用 WSL 缓存的 node_modules
)

rem 3.3 在 WSL 内执行 electron-builder
echo  [3/4.3] WSL 内执行 electron-builder...
wsl bash -lc "export HOME=$(dirname '%WSL_BUILD%'); cd '%WSL_BUILD%' && ELECTRON_MIRROR=%ELECTRON_MIRROR% ELECTRON_BUILDER_BINARIES_MIRROR=%ELECTRON_BUILDER_BINARIES_MIRROR% npx electron-builder --linux deb AppImage tar.gz --x64 --config electron-builder.hiwarp-linux.tmp.cjs --publish never"
if errorlevel 1 goto :error

rem ---- 4/4 整理 Linux 产物并复制回 Windows ----
echo [4/4] 整理 Linux 产物并复制回 Windows...
if "%PRE%"=="" (
    wsl bash -lc "cd '%WSL_BUILD%/dist' && cp 'HiWarp Linux-%CORE%-x86_64.AppImage' '%WSL_PATH%/dist/HiWarp Linux-%CORE%-AppImage x64.AppImage' && cp 'HiWarp Linux-%CORE%-amd64.deb' '%WSL_PATH%/dist/HiWarp Linux-%CORE%-deb amd64.deb' && cp 'HiWarp Linux-%CORE%-x64.tar.gz' '%WSL_PATH%/dist/HiWarp Linux-%CORE%-tar.gz x64.tar.gz'"
) else (
    wsl bash -lc "cd '%WSL_BUILD%/dist' && cp 'HiWarp Linux-%CORE%-x86_64-%PRE%.AppImage' '%WSL_PATH%/dist/HiWarp Linux-%CORE%-AppImage-%PRE% x64.AppImage' && cp 'HiWarp Linux-%CORE%-amd64-%PRE%.deb' '%WSL_PATH%/dist/HiWarp Linux-%CORE%-deb-%PRE% amd64.deb' && cp 'HiWarp Linux-%CORE%-x64-%PRE%.tar.gz' '%WSL_PATH%/dist/HiWarp Linux-%CORE%-tar.gz-%PRE% x64.tar.gz'"
)
if errorlevel 1 (
    echo [警告] Linux 产物复制失败, 请检查 %WSL_BUILD%/dist 中的实际文件名。
)

rem ---- 清理 Windows 侧中间产物 ----
powershell -NoProfile -Command "Remove-Item 'dist\win-unpacked','dist\linux-unpacked' -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item 'dist\*.blockmap','dist\builder-debug.yml','dist\builder-effective-config.yaml','dist\latest.yml' -Force -ErrorAction SilentlyContinue; Remove-Item 'electron-builder.hiwarp-win.tmp.cjs','electron-builder.hiwarp-linux.tmp.cjs' -Force -ErrorAction SilentlyContinue"

rem ---- 完成 ----
echo.
echo ============================================================
echo  构建完成! 产物列表:
echo ============================================================
dir /b "dist\HiWarp windows-%VERSION% Portable x64.exe" 2>nul
dir /b "dist\HiWarp windows-%VERSION% Setup x64.exe" 2>nul
if "%PRE%"=="" (
    dir /b "dist\HiWarp Linux-%CORE%-AppImage x64.AppImage" 2>nul
    dir /b "dist\HiWarp Linux-%CORE%-deb amd64.deb" 2>nul
    dir /b "dist\HiWarp Linux-%CORE%-tar.gz x64.tar.gz" 2>nul
) else (
    dir /b "dist\HiWarp Linux-%CORE%-AppImage-%PRE% x64.AppImage" 2>nul
    dir /b "dist\HiWarp Linux-%CORE%-deb-%PRE% amd64.deb" 2>nul
    dir /b "dist\HiWarp Linux-%CORE%-tar.gz-%PRE% x64.tar.gz" 2>nul
)
goto :eof

:error
echo.
echo 构建失败, 请检查上方错误信息。
if exist "electron-builder.hiwarp-win.tmp.cjs" del "electron-builder.hiwarp-win.tmp.cjs"
if exist "electron-builder.hiwarp-linux.tmp.cjs" del "electron-builder.hiwarp-linux.tmp.cjs"
exit /b 1