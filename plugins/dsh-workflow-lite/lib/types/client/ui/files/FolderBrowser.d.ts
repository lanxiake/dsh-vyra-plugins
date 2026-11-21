/**
 * dsh-workflow-lite — 左边浏览、右边预览：实例里点开一个文件夹资源，或导出成 skill 前看整个包。
 * 从哪读由 {@link BrowseSource} 定，这里不管背后是哪条 RPC。
 *
 * 左边是这一层的内容（目录在前）：上面一个搜索框（只筛这一层的名字，命中的字标出来），下面是面包屑和列表；
 * 点目录进去、点文件在右边看它，面包屑和「返回」能退回任何一层。键盘也能用：↑ ↓ 选，→ / 回车进目录，
 * ← 退一层，直接打字就是搜索，Esc 先清掉搜索、再关框。右边按文件的样子预览：Markdown / HTML 可切源码，
 * 图片整张显示、点一下放大，其余文本原样；标题行有复制路径、用其他程序打开。
 *
 * 看的都是根下面的东西：每次请求带着「根 + 往下的相对路径」，由主机把关，走不出这个文件夹。
 * Markdown 开头的 YAML 头部（SKILL.md 那种）预览时单独列成元数据，不当正文排版；源码里原样。
 * 动的只有 transform / opacity：换层和文件选择框一个做法——新一层读回来后，旧列表留个影子往外退、新列表从另一侧进来
 * （{@link useStage}），面包屑长出一级从前一级背后展开、缩短时收回去（{@link useTrail}）；选中块跟着光标上下滑。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/files/FolderBrowser
 */
import type { Desktop } from '../../app/desktop.ts';
import { type BrowseSource } from '../../app/useBrowse.ts';
import type { T } from '../../i18n.ts';
export declare function FolderBrowser(props: {
    t: T;
    source: BrowseSource;
    /** 文件夹本身叫什么（面包屑的根）。 */
    rootName: string;
    /** 一打开先看根下的哪个文件（导出 skill 时先看 SKILL.md）。 */
    initial?: string;
    desktop: Desktop | undefined;
}): React.JSX.Element;
