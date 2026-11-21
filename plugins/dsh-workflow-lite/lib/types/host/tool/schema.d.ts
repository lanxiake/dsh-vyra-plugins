/**
 * dsh-workflow-lite — `workflow_lite` 工具给模型看的那一面：工具说明（`DESCRIPTION`）与参数声明（`PARAMETERS`）。
 *
 * 这两段文字模型逐字读到，改措辞就是改工具的行为；参数的 TypeScript 形状在 `args.ts`，两边要同构。
 * @module @xiaoso/dsh-workflow-lite/host/tool/schema
 */
export declare const DESCRIPTION: string;
/** 工具的参数声明（隐式开放对象根；`required` 内联写）。导出供测试直接编译成 JSON Schema 校验。 */
export declare const PARAMETERS: {
    readonly action: {
        readonly type: "string";
        readonly enum: readonly ["list", "read", "compile", "create", "write_node", "set_label", "delete_node", "connect", "disconnect", "rename_workflow", "delete_workflow", "save_as_template", "configure", "write_resource", "runs", "resume", "state"];
        readonly required: true;
        readonly description: "要做的动作。";
    };
    readonly workflow: {
        readonly type: "string";
        readonly description: "图名（不带 .json）。除 list 外都需要。";
    };
    readonly node: {
        readonly type: "string";
        readonly description: "节点 id（read / write_node / set_label / delete_node / save_as_template）。";
    };
    readonly content: {
        readonly type: "string";
        readonly description: "write_node：节点提示词正文（允许空串，但空正文是编译级）。";
    };
    readonly label: {
        readonly type: "string";
        readonly description: "write_node / set_label：显示名。不要求唯一；空串 = 清除（回落显示 id）。";
    };
    readonly output: {
        readonly type: "string";
        readonly description: "write_node：产出契约（相对工作区根的路径）。";
    };
    readonly outputs: {
        readonly type: "array";
        readonly description: "write_node：一个或多个产出，每个可带生成规则（规则附在写它的步骤的任务描述里）。给了它就整份替换 output。";
        readonly items: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly properties: {
                readonly path: {
                    readonly type: "string";
                    readonly required: true;
                    readonly description: "相对工作区根的产出路径。";
                };
                readonly rule: {
                    readonly type: "string";
                    readonly description: "这份产出该怎么写：结构、必须包含什么、长度上限（进资源说明）。";
                };
                readonly display: {
                    readonly type: "object";
                    readonly description: "在画布上展示这个资源里的一项（图片、HTML、Markdown、文本、文件夹），给了的字段才改。详见 skill workflow-authoring 的「在画布上展示」。";
                    readonly additionalProperties: false;
                    readonly properties: {
                        readonly show: {
                            readonly type: "boolean";
                            readonly description: "false = 关掉展示。";
                        };
                        readonly size: {
                            readonly type: "string";
                            readonly enum: readonly ["s", "m", "l"];
                            readonly description: "预设尺寸，缺省 m；一般用 s 或 m。";
                        };
                        readonly width: {
                            readonly type: "number";
                            readonly description: "展示区宽（画布像素），优先于 size；一般用 size。";
                        };
                        readonly height: {
                            readonly type: "number";
                            readonly description: "展示区高（画布像素）。";
                        };
                        readonly zoom: {
                            readonly type: "number";
                            readonly description: "缩放百分比，缺省 100，一般不动。";
                        };
                        readonly fit: {
                            readonly type: "string";
                            readonly enum: readonly ["contain", "cover", "actual"];
                            readonly description: "图片怎么放，缺省 contain。";
                        };
                        readonly item: {
                            readonly type: "number";
                            readonly description: "展示第几项（从 0 数）。";
                        };
                        readonly adapt: {
                            readonly type: "boolean";
                            readonly description: "写它的步骤按卡片适配产出，缺省 true。";
                        };
                        readonly look: {
                            readonly type: "string";
                            readonly enum: readonly ["card", "clear", "bare", "glass", "auto"];
                            readonly description: "卡片外观，不写跟着用户设置。";
                        };
                        readonly hideTitle: {
                            readonly type: "boolean";
                            readonly description: "不选中、不悬停时藏起标题。";
                        };
                        readonly lines: {
                            readonly type: "object";
                            readonly description: "日志、纯文本怎么看。";
                            readonly additionalProperties: false;
                            readonly properties: {
                                readonly from: {
                                    readonly type: "string";
                                    readonly enum: readonly ["end", "start"];
                                    readonly description: "看末尾还是开头，不写 = 自动。";
                                };
                                readonly filter: {
                                    readonly type: "string";
                                    readonly description: "只显示含这段字的行，空串 = 不筛。";
                                };
                                readonly regex: {
                                    readonly type: "boolean";
                                    readonly description: "filter 按正则。";
                                };
                                readonly context: {
                                    readonly type: "number";
                                    readonly description: "匹配前后各带几行。";
                                };
                            };
                        };
                        readonly table: {
                            readonly type: "object";
                            readonly description: "CSV / TSV 怎么看。";
                            readonly additionalProperties: false;
                            readonly properties: {
                                readonly from: {
                                    readonly type: "string";
                                    readonly enum: readonly ["end", "start"];
                                    readonly description: "看末尾还是开头，不写 = 自动。";
                                };
                                readonly hide: {
                                    readonly type: "array";
                                    readonly items: {
                                        readonly type: "string";
                                    };
                                    readonly description: "卡片里藏起的列名。";
                                };
                                readonly sort: {
                                    readonly type: "string";
                                    readonly description: "按哪列排，空串 = 不排。";
                                };
                                readonly desc: {
                                    readonly type: "boolean";
                                    readonly description: "从大到小。";
                                };
                                readonly bars: {
                                    readonly type: "boolean";
                                    readonly description: "数字列画浅条。";
                                };
                            };
                        };
                        readonly folder: {
                            readonly type: "object";
                            readonly description: "文件夹怎么展示。";
                            readonly additionalProperties: false;
                            readonly properties: {
                                readonly show: {
                                    readonly type: "string";
                                    readonly enum: readonly ["images", "files"];
                                    readonly description: "图片墙或文件列表。";
                                };
                                readonly layout: {
                                    readonly type: "string";
                                    readonly enum: readonly ["wall", "strip", "single"];
                                    readonly description: "图片墙的排法。";
                                };
                                readonly order: {
                                    readonly type: "string";
                                    readonly enum: readonly ["newest", "name", "size"];
                                    readonly description: "排序，缺省 newest。";
                                };
                                readonly match: {
                                    readonly type: "string";
                                    readonly description: "只看名字对得上的，如 *.png。";
                                };
                            };
                        };
                    };
                };
            };
        };
    };
    readonly description: {
        readonly type: "string";
        readonly description: "write_node：一句话说明这一步做什么（给人看，不进计划）；空串 = 清除。";
    };
    readonly no_output: {
        readonly type: "boolean";
        readonly description: "write_node：true ⇒ 显式声明本节点不产出文件（写 output: false）。";
    };
    readonly from_template: {
        readonly type: "string";
        readonly description: "write_node：从 templates/nodes/<名>.json 取 data 本体（不复制它的 id 与 position）。";
    };
    readonly to: {
        readonly type: "string";
        readonly description: "rename_workflow：新图名 / save_as_template：节点模板名（缺省 = 步骤 id）。";
    };
    readonly source: {
        readonly type: "string";
        readonly description: "connect / disconnect：源节点 id。";
    };
    readonly target: {
        readonly type: "string";
        readonly description: "connect / disconnect：目标节点 id。";
    };
    readonly when: {
        readonly type: "string";
        readonly description: "connect / disconnect：条件（缺省 = 无条件边）。短判定词（pass / fail）走 VERDICT 约定；也可以写一句自然语言条件，由执行者判断。";
    };
    readonly handoff: {
        readonly type: "string";
        readonly enum: readonly ["result", "none"];
        readonly description: "connect（步骤 → 步骤）：result（缺省）把上游这一次的执行结果交给下游 / none 只管先后。边已存在时只改交接。";
    };
    readonly handoff_note: {
        readonly type: "string";
        readonly description: "connect（步骤 → 步骤）：交接说明——下游拿到执行结果之后怎么用（进派发计划）；空串 = 清除。";
    };
    readonly update: {
        readonly type: "boolean";
        readonly description: "connect（步骤 → 资源）：true = 在原文件上更新（先读再改，如修完在问题清单里打钩）；false = 整份写出。缺省：资源还没人写就是整份写出，已经有人写就是更新。";
    };
    readonly memory: {
        readonly type: "object";
        readonly description: "write_resource：加一张记忆卡（不带 node / resource）。给了 id 且库里有就引用那一条，否则新建一条；不给 id 就按工作流名起名。只给大型、复杂、会反复执行的工作流加。";
        readonly additionalProperties: false;
        readonly properties: {
            readonly type: {
                readonly type: "string";
                readonly enum: readonly ["workflow", "step"];
                readonly description: "workflow 工作流记忆（整个流程共用，不连线）/ step 步骤记忆（只给 step 那一步）。缺省：给了 step 就是 step；引用已有的按库里的类型。";
            };
            readonly id: {
                readonly type: "string";
                readonly description: "记忆库里的 id（list 的 memories 里有）；库里没有就用它新建。";
            };
            readonly step: {
                readonly type: "string";
                readonly description: "步骤记忆挂在哪一步（步骤 id）。";
            };
            readonly name: {
                readonly type: "string";
                readonly description: "新建时的名称（给人看；缺省 = id）。";
            };
            readonly description: {
                readonly type: "string";
                readonly description: "新建时的一句话描述（给人看）。";
            };
        };
    };
    readonly resource: {
        readonly type: "object";
        readonly description: "write_resource：资源的内容（给了 node 就是修改那个资源，给了的字段才改；没给 node 就是新建）。";
        readonly additionalProperties: false;
        readonly properties: {
            readonly label: {
                readonly type: "string";
                readonly description: "名字（计划里称呼它）；空串 = 清除。";
            };
            readonly description: {
                readonly type: "string";
                readonly description: "一句话描述（给人看，不进计划）；空串 = 清除。";
            };
            readonly items: {
                readonly type: "array";
                readonly description: "全部内容（整份替换），按顺序。同类、读写关系相同的资料放进同一个资源的多项里，不要一项建一个资源。";
                readonly items: {
                    readonly type: "object";
                    readonly additionalProperties: false;
                    readonly properties: {
                        readonly kind: {
                            readonly type: "string";
                            readonly enum: readonly ["file", "folder", "url", "skill", "text"];
                            readonly required: true;
                            readonly description: "file 文件 / folder 文件夹（value 是路径：绝对路径原样用；相对路径有步骤写它时在产出根目录下，只被读时相对工作区）/ url 网址 / skill（value 是 skill 名）/ text 自定义（value 是用户自己写的一段提示词，原样交给读它的步骤）。";
                        };
                        readonly value: {
                            readonly type: "string";
                            readonly required: true;
                            readonly description: "路径 / 网址 / skill 名 / 正文。";
                        };
                        readonly note: {
                            readonly type: "string";
                            readonly description: "这一项怎么用。写入的文件写成规格：结构、长度上限；更新的再写明哪些部分就地改写、记录表每次加一行的格式。text 不用。";
                        };
                    };
                };
            };
            readonly display: {
                readonly type: "object";
                readonly description: "在画布上展示这个资源里的一项（图片、HTML、Markdown、文本、文件夹），给了的字段才改。详见 skill workflow-authoring 的「在画布上展示」。";
                readonly additionalProperties: false;
                readonly properties: {
                    readonly show: {
                        readonly type: "boolean";
                        readonly description: "false = 关掉展示。";
                    };
                    readonly size: {
                        readonly type: "string";
                        readonly enum: readonly ["s", "m", "l"];
                        readonly description: "预设尺寸，缺省 m；一般用 s 或 m。";
                    };
                    readonly width: {
                        readonly type: "number";
                        readonly description: "展示区宽（画布像素），优先于 size；一般用 size。";
                    };
                    readonly height: {
                        readonly type: "number";
                        readonly description: "展示区高（画布像素）。";
                    };
                    readonly zoom: {
                        readonly type: "number";
                        readonly description: "缩放百分比，缺省 100，一般不动。";
                    };
                    readonly fit: {
                        readonly type: "string";
                        readonly enum: readonly ["contain", "cover", "actual"];
                        readonly description: "图片怎么放，缺省 contain。";
                    };
                    readonly item: {
                        readonly type: "number";
                        readonly description: "展示第几项（从 0 数）。";
                    };
                    readonly adapt: {
                        readonly type: "boolean";
                        readonly description: "写它的步骤按卡片适配产出，缺省 true。";
                    };
                    readonly look: {
                        readonly type: "string";
                        readonly enum: readonly ["card", "clear", "bare", "glass", "auto"];
                        readonly description: "卡片外观，不写跟着用户设置。";
                    };
                    readonly hideTitle: {
                        readonly type: "boolean";
                        readonly description: "不选中、不悬停时藏起标题。";
                    };
                    readonly lines: {
                        readonly type: "object";
                        readonly description: "日志、纯文本怎么看。";
                        readonly additionalProperties: false;
                        readonly properties: {
                            readonly from: {
                                readonly type: "string";
                                readonly enum: readonly ["end", "start"];
                                readonly description: "看末尾还是开头，不写 = 自动。";
                            };
                            readonly filter: {
                                readonly type: "string";
                                readonly description: "只显示含这段字的行，空串 = 不筛。";
                            };
                            readonly regex: {
                                readonly type: "boolean";
                                readonly description: "filter 按正则。";
                            };
                            readonly context: {
                                readonly type: "number";
                                readonly description: "匹配前后各带几行。";
                            };
                        };
                    };
                    readonly table: {
                        readonly type: "object";
                        readonly description: "CSV / TSV 怎么看。";
                        readonly additionalProperties: false;
                        readonly properties: {
                            readonly from: {
                                readonly type: "string";
                                readonly enum: readonly ["end", "start"];
                                readonly description: "看末尾还是开头，不写 = 自动。";
                            };
                            readonly hide: {
                                readonly type: "array";
                                readonly items: {
                                    readonly type: "string";
                                };
                                readonly description: "卡片里藏起的列名。";
                            };
                            readonly sort: {
                                readonly type: "string";
                                readonly description: "按哪列排，空串 = 不排。";
                            };
                            readonly desc: {
                                readonly type: "boolean";
                                readonly description: "从大到小。";
                            };
                            readonly bars: {
                                readonly type: "boolean";
                                readonly description: "数字列画浅条。";
                            };
                        };
                    };
                    readonly folder: {
                        readonly type: "object";
                        readonly description: "文件夹怎么展示。";
                        readonly additionalProperties: false;
                        readonly properties: {
                            readonly show: {
                                readonly type: "string";
                                readonly enum: readonly ["images", "files"];
                                readonly description: "图片墙或文件列表。";
                            };
                            readonly layout: {
                                readonly type: "string";
                                readonly enum: readonly ["wall", "strip", "single"];
                                readonly description: "图片墙的排法。";
                            };
                            readonly order: {
                                readonly type: "string";
                                readonly enum: readonly ["newest", "name", "size"];
                                readonly description: "排序，缺省 newest。";
                            };
                            readonly match: {
                                readonly type: "string";
                                readonly description: "只看名字对得上的，如 *.png。";
                            };
                        };
                    };
                };
            };
        };
    };
    readonly goal: {
        readonly type: "string";
        readonly description: "compile：本次目标（用户说了要做成什么时写，进计划的「本次执行」段）。";
    };
    readonly full: {
        readonly type: "boolean";
        readonly description: "compile：true = 整卷预览（内联正文，不建实例、不写文件）；建图后自检用它。";
    };
    readonly output_root: {
        readonly type: "string";
        readonly description: "configure：产出根目录（相对工作区或绝对路径），编译时拼在每个产出文件前面；{instance} 换成实例 id。空串 = 清除（默认 .workflow-lite/runs/{instance}/out），. = 工作区根目录。";
    };
    readonly run_state: {
        readonly type: "boolean";
        readonly description: "configure：记录运行状态。打开后每个工作流实例都带一份运行状态，执行时按计划末尾「运行状态」段用 state 记进度。";
    };
    readonly instance: {
        readonly type: "string";
        readonly description: "resume / state：实例 id（缺省 = 本会话当前的实例；用户从画布上执行时会给出）。";
    };
    readonly status: {
        readonly type: "string";
        readonly enum: readonly ["pending", "running", "waiting", "done", "failed", "cancelled"];
        readonly description: "state：整体状态。";
    };
    readonly note: {
        readonly type: "string";
        readonly description: "state：整体的一句说明（waiting 写等什么、failed / cancelled 写原因）；空串 = 清掉。";
    };
    readonly nodes: {
        readonly type: "array";
        readonly description: "state：要改的步骤，每项一个。改 status 时插件自动补轮次、开始 / 结束时间和流水；done 带 summary、outputs，有条件出边的带 verdict（取它出边的条件值）；failed 带 error。";
        readonly items: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly properties: {
                readonly id: {
                    readonly type: "string";
                    readonly required: true;
                    readonly description: "步骤 id（大小写与图一致）。";
                };
                readonly status: {
                    readonly type: "string";
                    readonly enum: readonly ["pending", "running", "waiting", "done", "failed", "skipped"];
                    readonly description: "步骤状态。";
                };
                readonly summary: {
                    readonly type: "string";
                    readonly description: "一两句结论（200 字以内）；空串 = 清掉。";
                };
                readonly outputs: {
                    readonly type: "array";
                    readonly items: {
                        readonly type: "string";
                    };
                    readonly description: "这一轮实际写出的文件路径（照计划里给的路径写）。";
                };
                readonly verdict: {
                    readonly type: "string";
                    readonly description: "判定：它出边的条件值之一（如 pass / fail）。";
                };
                readonly error: {
                    readonly type: "string";
                    readonly description: "失败原因。";
                };
                readonly by: {
                    readonly type: "string";
                    readonly description: "谁做的：self / subagent / 队员名。";
                };
            };
        };
    };
    readonly log: {
        readonly type: "string";
        readonly description: "state：往流水追加一条说明。";
    };
    readonly input: {
        readonly type: "object";
        readonly description: "write_node：给了它就是新建或修改一个输入节点（执行前问用户的问题；问题与回答进计划，占位与说明只给填写的人看）。";
        readonly additionalProperties: false;
        readonly properties: {
            readonly question: {
                readonly type: "string";
                readonly description: "问题（一行）；新建时必填。";
            };
            readonly kind: {
                readonly type: "string";
                readonly enum: readonly ["text", "textarea", "choice", "multi"];
                readonly description: "text 一句话（缺省）/ textarea 多行 / choice 单选 / multi 多选。";
            };
            readonly options: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
                readonly description: "选项（choice / multi）。";
            };
            readonly default: {
                readonly type: "string";
                readonly description: "默认值（文字题的预填文字、单选的一个选项）。";
            };
            readonly defaults: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
                readonly description: "多选的默认选项。";
            };
            readonly placeholder: {
                readonly type: "string";
                readonly description: "输入框里的灰字；空串 = 清除。";
            };
            readonly hint: {
                readonly type: "string";
                readonly description: "填写时显示的说明；空串 = 清除。";
            };
            readonly required: {
                readonly type: "boolean";
                readonly description: "必填。";
            };
            readonly other: {
                readonly type: "boolean";
                readonly description: "允许用户自己填写（choice / multi）：可以不选选项，改填自己的答案；计划里会注明是用户自填。";
            };
        };
    };
    readonly answers: {
        readonly type: "array";
        readonly description: "compile：用户对输入节点的回答，每项一个；没给的用默认值。用户在画布上点「执行」时已经填过，不用再给。";
        readonly items: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly properties: {
                readonly id: {
                    readonly type: "string";
                    readonly required: true;
                    readonly description: "输入节点 id。";
                };
                readonly value: {
                    readonly type: "string";
                    readonly description: "文字题、单选的回答。";
                };
                readonly values: {
                    readonly type: "array";
                    readonly items: {
                        readonly type: "string";
                    };
                    readonly description: "多选选中的项。";
                };
            };
        };
    };
    readonly all: {
        readonly type: "boolean";
        readonly description: "runs：true = 列所有会话的实例（缺省只列本会话的）。";
    };
    readonly mode: {
        readonly type: "string";
        readonly enum: readonly ["auto", "serial", "subagent", "team"];
        readonly description: "configure：执行方式。auto 由主 agent 决定 / serial 本人串行 / subagent 主 agent 派子代理 / team 主 agent 当 Agent Team 的 Lead。";
    };
    readonly reuse: {
        readonly type: "string";
        readonly enum: readonly ["auto", "reuse", "fresh"];
        readonly description: "configure：复用执行者——同一个步骤再次执行（循环下一轮、重试、中断后继续）交给谁。auto 由主 agent 决定 / reuse 交回上次做它的子代理或队员，带着之前的上下文 / fresh 每次新派，上下文干净。serial 时不起作用。";
    };
    readonly set_goal: {
        readonly type: "boolean";
        readonly description: "configure：设定目标（缺省开）。开着时计划让主 agent 开始前用 create_goal 把这次执行设成会话目标，做完标记完成；长流程不会做一半就停。";
    };
};
