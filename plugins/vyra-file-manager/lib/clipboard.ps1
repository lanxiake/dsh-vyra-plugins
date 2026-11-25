# 文件列表写进系统剪贴板，供宿主路由调用。
#
# 粘贴到资源管理器得到文件副本，粘贴到多数聊天框得到绝对路径。
# 为什么用 PowerShell 而不是给 Node 加原生模块：插件要能在用户机器上零依赖
# 跑起来，Set-Clipboard 是 PowerShell 5.0+ 自带的。
#
#   -Kind files -Path "C:\a.txt|C:\dir"
#
# 成功输出一行 OK；失败输出一行 CLIPBOARD_<原因> 并以退出码 1 结束。
param(
  [Parameter(Mandatory = $true)][ValidateSet('files')][string]$Kind,
  [Parameter(Mandatory = $true)][string]$Path
)

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
try { [Console]::OutputEncoding = $utf8 } catch { }

$items = @($Path -split '\|' | Where-Object { $_ -ne '' })
if ($items.Count -eq 0) { throw 'CLIPBOARD_EMPTY' }
foreach ($item in $items) {
  if (-not (Test-Path -LiteralPath $item)) { throw ('CLIPBOARD_MISSING:' + $item) }
}

$paths = @()
foreach ($item in $items) { $paths += [string](Convert-Path -LiteralPath $item) }

# 实测过三条都不行，写在这里免得以后有人重走：
#   - WPF SetFileDropList：恒报 CLIPBRD_E_CANT_OPEN；
#   - WinForms SetDataObject(StringCollection)：只写成 "StringCollection"，粘不出文件；
#   - WinForms DataObject.SetData(FileDrop, string[])：本进程内可见，跨进程读不到。
# Set-Clipboard -LiteralPath 由 PowerShell 自己写 CF_HDROP 交给系统持久化，跨进程可读。
if (-not (Get-Command Set-Clipboard -ErrorAction SilentlyContinue)) { throw 'CLIPBOARD_NO_CMDLET' }

# 用户往往刚复制过东西、或剪贴板管理器正持有剪贴板，OpenClipboard 会短暂失败。
$done = $false
$lastError = ''
for ($attempt = 0; $attempt -lt 8 -and -not $done; $attempt++) {
  try {
    Set-Clipboard -LiteralPath $paths
    $done = $true
  } catch {
    $lastError = $_.Exception.Message
    Start-Sleep -Milliseconds (120 * ($attempt + 1))
  }
}
if (-not $done) {
  Write-Output ('CLIPBOARD_BUSY:' + $lastError)
  exit 1
}

Write-Output 'OK'
