param(
  [Parameter(Mandatory = $true)][string]$Out
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $here 'load-cs.ps1')
Load-CSharpType -SourcePath (Join-Path $here 'Screen.cs') -TypeName ScreenCapture -References @('System.Drawing')

$virtual = [ScreenCapture]::VirtualScreen()
$monitors = @([ScreenCapture]::GetMonitors() | ForEach-Object {
  [ordered]@{
    index = $_.index
    name = $_.name
    x = $_.x
    y = $_.y
    w = $_.w
    h = $_.h
    primary = $_.primary
  }
})
$windows = @([ScreenCapture]::GetVisibleWindows() | Select-Object -First 40 | ForEach-Object {
  [ordered]@{
    hwnd = $_.hwnd
    title = $_.title
    process = $_.process
    x = $_.x
    y = $_.y
    w = $_.w
    h = $_.h
  }
})

$payload = [ordered]@{
  ok = $true
  virtual = [ordered]@{
    x = $virtual.x
    y = $virtual.y
    w = $virtual.w
    h = $virtual.h
  }
  monitors = $monitors
  windows = $windows
}

$json = $payload | ConvertTo-Json -Depth 6 -Compress
$encoding = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($Out, $json, $encoding)
Write-Output 'OK'
