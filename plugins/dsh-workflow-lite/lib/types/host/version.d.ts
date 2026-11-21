/**
 * dsh-workflow-lite — 插件自己的版本号（写进导出包的清单）。
 *
 * 从模块所在目录往上找本包的 `package.json`：构建后是 `lib/index.mjs` 的上一层，跑单测时是源码的上两层。
 * 找不到（被打进别的包里之类）就是空串，不影响导出。
 *
 * @module @xiaoso/dsh-workflow-lite/host/version
 */
export declare function pluginVersion(from?: string): string;
