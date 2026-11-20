# -*- coding: utf-8 -*-
"""Local addition (not part of the Lumii snapshot): the vendored sidecar plus
the avatar lookup tool.

The snapshot's `sidecar.py` is kept byte-for-byte so a future re-vendor can
replace the whole directory. This wrapper imports it and adds one dispatch
entry before entering its unchanged main loop.
"""
import functools

import app
import sidecar
import wechat_core as core
import vyra_avatar
import vyra_image
import vyra_voice

sidecar.DISPATCH.update(vyra_avatar.DISPATCH)
sidecar.DISPATCH.update(vyra_image.DISPATCH)
sidecar.DISPATCH.update(vyra_voice.DISPATCH)
# The snapshot removed this tool because its dependencies were not bundled.
# They are installed by uv now, and the Host needs it to pre-transcribe voice
# messages before handing a batch to the agent.
sidecar.DISPATCH["transcribe_voice"] = app.tool_transcribe

# Tools that read the process-wide account and ignore `args["account"]` (notably
# `poll_new`, whose implementation is just `core.poll(since_ts)`). With two WeChat
# instances logged in, the Host must be able to say which one each call means.
# Same semantics as Lumii's MCP: switch before the call, the next call switches
# again; the Host restores the user's selection after its own loops.
_ACCOUNT_SCOPED = {
    "list_sessions", "read_history", "search_messages", "poll_new", "list_unread",
    "read_image", "transcribe_voice", "export_chat", "preview_export",
    "wechat_digest", "wechat_profile_save", "wechat_profile_get",
    "wechat_distill_state", "wechat_distill_clear",
    "wechat_avatar", "wechat_image_fetch",
}


def _bind_account(fn):
    @functools.wraps(fn)
    def wrapped(args):
        account = (args or {}).get("account") if isinstance(args, dict) else None
        account = str(account or "").strip()
        if account:
            core.set_account(account)
        return fn(args)
    return wrapped


for _name in _ACCOUNT_SCOPED:
    if _name in sidecar.DISPATCH:
        sidecar.DISPATCH[_name] = _bind_account(sidecar.DISPATCH[_name])


def tool_profile_list(_args):
    """Distilled profiles with metadata (for the settings page, not the model)."""
    return core.profile_list()


# Dispatch-only (not in TOOLS): the settings page lists profiles through it.
sidecar.DISPATCH["wechat_profile_list"] = tool_profile_list

if __name__ == "__main__":
    raise SystemExit(sidecar.main())
