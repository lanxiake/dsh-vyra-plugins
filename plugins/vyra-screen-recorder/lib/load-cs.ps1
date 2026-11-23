# 用 .NET Framework 的 csc.exe 编译一次 C# 辅助类并加载。
#
# 为什么不直接用 Add-Type -TypeDefinition：Windows PowerShell 5.1 的 CodeDom
# 编译器在带 -ReferencedAssemblies 时会把核心程序集引用弄丢（IntPtr 都解析
# 不到）。直接调 csc 更稳定，结果按源码哈希缓存到 %TEMP%。
function Load-CSharpType {
  param(
    [Parameter(Mandatory = $true)][string]$SourcePath,
    [Parameter(Mandatory = $true)][string]$TypeName,
    [string[]]$References = @()
  )

  $existing = $null
  try { $existing = [System.Management.Automation.PSTypeName]::new($TypeName).Type } catch { }
  if ($existing -ne $null) { return }

  $source = Get-Content -Raw -LiteralPath $SourcePath
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($source)
  $hash = [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '').Substring(0, 16)
  $cacheDir = Join-Path $env:TEMP 'vyra-screen-recorder-bin'
  New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
  $dll = Join-Path $cacheDir ("$TypeName-$hash.dll")

  if (-not (Test-Path -LiteralPath $dll)) {
    $framework = if ([IntPtr]::Size -eq 8) { 'Framework64' } else { 'Framework' }
    $fwDir = Join-Path $env:WINDIR ("Microsoft.NET\$framework\v4.0.30319")
    $csc = Join-Path $fwDir 'csc.exe'
    if (-not (Test-Path -LiteralPath $csc)) { throw "找不到 .NET Framework csc.exe：$csc" }

    $arguments = @(
      '/nologo',
      '/target:library',
      ('/out:' + $dll),
      ('/reference:' + (Join-Path $fwDir 'System.dll'))
    )
    foreach ($reference in $References) {
      $arguments += ('/reference:' + (Join-Path $fwDir ($reference + '.dll')))
    }
    $arguments += $SourcePath

    $output = & $csc @arguments 2>&1
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $dll)) {
      throw ("C# 编译失败：" + ($output -join "`n"))
    }
  }

  try {
    Add-Type -Path $dll -ErrorAction Stop
  } catch {
    # 同一进程里重复加载同一程序集时忽略；类型已经可用。
    if ($_.Exception.Message -notmatch 'already loaded|已加载') { throw }
  }
}
