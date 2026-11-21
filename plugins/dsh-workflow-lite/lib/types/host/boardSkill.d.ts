/**
 * dsh-workflow-lite — 按需 skill `workflow-board`：怎么写一张在画布上展示的看板（HTML）。
 *
 * 只给看板用：资源卡开了画布展示、展示的是 HTML、开着「让模型适配展示」时，编译器在写它的步骤的任务描述里
 * 点名这个 skill（见 shared/dialect.ts 的 `dshDisplayLine`）；图片、Markdown、文本卡不读。
 * 任务描述里有这张卡的尺寸和几条硬要求，这里放做法和一份能直接改的模板：同一个文件在画布卡片、
 * 插件的查看框、浏览器里都要好看，颜色跟着画布主题走（约定见 shared/board.ts）。
 *
 * 模板里的后备值是默认两套主题（晴白、石板）的实值，`tests/host/boardSkill.spec.ts` 对着
 * client/model/boardTheme.ts 查，改主题色时一起改。
 *
 * @module @xiaoso/dsh-workflow-lite/host/boardSkill
 */
import type { Context } from '@deepseek-ai/cordis';
import { type BoardToken } from '../shared/board.ts';
/** 浏览器里单独打开时的后备值：亮色 = 晴白，暗色 = 石板。 */
export declare const BOARD_FALLBACK: Record<'light' | 'dark', Record<BoardToken, string>>;
/**
 * 卡片版的字号（画布像素）：标题 = 步骤卡片的标题（`--wl-fs-body`），正文、标签 = 步骤卡片的说明（`--wl-fs-meta`），
 * 指标值大一档。`tests/host/boardSkill.spec.ts` 对着 `shell.module.css` 查，改画布字号时一起改。
 */
export declare const BOARD_CARD_FONT: {
    readonly title: 13;
    readonly body: 12;
    readonly value: 15;
};
export declare function registerBoardSkill(ctx: Context): () => void;
/** 测试与演示用：skill 正文、模板、模板的样式和脚本。 */
export declare const BOARD_SKILL_CONTENT: string;
export declare const BOARD_TEMPLATE: string;
export declare const BOARD_STYLE: string;
export declare const BOARD_SCRIPT: string;
