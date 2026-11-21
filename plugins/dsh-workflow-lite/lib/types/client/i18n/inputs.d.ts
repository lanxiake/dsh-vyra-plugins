/**
 * dsh-workflow-lite — 输入节点与执行前填写文案。
 *
 * 输入节点（执行前向用户提问）的属性面板，以及执行前填写对话框。
 *
 * @module @xiaoso/dsh-workflow-lite/client/i18n/inputs
 */
/** 中文（默认）。 */
export declare const zh: {
    readonly 'input.kind.text': "一句话";
    readonly 'input.kind.textarea': "多行文字";
    readonly 'input.kind.choice': "单选";
    readonly 'input.kind.multi': "多选";
    readonly 'input.seed.text': "这次要处理的是什么？";
    readonly 'input.title': "用户输入";
    readonly 'input.badge': "输入";
    readonly 'input.question': "问题";
    readonly 'input.questionPlaceholder': "执行前想问用户什么？";
    readonly 'input.questionHint': "问题和用户的回答会原样写进计划，交给连着的步骤。";
    readonly 'input.questionEmpty': "还没写问题";
    readonly 'input.kindLabel': "怎么回答";
    readonly 'input.options': "选项";
    readonly 'input.addOption': "加一个选项";
    readonly 'input.optionPlaceholder': "选项内容";
    readonly 'input.removeOption': "删掉这个选项";
    readonly 'input.optionDup': "和别的选项重复了，保存时只留一个";
    readonly 'input.optionN': "选项 {n}";
    readonly 'input.default': "默认值";
    readonly 'input.defaultNone': "不预选";
    readonly 'input.defaultTip': "点左边的圈设为默认";
    readonly 'input.defaultPlaceholder': "预先填好的内容（用户可以改）";
    readonly 'input.defaultHint': "用户没改就用它；必填的问题有了默认值，用户不填也能执行。";
    readonly 'input.placeholder': "占位文字";
    readonly 'input.placeholderPlaceholder': "输入框里的灰色提示";
    readonly 'input.hint': "说明";
    readonly 'input.hintPlaceholder': "填写时显示在问题下面，比如要写到多细";
    readonly 'input.private': "占位文字和说明只给填写的人看，不进计划。";
    readonly 'input.required': "必填";
    readonly 'input.requiredDesc': "没有回答（也没有默认值）时不能执行";
    readonly 'input.other': "允许自己填写";
    readonly 'input.otherDesc': "用户可以不选上面的选项，改填自己的答案";
    readonly 'input.otherGhost': "其他（用户自己填写）";
    readonly 'input.otherTag': "可自填";
    readonly 'input.readers': "回答交给";
    readonly 'input.readersAll': "还没连到步骤：回答交给整个工作流。";
    readonly 'input.readersHint': "从输入卡右边的点拖到步骤上，就只交给那几步。";
    readonly 'input.connectHint': "拖到步骤上：把回答交给它";
    readonly 'input.optionsCount': "{n} 个选项";
    readonly 'input.delete': "删除输入";
    readonly 'input.answer': "用户的回答";
    readonly 'input.noAnswer': "没有填写";
    readonly 'ins.inputs': "用户输入";
    readonly 'ins.inputsHint': "执行时把这些问题的回答交给这一步。";
    readonly 'edge.ask': "交回答";
    readonly 'edge.askTitle': "用户输入 → 步骤";
    readonly 'edge.askHint': "执行时，用户对这个问题的回答会交给这一步。";
    readonly 'file.ask': "回答";
    readonly 'legend.askTip': "把用户执行前填的回答交给这一步";
    readonly 'link.hintAsk': "拖到步骤上：把回答交给它";
    readonly 'ask.title': "执行前填写";
    readonly 'ask.sub': "{name} · {n} 个问题";
    readonly 'ask.run': "执行";
    readonly 'ask.requiredTag': "必填";
    readonly 'ask.missing': "还有 {n} 个必填的没填";
    readonly 'ask.keys': "Ctrl+Enter 执行";
    readonly 'ask.pickOne': "选一项";
    readonly 'ask.pickMany': "可以选多项";
    readonly 'ask.defaultTag': "默认";
    readonly 'ask.other': "其他";
    readonly 'ask.otherPlaceholder': "自己填写";
    readonly 'ask.where': "执行位置：{where}";
};
/** 英文。键与 `zh` 同构，少一个键或多一个键都过不了类型检查。 */
export declare const en: Record<keyof typeof zh, string>;
