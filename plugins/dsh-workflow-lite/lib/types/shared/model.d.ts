/**
 * dsh-workflow-lite — 图 JSON 的读入规范化与 canonical 写出。
 *
 * 两条硬规则都在这里兑现：
 * 1. **白名单写出**：只写契约里的键，React Flow 的运行时字段（`measured` /
 *    `selected` / `dragging` / `width` / `height` / `computedPosition` …）与一切
 *    未知字段**一律丢弃**并报警告——它们每次渲染都在变，持久化就是永不停止的假 diff。
 * 2. **canonical writer**：2 空格缩进 / LF / 末尾恰好一个换行 / 固定键序 / 坐标归一化 /
 *    数组顺序永不重排。往返测试与"同图两次编译逐字节相同"的期望值都来自它。
 *
 * 纯函数，不碰磁盘、不 import DSH 包。
 * @module @xiaoso/dsh-workflow-lite/shared/model
 */
import { type EdgeData, type Handoff, type InputAnswer, type InputData, type InputNode, type LineFilter, type NodeData, type OutputSpec, type ResourceData, type ResourceItem, type ResourceNode, type ResourceView, type StepNode, type ValidationProblem, type WorkflowDocument, type WorkflowEdge, type WorkflowNode, type WorkflowSettings } from './types.ts';
/** 坐标归一化：`round(v * 100) / 100`（2 位小数）。 */
export declare function normalizeCoord(value: number): number;
/**
 * 大小写不敏感的 id 键——图内唯一性按它判定（`Scan` 与 `scan` 是同一个身份，
 * 因为它们会撞同一个载荷文件名）。
 */
export declare function idKey(id: string): string;
/** 边 id 的构造式：`<source>-><target>`，带 `when` 时追加 `#<when>`。构造上天然唯一。 */
export declare function makeEdgeId(source: string, target: string, when?: string): string;
/** 一个节点在计划里的规范标识：`label（id）`，`label` 缺省时只写 `id`。 */
export declare function displayName(id: string, label?: string): string;
export interface ParseOutcome {
    /** 结构可用时是规范化后的文档；保存级破损时是 `null`。 */
    document: WorkflowDocument | null;
    problems: ValidationProblem[];
}
/**
 * 从原始对象里挑出 `data` 的已知键（图里的节点与节点模板共用这一份）。
 * 产出数组里认不出的元素（不是对象、没有字符串 `path`）直接略过。
 */
export declare function readNodeData(raw: unknown): NodeData;
/**
 * 产出的规范写法：空数组 = 未声明；只有一个产出且没有规则 = 写成字符串（老写法，文件保持不变）；
 * 规则是空白的当没写。其余原样（数组顺序永不重排）。
 */
export declare function canonicalOutput(output: NodeData['output']): NodeData['output'];
/** 把任意写法的产出摊成一张清单（`false` 与未声明都是空清单）。 */
export declare function outputSpecs(output: NodeData['output']): OutputSpec[];
/** 两份 `data` 内容是否相同（产出按规范写法比，数组逐项比）。 */
export declare function sameNodeData(a: NodeData, b: NodeData): boolean;
/** 深拷一份输入节点的 `data`（选项与多选默认值不和原件共用）。 */
export declare function cloneInputData(data: InputData): InputData;
/** 深拷一份 `data`（产出数组不和原件共用）。 */
export declare function cloneNodeData(data: NodeData): NodeData;
/**
 * 从原始对象里挑出工作流设置的已知键。根目录存规范化后的写法；认不出的执行方式、复用方式当缺省（`auto`）。
 * 全是缺省值时返回 `undefined`（文件里不写这个键）。
 */
export declare function readSettings(raw: unknown): WorkflowSettings | undefined;
/** 冲突清单里代表「工作流设置」的那一项（设置没有 id，用这个固定键）。 */
export declare const SETTINGS_CONFLICT_ID = "settings";
/** 两份设置是否相同（缺省与缺省相等）。 */
export declare function sameSettings(a: WorkflowSettings | undefined, b: WorkflowSettings | undefined): boolean;
/** 交接：`false` 原样；对象只认字符串 `note`（空白说明 = 缺省）；其余值当没写（= 交执行结果）。 */
export declare function readHandoff(raw: unknown): Handoff | false | undefined;
/** 交接的规范写法：空白说明 = 缺省（交执行结果、不附说明）。 */
export declare function canonicalHandoff(handoff: Handoff | false | undefined): Handoff | false | undefined;
/** 两份交接是否相同（按规范写法比；缺省与缺省相等）。 */
export declare function sameHandoff(a: Handoff | false | undefined, b: Handoff | false | undefined): boolean;
/** 两条边的 `data` 内容是否相同（条件、标签、交接、写入方式）。 */
export declare function sameEdgeData(a: EdgeData | undefined, b: EdgeData | undefined): boolean;
/** 边的"内容"＝端点 + `data`（条件、标签、交接）；边没有独立的视图态。 */
export declare function sameEdgeContent(a: WorkflowEdge, b: WorkflowEdge): boolean;
export declare function isStep(node: WorkflowNode): node is StepNode;
export declare function isInput(node: WorkflowNode): node is InputNode;
export declare function isResource(node: WorkflowNode): node is ResourceNode;
/**
 * 资源节点 `data` 的已知键：名字与描述空白就当没写；内容里认不出的项（不是对象、种类不认识、
 * 没有字符串 `value`）直接略过；自定义不带 `note`。
 */
