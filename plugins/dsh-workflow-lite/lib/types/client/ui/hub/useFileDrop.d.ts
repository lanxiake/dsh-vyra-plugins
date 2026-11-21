/**
 * dsh-workflow-lite — 把文件拖到带 `data-wl-file-drop` 的区域里：这块区域自己收，宿主不插手。
 *
 * 宿主在 `document` 上（冒泡阶段）听所有带文件的拖动：一进页面就盖上整页的「文件或图片拖动到此处即可添加」，
 * 放下去就当对话附件加进去，并且靠它自己的 dragenter / dragleave 计数收起那层。我们在区域里 `stopPropagation`
 * 的话，宿主收不到 drop、计数不归零，那层就一直盖着。
 *
 * 所以这里在 `document` 的**捕获阶段**先接住落在区域里的拖动事件（宿主在冒泡阶段，被我们截下后看不到），
 * 自己管高亮和放下；放下之后补发一个 `dragend`，让宿主把之前（从区域外进来时）攒的计数和遮罩清掉。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/hub/useFileDrop
 */
/** 返回「有文件正拖在区域上」；放下时把第一个文件交给 `onFile`。 */
export declare function useFileDrop(onFile: (file: File) => void): boolean;
