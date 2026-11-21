/**
 * dsh-workflow-lite — 概览的右栏标题栏与图标块。
 *
 * 实例右栏的「概览」和顶栏「在看什么」共用图标块（{@link OverviewMark}）；
 * 其余几种标题栏在 `panel/NodeHeads.tsx`。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/run/OverviewHead
 */
import type { HeadProps } from '../panel/NodeHeads.tsx';
/** 概览的图标块（右栏标题栏与顶栏「在看什么」共用）。 */
export declare function OverviewMark(): React.JSX.Element;
export declare function OverviewHead(props: HeadProps): React.JSX.Element;
