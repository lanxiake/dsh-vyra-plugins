/**
 * dsh-workflow-lite — 运行状态编辑文案：修改、保存、冲突与草稿。
 *
 * 在实例面板里改状态、与磁盘上的状态文件冲突时的处理，以及未执行时的草稿。
 *
 * @module @xiaoso/dsh-workflow-lite/client/i18n/runState
 */
/** 中文（默认）。 */
export declare const zh: {
    readonly 'run.rerun': "重跑这一步（连同下游）";
    readonly 'run.pickVerdict': "这一步有条件出边，选一个判定：";
    readonly 'run.fileMade': "已生成";
    readonly 'run.stateMissing': "状态文件不在了";
    readonly 'run.untracked': "不记进度";
    readonly 'run.untrackedBanner': "这张图没开「记录运行状态」，这里只显示执行时的图，看不到进度。要记进度，到工作流设置里打开它，下次执行生效。";
    readonly 'run.stateInvalid': "状态文件有误";
    readonly 'run.stateInvalidLong': "状态文件格式有误，画布保留上一次合法的样子";
    readonly 'run.loadError': "读不到这个实例";
    readonly 'run.overwritten': "你的修改可能被模型覆盖了";
    readonly 'run.changes': "改动";
    readonly 'run.changed': "已改 {n} 处";
    readonly 'run.empty': "（空）";
    readonly 'run.conflict': "模型也改了";
    readonly 'run.conflictMine': "你的";
    readonly 'run.conflictDisk': "文件里";
    readonly 'run.keepMine': "用我的";
    readonly 'run.useDisk': "用文件里的";
    readonly 'run.undoChange': "撤回这处改动";
    readonly 'run.notePrompt': "给模型的说明（可选）";
    readonly 'run.discard': "放弃";
    readonly 'run.discardConfirm': "放弃这些改动？";
    readonly 'run.discardDesc': "这次攒的改动全部撤回，不能恢复。";
    readonly 'run.resolveFirst': "先处理冲突";
    readonly 'run.save': "保存";
    readonly 'run.notify': "通知模型";
    readonly 'run.notifyTip': "开着：保存后把改动发给模型，让它按新的接着做。\n关掉：只保存，不打扰模型；它下次读状态文件或重新拿计划时才会看到。";
    readonly 'run.savedSilent': "已保存，没有通知模型";
    readonly 'run.savedNotified': "已保存，模型收到了这次改动";
    readonly 'run.savedPending': "已保存；会话现在没在运行，模型下次活动时会收到这次改动";
    readonly 'run.saveConflict': "有字段在你改的同时被模型改了，先处理冲突再保存";
    readonly 'run.savedQuiet': "已保存（只改了布局或描述，不用告诉模型）";
    readonly 'run.freshStep': "新加的步骤，保存之后开始记它的状态";
    readonly 'run.lockedStep': "执行过的步骤不能删，不再做它就改成「跳过」";
    readonly 'run.graphProblem': "图里有问题：{p}";
    readonly 'run.stateMismatch': "改完的状态和图对不上：{p}";
    readonly 'run.tab.label': "右栏内容";
    readonly 'run.tab.run': "运行";
    readonly 'run.tab.edit': "编辑";
    readonly 'draft.layout': "布局";
    readonly 'draft.moved': "挪动了 {n} 张卡片";
    readonly 'draft.removed': "删掉了";
    readonly 'draft.changedFields': "改了{fields}";
    readonly 'draft.added.step': "新加的步骤";
    readonly 'draft.added.resource': "新加的资源";
    readonly 'draft.added.input': "新加的输入";
    readonly 'draft.added.edge': "新加的连线";
    readonly 'draft.field.label': "名称";
    readonly 'draft.field.description': "描述";
    readonly 'draft.field.look': "图标与颜色";
    readonly 'draft.field.prompt': "提示词";
    readonly 'draft.field.items': "内容";
    readonly 'draft.field.question': "问题";
    readonly 'draft.field.kind': "题型";
    readonly 'draft.field.options': "选项";
    readonly 'draft.field.default': "默认值";
    readonly 'draft.field.placeholder': "占位";
    readonly 'draft.field.hint': "说明";
    readonly 'draft.field.required': "必填";
    readonly 'draft.field.when': "条件";
    readonly 'draft.field.handoff': "交接";
    readonly 'draft.field.update': "写入方式";
    readonly 'run.freshBanner': "模型刚在这个会话里开始执行一个工作流";
    readonly 'run.freshOpen': "查看实例";
};
/** 英文。键与 `zh` 同构，少一个键或多一个键都过不了类型检查。 */
export declare const en: Record<keyof typeof zh, string>;
