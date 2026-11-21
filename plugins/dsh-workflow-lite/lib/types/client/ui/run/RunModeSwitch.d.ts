/**
 * dsh-workflow-lite — 实例右栏标题栏里「运行 / 编辑」的切换：两个图标格，挨着关闭按钮。
 * 选中格下面的滑块滑过去（见 motion/thumb.tsx 的 PickThumb），图标是灰、蓝两枚交叉淡过去（FadeMark），新选中的那枚弹一下；
 * 文字在悬停提示里。
 *
 * 两个面各带一份标题栏（换面时整块面板换掉），所以滑块靠 `carry` 跨着重新挂载接着滑。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/run/RunModeSwitch
 */
import type { T } from '../../i18n.ts';
/** 右栏选中东西时看什么：这次运行的样子，还是改它（模板的属性面板）。 */
export type PanelMode = 'run' | 'edit';
export declare function RunModeSwitch(props: {
    t: T;
    mode: PanelMode;
    onChange(mode: PanelMode): void;
}): React.JSX.Element;
