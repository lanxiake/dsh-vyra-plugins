# 录屏 / 截图（Vyra Screen Recorder）

给 DSH 输入框工具条加两个按钮：**录屏** 和 **截图**。

- **录屏**：点开「选择要录制的内容」——整个桌面、某台显示器、某个窗口，或者拖框自定义区域；可以同时录**系统声音**和**麦克风**。停止后自动编成一个 `.webm` 视频，挂进输入框附件，并保存到本机。
- **截图**：抓整屏 → 拖框选区域 → 用画笔 / 矩形 / 箭头 / 文字标注 →「用这张」进附件。
- **不需要 Python、ffmpeg、Pillow、虚拟声卡**：抓屏、系统声音、编码全部用 Windows 自带能力和浏览器 WebCodecs 完成。

---

## 安装

在 DSH 插件市场搜索「录屏」安装，或者：

```bash
dsh plugin --profile desktop add vyra-screen-recorder
```

装完**完整重启 DSH**（宿主侧路由在进程启动时挂载）。

## 使用

### 录屏

1. 点输入框工具条左侧的 **录屏** 按钮。
2. 在弹出的选择框里选：
   - 整个桌面（所有显示器）
   - 显示器 N
   - 窗口（默认收起，点标题展开）
   - 自定义区域…（回到拖框浮层）
3. 底部可以关掉「系统声音」或「麦克风」；默认两个都开。
4. 开始后工具条上出现红点和计时；再点一次按钮，或按 `Esc`，停止。
5. 显示「正在编码」进度，完成后视频自动挂进输入框。提示条里有「打开文件夹」。

录屏中按 `Esc` 停止；录满 10 分钟会自动停止并开始编码。

### 截图

1. 点工具条左侧的 **截图** 按钮。
2. 整屏图铺开：拖框选区；单击不拖选整屏。
3. 松手后直接进入标注：画笔 / 矩形 / 箭头 / 文字，7 种颜色、三档粗细，撤销 / 清空 / 重选。
4. 点「用这张」，裁切并合成标注，JPEG 自动挂进输入框。

`Esc` 取消，`Ctrl+Z` 撤销上一笔。

### 产物

- 视频：`<DSH_HOME>/vyra-screen-recorder/recordings/录屏-YYYYMMDD-HHmmss.webm`
- 截图：同一目录下的 `截图-YYYYMMDD-HHmmss.jpg`
- 临时 JPEG 帧和 WAV 在编码完成/取消后立即删除；`%TEMP%` 下超过 24 小时的残留会在下次启动时清理。

`DSH_HOME` 默认是 `~/.dsh`；可用环境变量 `VSR_RECORDINGS_DIR` 改保存目录。

---

## 前置条件

| 条件 | 说明 |
| --- | --- |
| Windows 10 / 11 | 抓屏用 GDI，系统声音用 WASAPI 回环 |
| DSH 桌面版 0.2.2-rc.3+ | 用官方 `conversation.input.left` 槽位挂按钮 |
| Chromium / Electron 支持 WebCodecs | DSH 当前使用的 Electron 44 已内置 VP9 + Opus 编码 |

**不需要**安装任何额外软件。

---

## 已知限制

说清楚比说好听重要：

1. **窗口录制是屏幕像素，不是窗口流。** 别的窗口盖在它上面，就会录到遮挡物。
2. **录的是默认播放设备。** 切到耳机/音箱后需要重新开始录制；受 DRM 保护的音频可能录不到。
3. **默认 8 fps，最长 10 分钟。** 帧率和上限是为了控制体积和编码时间；UI 演示够用，不适合高帧率游戏录制。
4. **编码在停止后进行。** 录得越久，等待越久；进度条会如实显示。
5. **同时只允许一路录制。** 多开页面/多标签不会同时录。
6. **麦克风用系统默认输入设备。** 暂不支持在插件里选设备。
7. **目前只支持 Windows。** Mac / Linux 没有这套 GDI + WASAPI 实现。

---

## 安全

- 所有处理都在本机：抓屏、录声音、编码、保存，不上传网络。
- 宿主路由只监听 DSH 自己的 Web 服务；截图/录屏内容不会离开本机。
- `/reveal` 只允许打开录制目录内的路径；`/record/save` 的文件名会去掉路径分隔符。
- 临时文件在 `%TEMP%`，编码完成或取消后删除。

---

## 和旧插件的区别

旧插件 `dsh-screen-capture-record-desktop` 把按钮插在「听写」按钮左边；当前 DSH 里没有这个锚点，扫描不到就静默退出。它还依赖 Python 3 + Pillow + ffmpeg，并且 `recorder.py` 只抓画面、不录声音。

本插件：

- 用官方槽位 `conversation.input.left` 挂按钮，不依赖任何 DOM 锚点；
- 抓屏 / 声音全部走 Windows 自带能力，不要求 Python / ffmpeg；
- 系统声音和麦克风都录，停止后编成单个 WebM；
- 截图带选区与基础标注。

---

## 开发

```bash
npm run build:client   # src/client.body.js + vendor/webm-muxer.js -> client.js
npm run check          # 语法检查
npm test               # 单元测试 + Windows 抓屏/声音集成测试
```

`client.js` 是生成文件；改客户端请改 `src/client.body.js`，然后重新 build。

## 致谢

- **webm-muxer**（Vanilagy，MIT）：把 WebCodecs 的 VP9 / Opus 分片封装成 WebM。许可证见 [`vendor/webm-muxer-LICENSE.txt`](vendor/webm-muxer-LICENSE.txt)。

## 许可证

MIT。见 [LICENSE](LICENSE)。

## 交流

QQ 群：1121362543。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/qq-group.png" />
  <img alt="QQ 交流群二维码，群号 1121362543" src="./assets/qq-group.png" width="220" />
</picture>
