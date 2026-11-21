/**
 * dsh-workflow-lite — 数据目录的路径构造与「什么算一个图文件」的扫描判据。
 *
 * 目录与布局，三件要紧的事：
 * - **同名目录也算被占用**（`create` / `save_as_template` 加序号、`rename_workflow` 拒绝）；
 * - `.dispatch/` 以 `.` 开头 ⇒ 一切扫描**天然忽略**，它也**不参与任何读入**；
 * - 扫描只认「普通文件 + 非隐藏 + 以 `.json` 结尾（不区分大小写）」，其余条目
 *   （非 `.json`、隐藏文件、`.tmp-*`、子目录、符号链接、编辑器残渣）一律忽略，
 *   由调用方逐条报提示。
 *
 * 本模块只做**只读**文件系统访问（`stat` / `readdir`）与路径拼接；一切写入在 `atomic.ts`。
 * 依赖方向严格单向：`atomic.ts` → 本模块 → `shared/*`，不成环。
 * @module @xiaoso/dsh-workflow-lite/host/store/paths
 */
import type { PlanId } from '../../shared/types.ts';
/** 图文件 / 模板文件的后缀。判据不区分大小写。 */
export declare const JSON_SUFFIX = ".json";
/** 一个路径当前的占用形态。 */
export type PathKind = 'file' | 'dir' | 'missing';
/** 一个图名在 `workflows/` 下被谁占了位。`both` = 同名 `.json` 与同名目录同时存在（保存级）。 */
export type NameOccupant = 'file' | 'dir' | 'both' | null;
/** `errno` 码；拿不到就 `null`（异常形态不可控，一律当成"未知 IO 失败"）。 */
export declare function errnoCode(error: unknown): string | null;
/** 「不存在」的三种 errno：`ENOENT`、路径中间是文件的 `ENOTDIR`、目标是目录的 `EISDIR`。 */
export declare function isAbsentError(error: unknown): boolean;
/** 读路径上的失败是否应当当成「不存在」（目录缺失、目标是个目录）。 */
export declare function isMissingOrUnreadableAsFile(error: unknown): boolean;
/** `<dataDir>/workflows/`。 */
export declare function workflowsDir(dataDir: string): string;
/** `<dataDir>/templates/nodes/`：节点模板（画布步骤库的「我的步骤」）。 */
export declare function templatesDir(dataDir: string): string;
/** `<dataDir>/memories/`：记忆库（图里的 `{memory}`）。 */
export declare function memoriesDir(dataDir: string): string;
/** `<dataDir>/memories/<id>.json`：一条记忆的元数据。 */
export declare function memoryMetaFile(dataDir: string, id: string): string;
/** `<dataDir>/memories/<id>/`：一条记忆的 skill 文件夹。 */
export declare function memoryFolder(dataDir: string, id: string): string;
/** `<dataDir>/memory-versions/<id>/`：一条记忆的版本。 */
export declare function memoryVersionsDir(dataDir: string, id: string): string;
/** `<dataDir>/workflows/<名>.json`。 */
export declare function workflowFile(dataDir: string, name: string): string;
/** `<dataDir>/templates/nodes/<名>.json`。 */
export declare function templateFile(dataDir: string, name: string): string;
/** `<dataDir>/versions/<图名>/`：这个工作流存下的版本（`<序号>.json`）。 */
export declare function versionsDir(dataDir: string, name: string): string;
/** `<dataDir>/versions/<图名>/<序号>.json`。 */
export declare function versionFile(dataDir: string, name: string, n: number): string;
/** `<dataDir>/assets/<图名>/`：工作流目录（图里的 `{workflow}/…`）。 */
export declare function assetsDir(dataDir: string, name: string): string;
/** `<dataDir>/assets/`：资料目录的根。 */
export declare function assetsRoot(dataDir: string): string;
/** `<dataDir>/.pack/`：导入导出的暂存区。 */
export declare function packRoot(dataDir: string): string;
/** `<dataDir>/.dispatch/` —— 派生根，**启动时不创建**，编译时才建。 */
export declare function dispatchRoot(dataDir: string): string;
/** `<dataDir>/.dispatch/<图名>`。 */
export declare function dispatchDir(dataDir: string, workflow: string): string;
/** `<dataDir>/.dispatch/<图名>/<planId>`。 */
export declare function payloadDir(dataDir: string, workflow: string, planId: PlanId): string;
/** `<dataDir>/.dispatch/<图名>/<planId>/<节点 id>.md`。 */
export declare function payloadFile(dataDir: string, workflow: string, planId: PlanId, nodeId: string): string;
/** 首次启动按需创建的那两个目录（**不含** `.dispatch/`）。 */
export declare function layoutDirs(dataDir: string): string[];
/**
 * 同目录临时文件名：`.tmp-<随机>`。
 * 以 `.` 开头 ⇒ 一切扫描天然忽略；与目标同目录 ⇒ `rename` 同卷、原子。
 */
export declare function tempName(target: string): string;
export interface DirScan {
    /** 可用的条目名（**已去掉 `.json` 后缀**，保持磁盘上的原样大小写）。 */
    names: string[];
    /** 被忽略的条目名：非 `.json`、隐藏、`.tmp-*`、符号链接…… */
    ignored: string[];
    /** 被忽略的子目录名（图目录 = 旧结构信号，见 {@link legacyStructureDetected}）。 */
    directories: string[];
}
/**
 * 扫一个「一文件一 JSON」的目录。**目录不存在 = 空**（首次启动的常态），不抛错。
 * 判据：普通文件 · 非隐藏（文件名以 `.` 开头即视为隐藏）· 以 `.json` 结尾（不区分大小写）。
 */
export declare function scanJsonDir(dir: string): Promise<DirScan>;
/** `workflows/` 下的图名（只认图文件；其余条目进 `ignored` / `directories`）。 */
export declare function scanWorkflowDir(dataDir: string): Promise<DirScan>;
/** `workflows/` 下的图名——`list` / `read` 的入口。 */
export declare function workflowNamesOnDisk(dataDir: string): Promise<string[]>;
/** `templates/nodes/` 下的节点模板名。 */
export declare function scanTemplateDir(dataDir: string): Promise<DirScan>;
/** 一个路径是文件、目录，还是不存在。 */
export declare function pathKind(target: string): Promise<PathKind>;
/** 一个图名在 `workflows/` 下的占位情况——**同名目录也算被占用**。 */
export declare function workflowOccupant(dataDir: string, name: string): Promise<NameOccupant>;
/** 一个节点模板名在 `templates/nodes/` 下的占位情况——同样把同名目录算进来。 */
export declare function templateOccupant(dataDir: string, name: string): Promise<NameOccupant>;
/**
 * 旧结构（md 版）是否在场：`workflows/` 下有**目录**，或 `dataDir` 顶层有 `nodes/`。
 * 只在启动 / `list` 呈现，报一条专用提示，**不进图列表**。
 */
export declare function legacyStructureDetected(dataDir: string): Promise<boolean>;
/** 占位者的人话描述，用于警告文案。 */
export declare function describeOccupant(occupant: NameOccupant): string;
