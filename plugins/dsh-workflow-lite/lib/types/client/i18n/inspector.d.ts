/**
 * dsh-workflow-lite — 属性面板文案：步骤、产出文件、连线、交接，以及图标与颜色。
 *
 * 选中步骤或连线时右栏显示的内容。
 *
 * @module @xiaoso/dsh-workflow-lite/client/i18n/inspector
 */
/** 中文（默认）。 */
export declare const zh: {
    readonly 'ins.name': "名称";
    readonly 'ins.prompt': "提示词";
    readonly 'ins.promptPlaceholder': "告诉执行者这一步要做什么、产出什么…";
    readonly 'ins.promptHint': "这段文字会逐字交给执行者。";
    readonly 'ins.chars': "字";
    readonly 'ins.output': "产出文件";
    readonly 'ins.output.unset': "不声明";
    readonly 'ins.output.file': "写入文件";
    readonly 'ins.output.none': "不产出";
    readonly 'ins.outputPlaceholder': "例如 plan.md";
    readonly 'ins.outputInvalid': "要写相对路径，不能是绝对路径或含 ..";
    readonly 'ins.output.add': "添加产出文件";
    readonly 'ins.output.rule': "生成规则";
    readonly 'ins.output.rulePlaceholder': "这份产出怎么写：格式、必须包含什么、给谁看…";
    readonly 'ins.output.empty': "文件名不能为空";
    readonly 'ins.output.duplicate': "这个文件已经在上面声明过了";
    readonly 'ins.description': "描述";
    readonly 'ins.descriptionPlaceholder': "一句话说明这一步做什么（给人看，不进计划）";
    readonly 'ins.links': "连接";
    readonly 'ins.from': "上游";
    readonly 'ins.to': "下游";
    readonly 'ins.noLinks': "还没有连接。从步骤右侧的圆点拖出一条线。";
    readonly 'ins.copyId': "复制步骤 ID";
    readonly 'tpl.name': "ID";
    readonly 'tpl.placeholder': "例如 my-check";
    readonly 'tpl.save': "保存";
    readonly 'tpl.saved': "已存为我的步骤";
    readonly 'out.files': "个文件";
    readonly 'out.remove': "删除这个产出";
    readonly 'out.noneHint': "这一步只做事、不留文件（比如直接改代码）。";
    readonly 'out.unsetHint': "没说产出什么。下游需要读它的结果时，改成「写入文件」。";
    readonly 'out.addRuleCta': "还没写生成规则，点这里补上";
    readonly 'out.noRule': "没有生成规则";
    readonly 'out.newTitle': "添加产出文件";
    readonly 'out.editTitle': "编辑产出文件";
    readonly 'out.viewTitle': "产出文件";
    readonly 'out.path': "文件路径";
    readonly 'out.pathHint': "相对于工作目录的路径；下游步骤从这里读取它。";
    readonly 'out.optional': "可选";
    readonly 'out.ruleHint': "会写进计划的「产出要求」，派发这一步时连同提示词一起交给执行者。";
    readonly 'out.submitKeys': "Ctrl+Enter 完成";
    readonly 'out.done': "完成";
    readonly 'out.peekTitle': "产出";
    readonly 'out.peekHint': "点文件查看或编辑";
    readonly 'out.finalPath': "最终写入";
    readonly 'edge.title': "连线";
    readonly 'edge.when': "流转条件";
    readonly 'edge.always': "总是";
    readonly 'edge.pass': "通过";
    readonly 'edge.fail': "未通过";
    readonly 'edge.custom': "自定义";
    readonly 'edge.customPlaceholder': "写下走这条线的条件，例如：测试全部通过，且没有新增警告";
    readonly 'edge.hintAlways': "上游完成后就执行下游。";
    readonly 'edge.hintVerdict': "上游的最后一行是下面这句时，走这条线：";
    readonly 'edge.hintJudge': "执行者会读上游的产出，自己判断这句话是否成立，成立就走这条线。";
    readonly 'edge.loop': "这条线回到前面的步骤，形成循环。";
    readonly 'edge.remove': "删除连线";
    readonly 'hand.title': "交接";
    readonly 'hand.result': "把上游的执行结果交给下游";
    readonly 'hand.resultHint': "回复里的结论与要点（不是全文）。文件不走这里——连到资源卡上。";
    readonly 'hand.resultShort': "执行结果";
    readonly 'hand.resultOf': " 的执行结果";
    readonly 'hand.flowOnly': "只管先后";
    readonly 'hand.flowOnlyHint': "下游等上游做完才开始，但不拿上游的执行结果。";
    readonly 'hand.note': "交接说明";
    readonly 'hand.notePlaceholder': "例如：按 review.md 逐条修复；修好的在对应条目前打钩 [x]，修不了的写明原因。";
    readonly 'hand.noteHint': "写进派发计划，下游拿到执行结果时一起看到。";
    readonly 'hand.edit': "编辑交接";
    readonly 'hand.editDone': "完成";
    readonly 'hand.editHint': "Esc 或点空白处完成";
    readonly 'hand.openPanel': "在右栏打开";
    readonly 'hand.tipWhat': "执行结果是上游这一次运行的回复（结论与要点），沿步骤之间的线交给下游；缺省就交。";
    readonly 'hand.tipFiles': "资源是独立的卡片：步骤连到资源 = 写它，资源连到步骤 = 读它。几个步骤连同一个资源，它就是共用的一份。";
    readonly 'look.title': "图标与颜色";
    readonly 'look.change': "换图标和颜色";
    readonly 'look.reset': "恢复默认";
    readonly 'look.color': "颜色";
    readonly 'look.icon': "图标";
    readonly 'look.c.blue': "蓝";
    readonly 'look.c.green': "绿";
    readonly 'look.c.amber': "琥珀";
    readonly 'look.c.coral': "珊瑚";
    readonly 'look.c.teal': "青";
    readonly 'look.c.pink': "粉";
    readonly 'look.c.olive': "橄榄";
    readonly 'look.c.violet': "紫";
    readonly 'look.c.slate': "石板灰";
};
/** 英文。键与 `zh` 同构，少一个键或多一个键都过不了类型检查。 */
export declare const en: Record<keyof typeof zh, string>;
