/**
 * dsh-workflow-lite — 工作流中心各页左栏顶上的搜索框（运行实例、工作流、记忆共用）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/hub/HubSearch
 */
import type { T } from '../../i18n.ts';
export declare function HubSearch(props: {
    t: T;
    value: string;
    placeholder: string;
    testId?: string;
    /** 搜索框右边同一行放的小按钮（比如工作流页的「导入」）。 */
    children?: React.ReactNode;
    onChange(value: string): void;
}): React.JSX.Element;
