/**
 * dsh-workflow-lite — 画布文案：空画布、快捷添加、步骤卡与线条图例。
 *
 * 画布本身的提示与步骤卡上的操作，快捷添加菜单，以及线条图例和连线提示。
 *
 * @module @xiaoso/dsh-workflow-lite/client/i18n/canvas
 */
/** 中文（默认）。 */
export declare const zh: {
    readonly 'welcome.title': "用步骤搭一条工作流";
    readonly 'welcome.body': "每个步骤是一段交给 AI 执行的提示词，连线决定先后、分支与循环。";
    readonly 'canvas.emptyTitle': "从第一个步骤开始";
    readonly 'canvas.emptyBody': "把左侧的步骤拖进来，或者右键点空白处。";
    readonly 'canvas.starter': "插入示例流程";
    readonly 'quick.title': "添加步骤";
    readonly 'quick.output': "产出文件";
    readonly 'quick.outputDesc': "这一步写的文件，放在一张资源卡里";
    readonly 'quick.resource': "资源";
    readonly 'quick.resourceDesc': "一张空的资源卡：文件、网址、Skill…";
    readonly 'quick.input': "用户输入";
    readonly 'quick.inputDesc': "执行前问用户，回答交给这一步";
    readonly 'quick.looseInput': "用户输入";
    readonly 'quick.looseInputDesc': "执行前问用户一个问题";
    readonly 'quick.memory': "记忆";
    readonly 'quick.memoryDesc': "这一步的经验，下次先读";
    readonly 'quick.globalMemory': "全局记忆";
    readonly 'quick.globalMemoryDesc': "每一步都读的共用经验";
    readonly 'node.noPrompt': "还没写提示词";
    readonly 'node.noFile': "不产出文件";
    readonly 'node.add': "添加下一步";
    readonly 'node.duplicate': "复制";
    readonly 'node.delete': "删除步骤";
    readonly 'node.copySuffix': "副本";
    readonly 'node.copied': "已复制「{name}」，已选中新的副本";
    readonly 'node.removed': "已删除「{name}」，Ctrl+Z 可撤销";
    readonly 'node.saveTemplate': "存为我的步骤";
    readonly 'legend.title': "线条图例";
    readonly 'legend.short': "图例";
    readonly 'legend.groupFlow': "步骤 → 步骤（按条件）";
    readonly 'legend.groupFile': "步骤 ↔ 资源 / 输入";
    readonly 'legend.portsTip': "连接点：空心圈是入口，线从这里进来；实心点是出口，从这里拖出去连线。";
    readonly 'legend.flow': "流程";
    readonly 'legend.alwaysTip': "上一步做完就走，默认把执行结果交给下一步";
    readonly 'legend.passTip': "上一步判定通过才走";
    readonly 'legend.failTip': "上一步判定未通过才走，常用来回去返工";
    readonly 'legend.customTip': "满足你写的条件才走";
    readonly 'legend.produceTip': "步骤整份写出资源里的文件（会覆盖原内容）";
    readonly 'legend.updateTip': "步骤读了再在原文件上改，比如打钩";
    readonly 'legend.readTip': "步骤执行时用这个资源（读文件、看网址、加载 Skill…）";
    readonly 'legend.in': "入口";
    readonly 'legend.inTip': "空心圈：线从这里进来";
    readonly 'legend.out': "出口";
    readonly 'legend.outTip': "实心点：从这里拖出去连线";
    readonly 'link.hintFlow': "拖到步骤上：接成下一步";
    readonly 'link.hintWrite': "拖到资源卡上写它；松在空白处新建产出文件";
    readonly 'link.hintRead': "拖到步骤上：让它用这个资源";
    readonly 'link.hintBack': "拖到上游步骤或资源卡上";
    readonly 'link.hintWriteBack': "拖到步骤上：让它写这个资源";
    readonly 'link.exists': "已经连着";
    readonly 'link.hintReadBack': "拖到资源卡上：用这个资源";
};
/** 英文。键与 `zh` 同构，少一个键或多一个键都过不了类型检查。 */
export declare const en: Record<keyof typeof zh, string>;
