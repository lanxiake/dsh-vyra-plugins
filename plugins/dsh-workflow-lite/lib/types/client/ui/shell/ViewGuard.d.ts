/**
 * dsh-workflow-lite — 视图出错时的兜底：渲染里抛了错，只把这个视图换成一张「出错了 · 重试」的卡片。
 *
 * 宿主自己也接得住视图里的错，但它会把整个标签页撤掉，要刷新页面才回来；这里接在它前面，
 * 原地给一张卡片，点「重试」把视图重新挂一遍。错误照样打到控制台，方便查。
 *
 * 只接渲染时抛的错（React 的错误边界管不到事件处理和异步回调里的错，那些各处自己报）。
 * 视图里不挂宿主的插槽，接住的不会是宿主要往外抛的装配错误。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/shell/ViewGuard
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { T } from '../../i18n.ts';
interface GuardProps {
    t: T;
    children: ReactNode;
}
interface GuardState {
    error: Error | null;
    /** 第几次挂：重试时换个 key，整棵树从头挂。 */
    attempt: number;
}
export declare class ViewGuard extends Component<GuardProps, GuardState> {
    state: GuardState;
    static getDerivedStateFromError(error: unknown): Partial<GuardState>;
    componentDidCatch(error: unknown, info: ErrorInfo): void;
    private readonly retry;
    render(): ReactNode;
}
export {};
