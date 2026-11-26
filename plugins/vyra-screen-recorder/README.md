# 录屏 / 截图（Vyra Screen Recorder）

给 DSH 输入框工具条加两个按钮：**录屏** 和 **截图**。

- **录屏**：点开「选择要录制的内容」——整个桌面、某台显示器、某个窗口，或者拖框自定义区域；可以同时录**系统声音**和**麦克风**。停止后自动编成 **MP4（H.264 / AAC，默认）** 或 WebM 视频，挂进输入框附件，并保存到专门的文件夹。
- **截图**：抓整屏 → 拖框选区域 → 用画笔 / 矩形 / 箭头 / 文字标注 →「用这张」进附件；可以**隐藏 DSH 界面**再截，拍到被它挡住的其他应用。抓屏走常驻服务，**不出加载提示**，抓图本身几十毫秒级，接近系统截图。
- **截图取字**：拖框松手就识别框里的文字，结果出现在「文字」面板里，**可选中、可一键复制**；还能**一键复制图片**（直接粘进聊天窗口）或**复制文件**（粘进资源管理器）。和 QQ / 微信截图里的取字、复制一样顺手。
- **悬停显示快捷键**：鼠标移到工具条的录屏 / 截图按钮上，弹出「录制屏幕 + Ctrl+Alt+R」这样的提示（按钮的原生 title 也一直带着快捷键）；截图浮层里的工具按钮只显示名称，不标快捷键。
- **设置页**：视频/截图存储位置、MP4/WebM、帧率、快捷键、文字识别引擎、隐藏 DSH、文件管理都在「设置 → 录屏截图」里；新版本 DSH 也可以在「设置 → 插件 → dsh-vyra-screen-recorder」里打开同一页。
- **快捷键**：默认 `Ctrl+Alt+S` 截图、`Ctrl+Alt+R` 录屏/停止；截图浮层里 `Ctrl+Alt+C` 取字、`Ctrl` 复制图片、`Ctrl+Shift+C` 复制文件、`Ctrl+S` 用这张（都可以改）。
- **Agent 也能用**：插件初始化时会把技能和 `vsr` CLI 装进 `~/.dsh`，Agent 可以直接录屏、截图、枚举屏幕/窗口、列出文件。
- **不需要 Python、ffmpeg、Pillow、虚拟声卡**：抓屏、系统声音、编码全部用 Windows 自带能力和浏览器 WebCodecs 完成；**取字用 Windows 10/11 自带的 OCR**，不用另外装 tesseract。

---

## 安装

在 DSH 插件市场搜索「录屏」安装，或者：

```bash
dsh plugin --profile desktop add dsh-vyra-screen-recorder
```

装完**完整重启 DSH**（宿主侧路由在启动时挂载）。

## 使用

### 录屏

1. 点输入框工具条左侧的 **录屏** 按钮。
2. 在弹出的选择框里选：
   - 整个桌面（所有显示器）
   - 显示器 N
   - 窗口（默认收起，点标题展开）
   - 自定义区域…（回到拖框浮层）
3. 底部可以关掉「系统声音」或「麦克风」；默认值来自设置页。
4. 开始后工具条上出现红点和计时；再点一次按钮，或按 `Esc`，停止。
5. 显示「正在编码」进度，完成后视频自动挂进输入框。提示条里有「打开文件夹」。

录屏中按 `Esc` 停止；达到设置里的最长时长会自动停止并开始编码。

### 截图

1. 按快捷键（默认 `Ctrl+Alt+S`）：**直接抓整个屏幕**进入选区，和 QQ / 微信一样，不额外弹选源框。
   - 想只截某个窗口/显示器时，点工具条上的 **截图** 按钮，会先让你选「要截图的内容」，再进选区。
2. 拖动框选区域；单击不拖选则取全部可见范围。
3. 松手即进入标注：画笔 / 矩形 / 箭头 / 文字，7 种颜色、三档粗细，撤销 / 清空 / 重选。
4. 点「用这张」，裁切并合成标注 → **保存成文件 + 复制到剪贴板**（不再自动挂进输入框）。

需要图片里的文字时，点工具条上的 **文**（或按取字快捷键）：识别是手动的，不会在截完图时自己跑一遍。