export declare function readResourceData(raw: unknown): ResourceData;
/**
 * 展示设置：宽高缺一个就当没开展示；越界的数夹回范围；`item` 只认非负整数（指向的项能不能展示由画布判断，
 * 认不出时回落到第一个能展示的）；`fit` 的缺省值 `contain` 不写盘。
 */
export declare function readView(raw: unknown): ResourceView | undefined;
/** 筛选词最长多少字（再长多半是贴错了）。 */
export declare const LINE_FILTER_MAX = 500;
/** 匹配的行前后最多各带几行。 */
export declare const LINE_CONTEXT_MAX = 10;
/** 只看匹配的行：没写字当没筛；上下文夹到 0–{@link LINE_CONTEXT_MAX}。键序固定（写盘、比较都用它）。 */
export declare function readLineFilter(raw: unknown): LineFilter | undefined;
/** 资源节点 `data` 的规范写法（读入的规范化 + 固定键序），写盘与比较都用它。 */
export declare function canonicalResource(data: ResourceData): ResourceData;
/** 深拷一份资源节点的 `data`（内容数组与每一项都不和原件共用）。 */
export declare function cloneResourceData(data: ResourceData): ResourceData;
/**
 * 输入节点 `data` 的已知键，顺手规范化：选项去空、去重；不认识的交互方式当单行文字；
 * 默认值按交互方式取形（文字题 / 单选是一段文字，多选是若干选项）。没有字符串 `question` 时给空串（编译级）。
 */
export declare function readInputData(raw: unknown): InputData;
/**
 * 一份回答按交互方式取形：文字题与单选是一段文字（空白 = 没回答），多选是去空、去重后的若干项
 * （一项都没有 = 没回答）。形状对不上（比如多选给了一段文字）时也尽量接住。
 */
export declare function readAnswer(kind: InputData['kind'] | 'text', raw: unknown): InputAnswer | undefined;
/** 输入节点 `data` 的规范写法（读入的规范化 + 固定键序），写盘与比较都用它。 */
export declare function canonicalInput(data: InputData): InputData;
/** 两个节点的内容是否相同（类型 + `data`；坐标不算）。 */
export declare function sameNodeContent(a: WorkflowNode, b: WorkflowNode): boolean;
/** 一项内容的简称：文件与文件夹取最后一段，网址取主机名，skill 取名字，自定义取 `custom`。 */
export declare function itemShortName(item: ResourceItem): string;
/**
 * 给资源起一个节点 id：按名字（没有就按第一项的简称，文件不带扩展名）换掉文件名里不许出现的字符，前面加 `res-`；
 * 撞名（大小写不敏感）就加 `-2`、`-3`…
 */
export declare function resourceIdFor(data: ResourceData, taken: (id: string) => boolean): string;
/**
 * 把 `JSON.parse` 的结果规范化成我们的文档形状。
 *
 * 保存级破损（顶层不是对象 / `nodes` 或 `edges` 不是数组 / 元素不是对象 /
 * 缺 `id` / 缺 `source` / `target` / 坐标非法）→ `document: null` + 保存级问题。
 * 其余问题（未知字段、未知 `type`、`position` 缺失、悬空 edge…）在**保留文档**的前提下
 * 逐条报出，交给上层按级别处置。
 */
export declare function normalizeDocument(input: unknown): ParseOutcome;
/** `JSON.parse` + {@link normalizeDocument}。解析失败就是保存级。 */
export declare function readDocument(text: string): ParseOutcome;
/**
 * Canonical 写出。**同一份文档两次写出必得逐字节相同的文本**，而不同文档的差异
 * 被限制在改动的那一个块里（2 空格缩进的每节点／每边一个多行块）。
 */
export declare function writeDocument(document: WorkflowDocument): string;
/** 深拷贝一份文档（工具做读-改-写时用，避免就地改调用方的对象）。 */
export declare function cloneDocument(document: WorkflowDocument): WorkflowDocument;
/** 按 `id` 找节点。 */
export declare function findNode(document: WorkflowDocument, id: string): WorkflowNode | undefined;
/** 一个节点的入边（**含回边**）。 */
export declare function incomingEdges(document: WorkflowDocument, id: string): WorkflowEdge[];
/** 一个节点的出边。 */
export declare function outgoingEdges(document: WorkflowDocument, id: string): WorkflowEdge[];
