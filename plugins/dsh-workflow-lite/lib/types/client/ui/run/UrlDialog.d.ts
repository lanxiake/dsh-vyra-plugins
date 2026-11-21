/**
 * dsh-workflow-lite — 实例视图里点开网址资源的详情框。
 *
 * 文件用 {@link FileViewer}（能读正文），Skill 用 {@link SkillPreview}（读 SKILL.md），文件夹、自定义文字用
 * {@link FolderDialog}、{@link TextDialog}（在 files/），都不在这里。
 * 框子是 {@link DocViewer} 的小号：标题行有复制、关闭，网址的说明放在正文前（框小、说明就是主要内容）：
 * - 网址：整条网址（点了在浏览器里开），底部一个「在浏览器中打开」。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/run/UrlDialog
 */
import type { ResourceItem } from '../../../shared/types.ts';
import type { Desktop } from '../../app/desktop.ts';
import type { T } from '../../i18n.ts';
/** 网址：整条网址、说明，底部在浏览器中打开。 */
export declare function UrlDialog(props: {
    t: T;
    item: ResourceItem;
    desktop: Desktop | undefined;
    onClose(): void;
}): React.JSX.Element;
