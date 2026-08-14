$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# 1. Dynamically locate Node.js across all systems
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
        "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
    )
    foreach ($cand in $candidates) {
        if ($cand -and (Test-Path $cand)) {
            $nodeExe = $cand
            break
        }
    }
}

if (-not $nodeExe) {
    Write-Error "Node.js executable not found. Please ensure Node.js is installed and in your PATH."
}

# Ensure Node bin directory is in PATH
$nodeDir = [System.IO.Path]::GetDirectoryName($nodeExe)
if ($nodeDir -and -not ($env:Path -split ';' -contains $nodeDir)) {
    $env:Path = "$nodeDir;$env:Path"
}

# 2. Locate electron-builder cli.js across npm, pnpm, and yarn layouts
$cliFile = Get-ChildItem -Path (Join-Path $root 'node_modules') -Filter 'cli.js' -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -like '*electron-builder*\cli.js' } | Select-Object -First 1

if ($cliFile) {
    Write-Output "Found electron-builder at: $($cliFile.FullName)"
    Write-Output "Starting packaging process with Node: $nodeExe"
    & $nodeExe $cliFile.FullName --win
} else {
    Write-Output "Running standard electron-builder..."
    npx electron-builder --win
}
