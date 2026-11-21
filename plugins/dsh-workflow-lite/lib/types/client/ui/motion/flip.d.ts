/**
 * dsh-workflow-lite — 列表的动效：增删筛选时其余项滑到新位置（{@link useFlip}）、
 * 某一项展开收起时后面的项跟着滑（{@link useResizeFlip}）、面包屑从右端增减（{@link useTrail}）。
 *
 * 守 `ui.module.css` 开头那条规矩：只动 `transform` / `opacity`，交给合成器。
 * JS 只在列表内容变了的那一次渲染里读一遍各项的 `offsetTop`，动画本身不占主线程
 * （CSS transition / Web Animations 的 transform 都在合成器上跑）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/motion/flip
 */
import { type RefObject } from 'react';
/**
 * 列表里带 `data-flip`（值是项的键）的直接子项：`layout`（各项的键连起来）变了，
 * 留下来的项从旧位置滑到新位置；`enter` 时新出现的项从左边淡入——第一次挂上时依次错开。
 * 键没变的项换了个样子（比如改名时换成输入框行）不算新项，不放入场。
 */
export declare function useFlip(ref: RefObject<HTMLElement | null>, layout: string, options?: {
    enter?: boolean;
}): void;
/**
 * 列表里有一项变高变矮（展开、收起、内容换了）或增删了项：它后面的项从旧位置滑到新位置。
 * 和 {@link useFlip} 一样只动 transform，不同的是不用给 `layout`——ResizeObserver 看着每一项，
 * 尺寸一变（布局之后、绘制之前）就比一遍各项的 `offsetTop`；项按元素本身认（React 按 key 留着同一个元素）。
 *
 * - `exit`：删掉的项留个影子原地淡出（见 {@link leaveAt}），列表要 `position: relative`；
 * - `enter`：新加的项从左边淡入（项自己带入场动画的不用开）。
 *
 * 返回一个回调 ref，挂到列表上（列表可以晚挂上、可以换）。项要有不透明的底色：
 * 往下滑的项像帘子一样盖着、再露出上面刚展开的内容。
 */
export declare function useResizeFlip(options?: {
    exit?: boolean;
    enter?: boolean;
}): (list: HTMLElement | null) => void;
/**
 * 路径栏那样沿一条线、从右端增减的一排（面包屑）：长出一级时新的一级从前一级背后「展开」出来，
 * 缩短时去掉的几级往前一级背后「收」进去——像抽屉拉出、推回，不是淡入淡出。
 *
 * 直接子项是一级一个单元。靠遮挡做出展开感，所以单元要**不透明底色**、`position: relative`，
 * 且越靠前的 `z-index` 越高（前一级盖在后一级上，影子垫在最底下）；整排要 `position: relative`、
 * 自己裁切（`overflow` 不是 visible）。只放 transform 动画，单元本身一次到位（布局不动，不占主线程）。
 * 返回一个回调 ref 挂到这一排上。
 */
export declare function useTrail(): (row: HTMLElement | null) => void;
