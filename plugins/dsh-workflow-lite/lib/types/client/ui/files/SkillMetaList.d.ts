/**
 * dsh-workflow-lite — SKILL.md 头部的元数据块：`name`、`description` 等字段排成几项，每项一个色点 + 字段名，下面是值。
 *
 * 看一个 skill 的 SKILL.md（{@link SkillPreview}）和浏览 skill 包时看 SKILL.md（{@link FolderBrowser}）都用它。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/files/SkillMetaList
 */
import type { T } from '../../i18n.ts';
/** 一个头部值怎么显示：字符串原样，数字、布尔转文字，一串简单值用顿号连起来，其余（对象、嵌套列表）压成一行 JSON。 */
export declare function metaText(value: unknown): string;
/**
 * 一份 Markdown 的 YAML 头部（解析好的键值）排成元数据的几项：`name`、`description`、`whenToUse` 在前、
 * 带中文名，其余按原顺序接在后面。浏览 skill 包时看 SKILL.md 用。
 */
export declare function headFields(t: T, head: Readonly<Record<string, unknown>>): {
    key: string;
    label?: string;
    value: string;
}[];
/** 元数据那一块：给好的几项（值是空的不显示），导出成 skill 时预览 SKILL.md 也用它。 */
export declare function SkillMetaList(props: {
    t: T;
    fields: readonly {
        key: string;
        label?: string;
        value: string;
    }[];
    /** 标题旁的小字（缺省「SKILL.md 头部读到的字段」）。 */
    hint?: string;
}): React.JSX.Element;
