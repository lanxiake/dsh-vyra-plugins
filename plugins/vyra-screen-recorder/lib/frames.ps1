param(
  [Parameter(Mandatory = $true)][string]$OutDir,
  [string]$Region = '',
  [long]$Hwnd = 0,
  [int]$Fps = 8,
  [int]$Quality = 65,
  [int]$MaxEdge = 1920,
  [int]$MaxSeconds = 600,
  [string]$StopFile = ''
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $here 'load-cs.ps1')
Load-CSharpType -SourcePath (Join-Path $here 'Screen.cs') -TypeName ScreenCapture -References @('System.Drawing')

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)

if ($Fps -lt 4) { $Fps = 4 }
if ($Fps -gt 15) { $Fps = 15 }
if ($Quality -lt 30) { $Quality = 30 }
if ($Quality -gt 90) { $Quality = 90 }
if ($MaxSeconds -lt 2) { $MaxSeconds = 2 }
if ($MaxSeconds -gt 600) { $MaxSeconds = 600 }
if ($MaxEdge -ne 0 -and $MaxEdge -lt 320) { $MaxEdge = 320 }
if ($MaxEdge -gt 2560) { $MaxEdge = 2560 }

$virtual = [ScreenCapture]::VirtualScreen()
if ($Region -ne '') {
  $parts = $Region -split ','
  if ($parts.Length -ne 4) { throw 'Region 必须是 x,y,w,h' }
  $rect = @([int]$parts[0], [int]$parts[1], [int]$parts[2], [int]$parts[3])
} elseif ($Hwnd -ne 0) {
  $bounds = [ScreenCapture]::WindowBounds($Hwnd)
  if ($bounds) {
    $rect = @($bounds.x, $bounds.y, $bounds.w, $bounds.h)
  } else {
    $rect = @($virtual.x, $virtual.y, $virtual.w, $virtual.h)
  }
} else {
  $rect = @($virtual.x, $virtual.y, $virtual.w, $virtual.h)
}
if ($rect[2] -le 0 -or $rect[3] -le 0) { throw '录制区域为空' }

$outW = $rect[2]
$outH = $rect[3]
if ($MaxEdge -gt 0) {
  $scale = [Math]::Min(1.0, $MaxEdge / [Math]::Max($outW, $outH))
  $outW = [int][Math]::Round($outW * $scale)
  $outH = [int][Math]::Round($outH * $scale)
}
# VP9 对奇数尺寸不友好；统一成偶数。
$outW = $outW - ($outW % 2)
$outH = $outH - ($outH % 2)
if ($outW -lt 2) { $outW = 2 }
if ($outH -lt 2) { $outH = 2 }

$meta = [ordered]@{
  width = $outW
  height = $outH
  sourceWidth = $rect[2]
  sourceHeight = $rect[3]
  fps = $Fps
  hwnd = $Hwnd
  region = @($rect[0], $rect[1], $rect[2], $rect[3])
  startedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
}
[System.IO.File]::WriteAllText((Join-Path $OutDir 'meta.json'), ($meta | ConvertTo-Json -Compress), $utf8)

$framesPath = Join-Path $OutDir 'frames.jsonl'
$writer = New-Object System.IO.StreamWriter($framesPath, $false, $utf8)
$writer.AutoFlush = $true

$stopwatch = [Diagnostics.Stopwatch]::StartNew()
$index = 0
$failures = 0
$baseT = [long]-1
$lastRect = $rect
$fatal = ''

try {
  while ($true) {
    if ($stopwatch.Elapsed.TotalSeconds -ge $MaxSeconds) { break }
    if ($StopFile -ne '' -and (Test-Path -LiteralPath $StopFile)) { break }

    if ($Hwnd -ne 0) {
      $bounds = [ScreenCapture]::WindowBounds($Hwnd)
      if ($bounds) {
        $current = @($bounds.x, $bounds.y, $bounds.w, $bounds.h)
        $lastRect = $current
      } else {
        # 窗口最小化/失效：沿用最后一个矩形，继续抓该位置的屏幕像素，不中断录制。
        $current = $lastRect
      }
    } else {
      $current = $rect
    }

    $file = 'f{0:d6}.jpg' -f $index
    $full = Join-Path $OutDir $file
    try {
      [ScreenCapture]::CaptureToJpeg($current[0], $current[1], $current[2], $current[3], $outW, $outH, $Quality, $full, $true) | Out-Null
      if ($baseT -lt 0) { $baseT = $stopwatch.ElapsedMilliseconds }
      $frameT = $stopwatch.ElapsedMilliseconds - $baseT
      $line = '{"i":' + $index + ',"t":' + $frameT + ',"file":"' + $file + '"}'
      $writer.WriteLine($line)
      $failures = 0
      if ($index -eq 0) { Write-Output 'READY' }
    } catch {
      $failures++
      if ($index -eq 0) {
        $fatal = $_.Exception.Message
        [System.IO.File]::WriteAllText((Join-Path $OutDir 'error.log'), $fatal, $utf8)
        Write-Output ('ERROR: ' + $fatal)
        exit 1
      }
      if ($failures -ge 10) {
        $fatal = $_.Exception.Message
        [System.IO.File]::WriteAllText((Join-Path $OutDir 'error.log'), $fatal, $utf8)
        break
      }
      Start-Sleep -Milliseconds 120
    }

    $index++
    $target = [long](($index * 1000) / $Fps)
    $delay = $target - $stopwatch.ElapsedMilliseconds
    if ($delay -gt 0) { Start-Sleep -Milliseconds $delay }
  }
} finally {
  $writer.Close()
  $done = [ordered]@{
    frames = $index
    elapsedMs = $stopwatch.ElapsedMilliseconds
    error = $fatal
  }
  [System.IO.File]::WriteAllText((Join-Path $OutDir 'done.json'), ($done | ConvertTo-Json -Compress), $utf8)
  Write-Output ('DONE ' + $index)
}
