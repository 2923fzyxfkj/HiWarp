@echo off
setlocal enabledelayedexpansion

rem ============================================================
rem  HiWarp Web 版本构建脚本
rem
rem  用法:  build-web.bat <version>
rem  例子:  build-web.bat 1.3.0-alpha.1
rem
rem  产物:
rem    ./dist-web/HiWarp-web-<version>/    (可部署的 web 目录)
rem    ./dist/HiWarp-web-<version>.zip     (压缩包)
rem ============================================================

set "VERSION=%~1"
if "%VERSION%"=="" (
    echo 用法: build-web.bat ^<version^>
    echo 例子: build-web.bat 1.3.0-alpha.1
    exit /b 1
)

echo %VERSION%| findstr /r /c:"^[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*" >nul
if errorlevel 1 (
    echo 版本格式不正确: %VERSION%
    exit /b 1
)

cd /d "%~dp0.."

echo ============================================================
echo  HiWarp Web 版本构建
echo  版本: %VERSION%
echo ============================================================

echo [1/2] 编译 webpack 生产构建...
call npm run webpack:prod
if errorlevel 1 goto :error

echo [2/2] 组装 web 版本...
set "OUT=dist-web\HiWarp-web-%VERSION%"
if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%"

rem 编辑器主页面: 复制 gui 全部产物, gui.html 改名 index.html
robocopy "dist-renderer-webpack\editor\gui" "%OUT%" /E /NFL /NDL /NJH /NJS /NP >nul
if exist "%OUT%\gui.html" ren "%OUT%\gui.html" index.html

rem 插件设置页
robocopy "dist-renderer-webpack\editor\addons" "%OUT%\addons" /E /NFL /NDL /NJH /NJS /NP >nul

rem 扩展库与库文件
robocopy "dist-extensions" "%OUT%\dist-extensions" /E /NFL /NDL /NJH /NJS /NP >nul
robocopy "dist-library-files" "%OUT%\dist-library-files" /E /NFL /NDL /NJH /NJS /NP >nul

rem 打包 zip 到 dist
if exist "dist\HiWarp-web-%VERSION%.zip" del "dist\HiWarp-web-%VERSION%.zip"
powershell -NoProfile -Command "Compress-Archive -Path '%OUT%' -DestinationPath 'dist\HiWarp-web-%VERSION%.zip' -Force"
if errorlevel 1 goto :error

echo.
echo ============================================================
echo  构建完成! 产物:
echo    %OUT%
echo    dist\HiWarp-web-%VERSION%.zip
echo ============================================================
goto :eof

:error
echo.
echo 构建失败, 请检查上方错误信息。
exit /b 1
