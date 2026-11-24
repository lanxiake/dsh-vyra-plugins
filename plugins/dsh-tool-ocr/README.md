# dsh-tool-ocr

> **在 dsh 里直接读图取字** —— 把截图、扫描件、发票、合同 PDF 丢给 Agent，
> 它自己判断有没有文字层，没有就调你配置的 OCR 引擎，最后把正文交回来。

给 **DeepSeek Harness** 用的自建工具插件：图片 OCR + PDF 文本抽取。

> **Compatibility**: built and tested against dsh `0.2.0-rc.2` (preview).
> The `apply(ctx)` plugin spec is stable; verify against your own dsh version if newer.

---

## 一行安装

```bash
dsh plugin --profile desktop add github:yuehancn/dsh-tool-ocr
```

**支持的 profile**：`desktop`（桌面版）/ `web`（Web 版）。装完重启 dsh 即可用。

---

## 它解决什么问题

Agent 能读文本文件，但读不了**图里的字**。你发给它一张发票截图、一份扫描合同、
一个手机拍的表格，它只能猜。这个插件补上这一段：

| 输入 | 插件怎么处理 |
|---|---|
| 带文字层的 PDF（电子合同、导出的报告） | 直接读文字层，不调 OCR，快且准 |
| 扫描件 / 图片型 PDF | 检测到文字层为空 → 自动栅格化 → 调 OCR 引擎 |
| 图片（截图、照片、表格） | 直接交给 OCR 引擎 |

关键点：**（1）它会先判断是不是电子版**，不会把电子 PDF 白跑一遍 OCR；
**（2）引擎是你自己配的**，tesseract / PaddleOCR / 公司内部 API 客户端都能接。

---

## 两个工具

### `ocr_read`

```
ocr_read(path, engine?, lang?, pages?, saveAs?)
```

- `path` —— 图片或 PDF 的**绝对路径**
- `engine` —— 用哪个 OCR 引擎；不填走默认
- `lang` —— 语言提示，如 `chi_sim+eng`
- `pages` —— PDF 页码范围，如 `1-3` 或 `2,5`
- `saveAs` —— 把抽出的文字另存到输出目录

**返回**：`text`（正文）+ `kind`（image / pdf）+ `engine`（实际用的引擎）
+ `pages` + `textPath` + `note`（走了哪条路径、有什么提醒）。

`note` 是有意暴露给你的：Agent 能据此判断「这次结果可不可信」，
而不是把一堆字照单全收。

### `ocr_status`

报告本机哪些引擎真能用（逐个探 `--version`），以及当前后端是什么。
**动手 OCR 之前先问一句**，能避免白跑一次几秒到几十秒的任务。

---

## 配置引擎

默认 `backend: native` —— 只用 poppler 读 PDF 文字层，不需要装任何 OCR。

**不想装东西？用 Windows 自带的 OCR。** Windows 10/11 内置 `Windows.Media.Ocr`，
识别语言跟着系统语言包走，插件用 `mode: winrt` 调它：

```yaml
# ~/.dsh/profiles/<profile>/cordis.patch.yml
- id: tool-ocr
  name: "@yuehancn/dsh-tool-ocr"
  config:
    backend: command      # 或者 winrt：没配任何引擎时也默认用系统 OCR
    engines:
      - id: windows
        label: Windows OCR（系统自带，中英文）
        mode: winrt
        lang: system      # 或指定 zh-Hans-CN / en-US
        isDefault: true
```

`ocr_status` 会报告系统装了哪些识别语言（`languages: zh-Hans-CN`）。中文系统一般都带
`zh-Hans-CN`；英文系统想认中文，去「设置 → 时间和语言 → 语言和区域」给中文加装语言包。
系统 OCR 会自动把中文逐字之间的空格去掉，`ocr.Text` 直接可用。

**要接别的引擎**，改成 `backend: command` 并在 `engines` 里加一个：

```yaml
# ~/.dsh/profiles/<profile>/cordis.patch.yml
- id: tool-ocr
  config:
    backend: command
    outputDir: C:/Users/you/Documents/ocr-output
    engines:
      - id: tesseract
        label: Tesseract 中英混排
        command: tesseract
        args: ["{input}", "{output}", "-l", "chi_sim+eng"]
        isDefault: true
```

