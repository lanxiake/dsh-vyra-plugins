/**
 * dsh-workflow-lite — 实例视图底部的草稿栏：「已改 x 处 · 改动清单 · 给模型的说明 · 通知模型（开关）· 放弃 · 保存」。
 *
 * 图的改动与状态的改动攒在一起：清单里图的在前（一处一行），状态的在后（一个字段一行），每行都能单独撤回；
 * 冲突（模型同时改了同一个字段）排在最前面，让用户选。保存不了的时候按钮按住，悬停说明原因。
 * 「通知模型」默认开着；关掉就只保存。「放弃」要二次确认，确认卡浮在按钮旁边，栏里的东西不挪位。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/run/RunDraftBar
 */
import type { Run } from '../../app/useRuns.ts';
import type { T } from '../../i18n.ts';
/** 清单里图的一行。 */
export interface DraftLine {
    key: string;
    text: React.ReactNode;
    onUndo(): void;
}
export declare function DraftBar(props: {
    t: T;
    current: Run;
    /** 图的改动（排在状态的改动前面）。 */
    graph: readonly DraftLine[];
    /** 改了几处：图一处一项，状态按对象算。 */
    count: number;
    /** 保存不了的原因（图有问题、改完的状态对不上）；`null` = 能存。 */
    blocked: string | null;
    /** 右栏开着没有（开着就让到右栏左边）。 */
    panel: boolean;
    onSave(): void;
    onDiscard(): void;
}): React.JSX.Element;
