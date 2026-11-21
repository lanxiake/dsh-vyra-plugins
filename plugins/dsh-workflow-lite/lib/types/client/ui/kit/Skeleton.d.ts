/**
 * dsh-workflow-lite — 读取中的占位：几行灰条轻轻呼吸，读完换成真内容。
 *
 * 读得快的话还没出来（延迟 150ms 才淡入）就已经换成内容了，不闪一下。
 * `list`：一行一个小块 + 两行字（工作流、实例列表）；`form`：标题 + 一排排输入框（设置、存储页）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/kit/Skeleton
 */
export declare function Skeleton(props: {
    label: string;
    shape?: 'list' | 'form';
    rows?: number;
}): React.JSX.Element;
