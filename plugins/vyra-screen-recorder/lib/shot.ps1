param(
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$MaxEdge = 0,
  [int]$Quality = 86,
  [string]$Region = '',
  [switch]$NoCursor
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $here 'load-cs.ps1')
Load-CSharpType -SourcePath (Join-Path $here 'Screen.cs') -TypeName ScreenCapture -References @('System.Drawing')

$virtual = [ScreenCapture]::VirtualScreen()
if ($Region -ne '') {
  $parts = $Region -split ','
  if ($parts.Length -ne 4) { throw 'Region 必须是 x,y,w,h' }
  $x = [int]$parts[0]
  $y = [int]$parts[1]
  $w = [int]$parts[2]
  $h = [int]$parts[3]
} else {
  $x = $virtual.x
  $y = $virtual.y
  $w = $virtual.w
  $h = $virtual.h
}
if ($w -le 0 -or $h -le 0) { throw '截图区域为空' }

$outW = 0
$outH = 0
if ($MaxEdge -gt 0) {
  $scale = [Math]::Min(1.0, $MaxEdge / [Math]::Max($w, $h))
  $outW = [int][Math]::Round($w * $scale)
  $outH = [int][Math]::Round($h * $scale)
  if ($outW -lt 2) { $outW = 2 }
  if ($outH -lt 2) { $outH = 2 }
}

[ScreenCapture]::CaptureToJpeg($x, $y, $w, $h, $outW, $outH, $Quality, $Out, (-not $NoCursor)) | Out-Null
Write-Output 'OK'
