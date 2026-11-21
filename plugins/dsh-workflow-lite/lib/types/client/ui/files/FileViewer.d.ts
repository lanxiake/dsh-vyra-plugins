/**
 * dsh-workflow-lite — 产出文件的查看框。
 *
 * 能看的：小文本（原样）、Markdown（默认预览，相对路径的图片按文档所在目录读）、HTML（默认在沙箱里渲染），
 * 后两种可切源码；图片整张显示、点一下放大。
 * 大文件、二进制、还没生成的只说明原因，
 * 并留着「用其他程序打开」。框子本身是 {@link DocViewer}。
 * 资源里的文件存过几版的（循环迭代时每一轮一版），标题行多一个「版本」：挑一版看、挑两版对比（见 `FileHistory.tsx`）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/files/FileViewer
 */
import type { LineFilter } from '../../../shared/types.ts';
import type { RunFileResponse } from '../../../shared/wire/run.ts';
import type { Desktop } from '../../app/desktop.ts';
import { type FileTarget } from '../../app/useRunFile.ts';
import type { T } from '../../i18n.ts';
import type { WorkflowLiteRpc } from '../../rpc.ts';
import { type DocBody } from './DocViewer.tsx';
/** 正文前的「说明」一块（网址这种小详情框用；大的查看框收在「说明」开关里）。 */
export declare function NoteLead(props: {
    t: T;
    text: string;
}): React.JSX.Element;
/**
 * 读回来的文件怎么摆：读不了说原因、还没读到是骨架、是图片就交给 `image`（从哪读图由调用方定），其余按格式给正文。
 * 查看框和文件夹浏览（右边预览）共用。
 */
export declare function fileBody(props: {
    t: T;
    file: RunFileResponse | null;
    error: string | null;
    loading: boolean;
    /** 是图片时摆什么（`name` 是文件名）。 */
    image(name: string): React.ReactNode;
}): DocBody;
export declare function FileViewer(props: {
    t: T;
    rpc: WorkflowLiteRpc;
    instance: string;
    target: FileTarget;
    /** 文件还没读回来时标题先用它。 */
    title: string;
    desktop: Desktop | undefined;
    /** 这一项的说明（产出文件就是它的生成要求）：收在标题行的「说明」开关里。 */
    note?: string | undefined;
    /** 步骤 id → 名字（版本列表里写「改稿 · 第 2 轮」）。 */
    names?: Readonly<Record<string, string>> | undefined;
    /** 卡片上「只看」的筛选：日志打开时带上。 */
    filter?: LineFilter | undefined;
    onClose(): void;
}): React.JSX.Element;
