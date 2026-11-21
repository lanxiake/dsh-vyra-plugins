/**
 * dsh-workflow-lite — 资源预设：资源卡上的一个类型标记，带一套内置写法和快捷配置。现在只有「记忆」。
 *
 * 预设不是新的节点类型：它还是资源节点（`wfResource`），只在 `data.preset` 上打个标记，
 * 编译器按标记换一套写法，画布与面板按标记给快捷入口和配置。所以文件查看、实例面板、导入导出都照资源走。
 * 任何一张资源卡都能在面板里换标记（{@link setPreset}）：每种预设在 {@link PRESET_SPECS} 里写明
 * 打上时怎么补内容、改连线，内容不合时拒绝，摘掉时怎么还原。以后的预设加在那张表里。
 *
 * 记忆（照 Hermes 的「skill 是流程性记忆」）：
 * - 记忆住在插件的记忆库里（`<dataDir>/memories/<id>/`，宿主 `host/store/memories.ts` 管），一条就是一份 skill：
 *   `SKILL.md` 写这一步（或整个工作流）怎么做得又快又对，`scripts/`、`templates/`、`references/` 放配套的东西；
 * - 记忆卡只存引用（{@link MemoryPreset}）和这一处的说明，那一项固定是 `{memory}/<id>`；
 *   名称、描述在库里，几个工作流、几个步骤可以引用同一条；
 * - 类型（工作流记忆 / 步骤记忆）建好就定，决定默认说明；步骤记忆连在步骤上（步骤 → 记忆），
 *   工作流记忆一条线都不连（每一步都读，主 agent 收尾时统一整理）。
 *
 * 纯函数，不碰磁盘、不 import DSH 包。
 * @module @xiaoso/dsh-workflow-lite/shared/presets
 */
import type { MemoryPreset, MemoryType, Point, ResourceData, ResourceNode, ResourcePresetKind, WorkflowDocument, WorkflowEdge, WorkflowNode } from './types.ts';
/** 全局记忆的节点 id（撞名时加序号）。 */
export declare const GLOBAL_MEMORY_ID = "mem-global";
/** 这份资源是不是记忆。 */
export declare function memoryOf(data: ResourceData): MemoryPreset | undefined;
export declare function isMemory(node: WorkflowNode): node is ResourceNode;
/** 一个步骤的记忆节点 id：`mem-<步骤 id>`（撞名时加序号）。 */
export declare function memoryIdFor(step: string): string;
/** 记忆卡引用库里的哪一条。 */
export interface MemoryRef {
    memory: string;
    type: MemoryType;
}
/** 新建记忆时建议的 id：工作流记忆用工作流名，步骤记忆用 `<工作流名>-<步骤 id>`（撞了由宿主加序号）。 */
export declare function suggestMemoryId(type: MemoryType, workflow: string, step?: string): string;
/** 记忆的内容合不合规矩：引用的 id 是个合法名字，内容恰好一项、就是那条记忆的文件夹。 */
export declare function memoryItemsOk(data: ResourceData): boolean;
export declare const STEP_MEMORY_PROMPT: string;
export declare const GLOBAL_MEMORY_PROMPT: string;
/** 记忆的默认说明：工作流记忆一份，步骤记忆一份。 */
export declare function defaultMemoryPrompt(type: MemoryType): string;
/** 记忆实际用的说明：写了就是它，空着就按类型用默认的。 */
export declare function memoryPrompt(data: ResourceData): string;
/**
 * 引用 `ref` 的记忆卡 `data`：一项，库里那条记忆的文件夹；不起名字（卡片上显示库里的名称）。
 * `note` 是这一处的说明（缺省按类型用默认的）。
 */
export declare function memoryData(ref: MemoryRef, note?: string): ResourceData;
/** 换成引用另一条记忆：这一处的说明、名字、颜色留着。 */
export declare function rebindMemory(data: ResourceData, ref: MemoryRef): ResourceData;
/** 图里引用到的记忆 id（按出现顺序，大小写不同算同一条）。 */
export declare function memoryRefs(document: WorkflowDocument): string[];
/** 把引用的记忆 id 按 `renames`（旧 id 的 `idKey` → 新 id）改掉；没有要改的原样返回。 */
export declare function renameMemoryRefs(document: WorkflowDocument, renames: ReadonlyMap<string, string>): WorkflowDocument;
/**
 * 记忆的类型和挂的位置对不上：步骤记忆没有步骤写它，或工作流记忆连在步骤上。
 * 照样能用（默认说明按类型），只给提示。
 */
