/**
 * dsh-workflow-lite — 查看框里看一张本地图片：文件夹里点开的截图、产出里的图片文件、skill 包里的图。
 *
 * 图读回来（文件自己就是那张图）后直接摆成放大看图的那一块（{@link ImageInline}）：
 * 工具条在上面，滚轮缩放、拖动平移、双击切换适应与原大，不用再点一下弹框。读不出来（太大、不在了）就说明原因。
 * 从哪读分两种：实例里的文件（{@link RunImagePreview}，走 `run/image`）、文件夹浏览的来源（{@link BrowseImagePreview}）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/files/ImagePreview
 */
import { type BrowseSource } from '../../app/useBrowse.ts';
import { type FileTarget, type RunImage } from '../../app/useRunFile.ts';
import type { T } from '../../i18n.ts';
import type { WorkflowLiteRpc } from '../../rpc.ts';
/** 摆一张读回来的图。 */
export declare function ImagePreview(props: {
    t: T;
    /** 文件名（替代文字）。 */
    name: string;
    image: RunImage;
}): React.JSX.Element;
/** 实例里的一份图片文件。 */
export declare function RunImagePreview(props: {
    t: T;
    rpc: WorkflowLiteRpc;
    instance: string;
    target: FileTarget;
    name: string;
}): React.JSX.Element;
/** 文件夹浏览里的一张图。 */
export declare function BrowseImagePreview(props: {
    t: T;
    source: BrowseSource;
    sub: string;
    name: string;
}): React.JSX.Element;
