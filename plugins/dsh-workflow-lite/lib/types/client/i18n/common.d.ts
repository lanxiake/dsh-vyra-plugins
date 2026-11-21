/**
 * dsh-workflow-lite — 通用文案：标签页名、通用按钮、通用错误。
 *
 * 各功能都会用到的几句，放在这里；只属于某个功能的文案去对应的文件。
 *
 * @module @xiaoso/dsh-workflow-lite/client/i18n/common
 */
/** 中文（默认）。 */
export declare const zh: {
    readonly 'tab.label': "工作流";
    readonly 'common.cancel': "取消";
    readonly 'common.confirm': "确认";
    readonly 'common.close': "关闭";
    readonly 'common.copy': "复制";
    readonly 'common.copied': "已复制";
    readonly 'common.delete': "删除";
    readonly 'common.retry': "重试";
    readonly 'error.generic': "操作失败";
    readonly 'error.viewCrashed': "工作流视图出错了";
    readonly 'error.viewCrashedBody': "已保存的工作流和实例不受影响；点「重试」重新打开这个视图。";
};
/** 英文。键与 `zh` 同构，少一个键或多一个键都过不了类型检查。 */
export declare const en: Record<keyof typeof zh, string>;
