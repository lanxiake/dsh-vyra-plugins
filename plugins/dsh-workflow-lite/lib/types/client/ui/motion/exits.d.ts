/**
 * dsh-workflow-lite — 出现 / 消失的动效：卸掉时留影子放退场（{@link useExit} / {@link ExitSeat}）、
 * 画布上节点和连线被删的影子（{@link useCanvasExits} / {@link useLineExit}）、宽度跟着内容滑（{@link useGlide}）、
 * 整张画布换视图（{@link useViewGhost}）、折叠区展开收起（{@link Presence}）。只动 `transform` / `opacity`。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/motion/exits
 */
import { type ReactNode, type RefObject } from 'react';
/** 退场：往哪边走、走多久（都是入场的反方向）。 */
declare const EXITS: {
    /** 底部轻提示、草稿栏：往下沉、略缩。 */
    readonly down: {
        readonly frames: "translateY(8px) scale(0.97)";
        readonly ms: 220;
    };
    /** 顶部提示条：往上收。 */
    readonly up: {
        readonly frames: "translateY(-8px) scale(0.98)";
        readonly ms: 200;
    };
    /** 就地弹出的菜单：原地缩回、淡出（缩向 CSS 里的 transform-origin）。 */
    readonly shrink: {
        readonly frames: "scale(0.95)";
        readonly ms: 140;
    };
    /** 从右边拉出来的抽屉：退回右边。 */
    readonly right: {
        readonly frames: "translateX(16px)";
        readonly ms: 180;
    };
};
type Exit = keyof typeof EXITS;
/**
 * 给按条件挂的一块加退场（就地菜单、抽屉、草稿栏）：返回的 ref 挂到它的根上，卸掉时留影子放 `exit`。
 * 调用方照常按条件挂，不用等动画。
 */
export declare function useExit<E extends HTMLElement>(exit: Exit, options?: {
    inner?: boolean;
}): RefObject<E>;
/**
 * 卸掉时留个影子放退场的一块（轻提示、提示条）：调用方照常按条件挂、按 key 换，不用等动画。
 * 动的是里面那一层——外面这层常带着居中用的 `translateX(-50%)`，两个 transform 不打架。
 * 换了一条（key 变了）时旧的影子往外走、新的照常浮进来，两条错开。
 */
export declare function ExitSeat(props: {
    className: string;
    exit: Exit;
    children: React.ReactNode;
}): React.JSX.Element;
/**
 * 画布上删掉的步骤、资源、连线：留个影子原地退场（步骤卡缩小淡出，连线和线上的小牌子淡出），不是一下没了。
 *
 * 只在"同一份文档里少了几个 id"时放（`loadKey` 没变）：换工作流、换实例时整张图换掉，不放。
 * React Flow 删 DOM 的时机由它自己定（可能晚一次提交），所以这里先记下哪些 id 没了，
 * 再用 MutationObserver 等那些元素真的被摘掉，照它们最后的样子复制影子放回原处。
 *
 * 认元素：节点外壳、连线 `<g>` 上的 `data-id`（React Flow 加的），线上小牌子写 `data-vanish`。
 */
export declare function useCanvasExits(root: RefObject<HTMLElement | null>, loadKey: string, ids: readonly string[]): void;
/**
 * 宽度随内容变的药丸（顶栏左边：名字、状态字一换，宽度就变）：不让宽度跳，只靠 transform 展开收缩。
 * 药丸里放一块 `data-glide-surface`（绝对定位铺满、左边为原点的底面：边框、底色、阴影都画在它上面），
 * 以及要跟着挪的 `data-glide` 小件（被挤到新位置的图标、状态按钮）：
 * 宽度一变，底面从旧宽度 `scaleX` 过渡到新宽度，小件从旧位置 `translateX` 滑到新位置；
 * 变宽立刻展开，变窄先停 `hold`（默认 {@link GLIDE_HOLD_MS}）毫秒再收；宽度是被布局挤变的、
 * 没有"等视线落稳"的需要时传 0（缩放条：右面板一开图例就收成按钮）。上一段还没放完就变了，从看上去的地方接着走。
 * 返回回调 ref，挂到药丸上。
 */
export declare function useGlide(hold?: number): (pill: HTMLElement | null) => void;
/**
 * 画布这一整块要被卸掉时（模板编辑 ↔ 实例视图）：留一个影子在原处淡出，新画布同时淡入，两边交叉过去。
 * 影子放进视图根（`data-workflow-lite-view`），不放在父节点里——实例视图的外壳跟着一起卸掉，放里面就看不到了。
 */
export declare function useViewGhost(ref: RefObject<HTMLElement | null>): void;
/**
 * 可以出现、也可以消失的一块（折叠区、行内的提示条 / 错误条）：
 * - 出现：高度从 0 长开、同时淡入，下面的内容被顺势推下去；
 * - 消失：高度收回 0、同时淡出，下面的内容顺势滑上来，再把它卸掉——不是「啪」地一下没了、下面的跳上来。
 * 走的是 CSS 过渡，不是关键帧：收到一半又要展开，从当前高度接着往回长，不是从 0 重来（iOS / macOS 的动画随时能反向）。
 * 第一次挂上时就是开着的不放动画（刷新页面不该看到所有折叠区重新展开一遍）。
 *
 * `show` 为假时，内容保留最后一次的样子放完退场动画，所以调用方照常写 `{cond && <X value={v} />}` 也行：
 * 把条件放进 `show`，把内容放进 children（`show` 为假时 children 可以是假值）。
 * 高度走 `grid-template-rows: 0fr ↔ 1fr`（布局属性，是「只动 transform / opacity」的例外）：折叠区不知道自己多高，
 * 这是不量高度就能从 0 长到内容那么高的办法；只在动的这段时间里动，内容区同时 `overflow: hidden`，平时不裁（阴影、焦点环照常画出来）。
 */
export declare function Presence(props: {
    show: boolean;
    children: ReactNode;
    className?: string;
}): React.JSX.Element | null;
/**
 * 底线输入框（`ui.module.css` 的 `.lineField`）被卸掉时，线缩回左边：改名这类输入框一提交就整块换回文字，
 * 框里的线没机会走完 CSS 的收回。这里在卸掉的那一刻（DOM 还在）读一下线此刻伸出多长，
 * 在视图根里放一根一样的线（影子），从那个长度缩回左边再删掉；字已经换回去了，线是唯一留着的东西。
 * 线本来就没伸出来（缩到 0）、开了「减少动态效果」、找不到视图根时什么也不放。
 * 返回要挂到 `.lineField` 外层的 ref。
 */
export declare function useLineExit(): RefObject<HTMLSpanElement>;
export {};
