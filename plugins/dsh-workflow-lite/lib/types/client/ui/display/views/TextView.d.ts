/**
 * dsh-workflow-lite — 展示区里整份读回来的文本类内容：按类型分给网页、表格、Markdown / 纯文本。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/views/TextView
 */
import type { RunFileResponse } from '../../../../shared/wire/run.ts';
import type { T } from '../../../i18n.ts';
import type { Display } from '../../../model/display.ts';
import type { ImageSource } from '../../files/Markdown.tsx';
import { type TableEnv } from './TableView.tsx';
/** 读回来的文本类内容怎么摆。 */
export declare function TextView(props: {
    t: T;
    file: RunFileResponse;
    /** 资源里写的路径（按扩展名定排成表、展开 JSON、折行）。 */
    path: string;
    display: Display;
    interactive: boolean;
    image?: ImageSource;
    /** 写它的步骤正在跑：日志停在末尾跟着往下走。 */
    writing: boolean;
    table?: TableEnv | undefined;
}): React.JSX.Element;
