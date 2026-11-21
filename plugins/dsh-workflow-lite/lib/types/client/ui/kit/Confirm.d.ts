/**
 * dsh-workflow-lite — 二次确认：点了删除 / 放弃这类收不回的按钮，在按钮旁边浮出一张小卡问一句。
 *
 * 不在原地换出「取消 / 确认」：那样同一行的东西会被挤开，用户正要点的地方跟着挪。
 * 小卡浮在视图根上（摆位、收起规则同 {@link useFloat}），按钮原地不动、旁边的东西也不动：
 *
 * - 触发器在视图右半边就右边对齐，免得卡片离按钮太远；下面放不下翻到上方；
 * - 再点一下触发器、点别处、滚动、Esc 都等于取消；焦点先落在「取消」上，关掉后回到触发器
 *   （确认后若触发器在对话框里，交给对话框——触发器多半跟着被删的东西一起没了）；
 * - 卡片里的按键不往外冒（不会删到画布上选中的步骤）。
 *
 * 用法：`const confirm = useConfirm<HTMLButtonElement>()`，触发器挂 `ref={confirm.anchorRef}`、
 * `onClick={confirm.toggle}`，再在旁边放 `{confirm.render({...})}`。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/kit/Confirm
 */
import type { T } from '../../i18n.ts';
export interface ConfirmOptions {
    t: T;
    /** 问的那句话：「删除这个实例？」 */
    title: string;
    /** 补一句后果（可选）。 */
    desc?: string;
    /** 标题下面额外的东西（比如「连同状态文件」勾选框）。 */
    children?: React.ReactNode;
    /** 确认按钮上的字：「删除」「放弃」。 */
    confirmText: string;
    /** 确认按钮的 `data-testid`；整张卡是 `${testId}-pop`。 */
    testId?: string;
    disabled?: boolean;
    /** 确认按钮是红的（删除、放弃）；`false` = 主色（切换这类收得回来的）。缺省红。 */
    danger?: boolean;
    onConfirm(): void;
}
export declare function useConfirm<A extends HTMLElement>(): {
    anchorRef: React.RefObject<A>;
    open: boolean;
    show(): void;
    hide(): void;
    toggle(): void;
    render(options: ConfirmOptions): React.ReactNode;
};
