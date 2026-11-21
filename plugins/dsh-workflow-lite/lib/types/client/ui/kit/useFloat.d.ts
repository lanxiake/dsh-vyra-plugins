/**
 * dsh-workflow-lite — 悬停浮层的状态与摆位（「?」说明、画布连线上的交接卡片共用）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/kit/useFloat
 */
import { type RefObject } from 'react';
/** 浮层退场动画的时长（和 ui.module.css 的 floatOut 一致）。 */
export declare const FLOAT_EXIT_MS = 120;
export type FloatState = 'off' | 'hover' | 'pinned';
/**
 * 悬停浮层的状态与摆位（「?」说明、画布连线上的交接卡片共用）。
 *
 * - 浮层挂到视图根（和模态框同一个挂载点）：不被滚动区裁掉，也不会把滚动区撑出滚动条；
 *   画布缩放时字号也不跟着变小。
 * - 鼠标可以从触发器移进浮层：离开触发器后稍等一下再收，进了浮层就不收；浮层接住指针，
 *   里面的文字能选中复制，点击不会穿透到后面。
 * - 在触发器与浮层之外按下指针、滚动、滚轮缩放画布都收起；Esc 只收浮层。
 * - 先按"触发器正下方、左边对齐"放（`align: 'end'` 右边对齐；`'auto'` 触发器在视图右半边就右对齐），
 *   量出高度后下面放不下就翻到上方，左右夹在视图里；上下都放不下就往回挪进视图，比视图还高才限高、里面滚。
 * - 里面的内容变高变矮时跟着重量一次：不换边，只在要越出视图时往回挪。
 */
export declare function useFloat<A extends HTMLElement>(options: {
    openMs: number;
    closeMs: number;
    width: number;
    align?: 'start' | 'end' | 'auto';
    /** 与触发器的间距，缺省 6。 */
    gap?: number;
    /**
     * 收起时留多久放退场动画（浮层带 `data-leaving="true"`、不接指针、不带 testId，样式自己写淡出）。
     * 缺省 0：立刻拿掉。
     */
    exitMs?: number;
    /**
     * 摆在这个元素旁边，而不是触发器下面：优先左边、放不下放右边，上沿和它对齐（夹在视图里）。
     * 画布上的卡片用：浮层不盖住卡片，卡片往右下长大也碰不到它。
     */
    beside?: RefObject<HTMLElement | null>;
    /**
     * 摆在旁边时上沿和谁对齐：缺省和那个元素（画布卡片）；`'anchor'` 和触发器——
     * 右栏里的设置摆在整条栏的左边，但和「调整」那一行齐平。
     */
    besideTop?: 'beside' | 'anchor';
}): {
    state: FloatState;
    setState: (next: FloatState | ((current: FloatState) => FloatState)) => void;
    anchorRef: RefObject<A>;
    panelRef: RefObject<HTMLDivElement>;
    /** 取消还没生效的悬停开 / 关。 */
    cancel: () => void;
    /** 悬停触发：挂到触发器上。 */
    hoverProps: {
        onPointerEnter: () => void;
        onPointerLeave: () => void;
    };
    onKeyDown: (event: React.KeyboardEvent) => void;
    /** 把浮层内容包一层定位壳，挂到视图根。 */
    render: (props: {
        className: string;
        testId?: string | undefined;
        label?: string;
        /** 默认 `tooltip`；二次确认这类要操作的浮层用 `alertdialog`，挑一项的用 `menu`。 */
        role?: 'tooltip' | 'alertdialog' | 'dialog' | 'menu';
        children: React.ReactNode;
    }) => React.ReactNode;
};
