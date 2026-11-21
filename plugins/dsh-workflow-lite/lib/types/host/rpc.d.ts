/**
 * dsh-workflow-lite — 画布的后端路由。
 *
 * 一个 endpoint 一条精确 Fetch 路由，挂在共享 Connection 的 `/api` 通道上
 * （与生态里其它插件同一条路）。载波负责 Host/Origin + 浏览器会话策略，
 * 我们只解码标准 `client-request` 信封、分派、再按标准 `server-response` 回。
 *
 * 注册走 `ctx.inject(['connection'])` 的子上下文——这样**插件在没有 web 的 profile 里
 * 也能只带工具起来**（RPC 是画布专用，缺它不该让整个插件停摆）。
 *
 * 分派只按 endpoint 的前缀转给 `rpc/` 下各组（graph / plan / run / memory / host / config / pack），
 * 每组各管自己的入参读取。
 *
 * @module @xiaoso/dsh-workflow-lite/host/rpc
 */
import type { Context } from '@deepseek-ai/cordis';
import { type RpcDeps } from './rpc/shared.ts';
/**
 * 注册全部画布路由。
 * @param ctx - **已绑定 `connection`** 的子上下文。
 * @param deps - 仓储与数据根。
 */
export declare function registerWorkflowLiteRpc(ctx: Context, deps: RpcDeps): void;
