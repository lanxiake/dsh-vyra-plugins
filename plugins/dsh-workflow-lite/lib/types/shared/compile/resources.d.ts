/**
 * dsh-workflow-lite — 计划的「资源」一节：总览、资源里每一项的写法、记忆与画布展示。
 *
 * 派发版只写位置——说明和自定义内容在任务描述里；整卷版没有任务描述，逐项带上说明。
 *
 * @module @xiaoso/dsh-workflow-lite/shared/compile/resources
 */
import type { ResourceNode } from '../types.ts';
import { type RenderContext } from './context.ts';
/**
 * 资源：「流程」表里那些资源 id 指的是什么，按 id 码位序，一个资源一行。谁读谁写看「流程」表，这里不重复；
 * 交给所有步骤的（一条线都没连）表里没有，在这里注明。派发版只写位置——说明和自定义内容在任务描述里；
 * 整卷版没有任务描述，逐项带上说明，多行的逐行引用。
 */
export declare function resourcesSection(ctx: RenderContext, inline: boolean): string;
/** 资源在计划里的称呼：`id`，有名字就跟在括号里。 */
export declare function resourceName(resource: ResourceNode): string;
/**
 * 一个资源的内容，放在任务描述里它自己的小标题下面：只有一项时不套列表——种类与位置一行，
 * 多行的说明空一行后逐行引用；几项的逐项列出。自定义内容直接引用。
 */
export declare function itemBlock(ctx: RenderContext, resource: ResourceNode, written: boolean): string[];
/**
 * 给写它的步骤的「画布展示」：资源开了展示、展示的是文件或文件夹、适配没关时才有（措辞在口径里，通用口径没有）。
 * 资源里不止一项时点明展示的是哪一项。
 */
export declare function displayLine(ctx: RenderContext, resource: ResourceNode, written: boolean): string | null;
/**
 * 记忆：目录的位置，说明跟在下面（没改过的用默认的）。
 * `withNotes` 为假时只给位置（任务描述里的全局记忆）。
 */
export declare function memoryLines(ctx: RenderContext, resource: ResourceNode, withNotes: boolean, indent: string): string[];
