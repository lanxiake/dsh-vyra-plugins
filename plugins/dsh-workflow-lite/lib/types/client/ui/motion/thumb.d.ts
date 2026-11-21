/**
 * dsh-workflow-lite — 选中底块的动效：列表里的选中底块滑过去（{@link ListThumb}）、
 * 单选组里的选中块滑过去并弹一下（{@link PickThumb}）。只动 `transform` / `opacity`。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/motion/thumb
 */
/**
 * 选中底块：列表里 `data-selected="true"` 的那一项底下垫一块，换选中时滑过去（不是这块灭、那块亮）。
 * 放在列表的第一个子位置（列表要 `position: relative`）；项自己不再画选中底色。
 * `layout` 同 {@link useFlip}：选中项、列表内容变了才重新量。
 *
 * 列表是自己的父元素（不收外面的 ref）：外面那个 ref 在子组件的 layout effect 跑的时候还没挂上。
 *
 * `carry`：列表会整个卸掉又挂上（下拉每次打开都是新的一份）时，给个名字，
 * 新挂上的这块从上次停的地方滑到现在选中的那一项（没变就原地淡入），不是凭空出现在新位置。
 */
export declare function ListThumb(props: {
    layout: string;
    className?: string;
    carry?: string;
}): React.JSX.Element;
/**
 * 单选组的选中块：放在组里（组要 `position: relative`），垫在 `aria-checked="true"` 的那一项下面；
 * 换选中时从旧的一项滑到新的一项（横竖都行，宽窄不同时一边滑一边变宽变窄），不是这块灭、那块亮。
 *
 * 只动 transform：块先摆到新位置（改一次 left / top / 宽高），再从"看上去还在旧位置"的
 * `translate + scale` 放回原样（FLIP）。半路上又换了，从它此刻的样子接着滑。
 *
 * - `part`：垫在选中项里面的某一块下面（主题卡只框缩略图），给选择器；
 * - `tone`：块有几种颜色（状态色）时每种叠一层，换色时交叉淡过去（只动 opacity），不是颜色瞬切；
 *   `attr` 是层上用来挑颜色的属性名，`className` 画每一层的样子。
 *
 * 没有选中项时原地淡掉；再选中时在新位置淡入、略放大。新选中项里带 `data-pick-pop` 的图标弹一下。
 */
export declare function PickThumb(props: {
    /** 选中值、各项变了才重新量：调用方把它们拼成一串。 */
    layout: string;
    part?: string;
    /**
     * 哪一项是选中的：相对单选组的选择器，默认 `:scope > [aria-checked="true"]`。
     * 选中的不是直接子元素时写后代选择器（`[data-active="true"]`）；别用 `data-on`，块自己带着它。
     */
    item?: string;
    className?: string;
    /** 单选组会跟着面板一起卸掉重挂时给个名字（两份用同一个），块跨重挂接着滑，见 {@link carried}。 */
    carry?: string;
    tone?: {
        list: readonly string[];
        on: string | null | undefined;
        attr: string;
        className?: string;
    };
}): React.JSX.Element;
