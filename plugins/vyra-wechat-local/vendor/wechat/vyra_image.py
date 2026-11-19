# -*- coding: utf-8 -*-
"""Local addition: image fetch that understands WeChat's display cache.

Modern WeChat stores the original as WXGF (not a bitmap the model can read) but
also writes a decoded JPEG into `cache/<month>/Message/<hash>/Bubble/<name>_b.dat`.
The account's image AES key lives in `~/.lumii/wechat-cache/image_key.json`;
the vendored `wechat_image` looks in a different profile directory and can miss
it. Try the display cache first, then the normal attach-file path.
"""
import base64
import glob
import json
import os

import wechat_core as core
import wechat_image as image


def _fail(code, detail, suggestion=""):
    return {"ok": False, "error_code": code, "detail": detail, "suggestion": suggestion, "stage": "media"}


def _account_key():
    """The logged-in account's image key from the Lumii cache, then the vendored path."""
    try:
        with open(os.path.expanduser("~/.lumii/wechat-cache/image_key.json")) as handle:
            data = json.load(handle)
        me = core.self_wxid()
        raw = (data.get("keys") or {}).get(me) or data.get("aes_key")
        if raw:
            return bytes.fromhex(raw)
    except Exception:
        pass
    return image.cached_aes_key()


def _bubble_path(base):
    if not base:
        return None
    root = os.path.dirname(core.db_root())
    hits = glob.glob(os.path.join(root, "cache", "*", "Message", "*", "Bubble", base + "_b.dat"))
    return hits[0] if hits else None


def tool_image_fetch(args):
    talker = str((args or {}).get("talker") or "").strip()
    local_id = args.get("local_id")
    ts = int(args.get("ts") or 0)
    if not talker or local_id is None:
        return _fail("bad_args", "talker 和 local_id 必填")
    message = core._message_by_id(talker, local_id, ts=ts, want_type=3)
    if not message:
        return _fail("target_not_found", "这个会话里没有这条图片消息（local_id/ts 不匹配？）")
    if message.get("type") != 3:
        return _fail("bad_args", "这条消息不是图片")
    key = _account_key()
    if key is None:
        return _fail("env_not_ready", "图片 AES 密钥还没抓过：先在微信里点开一张图，再运行一次图片密钥抓取",
                     "运行 ``wechat-mcp.exe --image-key``，或在 Lumii 客户端里打开一张大图")
    base = str(message.get("image_name") or "")
    # 1. The decoded display cache (JPEG/PNG the model can read directly).
    bubble = _bubble_path(base)
    if bubble:
        try:
            with open(bubble, "rb") as handle:
                raw = image.decrypt(handle.read(), key)
            if raw and image.looks_like_image(raw):
                mime = "image/png" if raw[:4] == b"\x89PNG" else "image/jpeg"
                return {"ok": True, "talker": talker, "local_id": message.get("local_id"),
                        "time": message.get("time"), "source": "bubble", "mime": mime,
                        "bytes": len(raw), "data": base64.b64encode(raw).decode("ascii")}
        except Exception:
            pass
    # 2. The normal attach-file path with the account key, then the vendored cached key.
    for candidate in (key, image.cached_aes_key()):
        if not candidate:
            continue
        path = image.image_file(message.get("image_md5"), candidate, message.get("image_name"))
        if not path:
            continue
        try:
            with open(path, "rb") as handle:
                raw = handle.read()
        except OSError:
            continue
        mime = "image/png" if raw[:4] == b"\x89PNG" else "image/jpeg"
        return {"ok": True, "talker": talker, "local_id": message.get("local_id"),
                "time": message.get("time"), "source": "attach", "mime": mime,
                "bytes": len(raw), "data": base64.b64encode(raw).decode("ascii")}
    return _fail("image_missing", "图没落到本地：原图/中图/显示缓存都取不到",
                 "让对方重发一次，或在微信里点开这张图后再试")


DISPATCH = {"wechat_image_fetch": tool_image_fetch}