"""JSON bridge for vyra-xianyu-delivery.

Borrows goofish-cli's shipped core (login state, mtop signing, IM send) from
PyPI, and implements the two seller endpoints the CLI does not ship yet:
`mtop.taobao.idle.trade.merchant.sold.get` and
`mtop.taobao.idle.logistic.consign.dummy`.

Usage:
    uv run --with goofish-cli python worker.py <command> '<json args>'

Commands: sold-list, confirm, send, status
Output: one JSON object on stdout. Never raises past the process boundary.
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any

SELLER_HEADERS = {"origin": "https://seller.goofish.com", "referer": "https://seller.goofish.com/"}


def _persist_cookies(session: Any) -> None:
    """把 requests 的 cookie jar 写回 cookies.json。

    mtop 每次响应都会轮换 `_m_h5_tk`，但 goofish-cli 只把它留在内存里，
    下一条命令又从磁盘读旧值——这就是「登录十分钟就过期」的根因。
    """
    try:
        from goofish_cli.core.session import resolve_cookie_path, write_cookies_json

        path = resolve_cookie_path()
        domains: dict[str, str] = {}
        for rec in getattr(session, "cookie_records", None) or []:
            name = rec.get("name") if isinstance(rec, dict) else getattr(rec, "name", "")
            domain = rec.get("domain") if isinstance(rec, dict) else getattr(rec, "domain", "")
            if name:
                domains[str(name)] = str(domain or ".goofish.com")
        records = [
            {
                "name": cookie.name,
                "value": cookie.value,
                "domain": cookie.domain or domains.get(cookie.name) or ".goofish.com",
                "path": cookie.path or "/",
            }
            for cookie in session.http.cookies
        ]
        if records:
            write_cookies_json(path, records)
    except Exception:  # noqa: BLE001 — 写盘失败不能影响命令结果
        pass


def _install_cookie_persist() -> None:
    """每次 mtop 调用后都写回 cookie，让 token 自己续上，不靠浏览器。"""
    try:
        import goofish_cli.core.mtop as mtop

        if getattr(mtop.call, "_persists_cookies", False):
            return
        original = mtop.call

        def call_with_persist(session, *args, **kwargs):  # type: ignore[no-untyped-def]
            retried = bool(kwargs.pop("_retried", False))
            try:
                return original(session, *args, **kwargs)
            except Exception as exc:  # noqa: BLE001
                # 令牌过期时服务器会在这条失败响应的 Set-Cookie 里发新 _m_h5_tk。
                # 先写回，再用同一个 session（jar 已更新）重试一次——不需要浏览器。
                _persist_cookies(session)
                from goofish_cli.core.errors import AuthRequiredError

                message = str(exc)
                token_level = isinstance(exc, AuthRequiredError) and any(
                    key in message for key in ("TOKEN_EXOIRED", "TOKEN_EMPTY", "令牌过期")
                )
                if token_level and not retried:
                    return original(session, *args, _retried=True, **kwargs)
                raise

        call_with_persist._persists_cookies = True  # type: ignore[attr-defined]
        mtop.call = call_with_persist
    except Exception:  # noqa: BLE001
        pass


def _spec_of(item: dict[str, Any]) -> tuple[str, str]:
    for line in ((item.get("itemVO") or {}).get("itemInfoLines")) or []:
        k = str((line or {}).get("key") or "").strip()
        v = str((line or {}).get("value") or "").strip()
        if k and v:
            return k, v
    return "", ""


def _ret_of(raw: dict[str, Any] | None) -> str:
    ret = (raw or {}).get("ret") or []
    return ret[0] if isinstance(ret, list) and ret else str(ret)


def _already(ret: str) -> bool:
    return "ORDER_ALREADY_DELIVERY" in ret or "已发货成功" in ret


def sold_list(page_number: int = 1, query_code: str = "NOT_SHIP") -> dict[str, Any]:
    from goofish_cli.core import Session
    from goofish_cli.core.mtop import call, default_headers

    session = Session.load()
    headers = default_headers()
    headers.update(SELLER_HEADERS)

    raw = call(
        session,
        api="mtop.taobao.idle.trade.merchant.sold.get",
        data={
            "pageNumber": int(page_number),
            "orderIds": "",
            "queryCode": str(query_code),
            "orderSearchParam": "{}",
        },
        spm_cnt="a21107h.42826273.0.0",
        extra_params={"valueType": "string"},
        headers=headers,
    )

    data = raw.get("data") or {}
    module = data.get("module") or {}
    orders = []
    for it in module.get("items") or []:
        common = it.get("commonData") or {}
        buyer = it.get("buyerInfoVO") or {}
        price = it.get("priceVO") or {}
        spec_name, spec_value = _spec_of(it)
        orders.append(
            {
                # 19-digit order ids overflow JS safe integers; keep them as strings.
                "order_no": str(common.get("orderId") or ""),
                "item_id": str(common.get("itemId") or ""),
                "status": common.get("orderStatus") or "",
                "in_refund": common.get("inRefund") == "true",
                "buyer_id": str(buyer.get("buyerId") or ""),
                "buyer_nick": str(buyer.get("userNick") or ""),
                "amount": str(price.get("totalPrice") or "0"),
                "quantity": int(price.get("buyNum") or 1),
                "spec_name": spec_name,
                "spec_value": spec_value,
                "is_bargain": any(
                    b.get("tradeAction") == "SKIP_PIN"
                    for b in ((it.get("rightVO") or {}).get("btnList") or [])
                ),
            }
        )

    return {
        "page": int(page_number),
        "query_code": str(query_code),
        "next_page": str(module.get("nextPage", "false")).lower() == "true",
        "total": int(module.get("totalCount") or 0),
        "orders": orders,
    }


def confirm(order_id: str, trade_text: str = "") -> dict[str, Any]:
    from goofish_cli.core import GoofishError, Session
    from goofish_cli.core.mtop import call
    from goofish_cli.core.write_operation import write_operation

    session = Session.load()
    data = {
        "orderId": str(order_id),
        "tradeText": (trade_text or "").strip(),
        "picList": [],
        "newUnconsign": True,
    }

    try:
        with write_operation(session, "order.write"):
            raw = call(
                session,
                api="mtop.taobao.idle.logistic.consign.dummy",
                data=data,
                spm_cnt="a21ybx.order.0.0",
            )
    except GoofishError as e:
        ret = _ret_of(e.raw) or str(e)
        if _already(ret):
            return {"order_id": str(order_id), "ok": True, "already": True, "message": ret}
        raise

    ret = _ret_of(raw)
    return {"order_id": str(order_id), "ok": "SUCCESS" in ret, "already": _already(ret), "message": ret}


def send(cid: str, toid: str, text: str, item_id: str = "") -> dict[str, Any]:
    from goofish_cli.commands.message.send import send as cli_send

    return cli_send(cid, toid, text=text, item_id=item_id)


def status() -> dict[str, Any]:
    from goofish_cli.core import Session

    session = Session.load()
    return {"unb": session.unb, "tracknick": session.tracknick, "valid": True}


def items(limit: int = 50) -> dict[str, Any]:
    """当前账号在售商品。"""
    from goofish_cli.commands.item.list import list_items

    return list_items(int(limit))


async def _list_conversations(limit: int = 200) -> list[dict[str, Any]]:
    """网页版 IM 用的会话分页接口，比 HTTP session.sync 全得多。

    `/r/Conversation/listNewestPagination` 返回 userConvs；每页最多 50，
    hasMore/nextCursor 翻页。
    """
    from goofish_cli.core.message_history import history_connection
    from goofish_cli.core.session import Session
    from goofish_cli.core.sign import generate_mid
    from goofish_cli.core.ws import recv_ack

    session = Session.load()
    myid = session.unb
    out: list[dict[str, Any]] = []
    cursor: Any = 9007199254740991

    async with history_connection(session) as ws:
        while len(out) < limit:
            mid = generate_mid()
            await ws.send(
                json.dumps(
                    {
                        "lwp": "/r/Conversation/listNewestPagination",
                        "headers": {"mid": mid},
                        "body": [cursor, min(50, limit - len(out))],
                    },
                    ensure_ascii=False,
                )
            )
            ack = await recv_ack(ws, mid, timeout=10)
            body = (ack or {}).get("body") or {}
            items = body.get("userConvs") or []
            for raw in items:
                conv = raw.get("singleChatUserConversation") or raw
                single = conv.get("singleChatConversation") or {}
                cid = str(single.get("cid") or "").split("@")[0]
                if not cid:
                    continue
                first = str(single.get("pairFirst") or "").split("@")[0]
                second = str(single.get("pairSecond") or "").split("@")[0]
                peer = second if first == myid else first
                # 对方 ID 为空或 "0" 的是系统/通知会话，网页版也不把它们当聊天。
                if not peer or peer == "0":
                    continue

                ext_raw = single.get("extension") or {}
                if isinstance(ext_raw, str):
                    try:
                        ext_raw = json.loads(ext_raw)
                    except (ValueError, TypeError):
                        ext_raw = {}
                item_title = str((ext_raw or {}).get("itemTitle") or "") if isinstance(ext_raw, dict) else ""
                # 会话本身就绑着商品：买家从聊天列表进来也能定位商品。
                item_id = str((ext_raw or {}).get("itemId") or "") if isinstance(ext_raw, dict) else ""

                last = (conv.get("lastMessage") or {}).get("message") or {}
                last_ext = last.get("extension") or {}
                if isinstance(last_ext, str):
                    try:
                        last_ext = json.loads(last_ext)
                    except (ValueError, TypeError):
                        last_ext = {}
                sender = str((last_ext or {}).get("senderUserId") or "").split("@")[0]
                nick = str((last_ext or {}).get("reminderTitle") or "")
                # 最后一条是对方发的，reminderTitle 才是对方昵称；
                # 否则用会话扩展里的 squadName_<对方id>（就是对方在这个会话下的显示名）。
                squad_name = ""
                if isinstance(ext_raw, dict):
                    squad_name = str(ext_raw.get(f"squadName_{peer}") or "")
                peer_nick = (nick if sender == peer and nick else "") or squad_name

                content = last.get("content") or {}
                custom = content.get("custom") or {}
                text = str(custom.get("summary") or "")
                if not text and custom.get("data"):
                    try:
                        payload = json.loads(base64.b64decode(custom["data"]))
                        text_obj = payload.get("text") or {}
                        text = text_obj.get("text", "") if isinstance(text_obj, dict) else str(text_obj)
                    except (ValueError, TypeError, UnicodeDecodeError):
                        text = ""

                out.append(
                    {
                        "session_id": cid,
                        "peer_user_id": peer,
                        "peer_nick": peer_nick,
                        "last_msg": text[:60],
                        "ts": int(conv.get("modifyTime") or 0) or None,
                        "unread": int(conv.get("redPoint") or 0),
                        "item_id": item_id,
                        "item_title": item_title,
                        "source": "im",
                    }
                )
                if body.get("hasMore") not in (1, "1", True) or not items:
                    break
                nxt = body.get("nextCursor")
                if nxt is None:
                    break
                cursor = nxt
    return out


def chats(fetch_num: int = 200) -> dict[str, Any]:
    """全量会话列表：先走 IM 分页接口，失败回退到 goofish-cli 的 HTTP 版本。"""
    try:
        rows = asyncio.run(_list_conversations(int(fetch_num)))
        if rows:
            return {"sessions": rows, "total": len(rows)}
    except Exception:  # noqa: BLE001 — 回退到有界版本
        pass
    from goofish_cli.commands.message.list_chats import list_chats

    return list_chats(fetch_num=int(fetch_num), watch_secs=0)


async def _refresh_session_once(headless: bool) -> dict[str, Any]:
    from playwright.async_api import async_playwright

    from goofish_cli.core.refresh import AUTH_PROBE_URL, _try_quick_enter
    from goofish_cli.core.session import Session, resolve_cookie_path, write_cookies_json

    session = Session.load()
    path = resolve_cookie_path()

    async with async_playwright() as pw:
        browser = await _launch_browser(pw, headless=headless)
        context = await browser.new_context(locale="zh-CN", timezone_id="Asia/Shanghai")
        try:
            # 用 cookie_records 而不是 http.cookies：前者保留了 domain/path，
            # 否则 add_cookies 会报 "Cookie should have a url or a domain/path pair"。
            # 记录可能是 dict 也可能是 CookieRecord，两种都兼容。
            def _pick(record: Any, key: str) -> str:
                if isinstance(record, dict):
                    return str(record.get(key) or "")
                return str(getattr(record, key, "") or "")

            records = getattr(session, "cookie_records", None) or []
            current = []
            for r in records:
                name = _pick(r, "name")
                value = _pick(r, "value")
                if not name or not value:
                    continue
                current.append({
                    "name": name,
                    "value": value,
                    "domain": _pick(r, "domain") or ".goofish.com",
                    "path": _pick(r, "path") or "/",
                })
            if not current:
                current = [
                    {"name": c.name, "value": c.value, "domain": c.domain or ".goofish.com", "path": "/"}
                    for c in session.http.cookies
                ]
            await context.add_cookies(current)
            page = await context.new_page()
            await page.goto("https://www.goofish.com", wait_until="domcontentloaded")
            await page.wait_for_timeout(1500)
            await _try_quick_enter(page)
            await page.goto(AUTH_PROBE_URL, wait_until="domcontentloaded")
            await page.wait_for_timeout(2500)

            fresh = await context.cookies()
            names = {c["name"] for c in fresh if c.get("value")}
            missing = [k for k in ("_m_h5_tk", "unb", "cookie2") if k not in names]
            if missing:
                raise RuntimeError(f"刷新后仍缺少关键 cookie：{', '.join(missing)}")

            write_cookies_json(
                path,
                [
                    {"name": c["name"], "value": c["value"], "domain": c.get("domain", ""), "path": c.get("path", "/")}
                    for c in fresh
                    if c.get("name") and c.get("value")
                ],
            )
            return {
                "ok": True,
                "unb": next((c["value"] for c in fresh if c["name"] == "unb"), ""),
                "headless": headless,
            }
        finally:
            try:
                await asyncio.wait_for(context.close(), timeout=8)
            except Exception:  # noqa: BLE001
                pass
            try:
                await asyncio.wait_for(browser.close(), timeout=8)
            except Exception:  # noqa: BLE001
                pass


REFRESH_STATE = Path.home() / ".goofish-cli" / "refresh-state.json"
REFRESH_COOLDOWN_SECS = 900  # 15 分钟：失败后别再反复弹浏览器


def _mark_refresh_failure(error: str) -> None:
    try:
        REFRESH_STATE.parent.mkdir(parents=True, exist_ok=True)
        REFRESH_STATE.write_text(
            json.dumps({"failedAt": int(time.time()), "error": str(error)[:300]}, ensure_ascii=False),
            encoding="utf-8",
        )
    except Exception:  # noqa: BLE001
        pass


def _refresh_cooldown_left() -> int:
    try:
        state = json.loads(REFRESH_STATE.read_text(encoding="utf-8"))
        failed_at = int(state.get("failedAt") or 0)
    except Exception:  # noqa: BLE001
        return 0
    left = failed_at + REFRESH_COOLDOWN_SECS - int(time.time())
    return max(0, left)


def _clear_refresh_failure() -> None:
    try:
        REFRESH_STATE.unlink()
    except Exception:  # noqa: BLE001
        pass


def _has_cookies() -> bool:
    """没登录（没有 cookie）时不要尝试刷新：刷新只会打开浏览器要扫码。"""
    try:
        from goofish_cli.core.session import resolve_cookie_path

        path = Path(resolve_cookie_path())
    except Exception:  # noqa: BLE001
        path = Path.home() / ".goofish-cli" / "cookies.json"
    try:
        return path.exists() and path.stat().st_size > 2
    except Exception:  # noqa: BLE001
        return False


async def _refresh_session(headful: bool = False) -> dict[str, Any]:
    """默认只跑无头刷新；headful 只有用户明确要求时才回退。

    无头失败说明 cookie 已经救不回来，再弹一个浏览器窗口要求扫码只会打扰人。
    """
    errors: list[str] = []
    modes = (True, False) if headful else (True,)
    for headless in modes:
        try:
            return await _refresh_session_once(headless)
        except Exception as e:  # noqa: BLE001
            errors.append(f"{'headless' if headless else 'headful'}: {e}")
    raise RuntimeError("；".join(errors))


def refresh_session(headful: bool = False) -> dict[str, Any]:
    if not _has_cookies():
        raise RuntimeError("未登录：没有 cookie，不做自动刷新")
    left = _refresh_cooldown_left()
    if left:
        raise RuntimeError(f"自动刷新冷却中（还剩 {left // 60} 分钟），需要重新扫码请点面板的扫码登录")
    try:
        result = asyncio.run(_refresh_session(headful))
    except Exception as e:
        _mark_refresh_failure(str(e))
        raise
    _clear_refresh_failure()
    return result


def user_info(cid: str, owner: bool = False) -> dict[str, Any]:
    """会话对方的头像与昵称（网页版 IM 用的 user.query 接口）。"""
    from goofish_cli.core import Session
    from goofish_cli.core.mtop import call

    session = Session.load()
    raw = call(
        session,
        api="mtop.taobao.idlemessage.pc.user.query",
        data={"type": 0, "sessionType": 1, "sessionId": str(cid), "isOwner": bool(owner)},
        version="4.0",
        spm_cnt="a21ybx.im.0.0",
    )
    info = (raw.get("data") or {}).get("userInfo") or {}
    return {"avatar": str(info.get("logo") or ""), "nick": str(info.get("nick") or "")}


def item_detail(item_id: str) -> dict[str, Any]:
    from goofish_cli.commands.item.get import get as get_item

    return get_item(str(item_id))


def order_detail(order_id: str) -> dict[str, Any]:
    from goofish_cli.core import Session
    from goofish_cli.core.mtop import call

    session = Session.load()
    raw = call(
        session,
        api="mtop.idle.web.trade.order.detail",
        data={"tid": str(order_id)},
        version="1.0",
        spm_cnt="a21ybx.order-detail.0.0",
    )
    return raw.get("data") or {}


def history(cid: str, limit: int = 10) -> list[dict[str, Any]]:
    from goofish_cli.commands.message.history import history as cli_history

    # 每页 50 条，整体最多 90 秒：网页版的会话历史常常几百条，30 秒不够。
    return cli_history(cid, limit_per_page=50, limit=int(limit), timeout=90.0)


WATCH_PID = Path.home() / ".goofish-cli" / "watch.pid"
WATCH_LOCK = Path.home() / ".goofish-cli" / "watch.lock"


def _pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    if os.name == "nt":
        import ctypes

        handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)  # QUERY_LIMITED_INFORMATION
        if not handle:
            return False
        ctypes.windll.kernel32.CloseHandle(handle)
        return True
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def _read_watch_pid() -> tuple[int, int]:
    try:
        parts = WATCH_PID.read_text(encoding="utf-8").strip().split("|")
        return int(parts[0]), int(parts[1])
    except Exception:  # noqa: BLE001 — 没有文件 / 格式坏了都当没有
        return 0, 0


def _kill_watch(pid: int) -> None:
    """强杀遗留的 watch。Windows 上 SIGTERM 不一定生效，直接 taskkill /F。"""
    if not pid or pid == os.getpid():
        return
    try:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/PID", str(pid), "/T", "/F"],
                capture_output=True, timeout=10,
            )
        else:
            os.kill(pid, signal.SIGKILL)
    except Exception:  # noqa: BLE001 — 已经退出 / 没有权限
        pass


def _claim_watch_slot(token: int) -> bool:
    """同一时间只留一个 watch，返回 False 表示自己该退出。

    插件热重载/多开会留下没人管的旧 watch；多个实例同时连 IM 会互相把连接
    踢掉，表现就是"买家发了消息但插件收不到事件"。

    单例分两层：
    1. 文件锁（portalocker）保证"读 pid → 判活 → 写 pid"是原子的。
       必须用 r+ 从偏移 0 加锁：Windows 上 msvcrt 锁的是当前偏移处的字节，
       a+ 会随写长度变化锁到不同位置，等于没锁。
    2. 拿不到锁说明别人在操作，或它已经跑起来了：杀掉 pid 文件里的进程再重试。
    无论插件实例先后，最后只有最后一个启动的 watch 存活。
    """
    try:
        from portalocker import Lock, LockException
    except ImportError:
        return _claim_watch_slot_nolock(token)

    WATCH_LOCK.parent.mkdir(parents=True, exist_ok=True)
    if not WATCH_LOCK.exists() or WATCH_LOCK.stat().st_size == 0:
        WATCH_LOCK.write_text("0", encoding="utf-8")

    for _ in range(3):
        lock = Lock(str(WATCH_LOCK), mode="r+", timeout=0)
        try:
            lock.acquire()
        except (LockException, TimeoutError, OSError):
            # 锁被占着：对方要么正在写，要么已经跑起来了。
            # 更新（或同代）的实例拥有它，让位；更旧的才杀。
            cur_token, cur_pid = _read_watch_pid()
            if cur_pid and cur_pid != os.getpid() and _pid_alive(cur_pid):
                if cur_token >= token:
                    return False
                _kill_watch(cur_pid)
            time.sleep(1.0)
            continue

        try:
            cur_token, cur_pid = _read_watch_pid()
            if cur_pid and cur_pid != os.getpid() and _pid_alive(cur_pid):
                if cur_token >= token:
                    return False  # 本代或更新的一直在跑，别再杀来杀去
                _kill_watch(cur_pid)
                time.sleep(0.5)
            WATCH_PID.write_text(f"{token}|{os.getpid()}", encoding="utf-8")
            return True
        finally:
            try:
                lock.release()
            except Exception:  # noqa: BLE001
                pass

    return False


def _claim_watch_slot_nolock(token: int) -> bool:
    """无 portalocker 时的回退版本（有窗口期，尽量不走这里）。"""
    _, cur_pid = _read_watch_pid()
    if cur_pid and cur_pid != os.getpid() and _pid_alive(cur_pid):
        _kill_watch(cur_pid)
        time.sleep(0.6)

    WATCH_PID.parent.mkdir(parents=True, exist_ok=True)
    WATCH_PID.write_text(f"{token}|{os.getpid()}", encoding="utf-8")
    return True


def watch() -> None:
    """常驻 IM 监听，事件以 JSONL 写到 stdout（每行一个 JSON）。"""
    from goofish_cli.commands.message.watch import watch as cli_watch

    # cli_watch 内部自己写 stdout；不要外层再包 JSON。
    cli_watch()


def _release_watch_slot() -> None:
    try:
        _, pid = WATCH_PID.read_text(encoding="utf-8").strip().split("|")
        if int(pid) == os.getpid():
            WATCH_PID.unlink()
    except Exception:  # noqa: BLE001
        pass


def _emit(obj: dict[str, Any]) -> None:
    print(json.dumps(obj, ensure_ascii=False), flush=True)


# ---------------------------------------------------------------------------
# serve：常驻 IM 进程。
#
# 每条短命令都要重新 `uv run` 起一个 Python（1~2 秒），而 chats/history/send
# 每次还新开一条 IM 连接、把常驻监听踢下线。serve 只建一条连接，stdin 读命令、
# stdout 写结果，收发的推送也走同一条连接。
#
# 协议（每行一个 JSON）：
#   请求  {"id":1,"op":"chats"|"history"|"send","args":{...}}
#   结果  {"id":1,"ok":true,"data":...} / {"id":1,"ok":false,"error":"..."}
#   事件  {"event":"message",...} / {"event":"read",...}  （服务端推送）
# ---------------------------------------------------------------------------
def logger_serve(message: str) -> None:
    """serve 进程的诊断日志走 stderr，不污染 stdout 的 JSON 协议。"""
    try:
        sys.stderr.write(f"[serve] {message}\n")
        sys.stderr.flush()
    except Exception:  # noqa: BLE001
        pass


def _http_chats(limit: int, timeout: float = 15.0) -> dict[str, Any]:
    """HTTP 版会话列表（IM 分页被流控时的兜底）。

    必须带超时：这里是同步调用，一旦卡住会堵死 serve 的主循环，
    宿主看到的就是「请求永远不返回」（2026-11-27 晚实测卡了 8 分钟）。
    """
    from goofish_cli.commands.message.list_chats import list_chats

    box: dict[str, Any] = {}

    def _run() -> None:
        try:
            box["data"] = list_chats(fetch_num=int(limit), watch_secs=0)
        except Exception as exc:  # noqa: BLE001 — 交给调用方判断
            box["error"] = exc

    worker = threading.Thread(target=_run, daemon=True)
    worker.start()
    worker.join(timeout)
    if worker.is_alive():
        # 线程还活着：不要等它，直接按超时处理（daemon 线程不会阻止退出）。
        raise GoofishError(f"HTTP 会话列表超时（{int(timeout)}s）")
    if "error" in box:
        raise box["error"]
    data = box.get("data") or {}
    sessions = data.get("sessions") if isinstance(data, dict) else data
    return {"sessions": sessions or [], "total": len(sessions or []), "source": "http"}


def _is_flow_control(exc: Any) -> bool:
    """识别闲鱼流控。IM 与服务端措辞可能不同，统一在这里判断。"""
    text = str(exc or "")
    lowered = text.lower()
    return (
        "flow control" in lowered
        or "flowcontroled" in lowered
        or "流控" in text
        or "too many request" in lowered
        or "请求过于频繁" in text
    )


async def _serve() -> None:
    from goofish_cli.core import Session
    from goofish_cli.core.errors import GoofishError
    from goofish_cli.core.message_history import parse_message
    from goofish_cli.core.sign import generate_mid
    from goofish_cli.core.token import get_access_token
    from goofish_cli.core.ws import (
        build_ack, cid_from_create_ack, connect, create_chat,
        extract_incoming_text, extract_meta_event, extract_push_messages,
        heartbeat_loop, register, send_text, wait_ready,
    )

    session = Session.load()
    token = get_access_token(session)
    loop = asyncio.get_running_loop()
    pending: dict[str, asyncio.Future[dict[str, Any]]] = {}

    def _emit_event(obj: dict[str, Any]) -> None:
        _emit(obj)

    async def _reader(ws: Any) -> None:
        async for raw in ws:
            try:
                frame = json.loads(raw)
            except (ValueError, TypeError):
                continue
            mid = (frame.get("headers") or {}).get("mid")
            waiter = pending.pop(mid, None) if mid else None
            if waiter is not None:
                if not waiter.done():
                    waiter.set_result(frame)
                continue
            # 没有等待者的帧都是服务端推送：回 ack，再把消息抛给宿主。
            try:
                await ws.send(json.dumps(build_ack(frame)))
            except Exception:  # noqa: BLE001
                pass
            if frame.get("lwp") != "/s/vulcan":
                continue
            for decoded in extract_push_messages(frame):
                meta = extract_meta_event(decoded)
                if meta is not None:
                    _emit_event(meta)
                    continue
                item = extract_incoming_text(decoded)
                if item is not None and (item.get("send_message") or item.get("content_type") == 1):
                    _emit_event(item)

    async def _call(ws: Any, lwp: str, body: Any, timeout: float = 20.0) -> dict[str, Any]:
        mid = generate_mid()
        fut: asyncio.Future[dict[str, Any]] = loop.create_future()
        pending[mid] = fut
        await ws.send(json.dumps({"lwp": lwp, "headers": {"mid": mid}, "body": body}, ensure_ascii=False))
        try:
            return await asyncio.wait_for(fut, timeout)
        finally:
            pending.pop(mid, None)

    im_chats_blocked_until = 0.0

    async def _chats(ws: Any, limit: int) -> dict[str, Any]:
        nonlocal im_chats_blocked_until
        # 被流控后先冷却一分钟，期间直接走 HTTP，别反复撞限流。
        if im_chats_blocked_until and time.time() < im_chats_blocked_until:
            raise GoofishError("会话列表冷却中（上一步被流控）")
        out: list[dict[str, Any]] = []
        cursor: Any = 9007199254740991
        try:
            while len(out) < limit:
                ack = await _call(
                    ws, "/r/Conversation/listNewestPagination",
                    [cursor, min(50, limit - len(out))],
                )
                code = (ack or {}).get("code")
                if code not in (200, None):
                    # 闲鱼会流控（400 The request has been flow controled）；
                    # 抛出去交给 HTTP 兜底，别把「被限流」当成「没有会话」。
                    reason = ((ack or {}).get("body") or {}).get("reason") or f"code={code}"
                    raise GoofishError(f"会话列表被拒绝：{reason}")
                body = (ack or {}).get("body") or {}
                items = body.get("userConvs") or []
                for raw in items:
                    conv = raw.get("singleChatUserConversation") or raw
                    single = conv.get("singleChatConversation") or {}
                    cid = str(single.get("cid") or "").split("@")[0]
                    if not cid:
                        continue
                    first = str(single.get("pairFirst") or "").split("@")[0]
                    second = str(single.get("pairSecond") or "").split("@")[0]
                    peer = second if first == session.unb else first
                    if not peer or peer == "0":
                        continue
                    ext = single.get("extension") or {}
                    if isinstance(ext, str):
                        try:
                            ext = json.loads(ext)
                        except (ValueError, TypeError):
                            ext = {}
                    last = (conv.get("lastMessage") or {}).get("message") or {}
                    last_ext = last.get("extension") or {}
                    if isinstance(last_ext, str):
                        try:
                            last_ext = json.loads(last_ext)
                        except (ValueError, TypeError):
                            last_ext = {}
                    sender = str((last_ext or {}).get("senderUserId") or "").split("@")[0]
                    nick = str((last_ext or {}).get("reminderTitle") or "")
                    squad = str((ext or {}).get(f"squadName_{peer}") or "") if isinstance(ext, dict) else ""
                    peer_nick = (nick if sender == peer and nick else "") or squad
                    content = last.get("content") or {}
                    custom = content.get("custom") or {}
                    text = str(custom.get("summary") or "")
                    if not text and custom.get("data"):
                        try:
                            payload = json.loads(base64.b64decode(custom["data"]))
                            text_obj = payload.get("text") or {}
                            text = text_obj.get("text", "") if isinstance(text_obj, dict) else str(text_obj)
                        except (ValueError, TypeError, UnicodeDecodeError):
                            text = ""
                    out.append({
                        "session_id": cid,
                        "peer_user_id": peer,
                        "peer_nick": peer_nick,
                        "last_msg": text[:60],
                        "ts": int(conv.get("modifyTime") or 0) or None,
                        "unread": int(conv.get("redPoint") or 0),
                        "item_id": str((ext or {}).get("itemId") or "") if isinstance(ext, dict) else "",
                        "item_title": str((ext or {}).get("itemTitle") or "") if isinstance(ext, dict) else "",
                        "source": "im",
                    })
                if body.get("hasMore") not in (1, "1", True) or not items:
                    break
                nxt = body.get("nextCursor")
                if nxt is None:
                    break
                cursor = nxt
        except Exception as exc:  # noqa: BLE001 — 流控/协议异常都退回 HTTP，别当空列表
            logger_serve(f"IM 会话列表失败，改用 HTTP：{exc}")
            # 把原因带出去：上层要据此判断是「被流控」还是「真的没会话」，
            # 否则流控会被当成空列表，水位照样推进，买家消息永远补不回来。
            return {
                "sessions": [],
                "total": 0,
                "im_error": str(exc),
                "flow_controlled": _is_flow_control(exc),
            }
        return {"sessions": out, "total": len(out)}

    async def _history(ws: Any, cid: str, limit: int) -> list[dict[str, Any]]:
        messages: dict[Any, dict[str, Any]] = {}
        cursor: Any = 9007199254740991
        page = 50
        while len(messages) < limit:
            ack = await _call(
                ws, "/r/MessageManager/listUserMessages",
                [f"{cid}@goofish", False, cursor, min(page, limit - len(messages)), False],
            )
            body = (ack or {}).get("body") or {}
            models = body.get("userMessageModels") or []
            for model in models:
                item = parse_message(model, cid)
                messages[item["message_id"] or len(messages)] = item
            if len(messages) >= limit or body.get("hasMore") not in (1, "1", True):
                break
            cursor = body.get("nextCursor")
            if cursor is None or not models:
                break
        ordered = sorted(messages.values(), key=lambda m: m.get("created_at") or 0)
        return ordered[-limit:]

    async def _send(ws: Any, args: dict[str, Any]) -> dict[str, Any]:
        from goofish_cli.core.ws import send_image

        cid = str(args.get("cid") or "")
        toid = str(args.get("toid") or "")
        item_id = str(args.get("itemId") or "")
        text = str(args.get("text") or "")
        kind = str(args.get("kind") or "text")
        url = str(args.get("url") or "")
        width = int(args.get("width") or 0)
        height = int(args.get("height") or 0)
        if not toid:
            raise GoofishError("缺少 toid")
        if item_id:
            create_mid = await create_chat(ws, myid=session.unb, toid=toid, item_id=item_id)
            fut: asyncio.Future[dict[str, Any]] = loop.create_future()
            pending[create_mid] = fut
            try:
                create_ack = await asyncio.wait_for(fut, 15)
            finally:
                pending.pop(create_mid, None)
            created = cid_from_create_ack(create_ack)
            if not created:
                raise GoofishError("创建会话失败：回包里没有 cid，未发送")
            cid = created
        elif cid in ("", "0"):
            raise GoofishError("未知会话 cid；新会话请传 itemId 先创建单聊")
        if kind == "image":
            if not url:
                raise GoofishError("发送图片需要 url")
            mid = await send_image(
                ws, myid=session.unb, cid=cid, toid=toid, url=url,
                width=width or 600, height=height or 600,
            )
        else:
            mid = await send_text(ws, myid=session.unb, cid=cid, toid=toid, text=text)
        fut = loop.create_future()
        pending[mid] = fut
        try:
            ack = await asyncio.wait_for(fut, 15)
        finally:
            pending.pop(mid, None)
        if (ack or {}).get("code") != 200:
            raise GoofishError(f"发送未被服务端接受：code={(ack or {}).get('code')}")
        body = (ack or {}).get("body") or {}
        return {
            "cid": cid, "toid": toid, "kind": "text", "ok": True,
            "mid": mid, "message_id": str(body.get("messageId", "")),
        }

    async with connect(session) as ws:
        mids = await register(ws, session, token)
        # 握手要先独占连接：wait_ready 自己读帧，和 reader 并发读会冲突。
        if not await wait_ready(ws, mids=mids):
            raise GoofishError("IM 连接未就绪")
        heartbeat = asyncio.create_task(heartbeat_loop(ws))
        reader = asyncio.create_task(_reader(ws))
        try:
            _emit({"event": "ready", "unb": session.unb, "tracknick": session.tracknick})
            while True:
                line = await asyncio.to_thread(sys.stdin.readline)
                if not line:
                    break
                line = line.strip()
                if not line:
                    continue
                try:
                    cmd = json.loads(line)
                except ValueError:
                    continue
                req_id = cmd.get("id")
                op = str(cmd.get("op") or "")
                args = cmd.get("args") or {}
                try:
                    if op == "chats":
                        limit = int(args.get("limit") or 60)
                        flow = False
                        im_error = ""
                        try:
                            data = await _chats(ws, limit)
                            flow = bool(data.get("flow_controlled"))
                            im_error = str(data.get("im_error") or "")
                        except Exception as exc:  # noqa: BLE001
                            logger_serve(f"IM 会话列表失败：{exc}")
                            flow = _is_flow_control(exc)
                            im_error = str(exc)
                            im_chats_blocked_until = time.time() + 60
                            data = {"sessions": []}
                        if not data.get("sessions"):
                            # IM 分页被流控时用 HTTP 会话列表兜底（短命令一直是这么做的）。
                            # 兜底必须带超时，否则会堵死主循环。
                            try:
                                data = await asyncio.to_thread(_http_chats, limit, 15.0)
                            except Exception as exc:  # noqa: BLE001
                                logger_serve(f"HTTP 会话列表兜底失败：{exc}")
                                data = {"sessions": [], "total": 0}
                                flow = flow or _is_flow_control(exc)
                                im_error = im_error or str(exc)
                        # 把「是否被流控」显式告诉宿主：它决定要不要推进水位。
                        data["flow_controlled"] = bool(flow) or bool(data.get("flow_controlled"))
                        if im_error:
                            data["im_error"] = im_error
                    elif op == "history":
                        data = await _history(ws, str(args.get("cid") or ""), int(args.get("limit") or 30))
                    elif op == "send":
                        data = await _send(ws, args)
                    elif op == "ping":
                        data = {"ok": True}
                    else:
                        raise GoofishError(f"unknown op: {op}")
                    _emit({"id": req_id, "ok": True, "data": data})
                except Exception as exc:  # noqa: BLE001
                    _emit({"id": req_id, "ok": False, "error": str(exc)})
        finally:
            reader.cancel()
            heartbeat.cancel()


async def _launch_browser(pw: Any, headless: bool = False) -> Any:
    """优先系统 Edge，其次 bundled Chromium，最后系统 Chrome。

    扫码登录必须 headful（headless 指纹会让 passport 二维码不渲染）；
    令牌续期先试 headless，失败由调用方回退 headful。
    """
    args = ["--window-position=1200,600", "--window-size=520,700"]
    for kwargs in ({"channel": "msedge"}, {}, {"channel": "chrome"}):
        try:
            return await pw.chromium.launch(headless=headless, args=args, **kwargs)
        except Exception:  # noqa: BLE001 — 逐个降级
            continue
    raise RuntimeError("没有可用的浏览器：请安装 Edge，或运行 playwright install chromium")


async def _login_qr(timeout: int = 180) -> None:
    """扫码登录：把二维码以 PNG base64 打到 stdout，成功后写回 cookies.json。

    事件行（每行一个 JSON）：
      {"event":"qr","image":"data:image/png;base64,..."}
      {"event":"done","unb":"..."}
      {"event":"error","message":"..."}
    """
    from playwright.async_api import async_playwright

    from goofish_cli.core.qr_login import HOME_URL, _find_passport_frame, _has_all_login_cookies
    from goofish_cli.core.session import resolve_cookie_path, write_cookies_json

    async with async_playwright() as pw:
        browser = await _launch_browser(pw)
        context = await browser.new_context(locale="zh-CN", timezone_id="Asia/Shanghai")
        try:
            page = await context.new_page()
            await page.goto(HOME_URL, wait_until="domcontentloaded")
            await page.wait_for_timeout(1500)

            frame = await _find_passport_frame(page)
            if frame is None:
                _emit({"event": "error", "message": "登录页没有出现 passport 二维码区域"})
                return

            try:
                await frame.wait_for_selector(".qrcode-login", timeout=30000)
            except Exception as e:  # noqa: BLE001
                _emit({"event": "error", "message": f"二维码未渲染：{e}"})
                return

            png = await frame.locator(".qrcode-login").screenshot()
            _emit({
                "event": "qr",
                "image": "data:image/png;base64," + base64.b64encode(png).decode("ascii"),
            })

            deadline = time.monotonic() + timeout
            while time.monotonic() < deadline:
                cookies = await context.cookies()
                if _has_all_login_cookies(cookies):
                    records = [
                        {
                            "name": c["name"],
                            "value": c["value"],
                            "domain": c.get("domain", ""),
                            "path": c.get("path", "/"),
                        }
                        for c in cookies
                        if c.get("name") and c.get("value")
                    ]
                    write_cookies_json(resolve_cookie_path(), records)
                    unb = next((c["value"] for c in cookies if c["name"] == "unb"), "")
                    _emit({"event": "done", "unb": unb})
                    return
                await asyncio.sleep(1)
            _emit({"event": "error", "message": f"{timeout}s 内未完成扫码"})
        finally:
            # 扫码完成后一定要把浏览器窗口关掉：先 context 再 browser，
            # 各限时 8 秒，避免 Playwright 在 Windows 上卡住留下窗口。
            try:
                await asyncio.wait_for(context.close(), timeout=8)
            except Exception:  # noqa: BLE001
                pass
            try:
                await asyncio.wait_for(browser.close(), timeout=8)
            except Exception:  # noqa: BLE001
                pass


COMMANDS = {
    "sold-list": lambda a: sold_list(a.get("pageNumber", 1), a.get("queryCode", "NOT_SHIP")),
    "confirm": lambda a: confirm(a["orderId"], a.get("tradeText", "")),
    "send": lambda a: send(a.get("cid", "0"), a["toid"], a["text"], a.get("itemId", "")),
    "status": lambda a: status(),
    "history": lambda a: history(a["cid"], int(a.get("limit", 10))),
    "items": lambda a: items(int(a.get("limit", 50))),
    "chats": lambda a: chats(int(a.get("fetchNum", 200))),
    "user-info": lambda a: user_info(a["cid"], bool(a.get("owner"))),
    "item-detail": lambda a: item_detail(a["itemId"]),
    "order-detail": lambda a: order_detail(a["orderId"]),
    "refresh": lambda a: refresh_session(bool(a.get("headful"))),
}


def main() -> None:
    # 不让 goofish-cli 自己在失败时拉起浏览器：刷新由插件显式控制（无头 + 冷却）。
    os.environ.setdefault("GOOFISH_AUTO_REFRESH_TOKEN", "0")
    _install_cookie_persist()
    # 中文 Windows 默认 stdout 是 GBK，商品标题里的 ¥ 会直接编码失败。
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:  # noqa: BLE001
        pass

    command = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        args = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    except json.JSONDecodeError as e:
        print(json.dumps({"ok": False, "error": f"bad json args: {e}"}))
        return

    if command == "login-qr":
        # 流式事件，自己负责输出；不要外层再包一层 JSON。
        try:
            asyncio.run(_login_qr(int(args.get("timeout", 180))))
        except Exception as e:  # noqa: BLE001
            _emit({"event": "error", "message": str(e)})
        return

    if command == "serve":
        try:
            asyncio.run(_serve())
        except KeyboardInterrupt:
            pass
        except Exception as e:  # noqa: BLE001
            _emit({"event": "error", "message": str(e)})
        return

    if command == "watch":
        # 常驻进程，事件行由 cli_watch 自己输出。
        token = int(args.get("token") or 0)
        if not _claim_watch_slot(token):
            _emit({"event": "superseded"})
            return
        try:
            watch()
        except KeyboardInterrupt:
            pass
        except Exception as e:  # noqa: BLE001
            _emit({"event": "error", "message": str(e)})
        finally:
            _release_watch_slot()
        return

    handler = COMMANDS.get(command)
    if handler is None:
        print(json.dumps({"ok": False, "error": f"unknown command: {command}"}))
        return

    try:
        result = handler(args)
        print(json.dumps({"ok": True, "data": result}, ensure_ascii=False))
    except Exception as e:  # noqa: BLE001 — 跨进程边界，必须结构化返回
        print(json.dumps({"ok": False, "error": str(e), "type": type(e).__name__}, ensure_ascii=False))


if __name__ == "__main__":
    main()
