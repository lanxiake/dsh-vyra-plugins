/**
 * dsh-workflow-lite — 顶栏右端的「预览 / 执行」组。
 *
 * 左边是预览计划（只留图标）；右边是执行，样子和实例下拉的触发器一样（平时不着色，悬停才亮）：
 * 「▶ 执行」缺省在同一工作区**新建一个会话**执行；旁边的小箭头打开选择：第一项就是新建会话，
 * 下面可以搜同一工作区的会话、挑一个执行。
 * 执行 = 用模板现在的样子建一个实例，往那个会话发一句话，然后跳过去看它跑。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/shell/Launch
 */
import { type SessionRow } from '../../app/sessions.ts';
import type { LocaleKey, T } from '../../i18n.ts';
export interface LaunchProps {
    t: T;
    /** 图是空的：预览、执行都不能点。 */
    empty: boolean;
    /** 执行为什么不能点（`null` = 能点）。 */
    blocked: LocaleKey | null;
    /** 正在建实例 / 发消息。 */
    starting: boolean;
    /** 这个 tab 所在的会话。 */
    session: string | undefined;
    rows: readonly SessionRow[];
    /** 能在同一工作区新建会话（缺省的执行方式）；不能时主按钮退回本会话。 */
    canCreate: boolean;
    onPreview(): void;
    /** `null` = 新建会话执行。 */
    onRun(session: string | null): void;
}
export declare function Launch(props: LaunchProps): React.JSX.Element;
