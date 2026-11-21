/**
 * dsh-workflow-lite — 剪贴板。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/kit/clipboard
 */
/** 把一段文字写进剪贴板；环境不允许就安静地失败。 */
export declare function copyText(text: string): Promise<boolean>;
