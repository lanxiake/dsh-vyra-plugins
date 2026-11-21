/**
 * dsh-workflow-lite — 影子：复制一块界面放退场动画（模态框关掉、整块视图被换掉）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/kit/ghost
 */
export declare const REDUCED_MOTION: MediaQueryList;
/** 一块界面此刻样子的复制品（纯 DOM，不归 React 管），放退场动画用。 */
export interface Ghost {
    node: HTMLElement;
    /** 挂到 `parent` 里，再把复制时记下的滚动位置、输入框里的字抄回去。 */
    place(parent: Node): void;
}
/**
 * 复制一块界面当影子：
 *
 * - 影子不接指针、不进无障碍树，也不带 `data-testid` / `id` / `role`：后面的界面马上能点，查找也找不到它；
 * - 影子里的入场动画、过渡都关掉（写在行内），不然复制出来的元素会把入场重放一遍；
 * - 滚动位置、输入框里的字在复制时记下、挂上后照抄，放动画时不跳；
 *   iframe 不复制（挂上就会重新加载页面），换成同样大小的空块。
 */
export declare function ghostClone(node: HTMLElement): Ghost;
/**
 * 模态框关掉后的退场：把它此刻的样子复制一份放回原处，遮罩淡出、卡片缩回触发它的控件（`folded` 是缩进去的变换），放完就删。
 * 起点取关掉那一刻的实际变换和透明度（弹出到一半就关，影子从那半截接着收，不是先跳到满尺寸再缩）。
 */
export declare function ghostOut(node: HTMLElement, parent: Node | null, folded: string | null): void;
/**
 * 整块视图（画布）被换掉时的退场：把它此刻的样子复制一份放进视图根、盖在新视图下面的面板之上，
 * 淡出后删掉——旧画布和新画布交叉淡过去，不是一下换掉。
 */
export declare function ghostFade(node: HTMLElement, parent: Node | null, ms?: number): void;
