# 常驻截图服务：加载 Screen.cs 一次，之后按行接收截图请求。
#
# 为什么常驻：每次 spawn powershell.exe 光启动就要 1.4s，再编译/加载 C# 又是
# 1s 左右，截图延迟 2-4 秒，既不像原生，也会让屏幕上后出现的界面被拍进去。
# 这里把进程和类型都留着，每次请求只剩 GDI 抓图 + JPEG 编码。
#
# 协议（stdin/stdout 均为 UTF-8，一行一条）：
#   请求：{"out":"...","quality":88,"region":"x,y,w,h","maxEdge":0,"hideDsh":true,"dshPid":1234}
#   成功：OK hidden=N
#   失败：ERR 消息
#   退出：quit（或 stdin 关闭）
param()

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
try { [Console]::InputEncoding = $utf8 } catch { }
try { [Console]::OutputEncoding = $utf8 } catch { }

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $here 'load-cs.ps1')
Load-CSharpType -SourcePath (Join-Path $here 'Screen.cs') -TypeName ScreenCapture -References @('System.Drawing')

[Console]::Out.WriteLine('READY')
[Console]::Out.Flush()

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $line = $line.Trim()
  if ($line -eq '') { continue }
  if ($line -eq 'quit') { break }

  $hiddenWindows = @()
  try {
    $request = $line | ConvertFrom-Json

    if ($request.hideDsh) {
      $targetPid = 0
      if ($request.dshPid) { $targetPid = [int]$request.dshPid }
      if ($targetPid -gt 0) {
        $hiddenWindows = @([ScreenCapture]::FindProcessWindows($targetPid))
      }
      if ($hiddenWindows.Count -eq 0) {
        $hiddenWindows = @([ScreenCapture]::FindTitleWindows('DeepSeek Harness'))
      }
      foreach ($handle in $hiddenWindows) { [ScreenCapture]::HideWindow($handle) }
      if ($hiddenWindows.Count -gt 0) { Start-Sleep -Milliseconds 180 }
    }

    $virtual = [ScreenCapture]::VirtualScreen()
    if ($request.region -and [string]$request.region -ne '') {
      $parts = ([string]$request.region) -split ','
      if ($parts.Length -ne 4) { throw 'Region 必须是 x,y,w,h' }
      $x = [int]$parts[0]; $y = [int]$parts[1]; $w = [int]$parts[2]; $h = [int]$parts[3]
    } else {
      $x = $virtual.x; $y = $virtual.y; $w = $virtual.w; $h = $virtual.h
    }
    if ($w -le 0 -or $h -le 0) { throw '截图区域为空' }

    $outW = 0; $outH = 0
    $maxEdge = 0
    if ($request.maxEdge) { $maxEdge = [int]$request.maxEdge }
    if ($maxEdge -gt 0) {
      $scale = [Math]::Min(1.0, $maxEdge / [Math]::Max($w, $h))
      $outW = [Math]::Max(2, [int][Math]::Round($w * $scale))
      $outH = [Math]::Max(2, [int][Math]::Round($h * $scale))
    }

    $quality = 88
    if ($request.quality) { $quality = [int]$request.quality }

    [ScreenCapture]::CaptureToJpeg($x, $y, $w, $h, $outW, $outH, $quality, [string]$request.out, $true) | Out-Null
    [Console]::Out.WriteLine('OK hidden=' + $hiddenWindows.Count)
  } catch {
    [Console]::Out.WriteLine('ERR ' + $_.Exception.Message)
  } finally {
    foreach ($handle in $hiddenWindows) { [ScreenCapture]::ShowWindowFor($handle) }
    [Console]::Out.Flush()
  }
}
