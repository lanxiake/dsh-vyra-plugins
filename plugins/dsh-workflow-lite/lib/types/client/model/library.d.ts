/**
 * dsh-workflow-lite — 步骤库的内容，与「库 → 画布」的拖放载荷。
 *
 * 内置步骤是**起点不是规范**：开箱即用的提示词骨架，插进图里之后随便改。没有它们，
 * 一张新图只能从空白提示词写起。文案全部走 locale 词典（键名在这里，正文在 `i18n/library.ts`）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/library
 */
import type { Handoff, InputData, InputKind, NodeData, WorkflowNode, WorkflowSettings } from '../../shared/types.ts';
import type { LocaleKey, T } from '../i18n.ts';
export interface StepPreset {
    /** 建议的节点 id（撞名由 `uniqueNodeId` 加序号）。 */
    id: string;
    labelKey: LocaleKey;
    descKey: LocaleKey;
    promptKey: LocaleKey;
    /** 产出契约；`false` = 显式声明不产出文件。 */
    output?: string | false;
    /** 产出文件的生成规则（进计划的「产出要求」）。 */
    ruleKey?: LocaleKey;
}
/** 呈现顺序 = 一条常见主线的顺序。 */
export declare const PRESETS: readonly StepPreset[];
/**
 * 右侧面板正在看步骤库里的哪一项（与画布上的选中互斥）。
 * `new` = 正在新建一个「我的步骤」，`seed` 是预填的内容（复制内置步骤时带过来）。
 */
export type LibraryFocus = {
    kind: 'preset';
    id: string;
} | {
    kind: 'template';
    name: string;
} | {
    kind: 'new';
    seed: NodeData;
    name: string;
};
/** 空白步骤的建议 id。 */
export declare const BLANK_ID = "step";
/** 输入节点的建议 id。 */
export declare const INPUT_ID = "ask";
/**
 * 输入的四种交互（呈现顺序）与文案。步骤库里只有一个「用户输入」，拖到画布上默认是一句话，
 * 在属性面板里切换交互方式。
 */
export declare const INPUT_KIND_OPTIONS: readonly {
    kind: InputKind;
    labelKey: LocaleKey;
}[];
/** 交互方式的显示名。 */
export declare function inputKindLabel(kind: InputKind): LocaleKey;
/** 新输入节点的 `data`：一句话，带一个起手的问题（空问题挡编译）。 */
export declare function inputData(t: T): InputData;
/** 内置步骤实例化成节点的 `data`。 */
export declare function presetData(preset: StepPreset, t: T): NodeData;
/**
 * 示例流程：侦察 → 实现 → 审查，通过去汇总，未通过去修复再回到审查。
 * 一次把能用的东西都摆出来，比任何说明文字都快：
 * - 顺序、条件分支（通过 / 未通过）、循环（修完回到审查），线上附交接说明；
 * - 用户输入：执行前问「这次要做什么」（多行文字、必填，交给侦察与实现）和「审查要多严格」（单选，交给审查）；
 * - 资源：每一步的产出挂在它右下方；审查报告由修复在原文件上打钩、汇总读它的最终版；
 *   「项目资料」一张卡放文件夹、文件、网址三项，侦察和实现都读它；
 *   「团队约定」是一段自定义提示词，一条线都不连 = 交给每一步；
 * - 设置：打开「记录运行状态」，执行后能在实例里看进度。
 */
export declare function starterGraph(t: T): {
    settings: WorkflowSettings;
    nodes: WorkflowNode[];
    edges: {
        source: string;
        target: string;
        when?: string;
        handoff?: Handoff | false;
        update?: boolean;
    }[];
};
/** 自定义 MIME，免得跟别处的拖放撞车。 */
export declare const DND_MIME = "application/x-workflow-lite-step";
/** 从库里拿出来的东西：空白步骤、内置步骤，或磁盘上的节点模板。 */
export type StepSource = {
    kind: 'blank';
}
/**
 * 一张资源卡（不是步骤，但同样从库里拖、从菜单里加）。从步骤的写点 / 「＋」加的是这一步的产出文件；
 * 别处加的是一张空的资源卡。
 */
 | {
    kind: 'resource';
}
/** 一个输入节点（执行前问用户的问题）。 */
 | {
    kind: 'input';
}
/** 记忆：从步骤的「＋」加是这一步的记忆，别处加是全局记忆（见 `shared/presets.ts`）。 */
 | {
    kind: 'memory';
} | {
    kind: 'preset';
    id: string;
} | {
    kind: 'template';
    name: string;
};
export declare function encodeStepSource(source: StepSource): string;
/**
 * 解码。`dataTransfer` 里可能是别的应用拖进来的任意内容，那不是错误而是"不归我们管"：
 * 任何不认识的输入一律返回 `null`，**永不抛异常**。
 *
 * 用 `Map` 查键而不是直接读属性：`JSON.parse('{"__proto__":{"kind":"blank"}}')` 得到的对象
 * 会顺着原型链读出一个它自己并没有的 `kind`；`Map.get` 只认自有键。
 */
export declare function decodeStepSource(raw: string | null | undefined): StepSource | null;
