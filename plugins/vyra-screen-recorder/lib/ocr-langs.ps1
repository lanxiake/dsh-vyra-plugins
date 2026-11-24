# 列出本机 Windows OCR 可用的识别语言（一行一个 LanguageTag）。
#
# 为什么不直接在 -Command 里写：PowerShell 的 -Command 会把
# Windows.Media.Ocr.OcrEngine.AvailableRecognizerLanguages 的结果包装成
# PSObject，`| ForEach-Object { $_.LanguageTag }` 只打印类型名。放进脚本里
# 先强类型化再取属性才可靠。
#
# 输出：
#   zh-Hans-CN
#   en-US
# 没有安装任何语言包时没有任何输出（宿主按"不可用"处理）。
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
try { [Console]::OutputEncoding = $utf8 } catch { }

try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
  [void][Windows.Media.Ocr.OcrEngine, Windows.Media, ContentType = WindowsRuntime]
  $languages = @([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages)
  foreach ($language in $languages) {
    if ($null -ne $language) { [Console]::Out.WriteLine([string]$language.LanguageTag) }
  }
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
[Console]::Out.Flush()
exit 0