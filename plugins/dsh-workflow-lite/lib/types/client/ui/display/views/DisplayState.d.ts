/**
 * dsh-workflow-lite — 展示区的占位与读不了的说明：居中一枚图标、一两行字。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/views/DisplayState
 */
import { type IconName } from '../../kit/Icon.tsx';
/** 占位与读不了的说明：居中一枚图标、一两行字。 */
export declare function DisplayState(props: {
    icon: IconName;
    title: string;
    sub?: string;
    tone?: 'wait' | 'error';
    /** 写它的步骤正在跑：边上有一道光在走。 */
    busy?: boolean;
}): React.JSX.Element;
