"""order confirm — 确认虚拟商品发货。

接口 mtop.taobao.idle.logistic.consign.dummy（写）。

语义：
- `ok=true` 表示服务端确认发货成功，或该订单此前已发货；
- 已发货用 `already=true` 表示，便于调用方幂等处理。
"""

from typing import Any

from goofish_cli.core import GoofishError, Session, Strategy, command
from goofish_cli.core.mtop import call
from goofish_cli.core.write_operation import write_operation

_API = "mtop.taobao.idle.logistic.consign.dummy"


def _ret_of(raw: dict[str, Any] | None) -> str:
    ret = (raw or {}).get("ret") or []
    if isinstance(ret, list):
        return ret[0] if ret else ""
    return str(ret)


def _already_delivered(ret_str: str) -> bool:
    return "ORDER_ALREADY_DELIVERY" in ret_str or "已发货成功" in ret_str


@command(
    namespace="order",
    name="confirm",
    description="确认虚拟商品发货（写操作）；已发货订单返回 already=true",
    strategy=Strategy.COOKIE,
    columns=["order_id", "ok", "already", "message"],
    write=True,
)
def confirm(order_id: str, trade_text: str = "") -> dict[str, Any]:
    """确认发货。

    Args:
        order_id: 闲鱼订单号
        trade_text: 可选，「无需邮寄表单」的凭证文本；普通虚拟发货传空串
    """
    session = Session.load()
    data = {
        "orderId": str(order_id),
        "tradeText": (trade_text or "").strip(),
        "picList": [],
        "newUnconsign": True,
    }

    try:
        with write_operation(session, "order.write"):
            raw = call(session, api=_API, data=data, spm_cnt="a21ybx.order.0.0")
    except GoofishError as e:
        # consign.dummy 在订单已发货时返回 ORDER_ALREADY_DELIVERY，不含 SUCCESS，
        # 会被 call() 的统一错误分类抛成 GoofishError；这里按幂等成功处理。
        ret_str = _ret_of(e.raw) or str(e)
        if _already_delivered(ret_str):
            return {"order_id": str(order_id), "ok": True, "already": True, "message": ret_str}
        raise

    ret_str = _ret_of(raw)
    return {
        "order_id": str(order_id),
        "ok": "SUCCESS" in ret_str,
        "already": _already_delivered(ret_str),
        "message": ret_str,
    }
