/**
 * dsh-workflow-lite — 仓储各部分共用的结果与问题小工具：`Outcome`、失败构造、保存级问题、写失败翻译。
 *
 * 仓储拆成核心（`repoCore`）和几个按职责分的部分（工作流、列举、版本、节点与边、模板），
 * 它们都用同一种返回形状；这些小函数放在这里，各部分直接引用，谁也不必依赖外层的 `repository`。
 * @module @xiaoso/dsh-workflow-lite/host/store/repoResult
 */
import type { ErrorCode, ToolError, ToolWarning, ValidationProblem } from '../../shared/types.ts';
/** 仓储的统一返回：成功 `{ ok: true, result }`，失败 `{ ok: false, error }`（就是 `ToolError` 的字段）。 */
export type Outcome<T> = {
    ok: true;
    result: T;
} | {
    ok: false;
    error: ToolError['error'];
};
export type Failure = {
    ok: false;
    error: ToolError['error'];
};
export declare function fail(code: ErrorCode, message: string, detail?: Record<string, unknown>): Failure;
/** 某件事做到一半 IO 出错：`<what>失败：<原因>`。 */
export declare function ioError(what: string, error: unknown): Failure;
export declare function ok<T>(result: T): {
    ok: true;
    result: T;
};
export declare function saveProblem(code: ValidationProblem['code'], message: string): ValidationProblem;
export declare function hasLevel(problems: readonly ValidationProblem[], level: ValidationProblem['level']): boolean;
export declare function onlyLevel(problems: readonly ValidationProblem[], level: ValidationProblem['level']): ValidationProblem[];
/** 把非阻塞问题（警告 / 提示）转成工具线格式的 `warnings`。 */
export declare function problemsToWarnings(problems: readonly ValidationProblem[]): ToolWarning[];
export declare function describeProblems(problems: readonly ValidationProblem[]): string;
/** errno → 工具失败码：`dataDir` 不可写 / 不可用 ⇒ `invalid_args`，其余 IO 失败 ⇒ `io_error`。 */
export declare function mapWriteFailure(error: unknown, target: string): Failure;
