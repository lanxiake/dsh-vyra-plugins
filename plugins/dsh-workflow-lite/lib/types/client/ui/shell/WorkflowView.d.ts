/**
 * dsh-workflow-lite — 工作流视图（会话页的一个 tab）：把发动机、画布与各块面板接起来。
 *
 * 版式：画布铺满，顶栏、步骤库、属性面板、缩放条浮在上面。属性面板只在选中东西时出现。
 * 键盘：快捷键挂在视图根上——视图内任何地方拿到焦点都能冒上来，又出不了这个视图
 * （挂 window 会隔着整页抢宿主的按键）。输入框里一律让开。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/shell/WorkflowView
 */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { Desktop } from '../../app/desktop.ts';
import type { SessionBridge } from '../../app/sessions.ts';
import type { NS } from '../../i18n.ts';
import type { WorkflowLiteRpc } from '../../rpc.ts';
/** 客户端入口注入的业务面。 */
export interface WorkflowViewInjected {
    rpc: WorkflowLiteRpc;
    /** 这个 tab 所在的会话。 */
    sessionId?: string;
    /** 会话列表与发消息（「执行」用）；宿主缺相应服务时不给。 */
    sessions?: SessionBridge;
    /** 用系统程序打开文件；宿主没有桌面能力时不给。 */
    desktop?: Desktop;
}
/** 槽位给这个组件的完整 props。 */
export type WorkflowViewProps = PropsRuntime<'conversation.view'> & PropsLocale<typeof NS> & WorkflowViewInjected;
export declare function WorkflowView(props: WorkflowViewProps): React.JSX.Element;
