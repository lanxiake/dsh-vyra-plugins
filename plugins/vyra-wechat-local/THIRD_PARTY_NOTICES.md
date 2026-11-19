# Third-party notices

`vendor/wechat/` 是 [lumii](https://github.com/lumii) Windows 应用里「本机微信」能力的
Python 侧车，按 MIT 许可原样引入，未改名、未修改业务逻辑。

## Lumii

MIT License

Copyright (c) 2026 Lumii

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### 二次来源

`vendor/wechat/wxkey4.py` 的文件头写明：改写自
`sunhanaix/pc_wechat_exp` 的 `config_cipher_extract.py`（去掉了其 `engine.*` 依赖）。
本仓库按上游原样保留这段说明与代码，不删除该出处。

## 本插件自己的 Python 文件（不属于 Lumii 快照）

- `vendor/wechat/vyra_sidecar.py`：十行包装，导入未改动的 `sidecar.py`，只往
  `DISPATCH` 里加一个头像工具，然后进入它原来的主循环。
- `vendor/wechat/vyra_avatar.py`：从微信 `db_storage/head_image/head_image.db` 读联系人/群头像。
  用 `wechat_core._mirror` 已有的解密镜像，不新增解密路径。
- `vendor/wechat/vyra_voice.py`：语音模型的下载/状态工具。
- `vendor/wechat/wechat_asr.py`：本仓库自己写的本地语音转写（MIT）。运行时依赖
  [`pilk`](https://pypi.org/project/pilk/)（SILK 解码）与
  [`sherpa-onnx`](https://github.com/k2-fsa/sherpa-onnx)（Apache-2.0），识别模型为
  `sherpa-onnx-paraformer-zh-small-2024-03-09`（k2-fsa 发布，Apache-2.0），
  首次使用时下载到 `~/.dsh/wechat-local/models/`，不随插件分发。

这两个文件由本仓库维护，MIT；Lumii 的 `sidecar.py`、`app.py` 等保持原样。

## Python 依赖（运行时由 uv 获取，不随本插件分发）

- `pycryptodome`（BSD-2-Clause / public domain 混合，见其发行包）
- `zstandard`（BSD-3-Clause）
