/**
 * dsh-workflow-lite — 「新节点到了」：复制之后选中跳到新节点上，等它渲染并量完尺寸，回调一次（借它把被右栏盖住的新卡挪出来）。
 * 新节点的 id 是 reducer 里才定下来的，所以先 `arm()`，等选中变化再认领。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/useArrival
 */
export declare function useArrival(selectedId: string | null, onArrive: (id: string) => void): () => void;
