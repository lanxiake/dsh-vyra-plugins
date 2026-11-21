/**
 * dsh-workflow-lite — 命名约束。
 *
 * 图名、模板名与 `node.id` **共用同一套文件名约束**（这三样都要落成文件名：
 * `workflows/<图名>.json`、`templates/**\/<名>.json`、`.dispatch/<图名>/<planId>/<id>.md`）。
 * `label` **不在**这套里——它不是文件名，只受"不得含换行或 `|`"一条。
 *
 * 写成**禁止集**而不是允许集：规则是"不许有什么"，所以中文名天然可用（`修复认证` 合法）。
 *
 * 纯函数，不碰磁盘、不 import DSH 包。
 * @module @xiaoso/dsh-workflow-lite/shared/naming
 */
import type { ValidationCode } from './types.ts';
/** 一条命名/取值问题：`code` 给机器，`message` 给人。 */
export interface NameProblem {
    code: ValidationCode;
    message: string;
}
/** 码点数（不是 UTF-16 长度——emoji 与增补平面字符按 1 个数）。 */
export declare function codepointLength(value: string): number;
/**
 * 归一：trim 尾部空白与尾随 `.`（Windows 会静默吞掉尾点），再统一 NFC。
 * **比较与落盘都走这一步。**
 */
export declare function normalizeName(raw: string): string;
/** 只做归一，不做校验——给"用户输入 → 待校验名字"这一步用。 */
export declare function normalizeWhen(raw: string): string;
/**
 * 校验一个名字（图名 / 模板名 / `node.id`）。
 * @returns `null` = 合法；否则是一条问题。
 */
export declare function checkName(raw: string): NameProblem | null;
/**
 * 校验 `when` 的值（条件出边的判据）。
 *
 * 两种都合法：短的判定词（`pass` / `fail` / `retry`，走 `VERDICT:` 约定），或者一句自然语言条件
 * （"测试全绿且没有新增警告"）。只拦三样：空串（要无条件边就整条不写 `when`）、换行与控制字符
 * （条件要能写进计划里的一句话）、超长。
 */
export declare function checkWhen(raw: string): NameProblem | null;
/**
 * 这个条件是不是判定词：一个短的英文标识（≤ {@link MAX_VERDICT_CODEPOINTS} 个字符，只含字母、
 * 数字、`-`、`_`），如 `pass` / `fail` / `needs-review`。
 *
 * 判定词由上游在回复末行写 `VERDICT: <值>` 来选路；其余（包括"用户确认了方案"这类中文短句）
 * 都按自然语言条件处理：由执行者读了上游产出之后自己判断成立与否——计划里两种的写法不同。
 */
export declare function isVerdictWhen(value: string): boolean;
/** 校验节点描述 / 产出规则这类自由文本：只防病态长度。 */
export declare function checkText(raw: string, what: string): NameProblem | null;
/** 校验 `label`：只禁换行与竖线 `|`（它们会打断计划里的 markdown 表格）。 */
export declare function checkLabel(raw: string): NameProblem | null;
/**
 * 校验 `output`：相对工作区根的路径，允许子路径，**禁止绝对路径与 `..`**。
 * `false`（显式不产出）与缺省都合法，由调用方先分流。
 */
export declare function checkOutput(raw: string): NameProblem | null;
/** 大小写不敏感的撞名比较（Windows 落盘不区分大小写，而这三样都是文件名）。 */
export declare function sameName(a: string, b: string): boolean;
