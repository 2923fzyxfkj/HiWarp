# HiWarp Desktop 安装脚本（gitget 安装步骤调用）
# 功能对应 Setup 安装包：定位安装目录、补开始菜单快捷方式、配置用户环境变量。
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = 'Stop'

# NSIS 安装目录默认是 %LOCALAPPDATA%\Programs\<productName>，productName 带版本号
$programsDir = Join-Path $env:LOCALAPPDATA 'Programs'
$installDir = Get-ChildItem -Path $programsDir -Directory -Filter 'HiWarp*' -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1 -ExpandProperty FullName

if (-not $installDir) {
    Write-Host '未找到 HiWarp 安装目录，请先运行 Setup 安装包。' -ForegroundColor Red
    exit 1
}

$exePath = Join-Path $installDir 'HiWarp.exe'
if (-not (Test-Path $exePath)) {
    Write-Host "安装目录中不存在 HiWarp.exe: $exePath" -ForegroundColor Red
    exit 1
}

Write-Host "安装目录: $installDir"

# 1. 确保开始菜单快捷方式存在（Setup 安装包通常已创建，这里兜底）
$startMenuDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
New-Item -ItemType Directory -Force -Path $startMenuDir | Out-Null
$lnkPath = Join-Path $startMenuDir 'HiWarp Desktop.lnk'
if (-not (Test-Path $lnkPath)) {
    try {
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($lnkPath)
        $shortcut.TargetPath = $exePath
        $shortcut.WorkingDirectory = $installDir
        $shortcut.Description = 'HiWarp Desktop - Scratch 增强版离线编辑器'
        $shortcut.Save()
        Write-Host "已创建开始菜单快捷方式: $lnkPath"
    } catch {
        Write-Host "创建开始菜单快捷方式失败: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "开始菜单快捷方式已存在: $lnkPath"
}

# 2. 配置用户环境变量 PATH（追加安装目录，使 hiwarp 命令可用）
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath -notlike "*$installDir*") {
    $newPath = if ($userPath) { "$installDir;$userPath" } else { $installDir }
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
    Write-Host "已将安装目录加入用户 PATH: $installDir"
} else {
    Write-Host '安装目录已在用户 PATH 中。'
}

Write-Host 'HiWarp Desktop 安装配置完成。' -ForegroundColor Green
