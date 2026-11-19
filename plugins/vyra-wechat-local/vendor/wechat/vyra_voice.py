# -*- coding: utf-8 -*-
"""Local addition: voice-model status/download for the watch loop.

The sidecar's `transcribe_voice` is re-added by `vyra_sidecar.py`; this tool lets
the Host prepare the model in the background, so a download never blocks the
sidecar's request loop.
"""
import threading

import wechat_asr

_job = {"running": False, "done": False, "error": ""}


def _run_download():
    try:
        wechat_asr.download_model()
        _job["done"] = True
    except Exception as error:
        _job["error"] = f"{type(error).__name__}: {error}"
    finally:
        _job["running"] = False


def tool_voice_model(args):
    action = str((args or {}).get("action") or "status")
    deps = wechat_asr.deps()
    if action == "status":
        ok, why = wechat_asr.available()
        return {"ok": ok, "deps": deps, "model_dir": wechat_asr.model_dir(), "hint": why, "download": _job}
    if action == "download":
        if _job["running"]:
            return {"ok": False, "status": "downloading", "download": _job}
        ok, why = wechat_asr.available()
        if ok:
            return {"ok": True, "model_dir": wechat_asr.model_dir(), "hint": why, "download": _job}
        _job.update(running=True, done=False, error="")
        threading.Thread(target=_run_download, daemon=True, name="vyra-wechat-asr-download").start()
        return {"ok": False, "status": "downloading", "download": _job}
    return {"ok": False, "reason": "bad_args", "detail": "action 只能是 status / download"}


DISPATCH = {"wechat_voice_model": tool_voice_model}