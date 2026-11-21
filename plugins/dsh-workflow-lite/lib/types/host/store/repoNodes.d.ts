/**
 * dsh-workflow-lite — 仓储的节点与边部分：写节点（步骤 / 输入 / 资源 / 记忆卡）、改显示名与设置、删节点、连线与断线。
 *
 * 每一个动作都只交给核心的 `mutate` 一段「拿到文档、改文档、回变更摘要」的函数；
 * 锁、预检、哈希比对、合并与落盘都在 `repoCore`。
 * @module @xiaoso/dsh-workflow-lite/host/store/repoNodes
 */
import { type DisplaySpec } from '../../shared/display.ts';
import { type MemoryRef } from '../../shared/presets.ts';
import { type ExecutionMode, type Handoff, type InputData, type OutputSpec, type Point, type ResourceItem, type ReusePolicy, type WriteResult } from '../../shared/types.ts';
import type { RepoCore } from './repoCore.ts';
import { type Outcome } from './repoResult.ts';
import type { TemplateStore } from './repoTemplates.ts';
/** `write_node` 的语义入参——`undefined` 一律表示"不改这一项"。 */
export interface NodeUpsert {
    /** 节点 id（图内大小写不敏感唯一）；不存在即新建。 */
    id: string;
    /** `data.prompt`；允许空串（空 `prompt` 是编译级，不拦落盘）。 */
    content?: string;
    /** 显示名；空串 = 清除（回落渲染 `id`）。 */
    label?: string;
    /**
     * 它写的文件（一个路径）；`false` / `null` = 不写任何文件。产出放在资源节点里：
     * 路径已有资源就连上，没有就新建（见 `shared/resources.ts` 的 `setStepOutputs`）。
     */
    output?: string | false | null;
    /** 一个或多个写入的文件（可带生成规则）；给了它就整份替换（`noOutput` 仍然优先）。 */
    outputs?: OutputSpec[];
    /** 给其中几个产出所在的资源设画布展示（`write_node` 的 `outputs[].display`）。 */
    displays?: {
        path: string;
        display: DisplaySpec;
    }[];
    /** 一句话描述；空串 = 清除。 */
    description?: string;
    /** `true` ⇒ 不写任何文件（与 `output` 同时给出时以本字段为准）。 */
    noOutput?: boolean;
    /** 从 `templates/nodes/<from>.json` 取 `data` 本体（**不复制模板的 `id` 与 `position`**）。 */
    fromTemplate?: string;
    /** 显式坐标；缺省时新建节点留 `{0,0}` 并报 `position_filled` 提示（布局由上层跑）。 */
    position?: Point;
}
/**
 * `write_node` 带 `input`：新建或改一个输入节点。给了的字段才改（`kind` 换了会按新题型重新规范化选项与默认值）；
 * 文字字段空串 = 清除。
 */
export interface InputUpsert {
    id: string;
    question?: string;
    kind?: InputData['kind'] | 'text';
    options?: string[];
    default?: string | string[];
    placeholder?: string;
    hint?: string;
    required?: boolean;
    other?: boolean;
    position?: Point;
}
/** `write_resource`：新建或修改一个资源节点。给了的字段才改；`items` 给了就整份替换。 */
export interface ResourceUpsert {
    /** 资源节点 id；缺省 = 新建，按名字或第一项起一个。 */
    id?: string;
    /** 名字；空串 = 清除。 */
    label?: string;
    /** 描述；空串 = 清除。 */
    description?: string;
    items?: ResourceItem[];
    /** 画布展示：给了的字段才改，`show: false` = 关掉（见 `shared/display.ts` 的 `applyDisplay`）。 */
    display?: DisplaySpec;
    position?: Point;
}
/** 加一张记忆卡：引用库里的哪一条；给了 `step` 就是那一步的记忆（连一条写它的线），不给就是工作流记忆。 */
export interface MemoryCardRequest {
    ref: MemoryRef;
    step?: string;
    position?: Point;
}
/** 改工作流设置时给的字段（没给的不动）。 */
export interface SettingsPatch {
    outputRoot?: string;
    mode?: ExecutionMode;
    reuse?: ReusePolicy;
    setGoal?: boolean;
    runState?: boolean;
}
/** 节点与边部分用到的核心能力：只有 `mutate`。 */
type NodesCore = Pick<RepoCore, 'mutate'>;
/** 节点与边部分用到的模板能力：`write_node` 带 `fromTemplate` 时取模板的 `data`。 */
type NodesTemplates = Pick<TemplateStore, 'readNodeTemplate'>;
export declare class NodeWriter {
    private readonly core;
    private readonly templates;
    constructor(core: NodesCore, templates: NodesTemplates);
    writeNode(workflow: string, upsert: NodeUpsert): Promise<Outcome<WriteResult>>;
    writeInput(workflow: string, upsert: InputUpsert): Promise<Outcome<WriteResult>>;
    writeResource(workflow: string, upsert: ResourceUpsert): Promise<Outcome<WriteResult>>;
    addMemory(workflow: string, request: MemoryCardRequest): Promise<Outcome<WriteResult>>;
    setLabel(workflow: string, node: string, label: string): Promise<Outcome<WriteResult>>;
    /**
     * 改工作流设置。给了的字段才改：`outputRoot` 空串 = 清除（回到默认的
     * `.workflow-lite/runs/{instance}/out`）、`.` = 工作区根，`mode` / `reuse` 给 `'auto'` = 清除。
     */
    configure(workflow: string, patch: SettingsPatch): Promise<Outcome<WriteResult>>;
    deleteNode(workflow: string, node: string): Promise<Outcome<WriteResult>>;
    /**
     * 连一条边。给了 `handoff` 就顺带设置它的交接（`null` = 回到自动，`false` = 只管先后）；
     * 边已存在时只改交接（没给 `handoff` 就是幂等的空操作）。
     */
    connect(workflow: string, source: string, target: string, when?: string, handoff?: Handoff | false | null, update?: boolean): Promise<Outcome<WriteResult>>;
    disconnect(workflow: string, source: string, target: string, when?: string): Promise<Outcome<WriteResult>>;
}
export {};
