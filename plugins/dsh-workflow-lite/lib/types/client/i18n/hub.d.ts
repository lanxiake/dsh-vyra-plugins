/**
 * dsh-workflow-lite — 工作流中心文案：导航、记忆、工作流页、实例与存储。
 *
 * 工作流中心的框架、「记忆」页、「工作流」页的列表，以及「实例」「存储」页。
 *
 * @module @xiaoso/dsh-workflow-lite/client/i18n/hub
 */
/** 中文（默认）。 */
export declare const zh: {
    readonly 'hub.title': "工作流中心";
    readonly 'hub.sub': "所有会话的实例、全部工作流的版本与本机数据";
    readonly 'hub.runs': "运行实例";
    readonly 'hub.storage': "存储";
    readonly 'hub.settings': "设置";
    readonly 'hub.memories': "记忆";
    readonly 'hub.memSearch': "搜索记忆名称、说明、类型";
    readonly 'hub.memNoMatch': "没有符合条件的记忆";
    readonly 'hub.memEmpty': "记忆库里还没有记忆";
    readonly 'hub.memEmptyHint': "在编辑页给步骤开记忆，或加一张工作流记忆，就会出现在这里。";
    readonly 'hub.memInvalid': "记录坏了，读不出来";
    readonly 'hub.memDeleted': "已删除记忆 {name}";
    readonly 'hub.memDeleteTitle': "删除记忆 {name}？";
    readonly 'hub.memDeleteUsed': "{n} 个工作流在用它，删掉后那里的记忆卡会提示库里没有这一条。";
    readonly 'hub.memInfo': "信息";
    readonly 'hub.memUsedBy': "在用的工作流";
    readonly 'hub.wfPage': "工作流";
    readonly 'hub.wfOpen': "打开";
    readonly 'hub.wfOpenTip': "在编辑页打开这个工作流";
    readonly 'hub.wfEditing': "正在编辑";
    readonly 'hub.wfSearch': "搜索工作流";
    readonly 'hub.wfNoMatch': "没有符合条件的工作流";
    readonly 'hub.wfEmpty': "还没有工作流";
    readonly 'hub.search': "搜索工作流、会话、目标";
    readonly 'hub.clearSearch': "清空搜索";
    readonly 'hub.noWorkspace': "未记录工作区";
    readonly 'hub.here': "本工作区";
    readonly 'hub.workspaces': "工作区";
    readonly 'hub.runCount': "{n} 个实例";
    readonly 'hub.active': "{n} 个进行中";
    readonly 'hub.setStatus': "改整体状态";
    readonly 'hub.setStatusTitle': "把实例状态改成「{to}」？";
    readonly 'hub.setStatusDesc': "现在是「{from}」，各步骤不变。";
    readonly 'hub.setStatusConfirm': "改状态";
    readonly 'hub.statusConflict': "模型刚改过这个实例的状态，列表已刷新，再选一次";
    readonly 'hub.loading': "正在读取…";
    readonly 'hub.noRunsTitle': "还没有工作流实例";
    readonly 'hub.noRuns': "在画布上点「执行」就会建一个；开了「记录运行状态」的工作流，模型编译时也会建。";
    readonly 'hub.noMatch': "没有符合条件的实例";
    readonly 'hub.thisSession': "本会话";
    readonly 'hub.otherSession': "其他会话";
    readonly 'hub.sessionGone': "会话已不在";
    readonly 'hub.noSession': "不属于任何会话";
    readonly 'hub.current': "当前";
    readonly 'hub.view': "查看";
    readonly 'hub.why': "点开看原因";
    readonly 'hub.missingAt': "这个位置找不到状态文件：";
    readonly 'hub.invalidHead': "状态文件里这些地方不对：";
    readonly 'hub.invalidMore': "打开实例能看到全部问题";
    readonly 'hub.move': "移到本会话";
    readonly 'hub.moveHint': "一个实例只属于一个会话：移过来之后，原会话下就没有它了";
    readonly 'hub.deleteConfirm': "删掉这条实例记录和它的图快照？";
    readonly 'hub.deleteState': "连工作区里的状态文件一起删";
    readonly 'hub.dataDir': "数据目录";
    readonly 'hub.dataDirDesc': "工作流、我的步骤与实例记录都存在这里";
    readonly 'hub.copyPath': "复制路径";
    readonly 'hub.usage': "占用";
    readonly 'hub.workflows': "工作流";
    readonly 'hub.templates': "我的步骤";
    readonly 'hub.versions': "工作流版本";
    readonly 'hub.versionsDesc': "每个工作流存下的版本；删掉工作流时一起删。";
    readonly 'hub.memoriesDesc': "记忆库里的每一条和它们的版本；删掉工作流时不删，在「记忆」页删。";
    readonly 'hub.instances': "工作流实例";
    readonly 'hub.instancesDesc': "实例记录与图快照；状态文件、任务描述和产出在各工作区的 .workflow-lite/ 里，不算在内";
    readonly 'hub.count': "{n} 个";
    readonly 'hub.files': "{n} 个文件";
    readonly 'hub.finished': "其中 {n} 个已结束";
    readonly 'hub.clearFinished': "清理已结束的";
    readonly 'hub.clearFinishedConfirm': "清理 {n} 个";
    readonly 'hub.clearFinishedTitle': "清理 {n} 个已结束的实例？";
    readonly 'hub.clearFinishedHint': "删掉已完成、已取消的实例记录与快照；工作区里的状态文件不动";
    readonly 'hub.legacy': "旧版本遗留文件";
    readonly 'hub.legacyDesc': "早先版本编译时写在 .dispatch/ 里的任务描述，现在已经不用了，可以放心删除";
    readonly 'hub.clearLegacy': "删除";
    readonly 'hub.clearedFinished': "清理了 {n} 个已结束的实例";
    readonly 'hub.clearedLegacy': "删除了 {n} 个旧版本遗留文件";
    readonly 'hub.history': "产出的各轮版本";
    readonly 'hub.historyDesc': "循环执行时每一轮存下的产出，在画布卡片和查看框里回看；删掉实例时一起删";
    readonly 'hub.clearHistory': "清空";
    readonly 'hub.clearHistoryTitle': "清空各轮版本？";
    readonly 'hub.clearHistoryHint': "删掉所有实例存下的旧版本；现在的产出文件不动";
    readonly 'hub.clearHistoryConfirm': "清空";
    readonly 'hub.clearedHistory': "删除了 {n} 个版本文件";
};
/** 英文。键与 `zh` 同构，少一个键或多一个键都过不了类型检查。 */
export declare const en: Record<keyof typeof zh, string>;
