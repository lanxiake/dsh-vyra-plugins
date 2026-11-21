/**
 * DSH Plugin Hub — the community plugin marketplace for DeepSeek Harness.
 * Website: https://dsh-plugin.org
 * GitHub: https://github.com/dshplugin/dsh-plugin-hub
 *
 * 安装执行器共用的纯进度估算工具。
 *
 * dsh CLI 包装了 pnpm，pnpm 用回车原地刷新 `Progress: …` 行，因此原始输出是一串碎片。
 * 这些工具把单个碎片归一化成干净的终端行，并映射到 0-100 估算值；不碰 I/O
 * 让估算逻辑可直接单测（见 tests/progress.test.ts）。
 */
/** 剥掉 `[out]` / `[err]` 来源前缀与 ANSI 转义序列。 */
export function cleanLine(raw) {
    return raw.replace(/^\[(?:err|out)\]\s*/, '').replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').trim();
}
/**
 * 从单行 CLI 输出估算 0-100 进度。pnpm 在 fetch 阶段输出
 * `Progress: resolved N, reused X, downloaded Y, added Z`；解析/安装阶段的行把估算值推向完成。
 */
export function estimateProgress(line) {
    const progress = line.match(/Progress:\s*(.+)/);
    if (progress) {
        let resolved = 0;
        let handled = 0;
        for (const part of progress[1].split(',')) {
            // pnpm 输出 `label count` 形式的 token，如 `resolved 100, reused 40`
            const [label, raw] = part.trim().split(/\s+/);
            const value = Number(raw);
            if (label === 'resolved')
                resolved = value;
            else if (label === 'reused' || label === 'downloaded' || label === 'added' || label === 'imported') {
                handled += value;
            }
        }
        // pnpm 的 resolved 是"解析出的包数"，reused/downloaded/added 是"已处理的包数"，
        // 两者几乎总是相等，比值没有进度区分度（一出现就贴满 100%）。
        // fetch 阶段只占安装总时长的一小部分（git 依赖之后还要 clone + 跑 prepare 构建），
        // 因此按已处理量在低区间（8-30）缓步推进，把中段留给真正的安装/构建阶段。
        if (resolved > 0 && handled > 0) {
            return Math.min(30, 8 + Math.round((handled / resolved) * 20));
        }
        return resolved > 0 ? 8 : 0;
    }
    if (/^dependencies:|^Packages:/i.test(line))
        return 85;
    if (/^Running\b|prepare|build scripts/i.test(line))
        return 60;
    if (/^Done in\b/i.test(line))
        return 96;
    return 0;
}
