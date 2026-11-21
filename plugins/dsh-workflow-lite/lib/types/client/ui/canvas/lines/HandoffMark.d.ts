/**
 * dsh-workflow-lite — 步骤之间的线上的交接标记：气泡 / 「只管先后」，悬停弹出说明卡，可就地编辑说明。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/canvas/lines/HandoffMark
 */
import type { T } from '../../../i18n.ts';
import type { HandoffActs } from '../types.ts';
/**
 * 步骤之间的线上的交接标记——只在不是缺省时出现（缺省就是交执行结果，画出来只会满屏都是）：
 * 附了交接说明是一个对话气泡，只管先后是一个虚线框的「只管先后」。点它选中这条线。
 * 颜色跟着线走（父层给的 `--wl-chip`）。
 *
 * 悬停气泡弹出一张卡片看说明；卡片上的「编辑交接」把说明就地换成输入框并把卡片钉住（边打边存，
 * 同一次输入并成一条撤销步），Esc、点空白处、点「完成」收起。右栏的交接开关另在「在右栏打开」里。
 */
export declare function HandoffMark(props: {
    edgeId: string;
    handoff: {
        note?: string;
        none: boolean;
    };
    route: string;
    t: T;
    selected: boolean;
    onPick: (id: string) => void;
    acts: HandoffActs;
}): React.JSX.Element;
