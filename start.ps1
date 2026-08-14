$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeBin = 'C:\Users\13660\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$electron = Join-Path $root 'node_modules\.bin\electron.cmd'
if (-not (Test-Path (Join-Path $root 'tools\yt-dlp.exe')) -or -not (Test-Path (Join-Path $root 'tools\ffmpeg.exe'))) {
  & (Join-Path $root 'setup.ps1')
}
$env:Path = "$nodeBin;$env:Path"
& $electron $root
