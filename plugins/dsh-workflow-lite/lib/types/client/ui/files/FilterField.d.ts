/**
 * dsh-workflow-lite — 日志、纯文本的筛选框：一个输入框、三个小开关、两个现成的、前后带几行；打字停一下才生效。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/files/FilterField
 */
import type { LineFilter } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
/**
 * 筛选：一个输入框（打字停一下才生效，回车立刻生效，Esc 撤回这次输入）、三个小开关、两个现成的、前后带几行。
 * 正则写错了框子底线变红、下面说原因，卡片上还是上一次对的结果。
 */
export declare function FilterField(props: {
    t: T;
    value: LineFilter | undefined;
    onChange(filter: LineFilter | undefined): void;
    /** 查看框顶上那一条：不带「只看」两个字，一行排开。 */
    inline?: boolean;
    inputRef?: React.Ref<HTMLInputElement>;
    /** 排在「前后带」后面的（查看框里写匹配了多少）。 */
    extra?: React.ReactNode;
}): React.JSX.Element;
