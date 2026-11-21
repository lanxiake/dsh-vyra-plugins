/**
 * dsh-workflow-lite — 计划编译器的文字小工具：引用一个值、多行文字逐行引用。
 *
 * @module @xiaoso/dsh-workflow-lite/shared/compile/format
 */
/** 计划里引用一个值：统一加反引号。 */
export declare function code(text: string): string;
/** 多行文字逐行引用（`indent` + `> `），空行只留 `>`。 */
export declare function quoteLines(text: string, indent: string): string[];
