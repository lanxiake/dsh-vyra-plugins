/**
 * dsh-workflow-lite — 工作流中心「设置」页：最上面是外观（配色主题，点了就换），
 * 下面是插件自己的几项设置，分「存储 / 画布 / 模型」三组。
 *
 * - 改在草稿上，底下浮出一条「有 N 处改动还没保存 · 放弃 · 保存」，点保存才写；
 *   数据目录这种改错了很麻烦的东西，不能一敲字就生效。
 * - 和默认值不一样的项，右边有个「恢复默认」的小按钮（提示里写着默认是多少）。
 * - 要重启才生效的项标一个小标签；保存后的提示也会再说一遍。
 * - 没有设置服务、或 profile 不让改：照样显示现值，控件都禁用，顶上说明为什么。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/hub/HubSettings
 */
import type { T } from '../../i18n.ts';
import type { WorkflowLiteRpc } from '../../rpc.ts';
export declare function HubSettings(props: {
    t: T;
    rpc: WorkflowLiteRpc;
    /** 保存成功：画布要用的上限、自动保存等待跟着换。 */
    onSaved(): void;
}): React.JSX.Element;
