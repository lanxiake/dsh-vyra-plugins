/**
 * dsh-workflow-lite — 工作流中心「存储」页：数据目录在哪、里面各样东西占多少，能清的两样（已结束的实例、
 * 旧版本遗留文件）就地清。
 *
 * - 打开时统计一次，之后只在清理时重算——不跟着外面的重绘重拉（外面重绘很频繁，跟着拉会让按钮一直闪）。
 * - 清理已结束的实例要再确认一次（确认卡浮在按钮旁边）；旧版本遗留文件没人用，点一下就删，删完这一行就不显示了。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/hub/HubStorage
 */
import type { T } from '../../i18n.ts';
import { type WorkflowLiteRpc } from '../../rpc.ts';
export declare function formatBytes(bytes: number): string;
export declare function HubStorage(props: {
    t: T;
    rpc: WorkflowLiteRpc;
    /** 清掉了实例记录：让外面的实例列表跟上。 */
    onChanged(): void;
}): React.JSX.Element;