export declare function memoryMisplaced(document: WorkflowDocument, node: ResourceNode): boolean;
/** 一个步骤写的记忆（步骤 → 记忆的线），按连线顺序。 */
export declare function stepMemories(document: WorkflowDocument, step: string): ResourceNode[];
/** 一条线都没连的记忆：全局记忆。 */
export declare function globalMemories(document: WorkflowDocument): ResourceNode[];
/** 写这份资源的相对路径要不要拼产出根目录：被写的普通资源要，记忆不要（它跨执行留着）。 */
export declare function writesUnderRoot(data: ResourceData, written: boolean): boolean;
/**
 * 给步骤开记忆：新建一张引用 `ref` 的记忆卡（id `mem-<步骤>`），连一条「在原文件上更新」的线。
 * 已经有了、不是步骤就是 `null`。
 */
export declare function addStepMemory(document: WorkflowDocument, step: string, ref: MemoryRef, position: Point): {
    document: WorkflowDocument;
    id: string;
} | null;
/** 加一张引用 `ref` 的工作流记忆卡（不连线）。 */
export declare function addGlobalMemory(document: WorkflowDocument, ref: MemoryRef, position: Point): {
    document: WorkflowDocument;
    id: string;
};
/**
 * 关掉一个步骤的记忆：去掉它写记忆的线；去掉之后一条线都不剩的记忆卡一并删掉
 * （不删就成了全局记忆）。记忆目录本身不动。没有可关的就是 `null`。
 */
export declare function removeStepMemory(document: WorkflowDocument, step: string): WorkflowDocument | null;
/**
 * 改动之前连着线、改动之后一条线都不剩的记忆卡删掉：删步骤、关记忆时用，免得它悄悄变成全局记忆。
 * 本来就没连线的（全局记忆）不动。
 */
export declare function dropOrphanMemories(before: WorkflowDocument, after: WorkflowDocument): WorkflowDocument;
/** 打不上标记的原因（界面按它给提示）：`memory_items` 卡上已经有内容了，`memory_ref` 没给要引用哪条记忆。 */
export type PresetRefusal = 'memory_items' | 'memory_ref';
/** 打标记时知道的事：卡片 id；打成记忆时引用库里的哪一条。 */
export interface PresetContext {
    id: string;
    memory?: MemoryRef;
}
/** 一种预设：打上、摘掉时怎么改这张卡和写它的线。 */
export interface PresetSpec {
    /** 打上：补默认内容、带上默认配置；现有内容不合这种预设就拒绝（内容不动）。 */
    attach(data: ResourceData, ctx: PresetContext): ResourceData | {
        refused: PresetRefusal;
    };
    /** 打上之后，写这张卡的线改成什么样（缺省不动）。 */
    writeEdge?(edge: WorkflowEdge): WorkflowEdge;
    /** 摘掉：去掉标记；内容、说明、连线都留着，换回普通资源照样能用。 */
    detach(data: ResourceData): ResourceData;
}
/**
 * 各预设的规矩。加新预设：在 `RESOURCE_PRESETS` 加种类、在这里写一套，
 * 界面（名字、图标、快捷配置）在 `client/ui/resources/ResourcePresets.tsx` 配。
 */
export declare const PRESET_SPECS: Record<ResourcePresetKind, PresetSpec>;
/**
 * 这张卡能不能打上这种预设：能就是 `null`，不能就是原因。只看卡上的内容——还没选引用哪条记忆不算
 * （界面上选了类型再去挑一条）。
 */
export declare function presetRefusal(data: ResourceData, kind: ResourcePresetKind, ctx: PresetContext): PresetRefusal | null;
/**
 * 换一张资源卡的标记：`null` 是换回普通资源。先摘掉旧的再打新的；写它的线按新预设改。
 * 打不上返回拒绝原因（图不动）；没变化、不是资源卡返回 `null`。
 */
export declare function setPreset(document: WorkflowDocument, id: string, kind: ResourcePresetKind | null, memory?: MemoryRef): WorkflowDocument | {
    refused: PresetRefusal;
} | null;
