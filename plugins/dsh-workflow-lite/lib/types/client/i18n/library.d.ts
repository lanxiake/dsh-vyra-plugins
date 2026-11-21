/**
 * dsh-workflow-lite — 步骤库文案：内置步骤、自定义步骤与它们的详情。
 *
 * 左侧步骤库的列表、预设提示词与起手步骤，以及单个步骤库条目的详情页。
 *
 * @module @xiaoso/dsh-workflow-lite/client/i18n/library
 */
/** 中文（默认）。 */
export declare const zh: {
    readonly 'lib.title': "步骤库";
    readonly 'lib.hint': "拖到画布上使用";
    readonly 'lib.builtin': "常用步骤";
    readonly 'lib.custom': "我的步骤";
    readonly 'lib.newCustom': "新建我的步骤";
    readonly 'lib.customEmpty': "点上面的「＋」新建一个，或选中画布上的步骤，点「存为我的步骤」。";
    readonly 'lib.broken': "模板文件有问题";
    readonly 'lib.noDescription': "还没写描述";
    readonly 'lib.blank': "空白步骤";
    readonly 'lib.blankDesc': "从零写提示词";
    readonly 'lib.collapse': "收起步骤库";
    readonly 'lib.basic': "基础";
    readonly 'lib.memory': "记忆";
    readonly 'lib.memoryDesc': "新建一条，或选已有的";
    readonly 'preset.scan.label': "侦察";
    readonly 'preset.scan.desc': "读代码，摸清现状";
    readonly 'preset.scan.prompt': "先把现状摸清楚：读相关代码/文档，把事实与假设分开列出来。\n不要修改任何文件。";
    readonly 'preset.scan.rule': "一份现状说明：关键文件路径、现状行为、可疑点；事实与假设分开写。";
    readonly 'preset.implement.label': "实现";
    readonly 'preset.implement.desc': "按计划动手改";
    readonly 'preset.implement.prompt': "按上游的计划实现。\n改完自己跑一遍验证命令并把结果贴出来。";
    readonly 'preset.implement.rule': "改动说明：改了哪些文件、为什么这么改、如何验证，附上验证命令的输出。";
    readonly 'preset.review.label': "审查";
    readonly 'preset.review.desc': "独立检查，给出通过与否";
    readonly 'preset.review.prompt': "独立审查上游的产出：不要信任作者的自我评价，直接看代码与运行结果。\n最后一行必须写 `VERDICT: pass` 或 `VERDICT: fail`。";
    readonly 'preset.review.rule': "问题清单（每条给出位置与理由）+ 明确结论。";
    readonly 'preset.fix.label': "修复";
    readonly 'preset.fix.desc': "按审查结论逐条修";
    readonly 'preset.fix.prompt': "按上游的审查结论逐条修复。\n不要顺手做审查里没提的重构。";
    readonly 'preset.fix.rule': "修复说明：逐条对应审查清单，写清改法与验证结果。";
    readonly 'starter.fixNote': "按 review.md 的问题清单逐条修复：修好的条目在原文件里打钩 [x]，修不了的在条目下写明原因；改法与验证结果写进 fix-notes.md。";
    readonly 'starter.recheckNote': "重新审查时对照 review.md 里的勾选与 fix-notes.md，逐条确认真的修好了。";
    readonly 'starter.askGoal': "这次要做什么？";
    readonly 'starter.askGoalHint': "一两句话说清目标和范围，侦察和实现都照着它来。";
    readonly 'starter.askGoalPlaceholder': "比如：给导出功能加上 CSV 格式";
    readonly 'starter.askStrict': "审查要多严格？";
    readonly 'starter.askStrictHint': "严格 = 小问题也记成未通过。";
    readonly 'starter.strict.loose': "宽松";
    readonly 'starter.strict.normal': "标准";
    readonly 'starter.strict.strict': "严格";
    readonly 'starter.rulesLabel': "团队约定";
    readonly 'starter.rulesDesc': "没连线：交给每一步";
    readonly 'starter.rulesText': "- 文档和说明用中文写\n- 改代码前先读懂相关测试，改完跑一遍\n- 不改公共接口；非改不可时在计划里写明原因";
    readonly 'starter.contextLabel': "项目资料";
    readonly 'starter.contextDesc': "侦察和实现时参考";
    readonly 'starter.contextSrc': "主要代码在这里，先看目录结构";
    readonly 'starter.contextReadme': "项目是做什么的、怎么跑起来";
    readonly 'starter.contextUrl': "提交信息按这个规范写";
    readonly 'preset.report.label': "汇总";
    readonly 'preset.report.desc': "写给人看的结论";
    readonly 'preset.report.prompt': "汇总本次的全部产出，给出人读的结论。\n产出：一段结论 + 关键证据；说清哪些已验、哪些未验、哪些是环境所限。";
    readonly 'lib.input': "用户输入";
    readonly 'lib.inputDesc': "执行前问用户一个问题，填空或选项";
    readonly 'lib.resource': "资源";
    readonly 'lib.resourceDesc': "文件、文件夹、网址、Skill 或一段自定义提示词，连到步骤上";
    readonly 'step.builtin': "内置";
    readonly 'step.mine': "我的步骤";
    readonly 'step.readonlyNote': "内置步骤不能修改。拖到画布上之后，那一份可以随意改；想要自己的版本，就复制成「我的步骤」。";
    readonly 'step.addToCanvas': "添加到画布";
    readonly 'step.copyToMine': "复制为我的步骤";
    readonly 'step.save': "保存";
    readonly 'step.saving': "保存中…";
    readonly 'step.unsaved': "未保存";
    readonly 'step.saved': "已保存";
    readonly 'step.created': "已创建";
    readonly 'step.deleted': "已删除";
    readonly 'step.delete': "删除这个步骤";
    readonly 'step.deleteConfirm': "删除后不可恢复";
    readonly 'step.deleteTitle': "删除「{name}」这个我的步骤？";
    readonly 'step.id': "ID";
    readonly 'step.idHint': "拖到画布上时就是这个步骤的 ID，也是文件名：templates/nodes/<ID>.json。";
    readonly 'step.labelPlaceholder': "步骤名称";
    readonly 'step.loading': "读取中…";
    readonly 'step.newTitle': "新建我的步骤";
    readonly 'step.noFile': "不产出文件";
    readonly 'step.noOutput': "未声明产出";
};
/** 英文。键与 `zh` 同构，少一个键或多一个键都过不了类型检查。 */
export declare const en: Record<keyof typeof zh, string>;
