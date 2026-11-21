/**
 * dsh-workflow-lite — 组件里用的刷新器（见 `refresher.ts`）：依赖变了换一个新的，旧的关掉，
 * 它路上的结果不会落到新依赖的界面上（换了实例时上一个实例的读取回来就丢掉）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/useRefresher
 */
import { type DependencyList } from 'react';
import { type Refresher, type RefresherSpec } from './refresher.ts';
export declare function useRefresher<A, T>(spec: RefresherSpec<A, T>, deps: DependencyList): Refresher<A>;
