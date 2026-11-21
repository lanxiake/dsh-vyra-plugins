/**
 * dsh-workflow-lite — 看一份文档的模态框（产出文件、SKILL.md 共用）。
 *
 * 标题行：图标、名字、一行元信息，右边「预览 / 源码」（Markdown、HTML、CSV、压成一行的 JSON 才有）、复制路径、
 * 用其他程序打开（含在文件管理器中显示）、关闭。正文：Markdown 默认排版，HTML 默认在沙箱框里渲染
 * （能跑脚本，但是独立的源：碰不到画布、拿不到登录态），CSV / TSV 排成表，压成一行的 JSON 展开缩进，
 * 其余原样；读不了的只说明原因。
 * 有说明（`note`）时标题行多一个「说明」开关，点开从右边滑出一栏，不占正文的地方。
 * 调用方可以在正文前插一段（`lead`），在底部放操作条（`footer`）。
 * 给了 `edit` 就多一个「编辑」：整块文字在这里改（提示词、摘要这类大段文字都在弹窗里改）。
 * 调用方还能在标题行加按钮（`tools`），在正文右边放一栏（`side`：产出的各轮版本），框子大小不变、正文让出位置。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/files/DocViewer
 */
import type { Desktop } from '../../app/desktop.ts';
import type { T } from '../../i18n.ts';
import { type IconName } from '../kit/Icon.tsx';
import { type ImageSource } from './Markdown.tsx';
/** 弹窗里能改的那段文字怎么交出去。 */
export interface DocEdit {
    onChange(text: string): void;
    placeholder?: string;
    maxLength?: number;
    testId?: string;
    /** 一打开就在「编辑」。 */
    start?: boolean;
}
/**
 * 文字按什么格式看：Markdown、HTML、CSV / TSV（排成表）、压成一行的 JSON（展开缩进）有两个视图，其余原样。
 */
export type DocFormat = 'plain' | 'markdown' | 'html' | 'csv' | 'tsv' | 'json';
/** 正文是什么：还在读、读不了（说明原因）、读到了一段文字（JSON 的话 `pretty` 是展开的那份）。 */
export type DocBody = {
    kind: 'loading';
} | {
    kind: 'state';
    icon: IconName;
    text: string;
} | {
    kind: 'text';
    text: string;
    format: DocFormat;
    pretty?: string;
}
/** 调用方自己画的正文（文件夹里有什么、网址的说明）。 */
 | {
    kind: 'node';
    node: React.ReactNode;
};
/** 复制按钮：点一下复制 `text`，图标换成对勾停一会儿。`text` 为 `null` 时禁用。 */
export declare function CopyButton(props: {
    t: T;
    text: string | null;
    /** 悬停提示与无障碍名（缺省「复制路径」）。 */
    label?: string | undefined;
}): React.JSX.Element;
/** 正文是哪种格式：除了 `plain` 都有两个视图（{@link renderedLabel} / 源码），`plain` 原样。 */
export declare function docFormat(body: DocBody): DocFormat;
/** 排过的那个视图叫什么：表格、格式化、预览。 */
export declare function renderedLabel(t: T, format: DocFormat): string;
/** 标题行里的小警告：预览里有图片没加载出来时淡入，悬停说明原因和办法。 */
export declare function BrokenImagesHint(props: {
    t: T;
    count: number;
}): React.JSX.Element | null;
/**
 * 正文区里的那块内容：读取中的骨架、读不了的原因、预览 / 源码。
 * 查看框（{@link DocViewer}）和文件夹浏览（右边预览一份文件）共用。
 */
export declare function DocContent(props: {
    t: T;
    body: DocBody;
    /** 有两个视图的格式（Markdown、HTML、表格、JSON）按它显示；别的格式不看它。 */
    view: 'rendered' | 'source';
    /** iframe 的标题。 */
    name: string;
    image?: ImageSource | undefined;
    /** HTML 预览里加载失败的图片数变了（换了视图、换了文件回 0）。 */
    onBroken?: ((count: number) => void) | undefined;
}): React.JSX.Element;
export declare function DocViewer(props: {
    t: T;
    /** 标题（也是对话框的无障碍名）。 */
    name: string;
    /** 标题左边的图标块。 */
    badge: React.ReactNode;
    /** 标题下面的一行（路径、大小……）。 */
    meta: React.ReactNode;
    body: DocBody;
    /** 「复制路径」复制什么；`null` 时按钮禁用。 */
    copyPath: string | null;
    /** 复制按钮的说明（缺省「复制路径」：网址、自定义文字复制的不是路径）。 */
    copyLabel?: string;
    /** 「用其他程序打开」打开什么；`null`（文件还不在、没有文件）时不出现。 */
    openPath: string | null;
    desktop: Desktop | undefined;
    testId: string;
    lead?: React.ReactNode;
    /** 这一项的说明（产出文件的生成要求、步骤的描述）：收在标题行的「说明」开关里。 */
    note?: string;
    footer?: React.ReactNode;
    className?: string;
    /** 能改：正文就是这段文字，「编辑」里改了直接交出去。 */
    edit?: DocEdit;
    /** Markdown 里相对路径的图片怎么读（文件查看框按文档所在目录读）；不给就只显示替代文字。 */
    image?: ImageSource;
    /** 标题行里「说明」前面多放的按钮。 */
    tools?: React.ReactNode;
    /** 正文右边的一栏（不盖住正文）。 */
    side?: React.ReactNode;
    /** 打开就停在正文末尾（日志：要看的多半是最后几行）。 */
    startAtEnd?: boolean;
    onClose(): void;
}): React.JSX.Element;
