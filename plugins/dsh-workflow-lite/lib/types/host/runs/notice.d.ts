/**
 * dsh-workflow-lite — 把"用户修改了运行状态"送进会话。
 *
 * 和 `dsh-task-runner` 的后台任务完成通知同一套机制：一条 `form: 'notice'` 的用户角色消息，
 * 对话里显示成一行摘要，展开就是完整的注入内容（用户看得到模型收到了什么）。
 * 用 `steer` 投递：会话空闲就开一轮，正在跑就在下一步接上。
 *
 * @module @xiaoso/dsh-workflow-lite/host/runs/notice
 */
import type { Context } from '@deepseek-ai/cordis';
import { type ContextFormed } from '@deepseek-ai/dsh-llm';
import type { Notify } from './runCore.ts';
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        'workflow-lite': {
            kind: 'workflow-lite';
        } & ContextFormed;
    }
}
/** 造一个投递函数：会话的 agent 不在运行时回 `false`（调用方把通知暂存起来）。 */
export declare function createNotify(ctx: Context): Notify;
