/**
 * dsh-workflow-lite — 工作流中心一行里的整体状态：小标本身就是按钮，点开挑一个新状态，再二次确认。
 *
 * - 菜单列六种整体状态（和实例视图「整体」那一排同一套），每项一行名字、一行说明，当前的打勾；
 * - 挑了别的，菜单收起，确认卡挂在同一个小标上：「把实例状态改成『失败』？」，
 *   卡里一个「通知模型」开关（和实例视图草稿栏同一个）——这里**默认关**：在列表里顺手改状态，
 *   多半只是整理，不该打断正在跑的模型；打开时多一栏「给模型的说明」。
 * - 只改整体状态，不动各步骤；文件里的状态已经不是列表上看到的那个，保存会被拒（冲突），由调用方提示并刷新。
 *
 * 不记运行状态的实例、状态文件读不出来的实例不能在这里改（小标照旧，不是按钮）。
 * 实例视图顶栏也用它（`confirm={false}`）：挑好就改进草稿，不弹确认卡。
 *
 * 动效（都只动 transform / opacity）：菜单从小标那一角展开、各项依次浮出，收起时淡出；状态真的变了小标弹一下。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/chrome/HubRunStatus
 */
import { type RunStatus } from '../../../shared/runState.ts';
import type { T } from '../../i18n.ts';
export declare function HubRunStatus(props: {
    t: T;
    status: RunStatus;
    /**
     * 默认挑好后二次确认才调用（工作流中心：直接存盘）。`false` = 挑好就调用、不弹确认卡
     * （实例视图顶栏：只是改进草稿，由底部草稿栏确认保存）。
     */
    confirm?: boolean;
    onChange(to: RunStatus, options: {
        notify: boolean;
        note: string;
    }): void;
}): React.JSX.Element;
