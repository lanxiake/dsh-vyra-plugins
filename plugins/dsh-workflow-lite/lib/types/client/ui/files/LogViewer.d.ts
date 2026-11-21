/**
 * dsh-workflow-lite — 查看框里看日志、纯文本（`.log`、`.txt`、`.jsonl`）：按字节分段读，几 GB 的也翻得动。
 *
 * 页面里最多留 {@link WINDOW_LINES} 行：滚到顶读前面一段（{@link PAGE_LINES} 行），滚到底读后面一段，
 * 多出来的从另一头扔掉（扔掉的那头变成「还有」，滚过去再读回来）。换段时看着的那一行不动。
 * 读到了末尾就每隔一会儿续读新追加的（人在底下就跟着走）；「开头」「末尾」两个按钮直接跳过去。
 *
 * 顶上一条筛选（Ctrl+F 到这里）：和卡片上的「只看」一样的写法，只在这次查看里有效；打开时带着卡片的筛选。
 * 筛着看时点一行，回到全文、停在这一行上（前后各读一段），那一行亮一下。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/files/LogViewer
 */
import type { LineFilter } from '../../../shared/types.ts';
import type { RunLinesResponse } from '../../../shared/wire/run.ts';
import type { LinesTarget } from '../../app/useRunLines.ts';
import type { T } from '../../i18n.ts';
import { type WorkflowLiteRpc } from '../../rpc.ts';
export declare function LogViewer(props: {
    t: T;
    rpc: WorkflowLiteRpc;
    instance: string;
    target: LinesTarget;
    /** 文件名（`.log` 打开就在末尾，别的从头）。 */
    name: string;
    /** 卡片上的筛选（打开时带上）。 */
    filter?: LineFilter | undefined;
    /** 读回来的元信息（标题行写大小、修改时间，「用其他程序打开」要路径）。 */
    onMeta?: (response: RunLinesResponse) => void;
}): React.JSX.Element;
