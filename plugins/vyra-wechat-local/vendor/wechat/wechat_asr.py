# -*- coding: utf-8 -*-
"""Local voice transcription: SILK -> PCM -> Paraformer -> text.

This module is ours (MIT), written to the small interface the vendored sidecar
expects (`deps`, `available`, `model_dir`, `transcribe`, `download_model`) so
`check_env` and `transcribe_voice` work without touching upstream files.

Decoding uses `pilk`; recognition uses the public sherpa-onnx Paraformer model
(`paraformer-zh-small`, Apache-2.0). Everything runs on this machine; audio and
text never leave it.
"""
import os
import sys
import threading
import urllib.request

SAMPLE_RATE = 24_000
MODEL_FILES = ("model.int8.onnx", "tokens.txt")
MODEL_BASES = (
    "https://hf-mirror.com/csukuangfj/sherpa-onnx-paraformer-zh-small-2024-03-09/resolve/main/",
    "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/"
    "sherpa-onnx-paraformer-zh-small-2024-03-09/",
)

_lock = threading.Lock()
_recognizer = None


def model_dir():
    env = os.environ.get("VYRA_WECHAT_ASR_MODEL") or os.environ.get("LUMII_WECHAT_ASR_MODEL")
    if env:
        return env
    return os.path.join(os.path.expanduser("~"), ".dsh", "wechat-local", "models", "voice", "paraformer-zh-small")


def _missing():
    return [name for name in MODEL_FILES if not os.path.exists(os.path.join(model_dir(), name))]


def deps():
    import importlib.util
    found = {name: importlib.util.find_spec(name) is not None for name in ("pilk", "sherpa_onnx", "numpy")}
    return {**found, "ok": all(found.values())}


def available():
    d = deps()
    if not d["ok"]:
        missing = [name for name, ok in d.items() if name != "ok" and not ok]
        return False, f"语音转写依赖缺失：{', '.join(missing)}"
    missing = _missing()
    if missing:
        return False, f"语音模型未下载（{model_dir()} 缺 {', '.join(missing)}）"
    return True, ""


def _load():
    global _recognizer
    with _lock:
        if _recognizer is not None:
            return _recognizer
        import sherpa_onnx
        directory = model_dir()
        _recognizer = sherpa_onnx.OfflineRecognizer.from_paraformer(
            paraformer=os.path.join(directory, "model.int8.onnx"),
            tokens=os.path.join(directory, "tokens.txt"),
            num_threads=4,
            sample_rate=16_000,
            feature_dim=80,
            decoding_method="greedy_search",
            debug=False,
        )
        return _recognizer


def transcribe(silk_path):
    """SILK file -> text. Raises on failure; callers surface the reason."""
    import numpy as np
    import pilk
    recognizer = _load()
    pcm_path = f"{silk_path}.{SAMPLE_RATE}.pcm"
    try:
        pilk.decode(silk_path, pcm_path, pcm_rate=SAMPLE_RATE)
        with open(pcm_path, "rb") as handle:
            raw = handle.read()
    finally:
        try:
            os.remove(pcm_path)
        except OSError:
            pass
    samples = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    stream = recognizer.create_stream()
    stream.accept_waveform(SAMPLE_RATE, samples)
    recognizer.decode_stream(stream)
    return str(stream.result.text or "").strip()


def download_model(progress=None):
    """Fetch the public model into `model_dir()`, resuming only what is missing."""
    directory = model_dir()
    os.makedirs(directory, exist_ok=True)
    say = progress or (lambda message: print(message, file=sys.stderr, flush=True))
    for name in MODEL_FILES:
        target = os.path.join(directory, name)
        if os.path.exists(target):
            continue
        last_error = None
        for base in MODEL_BASES:
            try:
                say(f"下载语音模型 {name} ← {base}")
                temp = target + ".part"
                with urllib.request.urlopen(base + name, timeout=60) as response, open(temp, "wb") as handle:
                    # The mirror redirects to a CDN; stop at the advertised length
                    # so a keep-alive connection cannot leave the loop waiting for EOF.
                    total = int(response.headers.get("Content-Length") or 0)
                    done = 0
                    while True:
                        chunk = response.read(1 << 20)
                        if not chunk:
                            break
                        handle.write(chunk)
                        done += len(chunk)
                        if total and done >= total:
                            break
                os.replace(temp, target)
                break
            except Exception as error:  # try the next mirror
                last_error = error
        else:
            raise RuntimeError(f"下载 {name} 失败：{last_error}")
    say(f"语音模型就绪：{directory}")
    return directory


if __name__ == "__main__":
    print("deps:", deps())
    print("available:", available())
    if len(sys.argv) > 1:
        print(transcribe(sys.argv[1]))
