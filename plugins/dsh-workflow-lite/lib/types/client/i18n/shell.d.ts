/**
 * dsh-workflow-lite — 外壳文案：工作流切换、版本、保存状态、工具条与「执行」入口。
 *
 * 画布顶部那一排：切换 / 新建 / 重命名工作流，版本对话框，保存状态，撤销重做等工具，以及执行位置的选择。
 *
 * @module @xiaoso/dsh-workflow-lite/client/i18n/shell
 */
/** 中文（默认）。 */
export declare const zh: {
    readonly 'wf.pick': "选择工作流";
    readonly 'wf.search': "搜索工作流或实例";
    readonly 'wf.none': "没有匹配的工作流或实例";
    readonly 'wf.new': "新建空白工作流";
    readonly 'wf.defaultName': "新工作流";
    readonly 'wf.rename': "重命名";
    readonly 'wf.renameHint': "回车确认，Esc 取消";
    readonly 'wf.delete': "删除工作流";
    readonly 'wf.deleteConfirm': "删除后不可恢复";
    readonly 'wf.deleteVersions': "它的 {n} 个版本一起删掉，不可恢复";
    readonly 'wf.deleteOpen': "编辑页正开着它，删掉后编辑页会空出来。";
    readonly 'wf.deleteTitle': "删除工作流「{name}」？";
    readonly 'wf.reload': "从磁盘重新加载";
    readonly 'wf.reloaded': "已重新加载";
    readonly 'ver.title': "版本";
    readonly 'ver.pending': "现在的内容还没存成版本";
    readonly 'ver.notePlaceholder': "这一版改了什么（可选）";
    readonly 'ver.save': "存为版本";
    readonly 'ver.sameAs': "现在的内容就是 v{n}";
    readonly 'ver.unsaved': "现在的内容还没存成版本";
    readonly 'ver.empty': "还没有版本";
    readonly 'ver.emptyText': "把满意的样子存一版，之后改坏了能切回来。";
    readonly 'ver.current': "当前";
    readonly 'ver.noNote': "没写说明";
    readonly 'ver.autoNote': "切到 v{n} 前自动存的";
    readonly 'ver.steps': "{n} 个步骤";
    readonly 'ver.restore': "切换到这一版";
    readonly 'ver.restoreTitle': "切换到 v{n}？";
    readonly 'ver.restoreSafe': "现在的内容已存为 v{n}，随时能切回来。";
    readonly 'ver.restoreAuto': "现在的内容还没存成版本，切换前会自动存一份。";
    readonly 'ver.restoreConfirm': "切换";
    readonly 'ver.editNote': "编辑说明";
    readonly 'ver.delete': "删除";
    readonly 'ver.deleteTitle': "删除 v{n}？";
    readonly 'ver.saved': "已存为 v{n}";
    readonly 'ver.restored': "已切换到 v{n}";
    readonly 'ver.restoredAuto': "已切换到 v{n}，原来的内容存为 v{m}";
    readonly 'ver.deleted': "已删除 v{n}";
    readonly 'ver.diffTitle': "切到这一版会";
    readonly 'ver.diffNone': "和现在的内容一样";
    readonly 'ver.diffSettings': "工作流设置不同";
    readonly 'ver.diffLoading': "正在比对…";
    readonly 'ver.invalid': "文件坏了，读不出来";
    readonly 'ver.count': "{n} 个版本";
    readonly 'ver.flushFailed': "还有改动没存下去，先处理顶栏的保存问题";
    readonly 'ver.withMem': "连同 {n} 条记忆";
    readonly 'ver.withMemTip': "每条记忆也各存一版，说明相同；内容没变的不存";
    readonly 'ver.sameKept': "工作流和 v{n} 一样，没另存";
    readonly 'ver.memSaved': "记忆存了 {n} 条";
    readonly 'ver.memSame': "{n} 条没变";
    readonly 'ver.memFailed': "{n} 条没存成";
    readonly 'ver.memJoin': "；";
    readonly 'ver.areaWorkflow': "工作流";
    readonly 'ver.areaMemory': "记忆";
    readonly 'ver.memEmptyText': "攒到满意的样子存一版，之后攒坏了能切回来。";
    readonly 'ver.memRestoreNote': "正在跑的实例之后读写的就是切回来的内容。";
    readonly 'wf.steps': "个步骤";
    readonly 'wf.broken': "文件有问题";
    readonly 'status.loading': "加载中";
    readonly 'status.saving': "保存中";
    readonly 'status.saved': "已保存";
    readonly 'status.dirty': "待保存";
    readonly 'status.error': "保存失败";
    readonly 'tool.undo': "撤销";
    readonly 'tool.redo': "重做";
    readonly 'tool.tidy': "整理布局";
    readonly 'tool.fit': "看全图";
    readonly 'tool.zoomIn': "放大";
    readonly 'tool.zoomOut': "缩小";
    readonly 'tool.keys': "快捷键";
    readonly 'tool.preview': "预览计划";
    readonly 'launch.run': "执行";
    readonly 'launch.runHere': "在本会话执行";
    readonly 'launch.runNew': "新建会话执行";
    readonly 'launch.newSession': "新建会话";
    readonly 'launch.default': "默认";
    readonly 'launch.pick': "选一个会话执行";
    readonly 'launch.search': "搜索本工作区的会话";
    readonly 'launch.none': "本工作区没有别的会话";
    readonly 'launch.here': "本会话";
    readonly 'launch.running': "运行中";
    readonly 'launch.noBridge': "这里连不上会话，执行不了";
    readonly 'launch.noSession': "先打开一个会话再执行";
    readonly 'launch.conflict': "先处理顶部的冲突再执行";
    readonly 'launch.fixFirst': "先修好检查里的错误再执行";
    readonly 'launch.unsaved': "图还没存好";
    readonly 'launch.sent': "已在「{title}」开始执行";
    readonly 'launch.failed': "没能执行";
    readonly 'tool.library': "步骤库";
    readonly 'tool.settings': "工作流设置";
};
/** 英文。键与 `zh` 同构，少一个键或多一个键都过不了类型检查。 */
export declare const en: Record<keyof typeof zh, string>;
