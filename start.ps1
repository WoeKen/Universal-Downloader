$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# 1. Dynamically locate Node.js across systems
$nodeExe = $null
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeExe = (Get-Command node).Source
} elseif ($env:NODE_EXE -and (Test-Path $env:NODE_EXE)) {
    $nodeExe = $env:NODE_EXE
} else {
    $candidates = @(
        "$env:ProgramFiles\nodejs\node.exe",
        "${env:ProgramFiles(x86)}\nodejs\node.exe",
        "$env:LOCALAPPDATA\Programs\node\node.exe",
        "$env:APPDATA\npm\node.exe"
    )
    foreach ($cand in $candidates) {
        if ($cand -and (Test-Path $cand)) {
            $nodeExe = $cand
            break
        }
    }
}

if ($nodeExe) {
    $nodeDir = [System.IO.Path]::GetDirectoryName($nodeExe)
    if ($nodeDir -and -not ($env:Path -split ';' -contains $nodeDir)) {
        $env:Path = "$nodeDir;$env:Path"
    }
}

if (-not (Test-Path (Join-Path $root 'tools\yt-dlp.exe')) -or -not (Test-Path (Join-Path $root 'tools\ffmpeg.exe'))) {
    & (Join-Path $root 'setup.ps1')
}

$localElectron = Join-Path $root 'node_modules\.bin\electron.cmd'
if (Test-Path $localElectron) {
    & $localElectron $root
} elseif (Get-Command electron -ErrorAction SilentlyContinue) {
    electron $root
} else {
    npx electron $root
}
