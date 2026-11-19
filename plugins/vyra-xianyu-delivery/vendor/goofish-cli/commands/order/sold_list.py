"""order sold-list — 卖家已售订单列表（只读，轮询用）。

接口 mtop.taobao.idle.trade.merchant.sold.get。

注意：这是卖家端接口，请求头必须带 seller.goofish.com 的 Origin/Referer，
否则会被判成非卖家端请求（TOKEN_EMPTY → PERMISSION_EXCEPTION）。
"""

from typing import Any

from goofish_cli.core import Session, Strategy, command
from goofish_cli.core.mtop import call, default_headers

_API = "mtop.taobao.idle.trade.merchant.sold.get"


def _spec_of(item: dict[str, Any]) -> tuple[str, str]:
    """从 itemInfoLines 提取第一组规格（[{"key": "规格", "value": "年卡"}]）。"""
    lines = ((item.get("itemVO") or {}).get("itemInfoLines")) or []
    for line in lines:
        k = str((line or {}).get("key") or "").strip()
        v = str((line or {}).get("value") or "").strip()
        if k and v:
            return k, v
    return "", ""


@command(
    namespace="order",
    name="sold-list",
    description="卖家已售订单列表（只读）；query_code: ALL / NOT_SHIP / NOT_RATE",
    strategy=Strategy.COOKIE,
    columns=["page", "query_code", "orders"],
)
def sold_list(page_number: int = 1, query_code: str = "NOT_SHIP") -> dict[str, Any]:
    """拉取卖家已售订单。

    Args:
        page_number: 页码，从 1 开始
        query_code: 订单状态筛选，默认 NOT_SHIP（待发货）
    """
    session = Session.load()

    headers = default_headers()
    headers["origin"] = "https://seller.goofish.com"
    headers["referer"] = "https://seller.goofish.com/"

    raw = call(
        session,
        api=_API,
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
    items = module.get("items") or []

    orders = []
    for it in items:
        spec_name, spec_value = _spec_of(it)
        orders.append(
            {
                # 订单号是 19 位整数，超过 JS Number.MAX_SAFE_INTEGER，必须转字符串，
                # 否则消费端 JSON.parse 会截断末位，导致幂等键错位。
                "order_no": str((it.get("commonData") or {}).get("orderId", "") or ""),
                "item_id": str((it.get("commonData") or {}).get("itemId", "") or ""),
                "status": (it.get("commonData") or {}).get("orderStatus", ""),
                "in_refund": (it.get("commonData") or {}).get("inRefund") == "true",
                "buyer_id": str((it.get("buyerInfoVO") or {}).get("buyerId", "") or ""),
                "buyer_nick": str((it.get("buyerInfoVO") or {}).get("userNick", "") or ""),
                "amount": str((it.get("priceVO") or {}).get("totalPrice", "0") or "0"),
                "quantity": int((it.get("priceVO") or {}).get("buyNum") or 1),
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
        "raw": data,
    }