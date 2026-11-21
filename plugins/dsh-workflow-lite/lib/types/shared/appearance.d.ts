/**
 * dsh-workflow-lite — 步骤卡的图标与颜色：图标库、色板，以及新步骤怎么挑一个不重样的。
 *
 * 图标与颜色只是认路的记号，**不进计划**。存在步骤的 `data.icon` / `data.color` 里；没存的老步骤
 * 按 id 猜（`review`、`review-2` 都是审查的样子，猜不中就是通用的样子）。
 *
 * 这里只有名字（host 与 client 都要用：校验、新建步骤时挑一个）；图标的笔画在 `client/ui/kit/stepIcons.ts`。
 * 纯函数，不碰磁盘、不 import DSH 包。
 *
 * @module @xiaoso/dsh-workflow-lite/shared/appearance
 */
import type { NodeData, WorkflowNode } from './types.ts';
/**
 * 图标库。顺序就是新步骤挑图标的顺序：先挑通用的那些，内置步骤的六个放在最后
 * （它们代表固定的意思，空白步骤别一上来就撞上）。
 */
export declare const STEP_ICONS: readonly ["idea", "target", "terminal", "bug", "test", "database", "chart", "globe", "chat", "mail", "rocket", "gear", "layers", "book", "checklist", "clipboard", "brush", "image", "translate", "branch", "package", "cloud", "lock", "flag", "sparkle", "scan", "plan", "implement", "review", "fix", "report", "blank"];
export type StepIcon = (typeof STEP_ICONS)[number];
/** 色板。顺序就是新步骤挑颜色的顺序；中性的石板灰放最后。 */
export declare const STEP_COLORS: readonly ["blue", "green", "amber", "coral", "teal", "pink", "olive", "violet", "slate"];
export type StepColor = (typeof STEP_COLORS)[number];
export interface Appearance {
    icon: StepIcon;
    color: StepColor;
}
export declare function isStepIcon(value: unknown): value is StepIcon;
export declare function isStepColor(value: unknown): value is StepColor;
/** 按 id 猜样子：`review`、`review-2` 都算审查；猜不中是通用的样子。 */
export declare function guessAppearance(id: string): Appearance;
/** 一个步骤卡的样子：存了就用存的，没存（或存的不认识）就按 id 猜。 */
export declare function appearanceOf(id: string, data: Pick<NodeData, 'icon' | 'color'>): Appearance;
/**
 * 给新步骤挑样子：给了的（来自模板 / 内置步骤）照用，缺的那一半挑图里用得最少的——
 * 尽量不和已有的步骤重样。
 */
export declare function pickAppearance(nodes: readonly WorkflowNode[], preferred?: Pick<NodeData, 'icon' | 'color'>, 
/** 新步骤的 id：是内置步骤的名字（`review`、`review-2`）就照内置步骤的样子。 */
id?: string): Appearance;
/**
 * 给新的「我的步骤」挑样子：避开内置步骤和已有的我的步骤用过的——步骤库里一眼扫过去尽量不重样。
 * 没存样子的老模板在库里显示的是书签，不算占用。
 */
export declare function pickTemplateAppearance(templates: readonly {
    name: string;
    icon?: string;
    color?: string;
}[]): Appearance;
/** 内置步骤的样子（步骤库、示例流程用）。 */
export declare function presetAppearance(id: string): Appearance;
