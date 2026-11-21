/**
 * dsh-workflow-lite — 文件前面的类型图标：文档、表格、代码、图片、压缩包、音视频……各有各的形状和颜色，
 * 一眼分得出来（文件夹浏览、选择文件的对话框共用）。分类见 `fileGroupOf`。
 *
 * 颜色用步骤卡的那套色板（`--wl-c-*`），跟着主题走；认不出的类型是灰色的通用文件图标。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/files/FileGlyph
 */
export declare function FileGlyph(props: {
    path: string;
    size?: number;
}): React.JSX.Element;
