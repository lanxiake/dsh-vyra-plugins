# -*- coding: utf-8 -*-
"""Local addition (not part of the Lumii snapshot): the vendored sidecar plus
the avatar lookup tool.

The snapshot's `sidecar.py` is kept byte-for-byte so a future re-vendor can
replace the whole directory. This wrapper imports it and adds one dispatch
entry before entering its unchanged main loop.
"""
import sidecar
import vyra_avatar

sidecar.DISPATCH.update(vyra_avatar.DISPATCH)

if __name__ == "__main__":
    raise SystemExit(sidecar.main())
