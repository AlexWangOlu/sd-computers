# Build the delivery zip for the localized sd-computers (Chinese fork).
#
# Mirrors the upstream .github/workflows/release.yml staging allowlist, plus README-CN.md.
# Compress-Archive on Windows PowerShell 5.1 writes entry names with backslashes, which
# violates APPNOTE 4.4.17.1 and breaks 7-Zip / WinRAR / Info-ZIP extraction - so the archive
# is written through ZipArchive with explicit forward slashes instead.
#
# NOTE: this script is deliberately ASCII-only: Windows PowerShell 5.1 reads .ps1 files using
# the ANSI codepage, so non-ASCII literals here would be mangled.
#
# Usage:  powershell -NoProfile -ExecutionPolicy Bypass -File _zh_work\pack.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root    = 'D:\FIVEMDEV\sd-computers'
$stage   = Join-Path $root '_zh_work\dist'
$resName = 'sd-computers'
$resDir  = Join-Path $stage $resName
$zipPath = 'D:\car\sd-computers-cn.zip'

# --- 1. stage the allowlist -------------------------------------------------
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $resDir -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $resDir 'web') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $resDir 'docs') -Force | Out-Null

foreach ($f in @('fxmanifest.lua', 'README.md', 'README-CN.md', 'THIRD_PARTY_NOTICES.md')) {
  Copy-Item (Join-Path $root $f) $resDir
}
foreach ($d in @('bridge', 'client', 'server', 'shared', 'configs', 'locales')) {
  Copy-Item (Join-Path $root $d) (Join-Path $resDir $d) -Recurse
}
Copy-Item (Join-Path $root 'docs\items') (Join-Path $resDir 'docs\items') -Recurse
Copy-Item (Join-Path $root 'docs\GAMEPLAY-CN.md') (Join-Path $resDir 'docs\GAMEPLAY-CN.md')
Copy-Item (Join-Path $root 'web\build') (Join-Path $resDir 'web\build') -Recurse

# --- 2. every path fxmanifest.lua declares must be staged -------------------
$manifest = Get-Content (Join-Path $root 'fxmanifest.lua') -Raw
$paths = [regex]::Matches($manifest, "'([^']+\.(?:lua|json|html|js|css|png|jpg|webp|svg|woff2?|mp3))'") |
  ForEach-Object { $_.Groups[1].Value } |
  Where-Object { $_ -notlike '@*' } |
  ForEach-Object { ($_ -replace '/\*\*.*$', '') -replace '/\*.*$', '' } |
  Sort-Object -Unique
$missing = @()
foreach ($p in $paths) {
  $full = Join-Path $resDir ($p -replace '/', '\')
  if (-not (Test-Path $full)) { $missing += $p }
}
# configs/server is require()'d server-side only, so the manifest never names it.
if (-not (Test-Path (Join-Path $resDir 'configs\server'))) { $missing += 'configs/server' }
if ($missing.Count -gt 0) {
  Write-Output 'STAGED RESOURCE IS INCOMPLETE:'
  $missing | ForEach-Object { Write-Output ("  missing: " + $_) }
  throw 'packaging aborted'
}
Write-Output ("fxmanifest paths present: " + $paths.Count)

# --- 3. zip with forward slashes -------------------------------------------
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
$files = Get-ChildItem $stage -Recurse -File
$zip = [IO.Compression.ZipFile]::Open($zipPath, [IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in $files) {
    $relative = $file.FullName.Substring($stage.Length).TrimStart('\')
    $entryName = $relative -replace '\\', '/'
    $entry = $zip.CreateEntry($entryName, [IO.Compression.CompressionLevel]::Optimal)
    $target = $entry.Open()
    try {
      $input = [IO.File]::OpenRead($file.FullName)
      try { $input.CopyTo($target) } finally { $input.Dispose() }
    } finally { $target.Dispose() }
  }
} finally {
  $zip.Dispose()
}

# --- 4. re-open and verify --------------------------------------------------
$item = Get-Item $zipPath
$check = [IO.Compression.ZipFile]::OpenRead($zipPath)
$names = $check.Entries | Select-Object -ExpandProperty FullName
$check.Dispose()
Write-Output ("zip:      " + $item.FullName)
Write-Output ("size:     " + [math]::Round($item.Length / 1MB, 1) + " MB")
Write-Output ("entries:  " + $names.Count)
Write-Output ("backslash entries: " + ($names | Where-Object { $_ -match '\\' }).Count + "  (must be 0)")
foreach ($probe in @('sd-computers/fxmanifest.lua', 'sd-computers/locales/cn.json',
                     'sd-computers/locales/en.json', 'sd-computers/README-CN.md',
                     'sd-computers/docs/GAMEPLAY-CN.md',
                     'sd-computers/web/build/index.html', 'sd-computers/web/build/os.html',
                     'sd-computers/web/build/admin.html', 'sd-computers/web/build/screen.html',
                     'sd-computers/web/build/assets/mojave-starry.jpg',
                     'sd-computers/web/build/assets/mail-icon.png',
                     'sd-computers/web/build/assets/desktop-login.ogg',
                     'sd-computers/configs/config.lua')) {
  $hit = $names | Where-Object { $_ -eq $probe }
  Write-Output ("  " + $(if ($hit) { 'ok  ' } else { 'MISS' }) + " " + $probe)
}
$fonts = ($names | Where-Object { $_ -match 'noto-sans-sc' }).Count
Write-Output ("  noto-sans-sc chunks in zip: " + $fonts)
