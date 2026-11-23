param(
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$MaxSeconds = 600,
  [string]$StopFile = ''
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $here 'load-cs.ps1')
Load-CSharpType -SourcePath (Join-Path $here 'Wasapi.cs') -TypeName WasapiRecorder

if ($MaxSeconds -lt 2) { $MaxSeconds = 2 }
if ($MaxSeconds -gt 600) { $MaxSeconds = 600 }

try {
  $recorder = [WasapiRecorder]::Start($Out, $MaxSeconds)
} catch {
  Write-Output ('ERROR: ' + $_.Exception.Message)
  exit 1
}

Write-Output 'READY'
$stopwatch = [Diagnostics.Stopwatch]::StartNew()
while ($stopwatch.Elapsed.TotalSeconds -lt $MaxSeconds) {
  if ($StopFile -ne '' -and (Test-Path -LiteralPath $StopFile)) { break }
  Start-Sleep -Milliseconds 100
}
$recorder.Stop()
Write-Output ('DONE ' + $recorder.Info)