抓屏在浮层出现之前完成，所以拍到的就是你按下快捷键那一刻的屏幕，浮层本身不会被拍进去。

浮层右上角的「隐藏 DSH 界面」会先藏起 DSH 和截图浮层、抓一张、再恢复，用来截取后面的窗口或其他应用；设置页可以把它设为默认。

`Esc` 取消，`Ctrl+Z` 撤销上一笔。

#### 取字与复制（像 QQ / 微信截图）

点工具条上的「文」（或按取字快捷键）识别选区里的文字，结果出现在工具条上方的「文字」面板：

| 要做什么 | 点哪里 | 默认快捷键 |
| --- | --- | --- |
| 提取 / 重新提取文字 | 工具条上的 **文** | `Ctrl+Alt+C` |
| 复制文字 | 文字面板里的「复制文字」 | `Ctrl+Alt+C` |
| 复制图片（粘进聊天窗口） | 工具条上的 **⧉** | `Ctrl` |
| 复制文件（粘进资源管理器） | 工具条上的 **⤓** | `Ctrl+Shift+C` |
| 只复制选中部分文字 | 在文字面板里拖选，再按 `Ctrl+C` | — |

- 识别到的每一行会在图上描一个淡蓝色框，能一眼看出哪块被认成了什么。
- 有标注时，复制出去的图片会**带上标注**；没有标注时直接切原图像素，不重编码。
- 文字面板可以选中、可以按行读；想复制全部就点「复制文字」，复制完面板会收起，露出整张图继续操作。
- 中文默认按行合并、去掉逐字之间的空格（Windows OCR 会给中文每个字之间插空格）。

### 文字识别引擎

默认就用 **Windows 10/11 自带的 OCR**（`Windows.Media.Ocr`），不需要装任何东西，识别语言跟着系统语言包走。如果装了 [`dsh-tool-ocr`](../dsh-tool-ocr)，本插件会**读它的引擎配置**：`~/.dsh/profiles/<profile>/cordis.patch.yml` 里 `tool-ocr` 那一条的 `engines`。

```yaml
- id: tool-ocr
  name: "@yuehancn/dsh-tool-ocr"
  config:
    backend: command
    engines:
      - id: windows          # 系统自带 OCR
        label: Windows OCR（系统自带，中英文）
        mode: winrt
        isDefault: true
      - id: tesseract        # 也可以挂外部引擎
        label: Tesseract
        command: tesseract
        args: ["{input}", "{output}", "-l", "chi_sim+eng"]
```

- 没写 `isDefault` 时用第一个；设置页的「识别引擎」可以手动指定，`自动` 表示跟随配置。
- `command` 型引擎的 `{input}` 是原图路径，`{output}` 是它应该写入的文本文件，`{lang}` 是语言提示。
- 系统没有中文识别包时，「设置 → 时间和语言 → 语言和区域」里给中文装上语言包即可。

### 设置页

打开 **设置 → 录屏截图**：

- **存储位置**：视频和截图可以分别指定目录，留空则用默认的 `我的视频/Vyra Screen Recorder/recordings` 和 `.../screenshots`；「选择…」改到任意目录，「打开」直接打开文件夹。
- **录制**：保存格式（MP4 / WebM，默认 MP4；环境不支持 H.264/AAC 时自动回退 WebM）、帧率、JPEG 质量、长边上限、最长时长、默认是否录系统声音/麦克风。
- **快捷键**：截图、录屏/停止，以及截图浮层里的取字、复制图片、复制文件、用这张；点输入框后直接按组合键。
- **文字识别**：识别引擎（自动 / 指定 id）、语言（跟随系统或指定）；页面底部会告诉你本机系统 OCR 是否可用、有哪些语言。
- **截图**：默认隐藏 DSH 界面。
- **文件**：列出录屏与截图，支持打开、打开文件夹、删除；WebM 录屏可以一键「转 MP4」。

### 给 Agent 用的技能 + CLI

插件初始化时会把两样东西装进 DSH 家目录（默认 `~/.dsh`）：

| 装什么 | 落点 |
| --- | --- |
| 技能 | `~/.dsh/skills/dsh-vyra-screen-recorder/SKILL.md` |
| CLI | `~/.dsh/dsh-vyra-screen-recorder/bin/vsr`（sh）和 `vsr.cmd`（Windows） |

