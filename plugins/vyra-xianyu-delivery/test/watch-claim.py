"""检查 watch 单例：新实例杀旧的，旧实例的重试让位并退出。"""
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
VENDOR = HERE.parent / "vendor"
sys.path.insert(0, str(VENDOR))
import worker  # noqa: E402

CODE = """
import sys, time
sys.path.insert(0, {vendor!r})
import worker
ok = worker._claim_watch_slot({token})
print('claimed', ok, flush=True)
if not ok:
    sys.exit(0)
time.sleep(60)
"""


def spawn(token):
    return subprocess.Popen(
        [sys.executable, "-c", CODE.format(vendor=str(VENDOR), token=token)],
        stdout=subprocess.PIPE, text=True,
    )


try:
    worker.WATCH_PID.unlink()
except FileNotFoundError:
    pass

procs = []
try:
    a = spawn(1000); procs.append(a)
    time.sleep(1.5)
    assert a.poll() is None and "claimed True" in a.stdout.readline()
    b = spawn(2000); procs.append(b)
    time.sleep(2.0)
    assert a.poll() is not None, "新实例应该杀掉旧实例"
    assert "claimed True" in b.stdout.readline()
    assert b.poll() is None, "新实例应该活着"

    c = spawn(1000); procs.append(c)  # 旧插件实例的重试
    out = c.stdout.readline()
    assert "claimed False" in out, out
    c.wait(timeout=5)
    assert b.poll() is None, "旧实例让位后，新实例仍应存活"
    print("watch-claim ok")
finally:
    for p in procs:
        if p.poll() is None:
            p.kill()
    try:
        worker.WATCH_PID.unlink()
    except FileNotFoundError:
        pass
