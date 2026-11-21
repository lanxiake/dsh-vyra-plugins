/**
 * dsh-workflow-lite — 顶栏的检查结果：一个小牌子（没有问题 / x 个问题），点开列出每一条，点一条定位到那个节点。
 * 模板编辑和实例视图共用（两边是同一套规则，见 `shared/validate.ts`）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/chrome/Issues
 */
import type { ValidationProblem } from '../../../shared/types.ts';
import type { LocaleKey, T } from '../../i18n.ts';
export declare function Issues(props: {
    t: T;
    problems: readonly ValidationProblem[];
    /** 没有问题时那句说明。 */
    noneBody?: LocaleKey;
    onLocate(nodeId: string): void;
}): React.JSX.Element;
