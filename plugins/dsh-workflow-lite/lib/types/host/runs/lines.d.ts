/**
 * dsh-workflow-lite — 日志、纯文本按行读（`run/lines`）：画布上只拿要显示的那几十行，不整份读进来。
 *
 * 三种读法：
 * - `tail`：从末尾（或 `before`，往上翻页时上一回的开头）往前一块一块读，凑够 `limit` 行就停；
 * - `head`：从 `from` 往后读，凑够就停（从头看、往下翻页）；
 * - `follow`：接着上一回的末尾（`from` + `tag`）往后读新追加的；文件被重写、截短过（`tag` 对不上）
 *   或者一下子多出太多，就退回 `tail` 重读。
 *
 * 带 `filter` 时只要匹配的行（可带上下文），扫到 `maxBytes` / `maxMs` 就停，说清楚只扫了多少。
 * 正则是用户写的，可能写出要回溯到天荒地老的那种：带筛选的扫描放在单独的工作线程里跑（{@link LineScanner}），
 * 超时就终止那个线程，主机不会被卡住。不带筛选的只是切行，直接在这里跑。
 *
 * {@link scanLines} 要原样搬进工作线程（`toString()` 拼成线程的源码），所以它**不能引用这个模块里的任何东西**：
 * 常量、小工具都写在函数里面，文件系统从参数传进来。
 *
 * @module @xiaoso/dsh-workflow-lite/host/runs/lines
 */
import type { open as openFile } from 'node:fs/promises';
import type { LineFilter } from '../../shared/types.ts';
import { type RunLinesResponse } from '../../shared/wire/run.ts';
/** 一次扫描要做什么（主线程、工作线程共用，只有能结构化克隆的字段）。 */
export interface LineScanJob {
    full: string;
    mode: 'tail' | 'head' | 'follow';
    /** 不筛时是行数，筛的时候是匹配的行数（上下文另算）。 */
    limit: number;
    /** `tail`：读到这里为止（不含，是行首）；缺省 = 末尾。 */
    before?: number;
    /** `head` / `follow`：从这里读起（行首）。 */
    from?: number;
    /** `follow`：上一回末尾那几个字节的指纹。 */
    tag?: string;
    /** `follow`：上一回最后一处匹配还欠几行下文。 */
    owed?: number;
    filter?: LineFilter;
    maxBytes: number;
    maxMs: number;
}
/** 扫描结果：{@link RunLinesResponse} 里和文件内容有关的那部分。 */
export type LineScanResult = Omit<RunLinesResponse, 'path' | 'display' | 'exists' | 'mtime' | 'kind'>;
/**
 * 读一段、切成行、（筛的话）挑出匹配的。自成一体：见模块说明。
 * @param fs - 只用到 `open`（主线程传 `node:fs/promises`，工作线程自己 require 一份）。
 */
export declare function scanLines(job: LineScanJob, fs: {
    open: typeof openFile;
}): Promise<LineScanResult>;
/** 正则写得对不对（只编译，不跑）：不对回原因。 */
export declare function patternError(filter: LineFilter | undefined): string | null;
/** 一个任务在工作线程里最多跑多久（比扫描自己的时间预算宽：那个预算只在块之间查，一条正则卡在一行里查不到）。 */
export declare const LINE_WORKER_TIMEOUT = 1500;
/** 正则太慢、被终止了。 */
export declare class SlowPatternError extends Error {
    constructor();
}
/**
 * 带筛选的扫描放在一个工作线程里跑：一个任务超时就终止整个线程，那个任务回 {@link SlowPatternError}，
 * 同线程里被连累的任务换个新线程重来一次。线程不拖住主机退出，空闲一会儿就收掉。
 */
export declare class LineScanner {
    private worker;
    private readonly pending;
    private nextId;
    private idle;
    private readonly timeout;
    constructor(timeout?: number);
    scan(job: LineScanJob): Promise<LineScanResult>;
    /** 收掉线程（插件卸载时）。 */
    dispose(): void;
    private post;
    private ensure;
    private timedOut;
    /** 线程没了（终止、出错）：还在等的任务换个新线程重来一次，再不行就报错。 */
    private crashed;
    private settle;
}
/** 读几行给画布：先看在不在、是不是二进制或 UTF-16（这两种不按行读），再扫。 */
export declare function readRunLines(full: string, display: string, request: {
    mode: LineScanJob['mode'];
    limit: number;
    before?: number;
    from?: number;
    tag?: string;
    owed?: number;
    filter?: LineFilter;
}, scanner: LineScanner): Promise<RunLinesResponse>;
