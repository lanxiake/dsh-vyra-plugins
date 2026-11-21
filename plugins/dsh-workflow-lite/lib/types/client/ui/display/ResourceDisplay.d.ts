/**
 * dsh-workflow-lite — 资源卡的展示区：把资源里的一项（图片、网页、Markdown、文本）直接摆在画布上。
 *
 * 从哪读由 {@link DisplayContext} 定：
 * - 实例视图给出实例与每项的修改时间（`run/stat`，见 `app/useDisplayStats.ts`），修改时间变了才重读，
 *   读回来之前上一份原样留着，新的淡入；还没生成时是草图（{@link DisplaySketch}），写它的步骤在跑时扫一道光。
 *   实例视图只看这个实例，从不拿别的实例的结果来填。
 * - 模板视图给出「上次执行」（`run/latest`）：这个工作流最近真的生成了它的那个实例，卡上显示那一份，
 *   右上角一枚「上次执行 · 时间」，点了打开那个实例；哪次都没生成就是草图「执行后显示」。
 * 自定义文字两边都直接显示。
 *
 * 平时展示区不接鼠标（拖卡片、平移、缩放画布照旧）；卡片进了「交互」才能在里面滚动、点网页里的按钮。
 * 第一次进视野、而且画布停着时才挂内容（宿主页面插拔元素要整页重算样式，平移中间插就是一次卡顿）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/ResourceDisplay
 */
import type { ResourceItem, TableView } from '../../../shared/types.ts';
import { type Display } from '../../model/display.ts';
/**
 * 展示区本体。`interactive` 时接鼠标（网页能点、长文能滚）；平时整块透明于鼠标，双击交给卡片。
 */
export declare function DisplayBody(props: {
    node: string;
    item: ResourceItem;
    display: Display;
    interactive: boolean;
    /** 写它的步骤正在跑。 */
    writing: boolean;
    /** 表格卡进了交互点表头排序：写回设置。 */
    onTable?: ((table: TableView | undefined) => void) | undefined;
}): React.JSX.Element;
