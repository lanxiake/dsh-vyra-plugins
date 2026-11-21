/**
 * dsh-workflow-lite — 文件夹的「只看」：按名字筛（`*.png, report-*`），打字停一下才生效。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/options/MatchField
 */
import type { T } from '../../../i18n.ts';
/**
 * 文件夹的「只看」：按名字筛（`*.png, report-*`），打字停一下生效，回车立刻生效，Esc 撤回这次输入，× 清掉。
 */
export declare function MatchField(props: {
    t: T;
    value: string | undefined;
    onChange(match: string | undefined): void;
}): React.JSX.Element;
