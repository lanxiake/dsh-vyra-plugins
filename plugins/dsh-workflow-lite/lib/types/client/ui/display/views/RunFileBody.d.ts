/**
 * dsh-workflow-lite — 实例视图里的一份文件连同它存下的各版：卡片底下的时间线、标题行里的状态签。
 * 实例视图里存过几版的（循环迭代时每一轮存一版，见 `host/runs/history.ts`），悬停卡片时底下出现一条时间线，
 * 标题行写出看的是哪一版（{@link HistoryBar}）：悬停预览、点一下钉住。钉住的那版只在这张卡上，不存进图里。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/views/RunFileBody
 */
import type { ResourceItem, TableView } from '../../../../shared/types.ts';
import type { T } from '../../../i18n.ts';
import type { Display } from '../../../model/display.ts';
import { type DisplayEnv } from '../displayEnv.ts';
/**
 * 实例视图里的一份文件，连同它存下的各版：至少两版时卡片底下一条时间线、标题行写出看的是哪一版（{@link HistoryBar}）。
 * 悬停预览的那版优先，其次钉住的那版，都没有就是现在的文件。
 * 右上角一枚小签：写它的步骤在跑时「生成中」，现在的文件更新了「刚更新」（几秒后淡出）。
 */
export declare function RunFileBody(props: {
    t: T;
    run: NonNullable<DisplayEnv['run']>;
    frame: React.ComponentProps<'div'> & {
        ref: React.RefObject<HTMLDivElement>;
    };
    seen: boolean;
    node: string;
    item: ResourceItem;
    display: Display;
    interactive: boolean;
    writing: boolean;
    onOpen?: ((sub: string) => void) | undefined;
    onTable?: ((table: TableView | undefined) => void) | undefined;
}): React.JSX.Element;
