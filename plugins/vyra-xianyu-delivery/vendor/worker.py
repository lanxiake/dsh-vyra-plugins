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

import json
import sys
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


COMMANDS = {
    "sold-list": lambda a: sold_list(a.get("pageNumber", 1), a.get("queryCode", "NOT_SHIP")),
    "confirm": lambda a: confirm(a["orderId"], a.get("tradeText", "")),
    "send": lambda a: send(a.get("cid", "0"), a["toid"], a["text"], a.get("itemId", "")),
    "status": lambda a: status(),
}


def main() -> None:
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        args = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    except json.JSONDecodeError as e:
        print(json.dumps({"ok": False, "error": f"bad json args: {e}"}))
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
