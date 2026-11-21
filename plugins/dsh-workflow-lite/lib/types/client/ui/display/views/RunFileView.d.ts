/**
 * dsh-workflow-lite — 实例里的一份文件：看 `stat` 决定读不读，按种类分给图、图片墙、日志、表格、文本。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/views/RunFileView
 */
import type { ResourceItem, TableView } from '../../../../shared/types.ts';
import type { T } from '../../../i18n.ts';
import type { Display } from '../../../model/display.ts';
import type { DisplayEnv } from '../displayEnv.ts';
/**
 * 实例里的一份文件：在不在看 `stat`，修改时间变了重读。`kept` 给了就显示存下的那一版（不看现在的文件在不在）。
 * 现在的文件更新了（读回来的修改时间变了）告诉外面一声（`onFresh`：卡片右上角说「刚更新」）。
 */
export declare function RunFileView(props: {
    t: T;
    run: NonNullable<DisplayEnv['run']>;
    node: string;
    item: ResourceItem;
    display: Display;
    interactive: boolean;
    writing: boolean;
    kept?: number | null;
    onFresh?: () => void;
    /** 打开这一项（文件夹的话直接看里面的某一份）。 */
    onOpen?: ((sub: string) => void) | undefined;
    /** 日志筛着看时匹配了多少（卡片左上角写出来）；不筛是 `null`。 */
    onMatch?: (text: string | null) => void;
    /** 进了交互点表头排序：写回设置。 */
    onTable?: ((table: TableView | undefined) => void) | undefined;
}): React.JSX.Element;
