/**
 * dsh-workflow-lite — 导入：解开上传的包、校验（{@link openPack}），给出预览（{@link inspectPack}），
 * 按用户的决定落盘（{@link applyPack}）。
 *
 * 解包这一步就挡掉坏包：条目路径不安全（zip-slip）、总大小 / 文件数超限、清单与文件对不上（哈希）、
 * 版本读不出来、包格式比本插件新。
 *
 * 落盘的顺序：检查都过了才动手 → 资料目录 → skill → 记忆 → 版本 → 工作流文件。工作流文件最后写，
 * 中途失败不会留下一张半成品工作流。**不自动存**本机现在的内容（并入时前端事先提醒过）。
 *
 * @module @xiaoso/dsh-workflow-lite/host/pack/importer
 */
import { type PackApplyRequest, type PackApplyResponse, type PackImportPreview, type PackManifest } from '../../shared/pack.ts';
import type { WorkflowDocument } from '../../shared/types.ts';
import { type Outcome } from '../store/repoResult.ts';
import type { ImportVersion } from '../store/repoVersions.ts';
import type { PackDeps } from './exporter.ts';
/** 解开、校验过的包。 */
export interface OpenedPack {
    manifest: PackManifest;
    /** 包里的版本（按编号从小到大），图已读好。 */
    versions: ImportVersion[];
    /** 相对顶层目录的路径 → 内容。 */
    entries: Map<string, Uint8Array>;
}
/**
 * 解开一个包。顶层可以是一层同名目录（导出的样子），也可以直接是清单（用户解开又重新压过）。
 */
export declare function openPack(zip: Uint8Array): Outcome<OpenedPack>;
/** 读上传的包，给出预览。 */
export declare function inspectPack(deps: PackDeps, request: {
    token: string;
    cwd?: string;
    session?: string;
}): Promise<Outcome<PackImportPreview>>;
/**
 * 换名安装时改 SKILL.md 头部的 `name:`。没有头部元数据就原样返回（DSH 按目录名认）。
 */
export declare function renameSkillDoc(text: string, name: string): string;
/** 包里那几个版本的图：换名安装的 skill 跟着改引用。 */
export declare function rewriteSkills(document: WorkflowDocument, renames: ReadonlyMap<string, string>): WorkflowDocument;
/** 一个 skill 落到 `target`：先写进旁边的临时目录，再换上去（覆盖时旧的先挪开、换好再删）。 */
export declare function installSkill(root: string, target: string, files: readonly {
    path: string;
    data: Uint8Array;
}[], replace: boolean): Promise<void>;
/** 按用户的决定导入。 */
export declare function applyPack(deps: PackDeps, request: PackApplyRequest): Promise<Outcome<PackApplyResponse>>;
