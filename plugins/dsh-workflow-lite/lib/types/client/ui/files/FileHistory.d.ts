/**
 * dsh-workflow-lite — 查看框里的「版本」：一份产出每一轮存下的样子，挑一版看，或挑两版对比。
 *
 * - 标题行一个「版本」开关（{@link VersionsToggle}），点开正文右边一栏（{@link VersionsPanel}），新的在上；
 *   每行写哪一步第几轮、什么时候、比上一版大了多少、有判定的写判定。
 * - 「查看」：点一行，正文换成那一版。
 * - 「对比」：每行前面两个圈，分别选「旧」「新」；正文（{@link VersionCompare}）按格式比：
 *   文字逐行标出删了、加了什么，没变的长段折起来；Markdown、网页还能并排看排版后的样子；
 *   图片并排，或叠在一起拖一道线左右比。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/files/FileHistory
 */
import type { RunFileResponse } from '../../../shared/wire/run.ts';
import { type FileTarget } from '../../app/useRunFile.ts';
import type { T } from '../../i18n.ts';
import { type HistoryLine } from '../../model/outputHistory.ts';
import type { WorkflowLiteRpc } from '../../rpc.ts';
/** 栏里在做什么：挑一版看，还是挑两版比。 */
export type VersionsMode = 'view' | 'compare';
/** 对比的两版（`null` = 最新：现在的文件）。 */
export interface VersionPair {
    old: number | null;
    new: number | null;
}
/** 读一版要带的目标：最新的读现在的文件。 */
export declare function versionTarget(target: {
    node: string;
    item: number;
}, v: number | null): FileTarget;
/** 默认拿哪两版比：`at` 这一版和它前面一版（`at` 是第一版就和第二版比）。 */
export declare function defaultPair(line: HistoryLine, at: number | null): VersionPair;
/** 标题行的开关：「版本」加个数，拉开时换成强调色（和「说明」开关同一套）。 */
export declare function VersionsToggle(props: {
    t: T;
    count: number;
    open: boolean;
    onToggle(): void;
}): React.JSX.Element;
/** 正文右边那一栏：各版的列表，新的在上。 */
export declare function VersionsPanel(props: {
    t: T;
    line: HistoryLine;
    names: Readonly<Record<string, string>>;
    /** 现在的文件（最新那行的大小、时间）。 */
    live: RunFileResponse | null;
    mode: VersionsMode;
    onMode(mode: VersionsMode): void;
    /** 「查看」里看的是哪一版。 */
    pick: number | null;
    onPick(v: number | null): void;
    pair: VersionPair;
    onPair(pair: VersionPair): void;
}): React.JSX.Element;
/** 正文换成两版对比。 */
export declare function VersionCompare(props: {
    t: T;
    rpc: WorkflowLiteRpc;
    instance: string;
    target: {
        node: string;
        item: number;
    };
    /** 给人看的路径（认格式）。 */
    display: string;
    line: HistoryLine;
    names: Readonly<Record<string, string>>;
    pair: VersionPair;
}): React.JSX.Element;
