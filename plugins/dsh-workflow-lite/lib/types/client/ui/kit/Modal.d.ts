/**
 * dsh-workflow-lite — 模态框：遮罩 + 居中的一张卡，挂载点上下文，以及弹窗从触发控件长出来 / 缩回去的进出场。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/kit/Modal
 */
import { type RefObject } from 'react';
/**
 * 模态框挂到哪里：视图根节点。
 *
 * 面板里打开的模态框不能就地渲染——面板自己带着入场动画（`transform`），会变成里面
 * `position: absolute` 的定位参照，遮罩就只盖住面板那一条。挂回视图根，遮罩盖住整个视图，
 * 设计令牌照常继承，也不会跑出视图去盖宿主页面。
 */
export declare const ModalHost: import("react").Context<HTMLElement | null>;
export declare const ModalHostProvider: import("react").Provider<HTMLElement | null>;
/**
 * 模态框：遮罩 + 居中的一张卡。
 *
 * - 键盘事件一律在这里截住：React 的合成事件会顺着组件树（而不是 DOM 树）冒泡，不截的话
 *   在模态框里按 Delete / Esc 会冒到视图根，删掉画布上选中的步骤。
 * - Esc 与点遮罩都走 `onDismiss`；调用方据此决定"有没写完的改动时不关"。
 * - 只有按下与松开都落在遮罩上才算点遮罩：在输入框里拖选文字、松手落在外面，不该把框关掉。
 * - Tab 在框内循环；关掉后焦点还给打开它的那个按钮。
 */
export declare function Modal(props: {
    label: string;
    onDismiss(): void;
    children: React.ReactNode;
    className?: string;
    testId?: string;
}): React.JSX.Element;
/**
 * 弹窗的进出场（模态框、计划对话框共用）——「从点的那个控件里长出来、缩回那个控件里」（iOS 打开 App、macOS 最小化的路数）：
 * - 打开：量出触发控件的位置，弹窗先缩成控件那么小、叠在控件上，再用弹簧放大到位（淡入只在前三成，先看到一小块从控件里冒出来）；
 * - 关掉：留一个"影子"，缩回同一个控件的位置、淡出（见 ghostOut）；调用方直接卸掉弹窗，不用等动画；
 * - 找不到触发控件（过了很久才弹出来、不是点开的）：用样式里的 `dialogIn`，从中心浮起。
 */
export declare function useSheetMotion(scrimRef: RefObject<HTMLElement | null>, dialogRef: RefObject<HTMLElement | null>): void;
