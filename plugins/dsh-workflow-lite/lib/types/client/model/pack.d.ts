/**
 * dsh-workflow-lite — 导入导出页面上的算账：默认选哪些版本、清单怎么分组、勾了之后多大、
 * 导入时每个 skill 默认怎么办、确认卡上的汇总。纯函数，不碰 RPC。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/pack
 */
import type { PackApplyRequest, PackImportPreview, PackMemoryAction, PackMemoryPreview, PackScanItem, PackScanResponse, PackSkillAction, PackSkillPreview } from '../../shared/pack.ts';
import type { SkillExisting, SkillPreviewResponse } from '../../shared/skillPack.ts';
import type { ResourceKind, VersionEntry } from '../../shared/types.ts';
import type { T } from '../i18n.ts';
/** 导出默认带哪些版本：和现在一样的那版；没有就最新的那版。 */
export declare function defaultVersions(list: readonly VersionEntry[]): number[];
/** 清单分组（呈现顺序）。 */
export interface ExportGroups {
    /** 能打包的：可以勾。 */
    packable: PackScanItem[];
    /** 本来想打、打不了的：找不到、太大。 */
    blocked: PackScanItem[];
    /** 原样引用：内置 skill、相对路径。 */
    kept: PackScanItem[];
    /** 已经在资料目录里的。 */
    assets: PackScanItem[];
    /** 产出（不用处理）。 */
    outputs: PackScanItem[];
}
export declare function exportGroups(scan: PackScanResponse): ExportGroups;
/** 导出清单的分类：资源种类，外加记忆（记忆是文件夹，但单独一类）。 */
export type PackCategory = ResourceKind | 'memory';
/** 导出清单按这几类分类展示（呈现顺序）。 */
export declare const PACK_CATEGORIES: readonly PackCategory[];
/** 能打包的几类，每类一个总开关：关着的那类整个不打包。 */
export type PackSwitch = 'skill' | 'file' | 'folder' | 'memory';
export type PackSwitches = Readonly<Record<PackSwitch, boolean>>;
export declare function isSwitchable(kind: PackCategory): kind is PackSwitch;
/** 一项归哪一类：引用记忆库的是记忆，其余按资源种类。 */
export declare function categoryOf(item: PackScanItem): PackCategory;
/** 能勾的一项：外部资源（`pack`）或记忆（`memory`）。 */
export declare function isPackable(item: PackScanItem): boolean;
/** 扫完之后缺省勾上的：能勾的全勾。 */
export declare function defaultPacked(scan: PackScanResponse): Set<string>;
/** 一类里的项：能勾的、其余的（只说明原因）。产出、资料目录里的不算外部资源，不列。 */
export declare function categoryItems(scan: PackScanResponse, kind: PackCategory): {
    packable: PackScanItem[];
    others: PackScanItem[];
};
/** 真正要打包的：逐项勾上的，再去掉总开关关着的那几类（逐项的勾选留着，开关打开就回来）。 */
export declare function effectivePack(scan: PackScanResponse, picked: ReadonlySet<string>, switches: PackSwitches): Set<string>;
/** 勾了这些之后包里一共多少字节（资料目录总是算进去）。 */
export declare function packedBytes(scan: PackScanResponse, picked: ReadonlySet<string>): number;
/** 没打包、留在图里的绝对路径（会带出本机的目录名）。 */
export declare function leftAbsolute(scan: PackScanResponse, picked: ReadonlySet<string>): number;
/** 一个 skill 默认怎么办：新的装，其余保留本机的。 */
export declare function defaultSkillAction(skill: PackSkillPreview): PackSkillAction;
/** 这个 skill 能选哪些处理方式（按呈现顺序）。 */
export declare function skillChoices(skill: PackSkillPreview): PackSkillAction[];
/** 装到哪（不装就是 `null`）。 */
export declare function skillDestination(preview: Pick<PackImportPreview, 'skillsRoot'>, skill: PackSkillPreview, action: PackSkillAction): string | null;
/** 导入的落脚点：用户选的方式和名字。 */
export interface ImportChoice {
    mode: 'new' | 'merge';
    name: string;
    assets: 'package' | 'local';
    skills: Record<string, PackSkillAction>;
    /** 本机已有同 id 的记忆：用本机的，还是另存一份。 */
    memories: Record<string, PackMemoryAction>;
}
export declare function defaultImportChoice(preview: PackImportPreview): ImportChoice;
/** 一条记忆怎么办：本机没有的就建；有的缺省用本机的。 */
export declare function memoryActionOf(choice: ImportChoice, memory: PackMemoryPreview): PackMemoryAction | 'create';
export declare function actionOf(choice: ImportChoice, skill: PackSkillPreview): PackSkillAction;
/** 确认卡上的汇总。 */
export interface ImportSummary {
    versions: number;
    assets: number;
    /** 写进 ~/.agents/skills 的。 */
    skills: number;
    /** 其中覆盖掉本机已有的。 */
    overwrite: number;
}
export declare function importSummary(preview: PackImportPreview, choice: ImportChoice): ImportSummary;
/** 发给主机的请求。 */
export declare function applyRequest(preview: PackImportPreview, choice: ImportChoice, scope: {
    cwd?: string;
    session?: string;
}): PackApplyRequest;
/** 字节 → base64（大数组分段转，免得 `String.fromCharCode(...)` 爆栈）。 */
export declare function toBase64(bytes: Uint8Array): string;
export declare function fromBase64(data: string): Uint8Array;
/** 导出成 skill 时预填的描述：工作流名 + 步骤（按执行批次），步骤太多就只列前几个。 */
export declare function descriptionDraft(t: T, workflow: string, steps: readonly string[]): string;
/** 本机已有的同名 skill（没有就是 `undefined`）。 */
export declare function existingSkill(preview: Pick<SkillPreviewResponse, 'existing'>, name: string): SkillExisting | undefined;
