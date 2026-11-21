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
export declare function cleanLine(raw: string): string;
/**
 * 从单行 CLI 输出估算 0-100 进度。pnpm 在 fetch 阶段输出
 * `Progress: resolved N, reused X, downloaded Y, added Z`；解析/安装阶段的行把估算值推向完成。
 */
export declare function estimateProgress(line: string): number;
