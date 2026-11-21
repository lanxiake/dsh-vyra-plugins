/**
 * dsh-workflow-lite — 导入导出清单里的一行：[勾选] 图标 名字 / 说明 [右端]，下面可以再挂一整条（skill 的处理方式）。
 *
 * 给了 `onCheck` 整行就是一个 `<label>`，点哪都切换勾选；挂了下面那一条（里面有按钮）就不要再给 `onCheck`。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/hub/PackRow
 */
import { type IconName } from '../kit/Icon.tsx';
export declare function PackRow(props: {
    /** 不给 = 紧凑的一行（导出清单：分类标题已经有图标，行里不再重复）。 */
    icon?: IconName;
    tone?: 'accent' | 'warn' | 'ok';
    title: React.ReactNode;
    /** 名字是路径（等宽字）。 */
    mono?: boolean;
    /** 名字旁边的小标。 */
    badge?: React.ReactNode;
    /** 下面一行的几段说明（空的会被略过）。 */
    meta?: readonly React.ReactNode[];
    metaTone?: 'warn';
    end?: React.ReactNode;
    checked?: boolean;
    onCheck?: (next: boolean) => void;
    disabled?: boolean;
    /** 没勾上：字淡一点。 */
    dim?: boolean;
    /** 悬停提示（完整路径之类放这里，行里只留一句）。 */
    tip?: string;
    /** 紧凑行里不能勾的那一格：状态图标，原因放它的悬停提示里。 */
    lead?: {
        icon: IconName;
        tone?: 'warn' | 'produce' | 'update';
        tip: string;
    };
    children?: React.ReactNode;
    testId?: string;
}): React.JSX.Element;
/**
 * 一节：标题、旁注、可选的右端链接，下面一个圆角框。
 * `quiet`：旁注和链接这会儿用不上（导出成 Skill 时的「已选几个」「全选」）——原地淡掉、不能点，但位置留着，
 * 来回切时标题行不跳；标题换字也是原地换。
 */
export declare function PackSection(props: {
    title: string;
    note?: React.ReactNode;
    hint?: string;
    action?: {
        label: string;
        onClick(): void;
    };
    quiet?: boolean;
    children: React.ReactNode;
    box?: boolean;
    testId?: string;
    className?: string;
}): React.JSX.Element;
/**
 * 步骤指示：1 选版本 — 2 资源清单（导出成 Skill 时多一步「Skill 信息」）。
 * 步数变了和路径栏一个做法（{@link useTrail}）：多出的一步从前一步背后展开，少了的收回去；
 * 所以按位置认（键是第几步），换了名字原地换字。
 */
export declare function PackSteps(props: {
    steps: readonly string[];
    at: number;
}): React.JSX.Element;
/** 一条提醒。 */
export declare function Callout(props: {
    tone?: 'warn' | 'error' | 'ok';
    icon?: IconName;
    children: React.ReactNode;
    testId?: string;
    /** 给了就在右边放一个 ✕，点一下收掉这条（`closeLabel` 是它的名字与悬浮提示）。 */
    onClose?: () => void;
    closeLabel?: string;
}): React.JSX.Element;
