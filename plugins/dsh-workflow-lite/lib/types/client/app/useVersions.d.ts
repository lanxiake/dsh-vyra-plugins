/**
 * dsh-workflow-lite — 一个工作流的版本：列、存、切、改说明、删，外加「切到这一版会变什么」。
 *
 * 编辑页的「版本」对话框和工作流中心的「工作流」页共用它。版本存的是**磁盘上**那份：
 * 动手之前先调 `before()`（编辑页正开着这张图时把还没写下去的改动存掉）；
 * 切换写回了工作流之后调 `onRestored()`（正开着就按磁盘重新加载）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/useVersions
 */
import { type Dispatch, type SetStateAction } from 'react';
import { type GraphChange } from '../../shared/graphDiff.ts';
import type { VersionEntry, WorkflowDocument } from '../../shared/types.ts';
import type { T } from '../i18n.ts';
import { type WorkflowLiteRpc } from '../rpc.ts';
export interface VersionNotice {
    tone: 'ok' | 'error';
    text: string;
    /** 每条提示一个新值：同样的字再出现一次也要重新淡入。 */
    seq: number;
}
/** 切到某一版会变什么：`base` = 现在，`next` = 那一版。 */
export interface VersionDiff {
    changes: GraphChange[];
    settings: boolean;
    base: WorkflowDocument;
    next: WorkflowDocument;
}
/** 一列版本共有的那几件事：列、存、切、改说明、删（工作流的、记忆的都是这一套）。 */
export interface VersionActions<E> {
    /** `null` = 还在读。 */
    list: E[] | null;
    /** 正在做的那件事（按钮按住）。 */
    busy: boolean;
    notice: VersionNotice | null;
    refresh(): Promise<void>;
    restore(n: number): Promise<boolean>;
    setNote(n: number, note: string): Promise<boolean>;
    remove(n: number): Promise<boolean>;
}
export interface Versions extends VersionActions<VersionEntry> {
    /** `memories` = 连同这张引用的记忆一起存一版。 */
    save(note: string, memories?: boolean): Promise<boolean>;
    diff(n: number): Promise<VersionDiff | null>;
}
/** {@link useVersionCore} 拿回来的：列表、提示，和「一件改动」的做法。 */
export interface VersionCore<E> {
    list: E[] | null;
    setList: Dispatch<SetStateAction<E[] | null>>;
    busy: boolean;
    notice: VersionNotice | null;
    say(tone: VersionNotice['tone'], text: string): void;
    refresh(): Promise<void>;
    /** 一件改动：按住按钮 → before → 做 → 重新列 → 报一句。 */
    act(task: () => Promise<string>): Promise<boolean>;
}
/**
 * 版本列表的底子：`load` 换了（换了一张工作流、一条记忆）就清空重读，上一份的回包不要；
 * 成功的提示过一会儿自己淡掉，出错的留着。
 */
export declare function useVersionCore<E>(options: {
    t: T;
    load: () => Promise<E[]>;
    before?: (() => Promise<boolean>) | undefined;
    onChanged?: (() => void) | undefined;
}): VersionCore<E>;
export declare function useVersions(options: {
    t: T;
    rpc: WorkflowLiteRpc;
    name: string;
    /** 动手前（存掉编辑页还没写下去的改动）；回 `false` 就不做了。 */
    before?: () => Promise<boolean>;
    /** 切换写回了工作流之后。 */
    onRestored?: () => void;
    /** 版本数变了（列表里的「N 个版本」跟上）。 */
    onChanged?: () => void;
    /** 连同记忆存了版本（记忆那边的列表跟上）。 */
    onMemoriesSaved?: () => void;
}): Versions;
