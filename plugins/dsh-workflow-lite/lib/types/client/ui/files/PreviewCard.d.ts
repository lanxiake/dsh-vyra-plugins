/**
 * dsh-workflow-lite — 右栏里的一段长文字：只露前几行，点这块或标题行的 👁 在弹窗里看全文（可复制）。
 *
 * 实例里步骤的提示词、摘要、失败原因，连线的上游摘要与交接说明，模板里步骤的提示词都用它，长短不一但样子一致。
 * 能改的（给了 `edit`）标题行多一支笔，弹窗里多一个「编辑」：大段文字都在弹窗里改，右栏只露一截。
 * 空着的能改的那块写着占位，点一下直接进「编辑」。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/files/PreviewCard
 */
import type { Desktop } from '../../app/desktop.ts';
import type { T } from '../../i18n.ts';
import { type DocEdit } from './DocViewer.tsx';
/** 能改时怎么交出去。 */
export interface PreviewEdit extends Omit<DocEdit, 'start'> {
    /** 弹窗关上（一次编辑结束）：断开撤销合并。 */
    onSeal?(): void;
}
export declare function PreviewCard(props: {
    t: T;
    /** 小标题（可以带改过的小圆点）。 */
    label: React.ReactNode;
    text: string;
    /** 弹窗：标题、左边的图标块、标题下面一行、收在「说明」开关里的说明。 */
    name: string;
    badge: React.ReactNode;
    meta: string;
    note?: string;
    copyLabel: string;
    desktop: Desktop | undefined;
    testId: string;
    /** 露几行（缺省 4）。 */
    lines?: number;
    /** 卡片下面的一行说明。 */
    help?: React.ReactNode;
    /** 标题行里笔、眼睛左边再放的按钮（记忆提示词的「恢复默认」）。 */
    actions?: React.ReactNode;
    edit?: PreviewEdit;
    /** 一出来就打开弹窗、进「编辑」（刚加的空白步骤写提示词）。 */
    autoEdit?: boolean;
}): React.JSX.Element;
