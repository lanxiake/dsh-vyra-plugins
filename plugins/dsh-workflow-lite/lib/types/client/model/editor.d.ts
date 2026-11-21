/**
 * dsh-workflow-lite — 编辑器状态机（**纯逻辑**，组件只管接线）。
 *
 * 事实源是磁盘上的那份 JSON。三个计数讲清"有没有没落盘的改动"：
 * - `rev`       每次改文档 +1（撤销/重做也算——它们同样需要落盘）；
 * - `savedRev`  磁盘上已知持有的那一版；
 * - `savingRev` 在途那笔保存对应的版本。
 * `rev !== savedRev` 即为脏。保存期间又来的改动不会被误判成已落盘，因为保存成功只把
 * `savedRev` 推到 `savingRev`，而不是推到最新。
 *
 * 节点身份一律按 `idKey`（大小写不敏感）比较；`label` 只用于显示。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/editor
 */
import { type MemoryRef } from '../../shared/presets.ts';
import { type Handoff, type InputData, type NodeData, type Point, type ResourceData, type ResourcePresetKind, type ValidationProblem, type WorkflowDocument, type WorkflowEdge, type WorkflowNode, type WorkflowSettings } from '../../shared/types.ts';
/** 选中态：步骤、连线，或什么都不选。用一个联合表达，互斥是结构上保证的。 */
export type Selection = {
    kind: 'node';
    id: string;
} | {
    kind: 'edge';
    id: string;
} | null;
/** 悬停到一个文件卡（`null` = 离开）：视图据此在画布上高亮用到它的步骤。 */
export type FocusFile = (fileId: string | null) => void;
/** `idle` 没打开任何工作流；`broken` 文件读不了（只读，绝不写盘）。 */
export type Phase = 'idle' | 'loading' | 'ready' | 'broken';
export interface EditorState {
    phase: Phase;
    name: string | null;
    doc: WorkflowDocument | null;
    /** 本地文档所基于的磁盘内容哈希（保存时提交它做写前比对）。 */
    baseHash: string | null;
    /** host 给的全部校验问题（四级）。 */
    problems: ValidationProblem[];
    /** `broken` 态的说明与原文。 */
    broken: {
        message: string;
        raw: string | null;
    } | null;
    selection: Selection;
    rev: number;
    savedRev: number;
    saving: boolean;
    savingRev: number;
    saveError: string | null;
    /** 撤销栈：每个元素是"那次改动之前"的文档。 */
    past: WorkflowDocument[];
    future: WorkflowDocument[];
    /** 当前历史条目的合并键；相同键的连续改动并成一条撤销步。 */
    mergeKey: string | null;
    /**
     * 每压一条新的撤销步 +1（撤销、重做、合并进上一步都不算），换基线也不归零。
     * 撤销栈到了上限时长度不再变，靠它才看得出"又多了一步"（实例视图把图和状态的撤销排成一条时用）。
     */
    historySeq: number;
    /** 每载入一份新基线 +1：画布据此重新定视口（保存不算，免得每存一次都跳一下）。 */
    loadSeq: number;
}
/** 撤销栈上限。 */
export declare const HISTORY_LIMIT = 60;
export declare const initialState: EditorState;
/** 会改文档的动作。 */
export type Edit = {
    type: 'addNode';
    id: string;
    /** 步骤的 `data`；带着 `output`（来自模板）时展开成挂在它右下方的资源节点。 */
    data: NodeData;
    position: Point;
    /** 顺手从这个节点连一条线过来（「添加下一步」；从资源拖出来 = 新步骤读这个资源）。 */
    from?: string;
}
/**
 * 加一个资源节点。给了 `writer` 就连「步骤 → 资源」（写），给了 `reader` 就连「资源 → 步骤」（读）。
 * 没给坐标时挂在写它（读它）的步骤右下方。`select` = 加完选中它（缺省不动选中）。
 */
 | {
    type: 'addResource';
    data: ResourceData;
    position?: Point;
    writer?: string;
    reader?: string;
    select?: boolean;
}
/**
 * 加一个输入节点。给了 `reader` 就连「输入 → 步骤」（把回答交给它）；没给坐标时放在它左边。
 * 加完选中它（好接着写问题）。
 */
 | {
    type: 'addInput';
    id: string;
    data: InputData;
    position?: Point;
    reader?: string;
}
/**
 * 开、关一个步骤的记忆（见 `shared/presets.ts`）。开：引用记忆库里的 `memory`（选好的或刚建的），卡挂在步骤下方，
 * 连一条「更新」线；关：去掉写记忆的线，不剩线的记忆卡一并删掉（库里那条不动）。
 */
 | {
    type: 'setStepMemory';
    step: string;
    on: true;
    memory: MemoryRef;
} | {
    type: 'setStepMemory';
    step: string;
    on: false;
}
/** 加一张引用 `memory` 的工作流记忆卡（不连线）；没给坐标就由布局补位。加完选中它。 */
 | {
    type: 'addGlobalMemory';
    memory: MemoryRef;
    position?: Point;
}
/**
 * 换资源卡的类型标记（`null` = 普通资源）；打成记忆要给引用的那条。打不上就不动（界面先用 `presetRefusal` 拦）。
 */
 | {
    type: 'setPreset';
    id: string;
    preset: ResourcePresetKind | null;
    memory?: MemoryRef;
}
/** 改输入节点（值为 `undefined` 的键 = 清掉这一项）。`merge` 同 `patchNode`。 */
 | {
    type: 'patchInput';
    id: string;
    patch: Partial<InputData>;
    merge?: string;
}
/** 一次加进一小片图（示例流程）：算一条撤销步。`settings` 并进工作流设置（同一步）。 */
 | {
    type: 'addGraph';
    settings?: WorkflowSettings;
    nodes: WorkflowNode[];
    edges: {
        source: string;
        target: string;
        when?: string;
        handoff?: Handoff | false;
        update?: boolean;
    }[];
} | {
    type: 'removeNode';
    id: string;
}
/**
 * 改坐标。`silent` = 程序自动补位：照样落盘，但不进撤销栈
 * （`Ctrl+Z` 撤出一个"节点全叠在原点"的版本不是任何人想要的）。
 */
 | {
    type: 'moveNodes';
    positions: Record<string, Point>;
    silent?: boolean;
}
/**
 * 改步骤的 `data`。值为 `undefined` 的键表示**清掉这一项**。
 * `merge` 相同的连续改动并成一条撤销步（连续打字）。
 */
 | {
    type: 'patchNode';
    id: string;
    patch: Partial<NodeData>;
    merge?: string;
}
/** 改资源节点：名字 / 描述 / 内容（值为 `undefined` 的键 = 清掉；`items` 整份替换）。 */
 | {
    type: 'patchResource';
    id: string;
    patch: Partial<ResourceData>;
    merge?: string;
} | {
    type: 'connect';
    source: string;
    target: string;
    when?: string;
} | {
    type: 'removeEdge';
    id: string;
}
/** 改条件。`merge` 相同的连续改动并成一条撤销步（在自定义条件里连续打字）。 */
 | {
    type: 'setWhen';
    id: string;
    when: string | undefined;
    merge?: string;
}
/**
 * 改交接（步骤 → 步骤）。`undefined` = 交执行结果，`false` = 只管先后，对象 = 交执行结果并附说明。
 * `merge` 相同的连续改动并成一条撤销步（在交接说明里连续打字）。
 */
 | {
    type: 'setHandoff';
    id: string;
    handoff: Handoff | false | undefined;
    merge?: string;
}
/** 改写入方式（步骤 → 资源）：整份写出 / 在原文件上更新。 */
 | {
    type: 'setUpdate';
    id: string;
    update: boolean;
}
/** 视口是视图状态：照样落盘，但不进撤销栈。 */
/** 换掉整份工作流设置（设置对话框「完成」时一次交出来 = 一条撤销步）。 */
 | {
    type: 'setSettings';
    settings: WorkflowSettings | undefined;
}
/** 整张换掉（实例视图撤回某一处改动时用）；选中的东西不在了就放掉。 */
 | {
    type: 'replaceDoc';
    doc: WorkflowDocument;
};
export type Action = Edit | {
    type: 'loading';
    name: string;
} | {
    type: 'loaded';
    name: string;
    doc: WorkflowDocument;
    baseHash: string;
    problems: ValidationProblem[];
} | {
    type: 'broken';
    name: string;
    message: string;
    raw: string | null;
    problems: ValidationProblem[];
} | {
    type: 'closed';
} | {
    type: 'renamed';
    name: string;
} | {
    type: 'select';
    selection: Selection;
} | {
    type: 'undo';
} | {
    type: 'redo';
}
/** 丢掉重做栈（实例视图里别处有了新的一步：撤销排成一条，新的一步之后都不能重做）。 */
 | {
    type: 'dropFuture';
}
/** 一次交互结束（输入失焦）：断开历史合并。 */
 | {
    type: 'seal';
} | {
    type: 'saveStarted';
    rev: number;
} | {
    type: 'saveDone';
    baseHash: string;
} | {
    type: 'saveFailed';
    message: string;
}
/**
 * 回读磁盘后的刷新。带 `doc` = 本地没有在途改动，整份换成磁盘上（合并后）的版本；
 * `external` = 这份来自外部改动而不是自己的保存，旧历史作废。
 */
 | {
    type: 'refreshed';
    problems: ValidationProblem[];
    doc?: WorkflowDocument;
    baseHash?: string;
    external?: boolean;
};
export declare function isDirty(state: EditorState): boolean;
export declare function findNode(doc: WorkflowDocument, id: string): WorkflowNode | undefined;
export declare function findEdge(doc: WorkflowDocument, id: string): WorkflowEdge | undefined;
/** 新步骤的 id：撞名就加 `-2`、`-3`…（**绝不静默覆盖**）。 */
export declare function uniqueNodeId(doc: WorkflowDocument, base: string): string;
/** 这个资源已经有步骤在写（`except` 除外）——再接上来的写入默认是"在原文件上更新"。 */
export declare function alreadyWritten(doc: WorkflowDocument, resourceId: string, except?: string): boolean;
/** 图里资源已经用掉的文件路径（规范化、小写后）。 */
export declare function takenPaths(doc: WorkflowDocument): string[];
/** 图里没被资源占用的文件路径：`x.md` 被占了就 `x-2.md`、`x-3.md`… */
export declare function freeFilePath(doc: WorkflowDocument, want: string): string;
export declare function reduce(state: EditorState, action: Action): EditorState;
