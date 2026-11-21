/**
 * dsh-workflow-lite — 设置页文案：配色主题与插件设置。
 *
 * 工作流中心「设置」页：外观里的配色主题，以及插件设置项。
 *
 * @module @xiaoso/dsh-workflow-lite/client/i18n/config
 */
/** 中文（默认）。 */
export declare const zh: {
    readonly 'theme.group': "外观";
    readonly 'theme.lead': "亮色、暗色各选一套，画布跟着 DSH 的亮暗模式自动切换。只在这台设备上生效。";
    readonly 'theme.light': "亮色主题";
    readonly 'theme.dark': "暗色主题";
    readonly 'theme.inUse': "正在用";
    readonly 'theme.default': "默认";
    readonly 'theme.swiss': "瑞士";
    readonly 'theme.swissDesc': "国际主义风格：中性灰、纯白卡面、直角细线、Helvetica 字体";
    readonly 'theme.white': "晴白";
    readonly 'theme.whiteDesc': "浅灰画布、纯白卡面，对比最清楚";
    readonly 'theme.mist': "雾蓝";
    readonly 'theme.mistDesc': "冷白底，蓝色落在描边、悬停和按钮上";
    readonly 'theme.sage': "林间";
    readonly 'theme.sageDesc': "暖白底，绿色落在描边、悬停和按钮上";
    readonly 'theme.slate': "石板";
    readonly 'theme.slateDesc': "冷调的深石板灰";
    readonly 'theme.ink': "墨黑";
    readonly 'theme.inkDesc': "纯黑底、更鲜亮的颜色，OLED 屏更省电";
    readonly 'theme.ocean': "深海";
    readonly 'theme.oceanDesc': "带一点蓝的深色底，配长春花蓝";
    readonly 'theme.board': "画布上的展示";
    readonly 'theme.boardDesc': "在画布上展示的看板、图片、文档的样子，默认柔边镂空。卡片带边框和标题行；柔边镂空不画卡片，内容下面的画布淡出；纯镂空连画布的点也透过来；毛玻璃是半透明卡面，后面的画布模糊着透出来。单张卡片可以在「画布展示」里另选。";
    readonly 'theme.board.card': "卡片";
    readonly 'theme.board.clear': "柔边镂空";
    readonly 'theme.board.bare': "纯镂空";
    readonly 'theme.board.glass': "毛玻璃";
    readonly 'theme.umber': "暖夜";
    readonly 'theme.umberDesc': "带一点暖褐的深色底、琥珀橙强调色";
    readonly 'cfg.groupStorage': "存储";
    readonly 'cfg.groupCanvas': "画布";
    readonly 'cfg.groupModel': "模型";
    readonly 'cfg.dataDir': "数据目录";
    readonly 'cfg.dataDirDesc': "工作流、版本和实例记录都存在这里。原来目录里的东西不会自动搬过去。";
    readonly 'cfg.maxNodes': "单张工作流最多步骤";
    readonly 'cfg.maxNodesDesc': "超出后画布不再自动整理，也不能执行。";
    readonly 'cfg.saveDebounce': "自动保存等待";
    readonly 'cfg.saveDebounceDesc': "在画布上停手多久后写盘。";
    readonly 'cfg.maxResult': "模型单次读取上限";
    readonly 'cfg.maxResultDesc': "模型读一张工作流、一份运行状态最多拿这么多；很大的工作流读不出来时调大。";
    readonly 'cfg.skill': "给模型的使用指南";
    readonly 'cfg.skillDesc': "注册三份模型按需读的指南：怎么设计工作流、怎么记录运行状态、怎么写画布上的看板。";
    readonly 'cfg.ms': "毫秒";
    readonly 'cfg.steps': "步";
    readonly 'cfg.kb': "KB";
    readonly 'cfg.restart': "重启后生效";
    readonly 'cfg.reset': "恢复默认（{v}）";
    readonly 'cfg.dirty': "有 {n} 处改动还没保存";
    readonly 'cfg.discard': "放弃";
    readonly 'cfg.save': "保存";
    readonly 'cfg.saved': "已保存，马上生效";
    readonly 'cfg.savedRestart': "已保存。{keys}要重启 DSH 才生效";
    readonly 'cfg.unavailable': "这个 DSH 没有设置服务，这里只能看。要改请编辑 profile 配置文件。";
    readonly 'cfg.readonly': "当前 profile 不允许在这里改设置。";
    readonly 'cfg.int': "要填整数";
    readonly 'cfg.min': "不能小于 {n}";
    readonly 'cfg.required': "不能为空";
};
/** 英文。键与 `zh` 同构，少一个键或多一个键都过不了类型检查。 */
export declare const en: Record<keyof typeof zh, string>;
