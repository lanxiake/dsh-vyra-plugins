/**
 * dsh-workflow-lite — 随状态变色 / 变形的小标记：字、图标交叉淡（{@link FadeText} / {@link FadeMark}）、
 * 打勾（{@link CheckMark} / {@link Checkbox} / {@link CheckBox}）、开关轨道、是否小状态（{@link DotState}）、描边环（{@link FadeRing}）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/motion/marks
 */
/**
 * 随选中态变色的字：本身透明（只占宽度、给读屏和测试读），上面叠两层同样的字——灰的和强调色的，
 * `on` 变了交叉淡过去（只动 opacity，不是颜色瞬切）。
 * 颜色由外面的自定义属性给：`--wl-off`（没选中，默认 text-2）、`--wl-on`（选中，默认 text）。
 * `pop`：选中时字弹一下（要在 PickThumb 所在的组里，见 `popIn`）。
 */
export declare function FadeText(props: {
    text: string;
    on: boolean;
    pop?: boolean;
    className?: string;
}): React.JSX.Element;
/**
 * 随选中态变色的图标 / 小标记：灰、强调色两枚叠在同一格，`on` 变了交叉淡过去；强调色那枚同时弹一下。
 * 颜色同 {@link FadeText}：没选中时继承外面的字色，选中时 `--wl-on`（默认 accent-text）。
 */
export declare function FadeMark(props: {
    on: boolean;
    children: React.ReactNode;
    className?: string;
}): React.JSX.Element;
/**
 * 勾选标记里的描边：先是一圈灰色圆环，选中时圆环收成 ✓（Uiverse 那种「描边变形」，路径和数字见 ui.module.css 的 `.checkDraw`）。
 * 放在 `ui.check` 元素里当**直接子元素**，跟着它的 `aria-checked` / `data-on` 走；字色就是 ✓ 的颜色。
 */
export declare function CheckMark(): React.JSX.Element;
/**
 * 纯展示的开关（点击由外面的按钮管，比如整行都是开关）：样子和 `ui.switch` 按钮一样，
 * `on` 决定滑块在哪一头；全局只有这一份，见 ui.module.css 的 `.switch` / `.knob`。
 */
export declare function SwitchTrack(props: {
    on: boolean;
}): React.JSX.Element;
/**
 * 勾选框：原生 `<input type="checkbox">` 透明地叠在方框上（键盘、`<label>` 点击、`checked` 都照旧），
 * 看得见的是方框——先填底色，✓ 再画出来（{@link CheckMark}）。除 `type` 外的属性都给 input。
 */
export declare function Checkbox(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>): React.JSX.Element;
/**
 * 纯展示的勾选方框（点击由外面的按钮 / 整行管）：`on` 决定画不画勾。
 * 样子全局一份，见 ui.module.css 的 `.check`。
 */
export declare function CheckBox(props: {
    on?: boolean;
    className?: string;
}): React.JSX.Element;
/**
 * 「是 / 否」的小状态（经过没有、生成没有）：圆点 + 一段字，是时点实心变绿，否时空心灰圈，
 * 点和字都是两层交叉淡（FadeMark / FadeText），不是颜色瞬切。`dot` 是点本身的类（大小、描边）。
 */
export declare function DotState(props: {
    on: boolean;
    text: string;
    dot: string;
    className?: string;
    testId?: string;
}): React.JSX.Element;
/**
 * 随状态换色的描边（卡片的运行态边框、角色边框、执行位置的外圈）：一个状态一层，
 * 换状态时旧的一层淡出、新的一层淡入（只动 opacity），不是 `border-color` 瞬切。
 * 层本身的样子由调用方的 `className` + `[data-ring="状态名"]` 给；`ring` 为空 = 没有描边（旧的淡出）。
 * 父元素要 `position: relative`；平时不占 DOM（没有状态就没有层）。
 */
export declare function FadeRing(props: {
    ring: string | undefined;
    className: string;
}): React.JSX.Element;