**参数占位符**（在 `args` 里可用）：

| 占位符 | 展开成 |
|---|---|
| `{input}` | 交给引擎的图片绝对路径 |
| `{output}` | 引擎应写入纯文本的绝对路径 |
| `{lang}` | 本次调用的 `lang` 参数（可为空） |

引擎把文字写进 `{output}` **或**打到 stdout 都行 —— 两种都被识别。

再配一个引擎（比如表格走 PaddleOCR、正文走 tesseract）就是再加一个条目：

```yaml
    engines:
      - id: tesseract
        command: tesseract
        args: ["{input}", "{output}", "-l", "chi_sim+eng"]
        isDefault: true
      - id: windows
        label: Windows OCR
        mode: winrt
      - id: paddle
        label: PaddleOCR（表格/版面更好）
        command: python
        args: ["-m", "paddleocr", "--image_dir", "{input}", "--use_angle_cls", "true"]
```

`mode: winrt` 的条目不需要 `command` 和 `args`；`backend: command` 时也能按 id 选它
（`ocr_read(path, engine: "windows")`）。

> **和录屏插件的关系**：`vyra-screen-recorder` 的截图浮层会读这里的 `engines` 配置，
> 截图里取字和 Agent 的 `ocr_read` 走同一套引擎；没装本插件时它直接用系统 OCR。

---

## 依赖

插件本体只在 Node 里跑，**不装任何 Python 包**。外部依赖按需：

| 依赖 | 用途 | 不装会怎样 |
|---|---|---|
| `mode: winrt`（Windows 内置） | 图片 / 扫描件取字 | 非 Windows 上不可用 |
| `pdftotext`（poppler） | 读 PDF 文字层 | 电子 PDF 也读不了，`note` 会告诉你 |
| `pdftoppm`（poppler） | 把 PDF 页栅格化成图 | 扫描 PDF 无法 OCR |
| 任一 OCR 引擎 | 识别图里的字 | `backend: native` 且没配引擎时，图片输入直接报错，提示你配置 |

**Windows 装 poppler**：下载 poppler-windows 解压，把 `bin` 加进 PATH，
或直接把 `pdftotext.exe` 的完整路径写进 config 的 `command`。
**Windows 装 tesseract**：用 UB-Mannheim 的安装包，记得勾中文语言包
（`chi_sim`），否则 `-l chi_sim` 会报缺 traineddata。

---

## 安全说明

- 插件**只读你给的那个文件**，不扫目录、不上传、不联网。
- OCR 引擎是**你配置的本地命令**，插件用 `spawn` 直接调用，
  不经 shell 拼接 —— 路径里的空格、引号、中文都不会出问题。
- 抽取的文字写到 `outputDir`，仅此一处写盘。

---

## 跑测试

三个套件，85 条断言，全部针对**真实的 dsh 运行时**跑（不是 mock 掉 `defineTool`）：

```bash
# 1) 把 dsh 的依赖链放进 node_modules（复用本机已装的 profile）
PROFILE=~/.dsh/profiles/desktop/node_modules/@deepseek-ai
mkdir -p node_modules/@deepseek-ai
cp -r "$PROFILE/." node_modules/@deepseek-ai/

# 2) 跑全部
node _test/run-all.mjs
```

| 套件 | 覆盖什么 |
|---|---|
| `test-logic.mjs` | 页码解析、类型判定、参数模板、引擎选择、Config 默认值 |
| `test-integration.mjs` | 插件加载、工具注册、开关生效、输出 schema、错误路径 |
| `test-e2e.mjs` | **真跑子进程**：调一个模拟引擎，验证抽取、存盘、选引擎、失败透传 |

`test-e2e.mjs` 用 `_test/fixtures/mock-ocr.mjs` 冒充 tesseract，
遵守同样的 `{input} {output}` 约定 —— 所以除了识别模型本身，
spawn、参数替换、读结果、错误处理全都真跑过。

---

## 许可

MIT

## 交流群

有问题、想提功能、或者想看看别人怎么用，欢迎加 QQ 群（群号 1121362543）。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/qq-group.png" />
  <img alt="QQ 交流群二维码，群号 1121362543" src="./assets/qq-group.png" width="220" />
</picture>
