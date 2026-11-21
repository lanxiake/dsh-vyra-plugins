/**
 * dsh-workflow-lite — 浏览器半。
 *
 * 把工作流视图挂到会话页的 tab 上（`conversation.view` 槽位），并接上共享 Connection 的
 * `/api` 通道。UI 文案走本插件的 locale 词典（`workflow-lite`）。
 *
 * tab 的显示名用 **thunk**：槽位每次读取时重新求值，所以切语言不用重新注册。
 *
 * @module @xiaoso/dsh-workflow-lite/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
/** 视图需要的三个客户端服务。 */
export declare const inject: string[];
/**
 * 挂载视图。
 * @param ctx - 浏览器插件上下文。
 */
export declare function apply(ctx: ClientContext): void;
