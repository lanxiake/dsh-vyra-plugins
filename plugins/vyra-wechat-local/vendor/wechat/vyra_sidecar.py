# -*- coding: utf-8 -*-
"""Local addition (not part of the Lumii snapshot): the vendored sidecar plus
the avatar lookup tool.

The snapshot's `sidecar.py` is kept byte-for-byte so a future re-vendor can
replace the whole directory. This wrapper imports it and adds one dispatch
entry before entering its unchanged main loop.
"""
import app
import sidecar
import vyra_avatar
import vyra_voice

sidecar.DISPATCH.update(vyra_avatar.DISPATCH)
sidecar.DISPATCH.update(vyra_voice.DISPATCH)
# The snapshot removed this tool because its dependencies were not bundled.
# They are installed by uv now, and the Host needs it to pre-transcribe voice
# messages before handing a batch to the agent.
sidecar.DISPATCH["transcribe_voice"] = app.tool_transcribe

if __name__ == "__main__":
    raise SystemExit(sidecar.main())
