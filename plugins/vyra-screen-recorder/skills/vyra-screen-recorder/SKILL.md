---
name: vyra-screen-recorder
description: Windows 录屏、截图、录制源枚举、文件列表，以及截图取字（Windows 自带 OCR）与剪贴板（vyra-screen-recorder 插件提供的 vsr CLI 与宿主路由）。截图/枚举/文件列表/取字不需要 DSH 运行；录屏需要 DSH Web 界面保持打开以完成 WebCodecs 编码。
---

# 录屏 / 截图 CLI

`vyra-screen-recorder` 插件初始化时会把本技能写入 `~/.dsh/skills/vyra-screen-recorder/`，
并安装 CLI shim：

- Git Bash / sh：`~/.dsh/vyra-screen-recorder/bin/vsr`
- PowerShell / cmd：`%USERPROFILE%\.dsh\vyra-screen-recorder\bin\vsr.cmd`

如果 `DSH_HOME` 指向别处，把上面的 `~/.dsh` 换成对应目录。
Git Bash 里如果 `vsr` 没有执行权限，用 `sh ~/.dsh/vyra-screen-recorder/bin/vsr ...`；
PowerShell / cmd 用 `vsr.cmd`。

## 截图（不依赖 DSH 运行）

```bash
vsr shot --out ./shot.jpg
vsr shot --out ./region.jpg --region 100,100,800,600
vsr shot --hide-dsh --out ./behind-dsh.jpg
vsr shot                  # 省略 --out：保存到设置的截图目录
```

- 默认抓整个虚拟桌面（所有显示器）。
- `--region x,y,w,h` 只抓一块；`--max-edge` 缩放长边；`--quality` 是 JPEG 质量。
- `--hide-dsh` 先隐藏 DSH 窗口再抓，用来截取被 DSH 挡住的其他应用。
- 输出路径会解析成绝对路径，父目录不存在会自动创建。

## 截图取字（Windows 自带 OCR，不需要 DSH 运行）

截图浮层里拖框松手就会自动取字，并把结果放进「文字」面板（可选中、可一键复制）；
工具条上还有「复制图片」「复制文件」。「复制图片」把选区放进剪贴板（能直接粘进聊天窗口），
「复制文件」把保存下来的 PNG 作为文件放进剪贴板（能粘进资源管理器）。

Agent 侧要读图里的字，优先用 `dsh-tool-ocr` 的 `ocr_read` 工具；没有那个插件时
可以直接调本插件自带的 OCR 脚本（`<插件目录>` 指 `vyra-screen-recorder` 插件所在目录）：

```powershell
# 输出一行 JSON：{"ok":true,"text":"...","lang":"zh-Hans-CN","lines":[...]}
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File "<插件目录>\lib\ocr.ps1" -Path .\shot.png
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File "<插件目录>\lib\ocr.ps1" -Path .\shot.png -Lang zh-Hans-CN
```

- `lines` 里每项是 `{ text, x, y, w, h }`，坐标是原图像素，可以用来定位。
- 小字号截图会先放大再识别；`-Scale 1` 关闭放大。
- 中文结果默认已去掉逐字空格。

## 列出可录制源

```bash
vsr sources --json
```

返回 `virtual`、`monitors`、`windows`。窗口项里有 `hwnd`、`title`、`process` 和矩形，
`hwnd` 用于 `--source window:<hwnd>`。

## 列出已保存文件

```bash
vsr files --json
vsr files
```

返回录制目录和截图目录里的文件（名称、类型、大小、时间、路径）。
视频和截图目录可以在 DSH 设置 → 录屏截图里分别配置；默认是
`我的视频/Vyra Screen Recorder/recordings` 和 `.../screenshots`。

## 录屏（需要 DSH Web 界面打开）

```bash
vsr record --duration 10 --out ./demo.mp4 --source desktop
vsr record --duration 10 --source desktop          # 省略 --out：存到录制目录
vsr record --duration 10 --format webm --out ./demo.webm --source desktop
vsr record --duration 15 --out ./demo.mp4 --source window:123456
vsr record --duration 8  --out ./demo.mp4 --source monitor:1 --no-mic
vsr record --duration 8  --out ./demo.mp4 --source region:100,100,800,600 --no-audio
```

- CLI 把请求写到本地队列；DSH 宿主开始抓屏，DSH 的 Web 界面用 WebCodecs 编码，
  保存到 `--out`（覆盖同名文件）或默认录制目录。
- **DSH Web 界面必须打开**。如果编码阶段超时，告诉用户先打开 DSH，再重试。
- 默认格式（MP4 / WebM）、帧率、质量、长边、最长时长、系统声音/麦克风都从设置页读取；
  `--format`、`--fps`、`--quality`、`--max-edge`、`--no-audio` / `--no-mic` 可临时覆盖。
- 默认 MP4（H.264 / AAC）；如果环境不支持 H.264/AAC，会自动落回 WebM，返回的 `file`
  可能是 `.webm`，以实际路径为准。
- `--json` 输出机器可读结果：`{"ok":true,"file":"...","bytes":123}`。
- 一次只允许一路录制；用户已经在录时，CLI 会报错。

## 注意

- 窗口录制录的是屏幕像素，别的窗口盖上去会一起录进去。
- 受 DRM 保护的音频可能录不到。
- 不要在用户没有明确要求时录制敏感内容。
- 录屏最长 10 分钟（可在设置页调整）；停止后需要等待编码完成。