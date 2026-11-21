/**
 * dsh-workflow-lite — 一份产出的各版怎么排给人看：展示卡的时间线、查看框里的版本列表都从这里取。
 *
 * 存下的各版（`run/history`，见 `host/runs/history.ts`）按时间排，最后补一点「最新」——现在的文件。
 * 现在的文件就是最后存的那一版（修改时间、大小都对得上）时不另补：那一版就是最新。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/outputHistory
 */
import type { RunHistoryResponse, RunVersion } from '../../shared/wire/run.ts';
import type { T } from '../i18n.ts';
/** 现在的文件此刻的样子（`run/stat`）。 */
export interface LiveFile {
    exists: boolean;
    size: number;
    mtime: number;
}
export interface HistoryDot {
    /** 读这一点要带的版本号；最新（读现在的文件）是 `null`。 */
    v: number | null;
    /** 这一点的身份串（React key、记「钉住时最新的是哪一点」）。 */
    key: string;
    /** 存下的那一版；只有「最新」、且和存下的都不一样时是 `null`。 */
    version: RunVersion | null;
    /** 有判定时：把流程领回去重做（`again`）还是往下走（`pass`）。 */
    tone: 'pass' | 'again' | null;
}
export interface HistoryLine {
    dots: HistoryDot[];
    /** 第一点后面省略了几版（超了上限从中间删掉的）。 */
    dropped: number;
}
/** 现在的文件就是这一版。 */
export declare function isLive(version: RunVersion, live: LiveFile | undefined): boolean;
/** 排成一行：存下的各版，加上「最新」。一版都没存过是空的。 */
export declare function historyLine(history: RunHistoryResponse | null, live: LiveFile | undefined): HistoryLine;
/** 第几点是现在显示的那一版（`v` 为 `null` = 最新）。找不到（那一版被删了）当最新。 */
export declare function dotIndex(line: HistoryLine, v: number | null): number;
/**
 * 这一版叫什么：「改稿 · 第 2 轮」「改稿 · 执行前」；最新的、没存过的是「最新」。
 * @param names - 步骤 id → 名字（不在表里就用 id）。
 */
export declare function versionName(t: T, version: RunVersion | null, names: Readonly<Record<string, string>>): string;
/**
 * 刻度盘主刻度下的短标记：每轮第一版写「第 N 轮」，第一轮之前存下的写「初始」，最后一点写「最新」，其余不写
 * （一版一个标记会挤，轮次在一组里只标一次）。轮次按存下的那一版算，没存过的「最新」不算进哪一轮。
 */
export declare function roundMarks(t: T, line: HistoryLine): (string | null)[];
/** 判定写成一个词：通过 / 打回；没有判定是空串。 */
export declare function toneWord(t: T, tone: HistoryDot['tone']): string;
