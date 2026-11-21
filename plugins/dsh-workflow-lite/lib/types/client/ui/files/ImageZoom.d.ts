/**
 * dsh-workflow-lite — 点开 Markdown 里的一张图：模态框里放大看。
 *
 * 缺省"适应窗口"：整张装得下，小图放大到两倍为止。滚轮以指针为中心缩放，拖动平移，双击在"适应"和"原大"之间切换。
 * 工具栏（− 比例 + ｜ 适应 1:1 ｜ 左转 右转）和键盘（+ − 0 1 R、方向键）做的是同一件事。
 * Esc、点空白处、✕ 都能关；叠在文档查看框上面时只关自己。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/files/ImageZoom
 */
import type { T } from '../../i18n.ts';
/** 点开 Markdown 里的一张图：模态框里放大看。 */
export declare function ImageZoom(props: {
    t: T;
    src: string;
    alt: string;
    /** 文档里写的路径，标题下面那一行看；网上的图就是网址。 */
    path?: string;
    onClose(): void;
}): React.JSX.Element;
/** 查看框、文件夹浏览里直接摆着的图：工具条在上面，画布铺满下面，不再点一下才弹框。 */
export declare function ImageInline(props: {
    t: T;
    src: string;
    alt: string;
}): React.JSX.Element;
