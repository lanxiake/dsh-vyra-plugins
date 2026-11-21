"""并发抢 watch 单例：同时起 5 个，最后只能活 1 个。"""
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
VENDOR = HERE.parent / "vendor"
sys.path.insert(0, str(VENDOR))
import worker  # noqa: E402

CODE = """
import sys, time, os
sys.path.insert(0, {vendor!r})
import worker
ok = worker._claim_watch_slot({token})
print('pid', os.getpid(), 'token', {token}, 'claimed', ok, flush=True)
if not ok:
    sys.exit(0)
time.sleep(60)
"""

procs = []
try:
    for f in (worker.WATCH_PID, worker.WATCH_LOCK):
        try:
            f.unlink()
        except FileNotFoundError:
            pass

    base = int(time.time() * 1000)
    procs = [subprocess.Popen(
        [sys.executable, "-c", CODE.format(vendor=str(VENDOR), token=base + i)],
        stdout=subprocess.PIPE, text=True,
    ) for i in range(5)]

    time.sleep(5)
    for p in procs:
        line = p.stdout.readline().strip()
        print(f"{line}  alive={p.poll() is None}")
    alive = [p for p in procs if p.poll() is None]
    print(f"存活 {len(alive)} / 5")
    assert len(alive) == 1, f"应该只活 1 个，实际 {len(alive)}"
    print("watch-single ok")
finally:
    for p in procs:
        if p.poll() is None:
            p.kill()
    time.sleep(0.5)
    for f in (worker.WATCH_PID, worker.WATCH_LOCK):
        try:
            f.unlink()
        except FileNotFoundError:
            pass
        except PermissionError:
            pass