Agent 的命令：

```bash
# 截图（不需要 DSH 运行；省略 --out 时存到设置的截图目录）
vsr shot --out ./shot.jpg
vsr shot --out ./region.jpg --region 100,100,800,600
vsr shot --hide-dsh --out ./behind-dsh.jpg

# 列出已保存的录屏/截图
vsr files --json

# 枚举可录制源
vsr sources --json

# 录屏（需要 DSH Web 界面保持打开，界面负责编码）
vsr record --duration 10 --out ./demo.mp4 --source desktop
vsr record --duration 10 --source desktop          # 省略 --out 时存到录制目录
vsr record --duration 10 --format webm --out ./demo.webm --source desktop
vsr record --duration 8 --out ./demo.mp4 --source monitor:1 --no-mic
vsr record --duration 8 --out ./demo.mp4 --source window:123456
vsr record --duration 8 --out ./demo.mp4 --source region:100,100,800,600 --no-audio
```

- 录屏流程：CLI 把请求写进本地队列 → 宿主开始抓屏 → DSH Web 界面用 WebCodecs 编码 → 保存到 `--out` 或录制目录。
- **DSH Web 界面必须打开**；否则编码阶段会超时，CLI 会明确报错。
- 默认格式、帧率、质量、系统声音/麦克风都从设置页读取；`--format`、`--fps`、`--no-audio` / `--no-mic` 可临时覆盖。
- 输出路径解析成绝对路径，父目录会自动创建。

完整的 Agent 使用说明见包内的 [`skills/dsh-vyra-screen-recorder/SKILL.md`](skills/dsh-vyra-screen-recorder/SKILL.md)。

### 产物

- 默认存储位置：`我的视频/Vyra Screen Recorder`（`~/Videos/Vyra Screen Recorder`），设置页可分别指定视频和截图目录。
- 视频：`<视频目录>/录屏-YYYYMMDD-HHmmss.mp4`（或 `.webm`）
- 截图：`<截图目录>/截图-YYYYMMDD-HHmmss.jpg`
- 临时 JPEG 帧和 WAV 在编码完成/取消后立即删除；`%TEMP%` 下超过 24 小时的残留会在下次启动时清理。
- 宿主侧常驻一个截图 PowerShell 进程（约几十 MB），插件启动时预热，截图和插件停用时自动结束。

`DSH_HOME` 默认是 `~/.dsh`；可用环境变量 `VSR_LIBRARY_DIR` 覆盖存储根目录。

---

## 前置条件

| 条件 | 说明 |
| --- | --- |
| Windows 10 / 11 | 抓屏用 GDI，系统声音用 WASAPI 回环 |
| DSH 桌面版 0.2.2-rc.3+ | 用官方 `conversation.input.left` / `settings.section` 槽位；新版插件管理页额外挂 `plugins.bundle.config` |
| Chromium / Electron 支持 WebCodecs | 当前 Electron 44 内置 VP9/Opus 和 H.264/AAC 编码 |

**不需要**安装任何额外软件。

---

## 已知限制

说清楚比说好听重要：

1. **窗口录制是屏幕像素，不是窗口流。** 别的窗口盖在它上面，就会录到遮挡物。
2. **录的是默认播放设备。** 切到耳机/音箱后需要重新开始录制；受 DRM 保护的音频可能录不到。
3. **默认 8 fps，最长 10 分钟。** 帧率、时长、格式都可以在设置页改。
4. **编码在停止后进行。** 录得越久，等待越久；进度条会如实显示。
5. **同时只允许一路录制。** 多开页面/多标签不会同时录。
6. **麦克风用系统默认输入设备。** 暂不支持在插件里选设备。
7. **目前只支持 Windows。** Mac / Linux 没有这套 GDI + WASAPI 实现。
8. **Agent 录屏需要 DSH Web 界面打开。** 编码在界面里做；截图、源枚举和 `files` 可以完全离线跑。
9. **MP4 依赖 H.264/AAC 编码器。** 当前 Electron 44 支持；如果环境不支持，会自动落回 WebM 并提示。
10. **WebM 转 MP4 是实时转换。** 会按原速播放（能听到原音频），时长多长就等多久。
11. **快捷键只在 DSH 窗口内生效。** 没有注册系统级全局热键。带 `Ctrl` / `Alt` 的组合在输入框里一样有效（站在聊天框里也能按 `Ctrl+Alt+S` 截图）；裸字母则让给打字。
12. **取字依赖系统 OCR 语言包。** 中文系统自带 `zh-Hans-CN`；英文系统没装中文包时只能认英文。识别质量不如商业引擎，小字号截图会先放大再识别。
13. **「复制文字」用的是 HTML 剪贴板。** 粘到聊天窗口、记事本、VS Code 都没问题；极少数只认纯文本的程序可能需要改用「复制文件」。

