/**
 * dsh-workflow-lite — 文件查看文案：文件历史、文件与图片查看器、文件夹浏览。
 *
 * 点开资源后的文件查看器、图片放大器、文件夹浏览，以及写文件的步骤每轮存下的历史。
 *
 * @module @xiaoso/dsh-workflow-lite/client/i18n/files
 */
/** 中文（默认）。 */
export declare const zh: {
    readonly 'history.live': "最新";
    readonly 'history.before': "{step}前";
    readonly 'history.beforeRound': "第 {round} 轮 · {step}前";
    readonly 'history.round': "第 {round} 轮 · {step}后";
    readonly 'history.failedMark': "（失败）";
    readonly 'history.dropped': "中间省略了 {n} 版";
    readonly 'history.back': "回到最新";
    readonly 'history.newer': "有新的一版";
    readonly 'history.toggle': "版本";
    readonly 'history.title': "各轮产出";
    readonly 'history.view': "查看";
    readonly 'history.compare': "对比";
    readonly 'history.older': "旧";
    readonly 'history.newerSide': "新";
    readonly 'history.pickOld': "作为旧的一版";
    readonly 'history.pickNew': "作为新的一版";
    readonly 'history.diff': "差异";
    readonly 'history.sideBySide': "并排";
    readonly 'history.slider': "滑动";
    readonly 'history.same': "两版内容一样";
    readonly 'history.unfold': "展开 {n} 行没变的";
    readonly 'history.lines': "+{add} −{del} 行";
    readonly 'history.noDiff': "这种文件没法逐行对比，换成并排看";
    readonly 'history.saved': "存于 {time}";
    readonly 'history.empty': "还没有存下的版本。写它的步骤每做完一轮，这里存一版。";
    readonly 'history.missing': "现在的文件不在了";
    readonly 'history.sliderHandle': "拖动比较两版";
    readonly 'history.markStart': "初始";
    readonly 'history.markRound': "第 {round} 轮";
    readonly 'history.pass': "通过";
    readonly 'history.again': "打回";
    readonly 'res.folderEmpty': "文件夹是空的。";
    readonly 'res.folderMissing': "这个文件夹不存在。";
    readonly 'res.folderMore': "条目太多，只列出了一部分。";
    readonly 'res.textChars': "{n} 字";
    readonly 'file.view': "查看";
    readonly 'file.openWith': "用其他程序打开";
    readonly 'file.openDefault': "{app}（默认）";
    readonly 'file.reveal': "在文件管理器中显示";
    readonly 'file.appsLoading': "正在查找能打开它的程序…";
    readonly 'file.appsNone': "没找到能打开它的程序";
    readonly 'file.openFailed': "没能打开这份文件";
    readonly 'file.brokenImages': "有 {n} 张图片没能显示";
    readonly 'file.brokenImagesTip': "有 {n} 张图片没能显示\n预览页面在隔离的框里运行，读不到本机文件，所以本地路径、相对路径的图片加载不出来。\n想看完整效果，点「用其他程序打开」，在浏览器里打开。";
    readonly 'file.generated': "已生成";
    readonly 'file.notGenerated': "还没生成";
    readonly 'file.modified': "修改时间";
    readonly 'file.modifiedAt': "修改于 {time}";
    readonly 'file.previewMore': "查看全部";
    readonly 'file.copyPath': "复制路径";
    readonly 'file.rendered': "预览";
    readonly 'file.source': "源码";
    readonly 'file.text': "原文";
    readonly 'file.table': "表格";
    readonly 'file.pretty': "格式化";
    readonly 'file.tailNote': "文件较大，只显示最后 {shown}（前面还有 {cut}）";
    readonly 'file.edit': "编辑";
    readonly 'image.actual': "原大（1）";
    readonly 'image.fit': "适应窗口（0）";
    readonly 'image.untitled': "图片";
    readonly 'image.tools': "图片工具";
    readonly 'image.zoomIn': "放大（+）";
    readonly 'image.zoomOut': "缩小（-）";
    readonly 'image.zoomLevel': "缩放比例";
    readonly 'image.rotateLeft': "逆时针旋转（Shift+R）";
    readonly 'image.rotateRight': "顺时针旋转（R）";
    readonly 'image.background': "背景";
    readonly 'image.bgTheme': "跟随主题";
    readonly 'image.bgChecker': "棋盘格";
    readonly 'image.hint': "滚轮缩放 · 拖动平移 · 双击切换适应与原大 · R 旋转 · Esc 关闭";
    readonly 'image.failed': "这张图读不出来";
    readonly 'file.loading': "正在读取…";
    readonly 'file.tooLarge': "文件有 {size}，超过 {limit}，这里不显示。可以用其他程序打开。";
    readonly 'file.binary': "这是二进制文件，这里看不了。可以用其他程序打开。";
    readonly 'file.missing': "文件还没生成。";
    readonly 'file.empty': "文件是空的。";
    readonly 'folder.search': "搜索文件";
    readonly 'folder.count': "{n} 项";
    readonly 'folder.countOf': "{n} / {total}";
    readonly 'folder.upKeys': "← / Backspace";
    readonly 'folder.list': "文件夹里的内容";
    readonly 'folder.noMatch': "没有名字里含「{q}」的项";
    readonly 'folder.clear': "清除筛选";
    readonly 'folder.pick': "选一个文件，在这里预览";
    readonly 'folder.tally': "{dirs} 个文件夹 · {files} 个文件";
    readonly 'folder.dirHint': "这是一个文件夹，按回车或 → 进入";
    readonly 'folder.keys': "↑ ↓ 选择 · → 回车 进入 · ← 返回上一级";
    readonly 'folder.back': "回到列表";
    readonly 'folder.more': "条目太多，只列出了前 {n} 项，可以用上面的搜索框缩小范围。";
};
/** 英文。键与 `zh` 同构，少一个键或多一个键都过不了类型检查。 */
export declare const en: Record<keyof typeof zh, string>;
