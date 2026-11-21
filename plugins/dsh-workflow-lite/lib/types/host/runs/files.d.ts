/**
 * dsh-workflow-lite — 实例里的文件：给画布看一眼（资源面板与查看框）。
 *
 * 只读、只认这个实例名下的文件：要么是快照里某个资源的文件项，要么是落在实例工作区里的相对路径
 * （模型在状态文件 `outputs` 里写的那些）。随手传进来的工作区外路径一律拒绝——这条路由不是通用的读文件口子。
 *
 * 读多少：小文本整份回去（`RUN_FILE_TEXT_MAX`，HTML 另按 `RUN_FILE_HTML_MAX` 放宽），大了只回元信息
 * 让前端说"太大了"；前 8 KB 里有 NUL 字节就当二进制。
 *
 * @module @xiaoso/dsh-workflow-lite/host/runs/files
 */
import type { InstanceRecord } from '../../shared/runState.ts';
import type { WorkflowDocument } from '../../shared/types.ts';
import { type RunDirResponse, type RunFileResponse, type RunImageResponse } from '../../shared/wire/run.ts';
import type { Outcome } from '../store/repoResult.ts';
/**
 * 文本文件按什么编码读：带 BOM 的按 BOM（UTF-8 / UTF-16，BOM 本身不留在正文里）；没有的先按 UTF-8 严格解，
 * 解不通再退到 GB18030（GBK 的超集：Windows 上的中文日志、记事本存的文件多半是它）。
 * 宿主没有这套编码时按 UTF-8 宽松读（认不出的字节成了替换符）。
 */
export declare function decodeText(bytes: Uint8Array): string;
/** 开头是 UTF-16 的 BOM（里面的 0 字节不算二进制）。 */
export declare const isUtf16: (bytes: Uint8Array) => boolean;
/**
 * 要看哪份：快照里某个资源的第几项（文件夹项可以再带 `sub`：往下走的相对路径；文件项可以带 `version`：
 * 存下的第几版，见 `history.ts`），或实例工作区里的相对路径。
 */
export type RunFileTarget = {
    node: string;
    item: number;
    sub?: string;
    version?: number;
} | {
    path: string;
};
/**
 * 整理文件夹里的相对路径：`/`、`\` 都当分隔符，空段和 `.` 去掉；`..`、盘符、绝对路径、空字符一律拒绝
 * （只许往下走）。回 `/` 分隔、没有首尾斜杠的串，根是空串。
 */
export declare function cleanSub(sub: string | undefined): Outcome<string>;
/**
 * `full` 真实位置（软链也算）还在 `root` 里面吗？`full` 还不存在时看不出，放行（读它自会说不存在）。
 * 文件夹里放一个指向外面的软链，不该成为读任意文件的口子。
 */
export declare function realInside(root: string, full: string): Promise<boolean>;
/**
 * 快照里一个资源的第几项实际在哪（还没拼工作区）；不是文件 / 文件夹就是 `null`。
 * 相对路径：有步骤写这个资源时在产出根目录下，只被读时相对工作区。
 */
export declare function itemLocation(document: WorkflowDocument, node: string, item: number): string | null;
/**
 * 把目标解析成绝对路径与给人看的相对路径；越界或找不到就是错误。
 * @param underRoot - 相对路径按产出根目录解析（模型报告产出时可能是相对根目录写的）。
 */
export declare function resolveRunFile(record: Pick<InstanceRecord, 'cwd'>, document: WorkflowDocument, target: RunFileTarget, underRoot?: boolean): Outcome<{
    full: string;
    display: string;
    root?: string;
}>;
/**
 * Markdown 里引用的图片在哪：`src` 按文档所在目录解析（去掉 `?…` / `#…`）。
 * 只认相对路径与图片扩展名；结果要在工作区里，或在文档自己的目录下（产出根目录可能是工作区外的绝对路径）。
 */
export declare function resolveImageRef(cwd: string | undefined, docFull: string, src: string): Outcome<{
    full: string;
    mime: string;
}>;
/** 文件自己当图看：按扩展名认类型（和 {@link resolveImageRef} 同一张表），不是图片就拒绝。 */
export declare function resolveSelfImage(full: string): Outcome<{
    full: string;
    mime: string;
}>;
/** 读一张图（上限 {@link RUN_IMAGE_MAX}）。 */
export declare function readRunImage(full: string, mime: string): Promise<Outcome<RunImageResponse>>;
/**
 * 读一份文件给画布：小文本带正文，其余（含文件夹）只有元信息。
 * `tail`：太大的文本不说「太大」，读最后 `limit` 字节（从下一个换行起，不留半行），`cut` 是前面没读的字节数——
 * 日志要看的是最新那几行。UTF-16 的不这么读（从中间切开对不上字节）。
 */
export declare function readRunFile(full: string, display: string, options?: {
    tail?: boolean;
}): Promise<RunFileResponse>;
/**
 * 一个路径现在的样子（画布展示问在不在、变没变）：文件是大小与修改时间；文件夹的「大小」是这一层有几项，
 * 修改时间取它自己和这一层里各项中最新的（往里加、删一份改的是文件夹自己的时间，覆盖写一份只改那一份的）。
 * 不在、读不了、是文件夹却要文件（或反过来）都回 `null`。只看一层，最多 {@link RUN_DIR_MAX} 项。
 *
 * 文件夹隔一会儿就被问一次：文件夹自己的时间没变时，只再看上回最近改过的 {@link DIR_HOT} 份，
 * 每 {@link DIR_RESCAN_MS} 整份重看一次，几千份的文件夹也不必每回逐份 stat。
 */
export declare function statRunPath(full: string, want: 'file' | 'folder'): Promise<{
    size: number;
    mtime: number;
} | null>;
/** 列一层目录：目录在前、各自按名字排（数字按大小）；读不了的条目（断了的软链）跳过。 */
export declare function readRunDir(full: string, display: string, sub: string): Promise<RunDirResponse>;
