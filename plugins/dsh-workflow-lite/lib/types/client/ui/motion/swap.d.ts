/**
 * dsh-workflow-lite — 右栏、整张图这类大块「换内容」的动效：旧内容（影子）让开淡出、新内容淡入（{@link useSwap}），
 * 收起时的退场（closeOut），切换工作流时旧图多留一会（{@link useSwapHold}）。
 *
 * `swappedAt` 记着右栏刚换过内容的时刻：列表那边据此把这一刻的整批增删当成换内容，不放增删动画。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/motion/swap
 */
import { type RefObject } from 'react';
/** 右栏刚换了内容（{@link swapIn}）：这时列表里的整批增删是换内容，不是有人删了一项，不放增删动画。 */
export declare let swappedAt: number;
/** 整个列表马上要换成另一份（进了另一个目录）：接下来那一次整批增删是换内容，不逐项放退场入场。 */
export declare function markSwap(): void;
/** 同一项的「编辑」面（属性面板那几块传它）；实例右栏的「运行」面用 {@link useSwap} 默认的 0。 */
export declare const EDIT_VIEW = 1;
/**
 * 右栏换了内容（选中了另一个节点 / 连线 / 回到总览）：栏框不动，旧内容让开淡出、新内容淡入（见 {@link swapIn}），
 * 方向按两者在画布上的左右（`at` 是横坐标）：选了右边的，新内容从右边进来。
 *
 * 两种情况都接得住：
 * - 面板按选中项挂键、每换一个就重新挂一块（编辑页的几种面板）：旧面板卸掉时拍下它的样子，
 *   同一帧里挂上的新面板拿它当影子；
 * - 面板一直挂着、只是内容换了（实例视图的右栏）：`key` 变了的那次渲染里 DOM 还是旧的，在那里拍。
 *
 * `key` 两边要用同一种写法。`view` 是同一项的第几个面（实例视图里「运行」0、「编辑」1）：
 * 来回切时标题栏原地不动，只有下面的内容按先后方向换（见 {@link swapIn}）。
 * 只放 Web Animation（transform / opacity），不重新挂载，焦点、输入都留着。
 */
export declare function useSwap<E extends HTMLElement>(key: string, at: number, view?: number): RefObject<E>;
/** 切换时旧图至少压暗多久再换新的（和 chrome/frame.module.css 里压暗的过渡一致）。 */
export declare const SWITCH_HOLD_MS = 170;
/**
 * 换一份内容（切换工作流）时，新的还没到、或到得太快，旧的先多留一会儿：
 * `live` 是当前该显示的东西（`key` 变了 = 换了一份）；`loading` 是正在换。
 * 返回 `view`（这一刻真正该画的）与 `dim`（旧的在等新的，外面把它压暗、别让人点）。
 * 新的到了但离开始换还不到 `ms`，就再等到够 `ms`：先压暗、再换内容、再亮回来，是一次完整的呼吸，不是一闪。
 * 同一份内容里的编辑（`key` 不变）原样透传，不等。
 */
export declare function useSwapHold<V extends {
    key: string;
}>(live: V | null, loading: boolean, ms: number): {
    view: V | null;
    dim: boolean;
};
