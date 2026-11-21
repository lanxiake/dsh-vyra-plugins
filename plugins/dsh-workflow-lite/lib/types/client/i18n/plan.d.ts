/**
 * dsh-workflow-lite — 计划预览、提示条与快捷键文案。
 *
 * 计划预览对话框、画布上方的提示条，以及快捷键说明。
 *
 * @module @xiaoso/dsh-workflow-lite/client/i18n/plan
 */
/** 中文（默认）。 */
export declare const zh: {
    readonly 'plan.title': "派发计划";
    readonly 'plan.forModel': "给模型";
    readonly 'plan.forHuman': "给人看";
    readonly 'plan.forModelHint': "和执行时模型拿到的一样：提示词以任务描述路径引用，执行到哪一步才去读哪一份；{instance} 执行时换成新建实例的 id。";
    readonly 'plan.forHumanHint': "提示词全部内联，适合通读、存档或贴给别人。";
    readonly 'plan.download': "下载";
    readonly 'plan.rendered': "预览";
    readonly 'plan.source': "源码";
    readonly 'plan.loading': "正在生成…";
    readonly 'plan.blocked': "还有问题没修完，计划暂时生成不了。";
    readonly 'banner.external': "这个文件在别处被改过。";
    readonly 'banner.synced': "已同步磁盘上的更新";
    readonly 'banner.reload': "重新加载";
    readonly 'banner.conflict': "磁盘上的版本和你的改动有冲突";
    readonly 'banner.keepMine': "保留我的";
    readonly 'banner.useDisk': "用磁盘的";
    readonly 'broken.title': "这个工作流文件打不开";
    readonly 'broken.body': "文件里有格式问题，画布不会写入它。修好文件后重新加载。";
    readonly 'keys.title': "快捷键";
    readonly 'keys.add': "添加步骤";
    readonly 'keys.addCombo': "右键点空白处";
    readonly 'keys.undo': "撤销";
    readonly 'keys.redo': "重做";
    readonly 'keys.duplicate': "复制选中的步骤";
    readonly 'keys.delete': "删除选中项";
    readonly 'keys.deselect': "取消选中";
    readonly 'keys.fit': "看全图";
    readonly 'keys.tidy': "整理布局";
};
/** 英文。键与 `zh` 同构，少一个键或多一个键都过不了类型检查。 */
export declare const en: Record<keyof typeof zh, string>;
