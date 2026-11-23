# 录屏 / 截图（Vyra Screen Recorder）

给 DSH 输入框工具条加两个按钮：**录屏** 和 **截图**。

- **录屏**：点开「选择要录制的内容」——整个桌面、某台显示器、某个窗口，或者拖框自定义区域；可以同时录**系统声音**和**麦克风**。停止后自动编成 **MP4（H.264 / AAC，默认）** 或 WebM 视频，挂进输入框附件，并保存到专门的文件夹。
- **截图**：抓整屏 → 拖框选区域 → 用画笔 / 矩形 / 箭头 / 文字标注 →「用这张」进附件；可以**隐藏 DSH 界面**再截，拍到被它挡住的其他应用。
- **设置页**：存储位置、MP4/WebM、帧率、快捷键、隐藏 DSH、文件管理都在「设置 → 录屏截图」里。
- **快捷键**：默认 `Ctrl+Alt+S` 截图、`Ctrl+Alt+R` 录屏/停止（DSH 窗口内生效，可改）。
- **Agent 也能用**：插件初始化时会把技能和 `vsr` CLI 装进 `~/.dsh`，Agent 可以直接录屏、截图、枚举屏幕/窗口、列出文件。
- **不需要 Python、ffmpeg、Pillow、虚拟声卡**：抓屏、系统声音、编码全部用 Windows 自带能力和浏览器 WebCodecs 完成。

---

## 安装

在 DSH 插件市场搜索「录屏」安装，或者：

```bash
dsh plugin --profile desktop add vyra-screen-recorder
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

1. 点工具条左侧的 **截图** 按钮（或按设置的截图快捷键）。
2. 整屏图铺开：拖框选区；单击不拖选整屏。
3. 松手后直接进入标注：画笔 / 矩形 / 箭头 / 文字，7 种颜色、三档粗细，撤销 / 清空 / 重选。
4. 点「用这张」，裁切并合成标注，JPEG 自动挂进输入框。

浮层右上角的「隐藏 DSH 界面」会先藏起 DSH、抓一张、再恢复，用来截取后面的窗口或其他应用；设置页可以把它设为默认。

`Esc` 取消，`Ctrl+Z` 撤销上一笔。

### 设置页

打开 **设置 → 录屏截图**：

- **存储位置**：默认 `我的视频/Vyra Screen Recorder`，点「选择…」改到任意目录；「打开」直接打开文件夹。内部按 `recordings/` 和 `screenshots/` 分开。
- **录制**：默认格式（MP4 / WebM）、帧率、JPEG 质量、长边上限、最长时长、默认是否录系统声音/麦克风。
- **快捷键**：截图、录屏/停止；点输入框后直接按组合键。
- **截图**：默认隐藏 DSH 界面。
- **文件**：列出录屏与截图，支持打开、打开文件夹、删除；WebM 录屏可以一键「转 MP4」。

### 给 Agent 用的技能 + CLI

插件初始化时会把两样东西装进 DSH 家目录（默认 `~/.dsh`）：

| 装什么 | 落点 |
| --- | --- |
| 技能 | `~/.dsh/skills/vyra-screen-recorder/SKILL.md` |
| CLI | `~/.dsh/vyra-screen-recorder/bin/vsr`（sh）和 `vsr.cmd`（Windows） |

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

完整的 Agent 使用说明见包内的 [`skills/vyra-screen-recorder/SKILL.md`](skills/vyra-screen-recorder/SKILL.md)。

### 产物

- 默认存储位置：`我的视频/Vyra Screen Recorder`（`~/Videos/Vyra Screen Recorder`），设置页可改。
- 视频：`<存储位置>/recordings/录屏-YYYYMMDD-HHmmss.mp4`（或 `.webm`）
- 截图：`<存储位置>/screenshots/截图-YYYYMMDD-HHmmss.jpg`
- 临时 JPEG 帧和 WAV 在编码完成/取消后立即删除；`%TEMP%` 下超过 24 小时的残留会在下次启动时清理。

`DSH_HOME` 默认是 `~/.dsh`；可用环境变量 `VSR_LIBRARY_DIR` 覆盖存储根目录。

---

## 前置条件

| 条件 | 说明 |
| --- | --- |
| Windows 10 / 11 | 抓屏用 GDI，系统声音用 WASAPI 回环 |
| DSH 桌面版 0.2.2-rc.3+ | 用官方 `conversation.input.left` / `settings.section` 槽位 |
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
11. **快捷键只在 DSH 窗口内生效。** 没有注册系统级全局热键。

---

## 安全

- 所有处理都在本机：抓屏、录声音、编码、保存，不上传网络。
- 宿主路由只监听 DSH 自己的 Web 服务；截图/录屏内容不会离开本机。
- `/reveal` 只允许打开存储位置内的路径；`/record/save` 的文件名会去掉路径分隔符。
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
npm run check          # 语法检查
npm test               # 单元测试 + Windows 抓屏/声音集成测试
```

`client.js` 是生成文件；改客户端请改 `src/client.body.js`，然后重新 build。

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
