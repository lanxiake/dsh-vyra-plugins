/**
 * dsh-workflow-lite — 展示区里的图片：按「适应」铺满或完整放进去，原尺寸时按缩放放大缩小。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/views/ImageView
 */
import type { Display } from '../../../model/display.ts';
export declare function ImageView(props: {
    name: string;
    url: string;
    display: Display;
}): React.JSX.Element;
