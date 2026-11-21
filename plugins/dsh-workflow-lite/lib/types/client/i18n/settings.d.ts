/**
 * dsh-workflow-lite — 工作流设置与检查文案。
 *
 * 「设置」面板（根目录、执行方式、复用执行者、设定目标、运行状态）和「检查」面板。
 *
 * @module @xiaoso/dsh-workflow-lite/client/i18n/settings
 */
/** 中文（默认）。 */
export declare const zh: {
    readonly 'settings.title': "工作流设置";
    readonly 'settings.root': "产出根目录";
    readonly 'settings.rootPlaceholder': "留空 = 用默认目录；. = 工作区根目录";
    readonly 'settings.rootTipJoin': "每个步骤的产出文件都拼在这个目录下，组成最终写入的路径。";
    readonly 'settings.rootTipKinds': "相对路径以工作区为起点；也可以写绝对路径，例如 D:/artifacts。";
    readonly 'settings.rootTipNormalize': "保存时自动标准化：分隔符统一成 /，去掉多余的 //、./ 和末尾的 /。不支持 ~。";
    readonly 'settings.rootTipEmpty': "默认放在 .workflow-lite/runs/{instance}/out：和状态文件在一起，每个实例一份，不进版本库。";
    readonly 'settings.rootTipToken': "{instance} 执行时换成实例 id；写 . 就直接写在工作区根目录。";
    readonly 'settings.rootRelative': "相对工作区";
    readonly 'settings.rootAbsolute': "绝对路径";
    readonly 'settings.rootDefault': "默认";
    readonly 'settings.rootWorkspace': "工作区根目录";
    readonly 'settings.rootReset': "恢复默认";
    readonly 'settings.preview': "例如";
    readonly 'settings.mode': "执行方式";
    readonly 'settings.mode.auto': "自动";
    readonly 'settings.mode.autoDesc': "不做规定，由主 agent 自己决定怎么执行。";
    readonly 'settings.mode.serial': "串行";
    readonly 'settings.mode.serialDesc': "主 agent 本人按顺序一步一步做，不派子代理。";
    readonly 'settings.mode.subagent': "主 agent + 子代理";
    readonly 'settings.mode.subagentDesc': "主 agent 当 leader，每个步骤派一个子代理去做。";
    readonly 'settings.mode.team': "Agent 团队";
    readonly 'settings.mode.teamDesc': "主 agent 当 Team Lead，给步骤建队员，队员之间能互相发消息。";
    readonly 'settings.leaderNote': "后两种方式里，主 agent 只负责派发、选分支、推进循环和最后汇报。";
    readonly 'settings.modeTipPlan': "执行方式会写进派发计划的开头，告诉主 agent 怎么组织这次执行。";
    readonly 'settings.modeTipTools': "子代理与 Agent 团队依赖 DSH 的对应工具；工具不可用时，计划会让主 agent 说明后改成自己逐个执行。";
    readonly 'settings.conflict': "工作流设置";
    readonly 'settings.reuse': "复用执行者";
    readonly 'settings.reuse.auto': "自动";
    readonly 'settings.reuse.autoDesc': "由主 agent 决定沿不沿用之前的子代理或队员。";
    readonly 'settings.reuse.reuse': "复用";
    readonly 'settings.reuse.reuseDesc': "同一步骤再次执行时交回上次那个，接着之前的上下文。";
    readonly 'settings.reuse.fresh': "新建";
    readonly 'settings.reuse.freshDesc': "每次都派新的，上下文干净，只靠交接和产出传递。";
    readonly 'settings.reuseSerial': "串行由主 agent 本人做，用不上。";
    readonly 'settings.reuseTipWhen': "「再次执行」指循环的下一轮、失败后重试、中断后继续。";
    readonly 'settings.reuseTipScope': "只在同一个步骤之间复用；不同步骤各有各的执行者。";
    readonly 'settings.reuseTipPick': "复用省得重读材料，还记得上一轮试过什么；新建不受上一轮影响，适合独立审查。";
    readonly 'settings.reuseTipTools': "复用靠 send_message 继续对话；工具不支持时，计划会让主 agent 改成新建。";
    readonly 'settings.goal': "设定目标";
    readonly 'settings.goalDesc': "开始前设为会话目标，没做完会接着做。";
    readonly 'settings.goalTipPlan': "写进派发计划的开头：主 agent 开始前用 create_goal 把这次执行设成会话目标，全部做完后标记完成。";
    readonly 'settings.goalTipWhy': "有目标时，主 agent 没做完就停下，DSH 会让它接着做，长流程不会停在一半。";
    readonly 'settings.goalTipSkip': "会话里已有进行中的目标时不再新建；没有目标工具就跳过。";
    readonly 'settings.during': "执行时";
    readonly 'settings.runState': "运行状态";
    readonly 'settings.runStateOn': "记录运行状态";
    readonly 'settings.runStateDesc': "每次执行建一个实例，画布上能看进度、改状态。";
    readonly 'settings.runStateTipInstance': "打开后，模型每编译一次这张图，就建一个工作流实例：拍一份图的快照，在会话工作区的 .workflow-lite/runs/ 下建好一份 YAML 状态文件。";
    readonly 'settings.runStateTipWriter': "执行期间只有主 agent 改它（子代理、队员不碰）；计划末尾会多一段「运行状态」，写明什么时候改、怎么校验。";
    readonly 'settings.runStateTipView': "在画布上可以切到实例，按状态看那张图；也能改状态，改完确认后会通知模型。";
    readonly 'issues.title': "检查";
    readonly 'issues.none': "没有问题";
    readonly 'issues.noneBody': "这条工作流可以直接交给模型执行。";
    readonly 'issues.noneBodyRun': "和模板用同一套规则检查过了，改完可以直接保存。";
    readonly 'issues.unit': "个问题";
    readonly 'issues.level.save': "错误";
    readonly 'issues.level.compile': "需修复";
    readonly 'issues.level.warning': "警告";
    readonly 'issues.level.hint': "建议";
};
/** 英文。键与 `zh` 同构，少一个键或多一个键都过不了类型检查。 */
export declare const en: Record<keyof typeof zh, string>;
