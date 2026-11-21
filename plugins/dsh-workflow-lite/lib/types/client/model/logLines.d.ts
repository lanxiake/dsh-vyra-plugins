/**
 * dsh-workflow-lite — 日志、纯文本按行看（`run/lines`）的前端这一半：读回来的几段怎么拼成一个窗口、
 * 哪些行是错误 / 警告、筛选写得对不对、几个现成的筛选。纯函数，展示卡和查看框共用。
 *
 * 窗口是文件里连续的一段（`start`–`end` 字节），筛的时候只留匹配的行和上下文，`skip` 记着中间跳过了几行。
 * 往下续（新追加的）接在后面，往上翻接在前面；超过上限就从另一头扔掉，那一头变成「还有」。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/logLines
 */
import type { LineFilter, ViewFrom } from '../../shared/types.ts';
import type { RunLine, RunLinesResponse } from '../../shared/wire/run.ts';
export interface LineWindow {
    lines: RunLine[];
    /** 末尾还没写完的那一行。 */
    pending?: RunLine | undefined;
    /** 窗口在文件里的范围（字节）。 */
    start: number;
    end: number;
    /** `end` 处的指纹（往下续读带上；窗口没到末尾时没用）。 */
    tag: string;
    /** 最后一行之后、`end` 之前筛掉了几行。 */
    trail: number;
    /** 最后一处匹配还欠几行下文。 */
    owed: number;
    /** 窗口里匹配了几行（不筛时 = 行数）。 */
    matched: number;
    /** `start` 前面还有没读的。 */
    before: boolean;
    /** `end` 后面还有没读的（不是一直读到末尾的）。 */
    after: boolean;
    /** 往前扫到上限停下了（筛的时候）。 */
    stopped?: 'bytes' | 'time' | undefined;
    size: number;
    mtime: number;
    /** 这一回新来的行（行首位置）：亮一下再淡下去；`parity` 每次换一个，同一行又是新的也从头亮。 */
    fresh: ReadonlySet<number> | null;
    parity: 0 | 1;
}
/** 一回读到的当成一个新窗口。 */
export declare function windowOf(response: RunLinesResponse, mode: 'tail' | 'head' | 'follow'): LineWindow;
/** 续读回来的（`follow`）：接上就接在后面（只留最后 `cap` 行），接不上（文件被重写、中间断开）就整个换掉。 */
export declare function appendWindow(win: LineWindow, response: RunLinesResponse, cap: number): LineWindow;
/** 往上翻读回来的（`tail` + `before`）：接在前面，超过 `cap` 行从后面扔（后面就变成「还有」）。 */
export declare function prependWindow(win: LineWindow, response: RunLinesResponse, cap: number): LineWindow;
/** 往下翻读回来的（`head` + `from`）：接在后面，超过 `cap` 行从前面扔（前面就变成「还有」）。 */
export declare function extendWindow(win: LineWindow, response: RunLinesResponse, cap: number): LineWindow;
export type LineLevel = 'error' | 'warn';
export declare function lineLevel(text: string): LineLevel | null;
/** 现成的几个筛选（填进去的就是一条正则，还能改）。 */
export declare const FILTER_PRESETS: {
    readonly errors: "\\b(?:fatal|error|err|critical|panic)\\b|[✗✘❌]";
    readonly problems: "\\b(?:fatal|error|err|critical|panic|warn|warning)\\b|[✗✘❌⚠]";
};
export type FilterPreset = keyof typeof FILTER_PRESETS;
/** 筛选写得不对的原因（V8 的原话去掉前缀）；对的、没写字、不是正则的是 `null`。 */
export declare function filterProblem(filter: LineFilter | undefined): string | null;
/** 真的在筛：写了字、而且写得对。 */
export declare function activeFilter(filter: LineFilter | undefined): LineFilter | undefined;
/** 筛选的身份串（换了筛选就重读）。 */
export declare function filterKey(filter: LineFilter | undefined): string;
/**
 * 「看哪一段」落到实处（日志和表格共用）：写了就按写的；自动 = `.log`、写它的步骤正在跑、文件超过 1 MB 时看末尾，别的从头。
 */
export declare function linesFrom(view: {
    from?: ViewFrom | undefined;
}, context: {
    log: boolean;
    writing: boolean;
    size: number;
}): ViewFrom;
/** 一行里命中的几段切开：`[文字, 是不是命中]`。 */
export declare function splitHits(text: string, hits: readonly number[] | undefined): [string, boolean][];
