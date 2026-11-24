# 剪贴板 / 资源管理器小工具，供宿主路由调用。
#
# 为什么用 PowerShell 而不是给 Node 加原生模块：插件要能在用户机器上零依赖
# 跑起来，Set-Clipboard / System.Windows.Forms.Clipboard 都是系统自带的。
#
# 子命令：
#   -Kind text   -Path file.txt    把文件内容（UTF-8）放进剪贴板
#   -Kind image  -Path shot.png    把图片作为位图放进剪贴板（可以直接粘到聊天窗口）
#   -Kind files  -Path a.jpg,b.jpg 把文件列表放进剪贴板（资源管理器里可以粘贴）
#   -Kind reveal -Path file        打开资源管理器并选中文件（目录则直接打开）
#   -Kind open   -Path file        用默认程序打开文件
#
# 成功输出一行 OK；失败抛异常（宿主看退出码）。
param(
  [Parameter(Mandatory = $true)][ValidateSet('text', 'image', 'files', 'reveal', 'open')][string]$Kind,
  [Parameter(Mandatory = $true)][string]$Path
)

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
try { [Console]::OutputEncoding = $utf8 } catch { }

function Set-ClipboardText([string]$text) {
  # Set-Clipboard 在 PowerShell 5.1 里不存在时回退到 WinForms。
  if (Get-Command Set-Clipboard -ErrorAction SilentlyContinue) {
    Set-Clipboard -Value $text
    return
  }
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.Clipboard]::SetText($text)
}

switch ($Kind) {
  'text' {
    if (-not (Test-Path -LiteralPath $Path)) { throw "找不到文本文件：$Path" }
    Set-ClipboardText ([System.IO.File]::ReadAllText($Path, $utf8))
  }
  'image' {
    if (-not (Test-Path -LiteralPath $Path)) { throw "找不到图片：$Path" }
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $stream = New-Object System.IO.MemoryStream
    try {
      $bytes = [System.IO.File]::ReadAllBytes($Path)
      $stream.Write($bytes, 0, $bytes.Length)
      $stream.Position = 0
      $image = [System.Drawing.Image]::FromStream($stream)
      # 剪贴板里有图时 SetImage 偶尔因别的进程占着剪贴板失败，重试几次。
      $done = $false
      for ($attempt = 0; $attempt -lt 5 -and -not $done; $attempt++) {
        try { [System.Windows.Forms.Clipboard]::SetImage($image); $done = $true }
        catch { Start-Sleep -Milliseconds 120 }
      }
      if (-not $done) { throw '剪贴板被其他程序占用，请稍后再试' }
      $image.Dispose()
    } finally {
      $stream.Dispose()
    }
  }
  'files' {
    $items = @($Path -split '\|' | Where-Object { $_ -ne '' })
    if ($items.Count -eq 0) { throw '没有要复制的文件' }
    foreach ($item in $items) {
      if (-not (Test-Path -LiteralPath $item)) { throw "文件不存在：$item" }
    }
    # 走 FileDrop 格式。这里必须用 WPF 的 Clipboard 并 Flush：WinForms 的
    # SetDataObject 写进去的列表会随本进程退出一起消失，用户粘贴时什么都没有。
    Add-Type -AssemblyName PresentationCore
    Add-Type -AssemblyName WindowsBase
    $wpf = [System.Type]::GetType(
      'System.Windows.Clipboard, PresentationCore, Version=4.0.0.0, Culture=neutral, PublicKeyToken=31bf3856ad364e35',
      $false)
    $paths = @()
    foreach ($item in $items) { $paths += [string](Convert-Path -LiteralPath $item) }
    $done = $false
    if ($null -ne $wpf) {
      for ($attempt = 0; $attempt -lt 5 -and -not $done; $attempt++) {
        try {
          $collection = New-Object System.Collections.Specialized.StringCollection
          foreach ($item in $paths) { [void]$collection.Add($item) }
          $wpf::SetFileDropList($collection)
          $wpf::Flush()
          $done = $true
        } catch { Start-Sleep -Milliseconds 120 }
      }
    }
    if (-not $wpf -and $items.Count -eq 1 -and (Test-Path -LiteralPath $items[0] -PathType Leaf)) {
      # 没有 WPF 时至少让单个文件能以文件名形式粘贴（多数聊天窗口认）。
      Set-ClipboardText (Convert-Path -LiteralPath $items[0])
      $done = $true
    }
    if (-not $done) { throw '剪贴板被其他程序占用，或当前系统不支持写入文件列表' }
  }
  'reveal' {
    if (-not (Test-Path -LiteralPath $Path)) { throw "路径不存在：$Path" }
    if (Test-Path -LiteralPath $Path -PathType Container) {
      Start-Process -FilePath 'explorer.exe' -ArgumentList @((Convert-Path -LiteralPath $Path))
    } else {
      Start-Process -FilePath 'explorer.exe' -ArgumentList @(('/select,' + (Convert-Path -LiteralPath $Path)))
    }
  }
  'open' {
    if (-not (Test-Path -LiteralPath $Path)) { throw "路径不存在：$Path" }
    Start-Process -FilePath (Convert-Path -LiteralPath $Path)
  }
}

Write-Output 'OK'