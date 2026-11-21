/**
 * dsh-workflow-lite — 画布：把文档画成步骤卡与连线，把指针操作翻译成编辑动作。
 *
 * 文档是事实源，React Flow 只负责渲染与手势：
 * - 节点对象按"文档里的那个节点 + 选中/语气"缓存，没变的节点保持同一个引用，React Flow
 *   就不会重建它的内部状态（尺寸、连接点位置）；
 * - 拖动过程中的坐标只放在本组件的局部状态里，**松手才写进文档**——一次拖拽 = 一次改动、
 *   一条撤销步、一次保存；
 * - 选中态由文档这边说了算，单向告诉 React Flow。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/canvas/Canvas
 */
import '@xyflow/react/dist/base.css';
import type { GraphAnalysis } from '../../../shared/graph.ts';
import type { MemoryEntry } from '../../../shared/memoryLib.ts';
import type { NodeStatus } from '../../../shared/runState.ts';
import type { Point, ValidationProblem, WorkflowDocument } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
import { type Edit, type FocusFile, type Selection } from '../../model/editor.ts';
import type { StepSource } from '../../model/library.ts';
import { type DisplayEnv } from '../display/displayEnv.ts';
import type { RunMark } from './types.ts';
/** 「在这里加一个步骤」的请求：屏幕坐标用来摆菜单，画布坐标用来落节点。 */
export interface AddRequest {
    client: Point;
    flow: Point;
    /** 顺手从这个节点连过来（步骤 = 接一步；资源 = 新步骤读它）。 */
    from?: string;
}
export interface CanvasProps {
    t: T;
    doc: WorkflowDocument;
    analysis: GraphAnalysis;
    /** 换了一份基线（打开 / 重新加载）就变：据此重新定视口。 */
    loadKey: string;
    /** 图名：给了就把人动过的视口记在浏览器里（见 `app/viewport.ts`），下次打开接着看；不写进图文件。 */
    viewKey?: string;
    selection: Selection;
    problems: readonly ValidationProblem[];
    /** 自动看全图时四周要让开的浮层宽度。 */
    insets: {
        left: number;
        right: number;
    };
    onEdit(edit: Edit): void;
    /** 一次连续输入结束：断开撤销合并（线上交接卡片里就地改说明用）。 */
    onSeal(): void;
    onSelect(selection: Selection): void;
    onRequestAdd(request: AddRequest): void;
    onDropSource(source: StepSource, flow: Point): void;
    onStarter(): void;
    /** 这一份刚载入的图摆好了视角、量好了卡片（头一回看全图 / 恢复视角之后）：之后才画得稳，线不会再挪。 */
    onSettled?(): void;
    /** 正在悬停的资源卡 id：用到它的步骤标出角色，其余的淡下去。 */
    focusFile: string | null;
    onFocusFile: FocusFile;
    /** 工作流实例视图：每张步骤卡挂上运行状态，走过的线亮、没走过的淡。缺省 = 模板编辑。 */
    run?: RunDecor;
    /** 步骤卡上的记忆开关（`anchor` 是那个按钮，菜单贴着它弹）；不给就不显示开关（只标出开着记忆的步骤）。 */
    onMemory?: (step: string, anchor: Element) => void;
    /** 记忆库（记忆卡显示库里的名称、谁还在用）；没读回来是 `null`。 */
    memories?: readonly MemoryEntry[] | null;
    /** 正在编辑的工作流名（「另有几个工作流在用」不算它自己）。 */
    workflow?: string | null;
    /** 资源卡的画布展示从哪读、怎么打开（实例视图给出实例）；缺省 = 模板（文件还没生成，只摆占位）。 */
    display?: Omit<DisplayEnv, 't'>;
}
/** 实例视图给画布的装饰。 */
export interface RunDecor {
    /**
     * 每个步骤此刻的状态（已经叠上草稿）；`mark` = 执行位置：最后执行的、接下来要做的
     * （见 `shared/runCursor.ts`）。
     */
    nodes: Readonly<Record<string, RunNodeDecor>>;
    /** 走过的线。 */
    taken: ReadonlySet<string>;
    /** 资源里每个文件、文件夹在不在（资源 id → 按项；不是路径的项为 `null`）。 */
    files: Readonly<Record<string, readonly (boolean | null)[]>>;
    /** 点卡片上的状态小标：在它旁边弹出改状态的菜单。 */
    onStatus(id: string, anchor: Element): void;
}
export interface RunNodeDecor {
    status: NodeStatus;
    round: number;
    edited: boolean;
    mark?: RunMark | undefined;
}
export declare function Canvas(props: CanvasProps): React.JSX.Element;
