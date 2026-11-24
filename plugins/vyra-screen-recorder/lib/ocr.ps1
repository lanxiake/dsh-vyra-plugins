# 图片文字识别（Windows.Media.Ocr）。
#
# 为什么用系统自带 OCR：Windows 10/11 自带 WinRT 的 Windows.Media.Ocr，
# 识别器语言跟着系统语言包装（本机中文系统就是 zh-Hans-CN），不需要用户再装
# tesseract、PaddleOCR 或任何 Python 包。剪贴板取字这条链路要的是"随手截一块
# 就能复制"，多一个安装步骤就没人用了。
#
# 与 dsh-tool-ocr 的关系：本脚本是它的 winrt 后端实现之一（另一份在 OCR 插件
# 自己的 lib/ 里），这里放一份是为了让录屏插件的截图浮层不依赖 OCR 插件也能
# 取字——OCR 插件只负责 Agent 侧的 ocr_read 工具。
#
# 用法：
#   ocr.ps1 -Path shot.png [-Out result.json] [-Lang zh-Hans-CN] [-Scale 2]
#
# 输出（stdout，UTF-8 一行 JSON）：
#   {"ok":true,"text":"...","lang":"zh-Hans-CN","lines":[{"text":"","x":0,"y":0,"w":0,"h":0}]}
#   {"ok":false,"error":"..."}
#
# 边界框是输入图片的像素坐标（已经除掉放大倍数），客户端拿它给识别结果描框。
param(
  [Parameter(Mandatory = $true)][string]$Path,
  [string]$Out = '',
  [string]$Lang = '',
  # 小字号截图先放大再识别，中文识别率明显更好；1 表示不放大。
  [int]$Scale = 2,
  # 单张图最长边超过这个值就不再放大，避免 4K 截图超时。
  [int]$MaxEdge = 3200
)

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
try { [Console]::OutputEncoding = $utf8 } catch { }

$result = [ordered]@{ ok = $false; error = '初始化失败' }

function Write-Result($value) {
  $json = $value | ConvertTo-Json -Depth 6 -Compress
  if ($Out -ne '') {
    $tmp = $Out + '.tmp'
    [System.IO.File]::WriteAllText($tmp, $json, $utf8)
    Move-Item -LiteralPath $tmp -Destination $Out -Force
  }
  [Console]::Out.WriteLine($json)
  [Console]::Out.Flush()
}

try {
  if (-not (Test-Path -LiteralPath $Path)) { throw "找不到图片：$Path" }
  if ($Scale -lt 1) { $Scale = 1 }
  if ($Scale -gt 4) { $Scale = 4 }

  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  [void][Windows.Media.Ocr.OcrEngine, Windows.Media, ContentType = WindowsRuntime]
  [void][Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
  [void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
  [void][Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
  [void][Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
  [void][Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]

  # WinRT 的 IAsyncOperation<T> 在 PowerShell 5.1 里没有 await；手工转 Task 再 Wait。
  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  })[0]

  function Await($operation, [Type]$resultType) {
    $task = $asTaskGeneric.MakeGenericMethod($resultType).Invoke($null, @($operation))
    if (-not $task.Wait(30000)) { throw 'WinRT 调用超时' }
    return $task.Result
  }

  # 选识别器：优先请求的语言，其次系统语言，最后任意可用语言。
  $engine = $null
  $available = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages
  if ($available.Count -eq 0) { throw '系统没有安装任何 OCR 语言包（设置 → 时间和语言 → 语言 → 可选功能）' }
  if ($Lang -ne '') {
    try {
      $language = New-Object Windows.Globalization.Language($Lang)
      $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
    } catch { $engine = $null }
  }
  if ($null -eq $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
  if ($null -eq $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($available[0]) }
  if ($null -eq $engine) { throw '无法创建 OCR 识别器' }

  $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($Path)) ([Windows.Storage.StorageFile])
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  try {
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $width = [double]$bitmap.PixelWidth
    $height = [double]$bitmap.PixelHeight

    # OCR 引擎对很小或很大的位图都吃力：放大到合适尺寸再识别，坐标最后除回来。
    $factor = 1.0
    if ($width -gt 0 -and $height -gt 0) {
      $longest = [Math]::Max($width, $height)
      $target = [Math]::Min(1600.0, $longest * $Scale)
      $target = [Math]::Min([double]$MaxEdge, [Math]::Max($longest, $target))
      $factor = [Math]::Round($target / $longest, 3)
    }
    if ($factor -gt 1.001 -and [Windows.Media.Ocr.OcrEngine]::MaxImageDimension -ge 1) {
      $max = [double][Windows.Media.Ocr.OcrEngine]::MaxImageDimension
      if ($factor * $longest -gt $max) { $factor = [Math]::Floor($max) / $longest }
      $scaledW = [Math]::Max(1, [int][Math]::Round($width * $factor))
      $scaledH = [Math]::Max(1, [int][Math]::Round($height * $factor))
      $transform = New-Object Windows.Graphics.Imaging.BitmapTransform
      $transform.ScaledWidth = [uint32]$scaledW
      $transform.ScaledHeight = [uint32]$scaledH
      $transform.InterpolationMode = [Windows.Graphics.Imaging.BitmapInterpolationMode]::Fant
      $bitmap = Await ($decoder.GetSoftwareBitmapAsync(
        [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,
        [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied,
        $transform,
        [Windows.Graphics.Imaging.ExifOrientationMode]::IgnoreExifOrientation,
        [Windows.Graphics.Imaging.ColorManagementMode]::DoNotColorManage
      )) ([Windows.Graphics.Imaging.SoftwareBitmap])
    } else {
      $factor = 1.0
    }

    $ocr = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

    $lines = New-Object System.Collections.ArrayList
    foreach ($line in $ocr.Lines) {
      $left = [double]::MaxValue; $top = [double]::MaxValue
      $right = 0.0; $bottom = 0.0
      foreach ($word in $line.Words) {
        $rect = $word.BoundingRect
        if ($rect.X -lt $left) { $left = $rect.X }
        if ($rect.Y -lt $top) { $top = $rect.Y }
        if (($rect.X + $rect.Width) -gt $right) { $right = $rect.X + $rect.Width }
        if (($rect.Y + $rect.Height) -gt $bottom) { $bottom = $rect.Y + $rect.Height }
      }
      $text = $line.Text
      if ($text -eq $null) { $text = '' }
      # Windows OCR 会把中文按字拆开、中间插空格（"这 是 一 段"）；复制出去要能
      # 直接用，所以只在两个表意文字之间去掉空格，中英混排的 "中文 test" 保留。
      $text = [regex]::Replace($text, '(?<=[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF])[ \t]+(?=[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF])', '')
      if ($left -eq [double]::MaxValue) { $left = 0; $top = 0; $right = 0; $bottom = 0 }
      [void]$lines.Add([ordered]@{
        text = $text
        x = [int][Math]::Round($left / $factor)
        y = [int][Math]::Round($top / $factor)
        w = [int][Math]::Round(($right - $left) / $factor)
        h = [int][Math]::Round(($bottom - $top) / $factor)
      })
    }

    $result = [ordered]@{
      ok = $true
      # 同一行内的多余换行会拆碎句子；换成换行符拼接，和视觉上的行一致。
      text = (($lines | ForEach-Object { $_.text }) -join "`n")
      lang = [string]$engine.RecognizerLanguage.LanguageTag
      lines = $lines
    }
  } finally {
    if ($stream -ne $null) { $stream.Dispose() }
  }
} catch {
  $result = [ordered]@{ ok = $false; error = $_.Exception.Message }
}

Write-Result $result