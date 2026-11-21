/**
 * dsh-workflow-lite — Markdown 排版（计划预览、文档查看、说明栏共用），交给 markdown-it 渲染。
 *
 * 规则是 CommonMark + GFM 表格 / 删除线，另外几处按我们的内容调过：
 * - **不收原始 HTML**（`html: false`）：提示词、文件都是任意文本，里面的标签一律当文字，
 *   这样渲染结果才能直接放进 `innerHTML`。别为了"支持 HTML"把它打开——那就是一个注入口。
 * - **链接只认 http(s)**，新窗口打开、不带来源；相对路径的链接只留文字（点了会把宿主页面带走）。
 * - **相对路径的图片**按文档所在目录找：调用方给了 `image`（文件查看框按实例去读）就换成读回来的图，
 *   没给（计划、说明这类没有"所在目录"的文字）就只显示替代文字。读到了的图不让拖（宿主会当成拖文件进对话），
 *   点一下（或聚焦后回车）在模态框里放大看（{@link ImageZoom}）。
 * - **一行就是一行**（`breaks: true`，GitHub 评论区那种）：提示词与计划都是按行写的。
 * - **只认带协议的网址**：关掉 linkify 的模糊匹配，`review.md` 这种文件名（`.md` 也是顶级域名）不变成链接。
 * - **中日韩友好的强调**（`markdown-it-cjk-friendly`）：`**结论。**后面` 这种挨着中文标点的
 *   粗体，按 CommonMark 原规则认不出来。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/files/Markdown
 */
import type { T } from '../../i18n.ts';
/** 把文档里写的相对路径读成能放进 `<img src>` 的地址（data URL）。 */
export type ImageSource = (src: string) => Promise<string>;
export declare function Markdown(props: {
    t: T;
    text: string;
    className?: string;
    /** 相对路径的图片怎么读；不给就只显示替代文字。 */
    image?: ImageSource | undefined;
}): React.JSX.Element;
