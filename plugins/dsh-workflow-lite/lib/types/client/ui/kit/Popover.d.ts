/**
 * dsh-workflow-lite — 触发器 + 浮层，以及"点外面就关"的监听。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/kit/Popover
 */
import { type RefObject } from 'react';
/**
 * 在 `ref` 之外按下指针就关掉。
 *
 * 监听挂在 `document` 的**捕获**阶段：React Flow 会在自己的按下处理里拦截冒泡，
 * 冒泡阶段的监听收不到"点在画布上"这一下。
 */
export declare function useDismiss(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void): void;
/**
 * 触发器 + 浮层。浮层不走 portal：留在视图根的子树里，设计令牌照常继承。
 * `Esc` 在这里消化掉（不再冒到视图根去取消画布上的选中）。
 *
 * `hold`：浮层里正有一件事没做完（行内改名、挂在某一行上的确认卡）——点外面先只结束那件事，
 * 浮层留着，再点一下才收。浮层本身可聚焦（不进 Tab 序）：里面的按钮跟着一行被删掉时焦点有处可去，
 * Esc 照样能收起。
 */
export declare function Popover(props: {
    open: boolean;
    onClose: () => void;
    trigger: React.ReactNode;
    children: React.ReactNode;
    align?: 'start' | 'end';
    up?: boolean;
    className?: string;
    label: string;
    hold?: boolean;
    /** 鼠标从触发器和浮层上整个移开（离开两者合起来的范围）。 */
    onLeave?: () => void;
}): React.JSX.Element;
