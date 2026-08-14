$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$toolsDir = Join-Path $projectRoot 'tools'
$cacheDir = Join-Path $projectRoot '.setup-cache'
New-Item -ItemType Directory -Force -Path $toolsDir, $cacheDir | Out-Null

function Get-RemoteFile([string]$Uri, [string]$Destination) {
  Write-Host "Downloading $([System.IO.Path]::GetFileName($Destination))..."
  Invoke-WebRequest -Uri $Uri -OutFile $Destination -UseBasicParsing
}

$ytDlp = Join-Path $toolsDir 'yt-dlp.exe'
if (-not (Test-Path $ytDlp)) {
  Get-RemoteFile 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' $ytDlp
}

$ffmpeg = Join-Path $toolsDir 'ffmpeg.exe'
if (-not (Test-Path $ffmpeg)) {
  $ffmpegZip = Join-Path $cacheDir 'ffmpeg.zip'
  $extractDir = Join-Path $cacheDir 'ffmpeg'
  Get-RemoteFile 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' $ffmpegZip
  if (Test-Path $extractDir) { Remove-Item -LiteralPath $extractDir -Recurse -Force }
  Expand-Archive -LiteralPath $ffmpegZip -DestinationPath $extractDir -Force
  $binDir = Get-ChildItem -LiteralPath $extractDir -Directory | Select-Object -First 1 | ForEach-Object { Join-Path $_.FullName 'bin' }
  Copy-Item -LiteralPath (Join-Path $binDir 'ffmpeg.exe') -Destination $ffmpeg -Force
  Copy-Item -LiteralPath (Join-Path $binDir 'ffprobe.exe') -Destination (Join-Path $toolsDir 'ffprobe.exe') -Force
}

& $ytDlp --version
& $ffmpeg -version | Select-Object -First 1
Write-Host ''
Write-Host 'Setup complete. Run: pnpm start'
