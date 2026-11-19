# -*- coding: utf-8 -*-
"""Local addition (not part of the Lumii snapshot): contact avatar lookup.

WeChat stores contact and group avatars in `db_storage/head_image/head_image.db`
(`username`, `md5`, `image_buffer`). `wechat_core._mirror` already decrypts that
store for the other sidecar readers, so this module only queries it.

Registered through `vyra_sidecar.py`; `sidecar.py` itself is left untouched.
"""
import base64
import sqlite3

import wechat_core as core


def tool_avatar(args):
    talker = str((args or {}).get("talker") or "").strip()
    if not talker:
        return {"ok": False, "reason": "bad_args", "detail": "talker 必填"}
    try:
        mirror = core._mirror("head_image/head_image.db")
        mirror.refresh()
        con = sqlite3.connect(mirror.out)
        try:
            row = con.execute(
                "select md5, image_buffer from head_image where username=? limit 1",
                (talker,),
            ).fetchone()
        finally:
            con.close()
    except Exception as e:
        return {"ok": False, "reason": "db_error", "detail": f"{type(e).__name__}: {e}"}
    if not row or not row[1]:
        return {"ok": False, "reason": "no_avatar", "talker": talker}
    data = bytes(row[1])
    if data.startswith(b"\x89PNG"):
        mime = "image/png"
    elif data.startswith(b"\xff\xd8"):
        mime = "image/jpeg"
    elif data.startswith(b"GIF8"):
        mime = "image/gif"
    else:
        mime = "application/octet-stream"
    return {
        "ok": True,
        "talker": talker,
        "md5": str(row[0] or ""),
        "mime": mime,
        "bytes": len(data),
        "data": base64.b64encode(data).decode("ascii"),
    }


DISPATCH = {"wechat_avatar": tool_avatar}
