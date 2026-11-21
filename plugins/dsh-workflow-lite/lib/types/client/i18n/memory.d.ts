/**
 * dsh-workflow-lite — 记忆文案：记忆节点与记忆库。
 *
 * 记忆节点的属性面板、记忆的选择与新建，以及记忆内容的查看。
 *
 * @module @xiaoso/dsh-workflow-lite/client/i18n/memory
 */
/** 中文（默认）。 */
export declare const zh: {
    readonly 'preset.title': "颜色与类型";
    readonly 'preset.type': "类型";
    readonly 'preset.change': "换颜色与类型";
    readonly 'preset.noneDesc': "文件、网址、Skill 等，按连线读写";
    readonly 'preset.memoryDesc': "引用记忆库里的一条：跨多次执行沉淀做法的一份 skill";
    readonly 'preset.refused.memoryItems': "只有空的资源卡能换成记忆（记忆引用记忆库里的一条）";
    readonly 'preset.refused.memoryRef': "先选一条记忆";
    readonly 'preset.none': "资源";
    readonly 'preset.memory': "记忆";
    readonly 'mem.title': "记忆";
    readonly 'mem.type.workflow': "工作流记忆";
    readonly 'mem.type.step': "步骤记忆";
    readonly 'mem.tag.workflow': "全局";
    readonly 'mem.tag.step': "步骤";
    readonly 'mem.libLabel': "记忆库";
    readonly 'mem.name': "记忆名称";
    readonly 'mem.descPlaceholder': "这条记忆攒的是什么（在记忆库里，用到它的地方都看得到）";
    readonly 'mem.usedBy': "{n} 个工作流在用";
    readonly 'mem.unused': "没被用";
    readonly 'mem.alsoUsed': "另有 {n} 个工作流在用，改动对它们都生效";
    readonly 'mem.onlyHere': "只有这个工作流在用";
    readonly 'mem.missing': "记忆库里没有这一条（删掉了？）：换一条或新建一条；不换的话，执行时从空的开始攒。";
    readonly 'mem.rebind': "换一条";
    readonly 'mem.relink': "换一条或新建";
    readonly 'mem.pick.step': "给这一步加记忆";
    readonly 'mem.pick.workflow': "加工作流记忆";
    readonly 'mem.pick.newStep': "新建一条步骤记忆";
    readonly 'mem.pick.newWorkflow': "新建一条工作流记忆";
    readonly 'mem.createFailed': "新建记忆失败：{error}";
    readonly 'mem.on': "开启记忆：这一步把摸清的做法写成一份 skill，下次执行照着做";
    readonly 'mem.off': "关闭记忆（记忆库里那条留着）";
    readonly 'mem.prompt': "记忆说明";
    readonly 'mem.promptPlaceholder': "怎么读、什么时候改、SKILL.md 写成什么样（空着就用默认的）";
    readonly 'mem.hint': "附在这一步的任务描述里，执行者照它读、改这份 skill。";
    readonly 'mem.globalHint': "每一步都读、只读不改，把通用的经验写在回复里；整个工作流结束时，主 agent 照它整理进去。";
    readonly 'mem.dir': "记忆目录";
    readonly 'mem.view': "查看";
    readonly 'mem.statFiles': "文件";
    readonly 'mem.statSize': "大小";
    readonly 'mem.statUpdated': "最近修改";
    readonly 'hub.memRenameTip': "点一下改名";
    readonly 'hub.memUnusedHint': "还没有工作流用到它：在编辑页给步骤开记忆、或加工作流记忆时选它。";
    readonly 'mem.files': "{n} 个文件";
    readonly 'mem.viewEmpty': "还没有内容：第一次跑通、攒下做法之后会写在这里。";
    readonly 'mem.dirHint': "一份 skill，放在插件的记忆库里：SKILL.md 写做法，scripts/、templates/、references/ 放配套的东西。每次执行读写的都是同一份，别的工作流也能选用。";
};
/** 英文。键与 `zh` 同构，少一个键或多一个键都过不了类型检查。 */
export declare const en: Record<keyof typeof zh, string>;
