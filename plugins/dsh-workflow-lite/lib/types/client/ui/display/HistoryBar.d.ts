/**
 * dsh-workflow-lite — 展示卡的各轮产出：这份产出每一轮存下的样子（见 `model/outputHistory.ts`）。至少有两版才有。
 *
 * 两块，和标题行右边的按钮一样，悬停卡片或选中时才出来：
 * - 卡片底边外的刻度盘（{@link HistoryDial}）：正中对着显示的那一版，悬停预览、点击 / 拖动 / 滚轮 / 方向键换版钉住。
 * - 标题行里写出看的是哪一版（「第 2 轮 · 审查后 3/6」），跟着刻度盘上悬停的那一点换字；点它下拉出各版列表
 *   （新的在上），悬停一项卡里临时换成那一版，点一下钉住。
 *   钉在旧版时旁边多一个 ✕ 回到最新（颜色不变）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/HistoryBar
 */
import type { T } from '../../i18n.ts';
import { type HistoryLine } from '../../model/outputHistory.ts';
export declare function HistoryBar(props: {
    t: T;
    /** 标题行里留给「看的是哪一版」的位置。 */
    slot: HTMLElement | null;
    /** 卡片底边外留给时间线的位置。 */
    rail: HTMLElement | null;
    line: HistoryLine;
    names: Readonly<Record<string, string>>;
    /** 卡片里现在显示的是哪一版（`null` = 最新）。 */
    shown: number | null;
    /** 现在显示的是悬停预览。 */
    previewing: boolean;
    /** 钉住的那一版；没钉是 `null`。 */
    pinned: number | null;
    /** 钉着的时候又来了新的一版。 */
    newer: boolean;
    /** 悬停预览：给 `undefined` 是不预览了。 */
    onPreview(v: number | null | undefined): void;
    onPin(v: number | null): void;
}): React.JSX.Element | null;
