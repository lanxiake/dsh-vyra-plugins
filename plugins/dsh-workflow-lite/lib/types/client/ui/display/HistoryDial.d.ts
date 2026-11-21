/**
 * dsh-workflow-lite — 展示卡底边外的各轮产出刻度盘（{@link HistoryBar} 挂进卡片的时间线位置）。
 *
 * 像相机拨盘：正中不动，刻度尺在下面滑。一版一道主刻度，正对正中的那道是强调色（没有另外的指针），
 * 离正中越近的刻度越高越亮，两头渐隐；主刻度头上一颗判定色小点，下面每轮第一版写轮次。下面一行写这一版叫什么。
 *
 * 交互：悬停一道刻度只预览（移开回到钉住的那版）；点一下、按住拖（松手吸附到最近一版）、滚轮、方向键 / Home / End 才换版钉住。
 * 尺子的位置、放大区由 {@link useDialMotion} 逐帧写，这里只渲染一次刻度。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/HistoryDial
 */
import type { T } from '../../i18n.ts';
import { type HistoryLine } from '../../model/outputHistory.ts';
export declare function HistoryDial(props: {
    t: T;
    line: HistoryLine;
    /** 每一点叫什么（最后一点叫「最新」）。 */
    labels: readonly string[];
    /** 卡片里现在显示的是第几点（含悬停预览；连续换版时等停下才跟上）。 */
    current: number;
    /** 现在显示的是悬停预览。 */
    previewing: boolean;
    /** 钉住的是第几点（没钉 = 最后一点）。 */
    pinnedAt: number;
    /** 钉着旧版的时候又来了新的一版。 */
    newer: boolean;
    /** 悬停预览：给 `undefined` 是不预览了。 */
    onPreview(v: number | null | undefined): void;
    onPin(v: number | null): void;
}): React.JSX.Element;