---

## 安全

- 所有处理都在本机：抓屏、录声音、编码、保存、**文字识别**，都不上传网络。
- 宿主路由只监听 DSH 自己的 Web 服务；截图/录屏内容不会离开本机。
- `/reveal`、`/open`、`/clipboard` 只接受存储位置（或剪贴板临时目录）内的路径；客户端传任意路径会被拒绝。
- 剪贴板临时文件在 `%TEMP%/vyra-screen-recorder-clipboard`，文件名由宿主生成，不接受客户端指定目录。
- `/record/save` 的文件名会去掉路径分隔符。
- 临时文件在 `%TEMP%`，编码完成或取消后删除。

---

## 和旧插件的区别

旧插件 `dsh-screen-capture-record-desktop` 把按钮插在「听写」按钮左边；当前 DSH 里没有这个锚点，扫描不到就静默退出。它还依赖 Python 3 + Pillow + ffmpeg，并且 `recorder.py` 只抓画面、不录声音。

本插件：

- 用官方槽位挂按钮和设置页，不依赖任何 DOM 锚点；
- 抓屏 / 声音全部走 Windows 自带能力，不要求 Python / ffmpeg；
- 系统声音和麦克风都录，默认直接编成 MP4；
- 截图带选区、基础标注和「隐藏 DSH」；
- 有专门的存储目录、文件管理、可配置快捷键和 Agent 技能/CLI。

---

## 开发

```bash
npm run build:client   # src/client.body.js + 两个 muxer -> client.js
npm run check          # 语法检查 + PowerShell 脚本 BOM 检查
npm test               # 单元测试 + Windows 抓屏/声音/OCR/剪贴板集成测试
```

`client.js` 是生成文件；改客户端请改 `src/client.body.js`，然后重新 build。

**PowerShell 脚本必须带 UTF-8 BOM。** Windows PowerShell 5.1 在没有 BOM 时按系统
ANSI 代码页读脚本，中文注释会被读成乱码，甚至把语法搞坏。`npm run check` 会检查；
手动改完脚本跑一次 `npm run fix:bom` 补上。

新增的宿主路由：

| 路由 | 作用 |
| --- | --- |
| `POST /ocr` | 请求体是 PNG，返回 `{ text, lines, engine, lang, ms }`；`lines` 是原图像素坐标的行框 |
| `GET /ocr/status` | 返回可用引擎、系统 OCR 语言、当前生效引擎 |
| `POST /clipboard?kind=image\|text\|files` | 请求体是图片/文字，或用 `path=` 指定已保存文件；写进系统剪贴板 |
| `GET /open?path=` | 用默认程序打开存储目录里的文件 |

## 致谢

- **webm-muxer**（Vanilagy，MIT）：把 WebCodecs 的 VP9 / Opus 分片封装成 WebM。
- **mp4-muxer**（Vanilagy，MIT）：把 WebCodecs 的 H.264 / AAC 分片封装成 MP4。

许可证见 [`vendor/webm-muxer-LICENSE.txt`](vendor/webm-muxer-LICENSE.txt) 和
[`vendor/mp4-muxer-LICENSE.txt`](vendor/mp4-muxer-LICENSE.txt)。

## 许可证

MIT。见 [LICENSE](LICENSE)。

## 交流

QQ 群：1121362543。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/qq-group.png" />
  <img alt="QQ 交流群二维码，群号 1121362543" src="./assets/qq-group.png" width="220" />
</picture>

## 交流群

有问题、想提功能、或者想看看别人怎么用，欢迎加 QQ 群（群号 1121362543）。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/qq-group.png" />
  <img alt="QQ 交流群二维码，群号 1121362543" src="./assets/qq-group.png" width="220" />
</picture>
