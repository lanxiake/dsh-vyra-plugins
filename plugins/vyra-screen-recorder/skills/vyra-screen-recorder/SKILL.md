---
name: vyra-screen-recorder
description: Windows 录屏、截图与可录制源枚举（vyra-screen-recorder 插件提供的 vsr CLI）。截图不需要 DSH 运行；录屏需要 DSH Web 界面保持打开以完成 WebCodecs 编码。
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
vsr shot --out ./small.jpg --max-edge 1920 --quality 80
```

- 默认抓整个虚拟桌面（所有显示器）。
- `--region x,y,w,h` 只抓一块；`--max-edge` 缩放长边；`--quality` 是 JPEG 质量。
- 输出路径会解析成绝对路径，父目录不存在会自动创建。

## 列出可录制源

```bash
vsr sources --json
```

返回 `virtual`、`monitors`、`windows`。窗口项里有 `hwnd`、`title`、`process` 和矩形，
`hwnd` 用于 `--source window:<hwnd>`。

## 录屏（需要 DSH Web 界面打开）

```bash
vsr record --duration 10 --out ./demo.webm --source desktop
vsr record --duration 15 --out ./demo.webm --source window:123456
vsr record --duration 8  --out ./demo.webm --source monitor:1 --no-mic
vsr record --duration 8  --out ./demo.webm --source region:100,100,800,600 --no-audio
```

- CLI 把请求写到本地队列；DSH 宿主开始抓屏，DSH 的 Web 界面用 WebCodecs 编成 WebM，
  保存到 `--out`（覆盖同名文件）。
- **DSH Web 界面必须打开**。如果编码阶段超时，告诉用户先打开 DSH，再重试。
- 默认录系统声音 + 麦克风；`--no-audio` / `--no-mic` 分别关闭。
- 可调 `--fps`（4-12，默认 8）、`--quality`（40-90，默认 65）、`--max-edge`（默认 1920）。
- `--json` 输出机器可读结果：`{"ok":true,"file":"...","bytes":123}`。
- 一次只允许一路录制；用户已经在录时，CLI 会报错。

## 注意

- 窗口录制录的是屏幕像素，别的窗口盖上去会一起录进去。
- 受 DRM 保护的音频可能录不到。
- 不要在用户没有明确要求时录制敏感内容。
- 录屏最长 10 分钟；停止后需要等待编码完成。