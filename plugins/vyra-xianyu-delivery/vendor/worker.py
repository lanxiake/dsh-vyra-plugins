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
import sys
import time
from typing import Any

SELLER_HEADERS = {"origin": "https://seller.goofish.com", "referer": "https://seller.goofish.com/"}


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

                last = (conv.get("lastMessage") or {}).get("message") or {}
                last_ext = last.get("extension") or {}
                if isinstance(last_ext, str):
                    try:
                        last_ext = json.loads(last_ext)
                    except (ValueError, TypeError):
                        last_ext = {}
                sender = str((last_ext or {}).get("senderUserId") or "").split("@")[0]
                nick = str((last_ext or {}).get("reminderTitle") or "")
                # 只有最后一条是对方发的，reminderTitle 才是对方昵称
                peer_nick = nick if sender == peer and nick else ""

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
                        "item_id": "",
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


def history(cid: str, limit: int = 10) -> list[dict[str, Any]]:
    from goofish_cli.commands.message.history import history as cli_history

    # 每页 50 条，整体最多 90 秒：网页版的会话历史常常几百条，30 秒不够。
    return cli_history(cid, limit_per_page=50, limit=int(limit), timeout=90.0)


def watch() -> None:
    """常驻 IM 监听，事件以 JSONL 写到 stdout（每行一个 JSON）。"""
    from goofish_cli.commands.message.watch import watch as cli_watch

    # cli_watch 内部自己写 stdout；不要外层再包 JSON。
    cli_watch()


def _emit(obj: dict[str, Any]) -> None:
    print(json.dumps(obj, ensure_ascii=False), flush=True)


async def _launch_browser(pw: Any) -> Any:
    """优先系统 Edge，其次 bundled Chromium，最后系统 Chrome。

    必须 headful：实测 headless 下页面指纹会被闲鱼判掉，passport 二维码不渲染。
    窗口放到屏幕右下角，不遮住 DSH 面板。
    """
    args = ["--window-position=1200,600", "--window-size=520,700"]
    for kwargs in ({"channel": "msedge"}, {}, {"channel": "chrome"}):
        try:
            return await pw.chromium.launch(headless=False, args=args, **kwargs)
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
    "chats": lambda a: chats(int(a.get("fetchNum", 50))),
}


def main() -> None:
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

    if command == "watch":
        # 常驻进程，事件行由 cli_watch 自己输出。
        try:
            watch()
        except KeyboardInterrupt:
            pass
        except Exception as e:  # noqa: BLE001
            _emit({"event": "error", "message": str(e)})
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
