# Mo moi tai khoan Muse trong mot ho so trinh duyet rieng.
# Moi ho so giu dang nhap rieng, nen nhieu tai khoan mo cung luc khong de len nhau.
# Script CHI mo trinh duyet. Ban tu nhap email va ma 6 so tren trang Muse.
# (File nay chi dung ky tu ASCII de Windows PowerShell 5.1 doc dung.)
param([string]$Email)

$ErrorActionPreference = 'Stop'
$MuseUrl = 'https://muse.ai'
$ProjectDir = Split-Path -Parent $PSScriptRoot
$ProfileRoot = Join-Path $env:LOCALAPPDATA 'MuseStudio\profiles'

function Find-Browser {
  $candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
  )
  foreach ($c in $candidates) { if ($c -and (Test-Path -LiteralPath $c)) { return $c } }
  return $null
}

function Find-List {
  $local = Join-Path $ProjectDir 'tai-khoan.txt'
  if (Test-Path -LiteralPath $local) { return $local }
  $downloads = Join-Path $env:USERPROFILE 'Downloads'
  if (Test-Path -LiteralPath $downloads) {
    $f = Get-ChildItem -LiteralPath $downloads -Filter 'tai-khoan*.txt' -File -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($f) { return $f.FullName }
  }
  return $null
}

function Read-Accounts([string]$Path) {
  $result = @()
  foreach ($raw in (Get-Content -LiteralPath $Path -Encoding UTF8)) {
    $line = $raw.Trim()
    if (-not $line -or $line.StartsWith('#')) { continue }
    $parts = $line -split '\s+', 2
    $mail = $parts[0]
    if ($mail -notmatch '^[^@\s]+@[^@\s]+$') { Write-Host "Bo qua dong khong phai email: $line"; continue }
    $link = ''
    if ($parts.Count -gt 1 -and $parts[1].Trim() -match '^https?://\S+$') { $link = $parts[1].Trim() }
    $result += [pscustomobject]@{ Email = $mail; Link = $link }
  }
  return ,$result
}

function Get-ProfileDir([string]$Mail) {
  $name = $Mail.ToLowerInvariant().Replace('@', '_at_') -replace '[^a-z0-9._-]', '_'
  return Join-Path $ProfileRoot $name
}

function Open-Account($Account, [string]$Browser) {
  $dir = Get-ProfileDir $Account.Email
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $browserArgs = @("--user-data-dir=`"$dir`"", '--no-first-run', '--no-default-browser-check', '--new-window', $MuseUrl)
  if ($Account.Link) { $browserArgs += "`"$($Account.Link)`"" }
  Start-Process -FilePath $Browser -ArgumentList $browserArgs
  Write-Host "  Da mo cua so rieng cho: $($Account.Email)"
}

$browser = Find-Browser
if (-not $browser) {
  Write-Host 'Khong tim thay Google Chrome hoac Microsoft Edge. Hay cai Chrome roi chay lai.'
  exit 1
}

if ($Email) {
  Open-Account ([pscustomobject]@{ Email = $Email; Link = '' }) $browser
  exit 0
}

$list = Find-List
if (-not $list) {
  Write-Host 'Chua co danh sach tai khoan.'
  Write-Host 'Cach 1: Trong Muse Studio, mo "Tai khoan" va bam "Tai danh sach cho MO_TAI_KHOAN.cmd".'
  Write-Host '        File se nam trong thu muc Downloads, script tu tim thay.'
  Write-Host "Cach 2: Tao file tai-khoan.txt trong $ProjectDir (xem mau tai-khoan.example.txt)."
  exit 1
}

$accounts = Read-Accounts $list
if ($accounts.Count -eq 0) { Write-Host "File $list khong co email nao."; exit 1 }

while ($true) {
  Write-Host ''
  Write-Host '=== MO TAI KHOAN MUSE - MOI TAI KHOAN MOT CUA SO RIENG ==='
  Write-Host "Danh sach: $list"
  Write-Host "Trinh duyet: $browser"
  Write-Host ''
  for ($i = 0; $i -lt $accounts.Count; $i++) {
    $extra = ''
    if ($accounts[$i].Link) { $extra = '  (+ mo link lay ma)' }
    Write-Host ("  {0,2}. {1}{2}" -f ($i + 1), $accounts[$i].Email, $extra)
  }
  Write-Host ''
  Write-Host 'Lan dau: tren trang Muse nhap email, lay ma 6 so tu link hop thu roi nhap vao Muse.'
  Write-Host 'Cac lan sau cua so do da nho dang nhap.'
  $choice = Read-Host 'Chon so (vd: 1 | 1 3 5 | 1-4), A = tat ca, Q = thoat'
  if ($null -eq $choice) { break }
  $choice = $choice.Trim()
  if ($choice -match '^[Qq]$' -or $choice -eq '') { break }

  $picked = @()
  if ($choice -match '^[Aa]$') {
    $picked = 1..$accounts.Count
  } else {
    foreach ($token in ($choice -split '[\s,;]+')) {
      if ($token -match '^(\d+)-(\d+)$') { $picked += [int]$Matches[1]..[int]$Matches[2] }
      elseif ($token -match '^\d+$') { $picked += [int]$token }
      elseif ($token) { Write-Host "  Bo qua: $token" }
    }
  }
  $picked = $picked | Where-Object { $_ -ge 1 -and $_ -le $accounts.Count } | Select-Object -Unique
  if (-not $picked) { Write-Host '  Khong co so hop le.'; continue }
  foreach ($n in $picked) {
    Open-Account $accounts[$n - 1] $browser
    Start-Sleep -Milliseconds 700
  }
}
