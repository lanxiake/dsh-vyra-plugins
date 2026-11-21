/**
 * dsh-workflow-lite — 导出：盘点选中版本里的资源（{@link scanPack}），按用户勾的打成 zip（{@link exportPack}）。
 *
 * 只导出**存成了版本的**内容。资源分几种：
 * - 绝对路径的文件、文件夹（只被读的）：可以打包，打进 `assets/`，包里那几个版本的图改写成 `{workflow}/…`
 *   （本机的工作流不动）；重名的依次加 `-2`、`-3`；
 * - 有目录的 skill：可以打包，整个目录进 `skills/<名>/`；内置或插件注册的没有目录，只能原样引用；
 * - 工作流目录（`{workflow}/…`）：总是整个打进去；
 * - 记忆（`{memory}/<id>`）：元数据总是写进清单，内容（那份 skill 文件夹）勾了才打进 `memories/<id>/`，缺省勾上；
 * - 相对路径、产出、网址、自定义文本：原样留在图里。
 *
 * @module @xiaoso/dsh-workflow-lite/host/pack/exporter
 */
import type { MemoryMeta } from '../../shared/memoryLib.ts';
import { type PackExportRequest, type PackExportResponse, type PackScanRequest, type PackScanResponse } from '../../shared/pack.ts';
import { type VersionEntry, type WorkflowDocument } from '../../shared/types.ts';
import type { HostSkillEntry } from '../../shared/wire/host.ts';
import { type SkillViewer } from '../hostFs.ts';
import type { DocumentValidator } from '../store/repoCore.ts';
import { type Outcome } from '../store/repoResult.ts';
import type { Repository } from '../store/repository.ts';
import { type Tree } from './tree.ts';
export interface PackDeps {
    dataDir: string;
    repository: Repository;
    skills?: SkillViewer;
    /** skill 装到哪：`~/.agents/skills`。 */
    skillsRoot: string;
    /** 插件版本（写进清单）。 */
    plugin: string;
    /** 文档级校验（导出成 skill 时看有没有编译级问题）；没给就不查。 */
    validate?: DocumentValidator;
    now?: () => number;
}
/** 选中的一个版本。 */
interface PickedVersion {
    entry: VersionEntry;
    document: WorkflowDocument;
}
/** 盘点时顺手留下的东西（导出时直接用，不再看一遍磁盘）。 */
export interface ScanState {
    response: PackScanResponse;
    versions: PickedVersion[];
    trees: Map<string, Tree>;
    assetsTree: Tree | null;
    skills: Map<string, HostSkillEntry>;
    /** 记忆项（`PackScanItem.key`）→ 库里那条的元数据。 */
    memories: Map<string, MemoryMeta>;
}
export declare function isAbsolutePath(value: string): boolean;
export declare function scanState(deps: PackDeps, request: PackScanRequest): Promise<Outcome<ScanState>>;
/** 盘点选中版本里的资源。 */
export declare function scanPack(deps: PackDeps, request: PackScanRequest): Promise<Outcome<PackScanResponse>>;
/** 把包里那几个版本的图改写一下：打包的文件、文件夹换成 `{workflow}/…`。 */
export declare function rewriteForPack(document: WorkflowDocument, renames: ReadonlyMap<string, string>): WorkflowDocument;
/** 打包：按用户勾的项，写一个 zip 到暂存区，回暂存编号。 */
export declare function exportPack(deps: PackDeps, request: PackExportRequest): Promise<Outcome<PackExportResponse>>;
export {};
