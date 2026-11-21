/**
 * dsh-workflow-lite — 展示卡按行读日志（`run/lines`）：第一次读末尾（或开头）几百行，之后文件每变一次只续读新追加的。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/useRunLines
 */
import type { LineFilter } from '../../shared/types.ts';
import type { RunLinesResponse } from '../../shared/wire/run.ts';
import { type LineWindow } from '../model/logLines.ts';
import { type WorkflowLiteRpc } from '../rpc.ts';
export interface LinesTarget {
    node: string;
    item: number;
    sub?: string;
    version?: number;
}
export interface RunLines {
    /** 读到的窗口；换了目标、筛选，新的读回来之前还是上一份（不闪空）。 */
    win: LineWindow | null;
    /** 这个文件不按行读（UTF-16、二进制）：`run/lines` 回的种类。 */
    kind: RunLinesResponse['kind'] | null;
    error: string | null;
}
/**
 * @param from - `end` 读末尾、跟着往下走；`start` 读开头（文件变了从头再读一遍：只读 `limit` 行，不贵）。
 * @param signal - 变了就续读（现在的文件拿修改时间；`null` 不读）。
 */
export declare function useRunLines(rpc: WorkflowLiteRpc, instance: string, target: LinesTarget | null, options: {
    from: 'end' | 'start';
    limit: number;
    filter: LineFilter | undefined;
}, signal: string | number | null): RunLines;
