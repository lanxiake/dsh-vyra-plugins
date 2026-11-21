/**
 * dsh-workflow-lite — 仓储核心：各部分共用的那一小块状态与读-改-写骨架。
 *
 * 拿着数据根目录、注入的文档级校验器、进程内写锁和基线快照，对外只给几样东西：
 * - `withLock`：一条 promise 链，写路径全程串行（一次工具调用全程在锁内）；
 * - `mutate` / `persist`：读-改-写（写前哈希比对 → 字段级合并 → 复核 → 原子写），**所有写都走这一条**；
 * - `validate` / `resolveName` / `pickFreeName`：校验与名字；
 * - `rememberBaseline` / `baselineFor` / `dropBaselines`：基线快照。
 *
 * 各部分（`repoWorkflows` / `repoList` / `repoVersions` / `repoNodes` / `repoTemplates`）
 * 只按自己用到的几项取窄接口（`Pick<RepoCore, …>`），不碰别的。
 * @module @xiaoso/dsh-workflow-lite/host/store/repoCore
 */
import type { ChangedEntry, ToolWarning, ValidationProblem, WorkflowDocument, WriteResult } from '../../shared/types.ts';
import { type NameOccupant } from './paths.ts';
import { type Failure, type Outcome } from './repoResult.ts';
/** 合并-重试的上限：合并期间磁盘还在变就再读一次，超过这个次数即认输报 `conflict`。 */
export declare const MAX_MERGE_ATTEMPTS = 5;
/** 撞名自动加序号的上限（`-2` … `-99`）。 */
export declare const MAX_SEQUENTIAL = 99;
/**
 * 文档级校验器——`shared/validate.ts` 的入口在 host 装配时注入（缺省不做文档级校验）。
 *
 * 图名要一起给：校验层有两条规则依赖它（图名的文件名约束、同名目录占位）。
 * `maxNodes` 这类活配置由装配方闭包进来，仓储不认识 Config。
 *
 * 列表按文件身份记着每张图的保存级问题（见 `repoList.ts`）：**保存级问题只能取决于文档和图名**。
 * 要加看别的东西（配置、别的文件）的规则，放到编译级或警告里。
 */
export type DocumentValidator = (document: WorkflowDocument, workflow: string) => ValidationProblem[];
/** 名字空间：图目录与两个模板子目录**不能混**（`workflows` 这个词在两处都出现）。 */
type NameSpace = 'graphs' | 'templates/nodes';
export type MutationOutcome = {
    ok: true;
    document: WorkflowDocument;
    changed: ChangedEntry[];
    warnings: ToolWarning[];
} | Failure;
/** 仓储核心。见文件头。 */
export declare class RepoCore {
    readonly dataDir: string;
    private readonly validator;
    /**
     * 基线快照：`"<图名>\0<整图哈希>" → document`，只记 `load()` / 上一次写落盘的那个版本。
     * **它不服务任何读路径**（`read` / `compile` 永远直接读盘；`list` 每次看盘上的文件身份，见 `repoList.ts`），
     * 只为了让 `save()` 拿得到 `mergeDocuments` 需要的 `base`。
     *
     * 同名留多个快照是必要的：画布与工具可能各自持有旧基线并发写，只留最新一份的话
     * 旧基线就退化成"以磁盘为基线"，会把对方刚落盘的改动当成自己的旧值顶掉。
     */
    private readonly baselines;
    /** 进程内写锁：一条 promise 链，写路径全程串行。 */
    private chain;
    constructor(dataDir: string, validate?: DocumentValidator);
    withLock<T>(task: () => Promise<T>): Promise<T>;
    ensureLayout(): Promise<Outcome<{
        created: string[];
    }>>;
    /**
     * 读-改-写核心：写前哈希比对 → 字段级合并 → 复核 → 原子写。
     * **必须在 `withLock` 内调用**。
     *
     * 返回的 `diskBefore` 是"写这一笔之前磁盘上的样子"——`changed` 应当相对它算，
     * 否则会把外部先落盘的改动也算成我们改的。
     */
    persist(name: string, baseDocument: WorkflowDocument | null, baseHash: string | null, next: WorkflowDocument, force: boolean): Promise<Outcome<{
        hash: string;
        document: WorkflowDocument;
        diskBefore: WorkflowDocument | null;
        warnings: ToolWarning[];
    }>>;
    /** 一次写类工具调用的公共骨架：锁 + 预检 + 读-改-写。 */
    mutate(workflow: string, apply: (document: WorkflowDocument) => Promise<MutationOutcome>): Promise<Outcome<WriteResult>>;
    validate(document: WorkflowDocument, workflow: string): ValidationProblem[];
    resolveName(raw: string): Outcome<string>;
    occupantOf(space: NameSpace, name: string): Promise<NameOccupant>;
    /** 新建类操作：撞名（**含同名目录**）自动加序号并说明是哪一样占了位。 */
    pickFreeName(base: string, space: NameSpace, warnings: ToolWarning[]): Promise<Outcome<string>>;
    rememberBaseline(name: string, hash: string, document: WorkflowDocument): void;
    baselineFor(name: string, hash: string | null): WorkflowDocument | null;
    dropBaselines(name: string): void;
}
export {};
