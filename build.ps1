$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeExe = 'C:\Users\13660\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'

$builderCli = Get-ChildItem -Path (Join-Path $root 'node_modules\.pnpm') -Filter 'cli.js' -Recurse | Where-Object { $_.FullName -like '*electron-builder*\cli.js' } | Select-Object -First 1

if (-not $builderCli) {
    Write-Error "electron-builder cli.js not found in .pnpm"
}

Write-Output "Found electron-builder at: $($builderCli.FullName)"
Write-Output "Starting packaging process with Node: $nodeExe"

Set-Location $root
& $nodeExe $builderCli.FullName --win
