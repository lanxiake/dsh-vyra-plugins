/**
 * DSH Plugin Hub — the community plugin marketplace for DeepSeek Harness.
 * Website: https://dsh-plugin.org
 * GitHub: https://github.com/dshplugin/dsh-plugin-hub
 *
 * 安装/卸载运行时的公共类型与常量（无依赖，供各服务模块复用）。
 */
/** 目录 GitHub 仓库身份（`owner/repo`）的语法。 */
export const REPO_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
/** npm 包名的语法（用于卸载目标）。 */
export const PACKAGE_RE = /^(?:@[a-z0-9._-]+\/)?[A-Za-z0-9._-]+$/;
/** 捕获输出上限：stdout/stderr 各保留尾部 N 字节。 */
export const CAPTURE_LIMIT_BYTES = 64 * 1024;
/** 每个任务保留的最大输出行数（最新优先）。 */
export const MAX_TASK_LINES = 200;
/** 最多跟踪的任务数；超出时先丢弃最早结束的任务。 */
export const MAX_TASKS = 50;
