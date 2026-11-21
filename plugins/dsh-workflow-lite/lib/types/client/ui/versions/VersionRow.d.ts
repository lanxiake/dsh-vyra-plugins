/**
 * dsh-workflow-lite — 版本列表的一行：「v3 · 说明 · 时间 · 步骤数 · 当前」。
 *
 * - 点这一行展开「切到这一版会有哪些变化」（和磁盘上现在的内容比）：箭头转过来、变化一条条浮出，
 *   下面的行滑下去让位（`VersionList` 的 useResizeFlip）；收起时下面的行滑回来；
 * - 「切换 / 编辑说明 / 删除」平时藏着，悬停或键盘移进来时浮在右端（和 `WorkflowRow` 一个做法）；
 * - 切换、删除都要再确认一次，确认卡浮在按钮旁边；编辑说明就在这一行原地换成输入框。
 *
 * 记忆的版本也用这一行：展开的那块换成「查看这一版的文件」（`onView`），第二行写文件数和大小。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/versions/VersionRow
 */
import type { VersionEntry } from '../../../shared/types.ts';
import type { VersionActions, Versions } from '../../app/useVersions.ts';
import type { T } from '../../i18n.ts';
/** 一行版本要的：工作流的版本、记忆的版本都有这几样。 */
export type RowEntry = Pick<VersionEntry, 'n' | 'createdAt' | 'note' | 'autoBefore' | 'current' | 'invalid'>;
export declare function VersionRow(props: {
    t: T;
    entry: RowEntry;
    versions: Pick<VersionActions<unknown>, 'busy' | 'restore' | 'setNote' | 'remove'>;
    /** 和现在内容一样的那个版本号（切换的确认卡据此说"切回来不丢"）。 */
    currentN: number | null;
    /** 第二行时间后面那句（几个步骤 / 几个文件）。 */
    meta: string;
    /** 点这一行展开的那块；不给就看 `onView`。 */
    detail?: React.ReactNode;
    /** 点这一行打开这一版看（记忆：看那一版的文件）。 */
    onView?: () => void;
    /** 切换确认卡上补的一句。 */
    restoreNote?: string;
    /** 测试钩子的前缀（缺省 `wl-ver`）。 */
    testPrefix?: string;
}): React.JSX.Element;
/** 工作流版本展开的那一块：切到这一版会有哪些变化。列表每次重读（存了、切了）都重新比一次。 */
export declare function DiffView(props: {
    t: T;
    entry: VersionEntry;
    versions: Versions;
}): React.JSX.Element | null;
