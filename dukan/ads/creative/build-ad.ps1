# ============================================================
#  Dukan — 9:16 Ad Render Script  (v2 — cinematic motion graphics)
#  Requires: ffmpeg built with libass + libfribidi + libharfbuzz
#  Usage:    powershell -ExecutionPolicy Bypass -File build-ad.ps1
#  Output:   ..\dukan-ad-9x16.mp4
#
#  The full filtergraph lives in  filters.txt  (blur-bg Ken-Burns,
#  xfade transitions, vignette, light sweep, floating watermark,
#  progress indicator, burned Arabic captions).
# ============================================================
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

# --- locate ffmpeg ---------------------------------------------------------
$ff = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source
if (-not $ff) { $ff = 'ffmpeg' }   # fall back to PATH

# --- inputs ----------------------------------------------------------------
$shots = Join-Path $here 'shots'
$audio = Join-Path $here 'voiceover.mp3'   # put the VO next to this script
if (-not (Test-Path $audio)) {
  $audio = (Get-ChildItem "$env:USERPROFILE\Downloads\Music\" -Filter *.mp3 |
            Sort-Object LastWriteTime | Select-Object -Last 1).FullName
}
# captions.ass must be reachable from the working folder:
Copy-Item (Join-Path $here '..\captions.ass') (Join-Path $here 'captions.ass') -Force

$fc  = (Get-Content -Raw (Join-Path $here 'filters.txt')).Trim()
$out = Join-Path $here '..\dukan-ad-9x16.mp4'
$s   = $shots

& $ff -y -hide_banner `
  -framerate 30 -i "$s\card-intro.png" `
  -framerate 30 -i "$s\index-hero.png" `
  -framerate 30 -i "$s\card-a.png" `
  -framerate 30 -i "$s\store.png" `
  -framerate 30 -i "$s\index-feat.png" `
  -framerate 30 -i "$s\card-b.png" `
  -framerate 30 -i "$s\market.png" `
  -framerate 30 -i "$s\index-faq.png" `
  -framerate 30 -i "$s\card-c.png" `
  -framerate 30 -i "$s\card-outro.png" `
  -framerate 30 -i "$s\sweep.png" `
  -framerate 30 -i "$s\watermark.png" `
  -framerate 30 -i "$s\dot.png" `
  -i $audio `
  -filter_complex $fc `
  -map '[vout]' -map 13:a `
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r 30 `
  -c:a aac -b:a 192k -shortest -movflags +faststart `
  $out

Write-Host "Done -> $out"
