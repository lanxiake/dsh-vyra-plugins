/* ─────────────────────────────────────────────────────────────────────────
   StudyMate · 纯函数域 —— 记忆模块：两份 `MEMORY.yaml` 的分节与投影

   一句话：给它两份记忆文件的**文本**（读不到就传 `null`），它给出 ①可注入的画像三节投影、
   ②`积累` 条目的键与内容、③节名完整性与空骨架的判定。不碰盘、不发请求、不认识工作区——
   「这两份文件在哪」按「文件归属」由调用方去找（`MEMORY_FILE` 与它同一份词表）。

   为什么要有这一层：共享记忆与科目记忆是**两种可见性**，不是两份内容。学生画像三节
   （`我是谁` / `教学偏好` / `学习习惯`）可以进上下文；`积累`（角色攒下的干活笔记）与整份
   科目记忆**永不进入任何上下文**。这条边界不能靠提示词约定——三处取内容的消费路径（答疑开张
   注入、工作区摘要工具、图片库载荷）各自读盘，各写一遍「取哪几节」就会漂。所以分节与白名单
   只在这里定义一次，调用方只拿投影文本。第四处会点到「记忆」这个名字的消费点是监听域
   （`lib/watch/domains.ts`）：它只按文件名认这份文件、一个字节的内容都不带（它回答「哪一片
   变了」，不是「取哪几节」），所以那里没有投影可用，也不该有。

   为什么投影是**原文照搬**而不是重新序列化：投影要能一眼对回学生自己写的那几行（他在文件里
   改了措辞，注入的就是他改的措辞）。所以这里只切段、不构造值，跟 `resources.ts` 的
   分节器同一套读法（`##` 换成一级键）。

   为什么「节」= 顶格的 `键:`：记忆是一份 YAML，节名就是一级键（`lib/yaml.ts` 的读法）。
   代码块、缩进的子键、行内注释都不算节。**第一个节名之前的引言不算节**——那是这份文件的
   定位说明（模板里的注释），既不是画像也不是积累。

   为什么「一条」= 有内容的那一行：空列表 `[]`、空映射 `{}`、`null` 都是「这一条还没有内容」
   （模板骨架就长这样），不算条目。一条 = 中文键 + 内容，键下面缩进更深的行（列表项、块标量）
   算这条的内容。这样「空骨架」有判定：文件在盘上、四个节名齐全、一条内容都没有。

   已知的取舍：**不认块标量里的顶格行**（`|` 内容里出现一列 0 的 `键:` 会被当成新的一节）。
   记忆是一行一条的短文本，真写出那种结构时该改的是记忆本身；为它写一个 YAML 块标量状态机
   不值得（`yamlpos.ts` 也刻意在没把握的结构上退让）。
   ───────────────────────────────────────────────────────────────────────── */

/** 记忆的两种归属：共享记忆（工作区根的 `.learning/` 下）与科目记忆（科目目录下）。 */
export type MemoryKind = 'shared' | 'subject';

/** 两份记忆都叫这个名字（位置不同，路径见「文件归属」）。 */
export const MEMORY_FILE = 'MEMORY.yaml';

/** 画像三节：**只有这三节**能被注入；顺序即投影顺序（文件里怎么排都不改变它）。 */
export const PROFILE_SECTIONS = ['我是谁', '教学偏好', '学习习惯'] as const;

/** 角色攒下的干活笔记：一条 = 中文键 + 内容，**永不进上下文**。 */
export const ACCUMULATION_SECTION = '积累';

/** 每类记忆按规范该有的节（顺序即规范顺序）。 */
export const MEMORY_SECTIONS: Record<MemoryKind, readonly string[]> = {
  shared: [...PROFILE_SECTIONS, ACCUMULATION_SECTION],
  subject: [ACCUMULATION_SECTION],
};

/** 记忆里的一条：中文键 + 内容。列表项没有键，键就是空串。 */
export interface MemoryEntry {
  /** 键（`积累` 里那一行冒号前的词）；列表项之类没有键的条目是空串。 */
  key: string;
  /** 内容原文（键下面缩进更深的行按原样接起来；空的一律不算条目）。 */
  content: string;
  /** 键（或列表项）那一行的 1 起行号，与校验器的 `line` 口径一致。 */
  line: number;
}

/** 一节：标题行、行号范围、条目、以及这一节的原文。 */
export interface MemorySectionView {
  /** 一级键的键名（去掉两端空白与包裹的引号）。 */
  heading: string;
  /** 标题行的 1 起行号。 */
  from: number;
  /** 下一节标题之前的最后一行（含）的 1 起行号；本节是最后一节时就是文件末行。
   *  这是**文件里的事实**（下一节从哪一行开始），与「哪几行算这一节的内容」不是一回事——
   *  正文的边界见 `text`。 */
  to: number;
  /** 这一节里有内容的条目（空列表、空映射都不算）。 */
  entries: MemoryEntry[];
  /** 这一节的原文：标题行 + 正文，止于最后一个非空非注释行（下一节标题上方的注释块属于
   *  下一节，见下面 `text` 那一步的注释）。投影就是从这儿取的。 */
  text: string;
}

/** 一份记忆文件的判读结果。 */
export interface MemoryFileView {
  /** 文件在盘上（这次调用真的拿到了文本）。 */
  present: boolean;
  /** 文件里出现的节，按文件顺序。 */
  sections: MemorySectionView[];
  /** 规范里有、这份文件里没有的节名（按规范顺序）。 */
  missing: string[];
  /** 文件里有、规范里没有的节名（按文件顺序）——节名完整性两个方向都要判。 */
  unknown: string[];
  /** 一条内容都没有——`present:true` 时就是「空骨架」（模板预置的那种），`present:false` 也是 true。 */
  empty: boolean;
  /** 可注入的画像三节投影；科目记忆与 `积累` 永远是空串。 */
  injectable: string;
  /** 这一份文件里的 `积累` 条目。 */
  accumulations: MemoryEntry[];
}

/** 一条带出处的 `积累` 条目。 */
export interface AccumulationEntry extends MemoryEntry {
  /** 这一条来自哪份记忆。 */
  from: MemoryKind;
}

/** 两份记忆的判读结果。 */
export interface MemoryReport {
  shared: MemoryFileView;
  subject: MemoryFileView;
  /** 共享记忆的画像三节投影（= `shared.injectable`）。`积累` 与科目记忆一个字都不在里面。 */
  injectable: string;
  /** 两份记忆的全部 `积累` 条目：共享在前、科目在后，各自按文件顺序。 */
  accumulations: AccumulationEntry[];
  /** 两份都一条内容都没有。 */
  empty: boolean;
}

/** 两份记忆的文本；读不到就传 `null`／`undefined`（那是「没有这份记忆」，不是错误）。 */
export interface MemoryTexts {
  shared?: string | null;
  subject?: string | null;
}

/* ── 行扫描 ─────────────────────────────────────────────────────────────── */

/** 与校验器同一套断行口径（`\r\n` / `\r` / `\n` 都算断行）。 */
function splitLines(text: string): string[] {
  return text.split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/);
}

/** 一级键：顶格、`键:`、冒号后是空白或行尾。`###`／缩进的子键／注释都不是节。 */
const HEADING_RE = /^([^\s#:][^:]*?)[ \t]*:(?:[ \t](.*))?$/;
/** 键行（任意缩进）。`url: https://x` 这种冒号后跟非空白的写法不算键——与 `lib/yaml.ts` 同口径。 */
const KEY_RE = /^([ \t]*)([^\s#][^:]*?)[ \t]*:(?:[ \t](.*))?$/;
/** 列表项（任意缩进）。 */
const ITEM_RE = /^([ \t]*)[-*+][ \t]+(.*\S)[ \t]*$/;
/** 空值：`[]`／`{}`／`null`／`~`／空引号——「这一条还没有内容」，不是一条。 */
const EMPTY_VALUE_RE = /^(?:\[\s*\]|\{\s*\}|null|~|''|""|Null|NULL)$/;
/** 块标量的引子（`|`、`|-`、`>2` 之类）：内容在下面那几行里。 */
const BLOCK_VALUE_RE = /^[|>][+-]?[0-9]*$/;
/** 行首缩进。 */
const INDENT_RE = /^[ \t]*/;

/** 去掉键两端可能包着的引号（YAML 允许 `"我是谁":` 与 `'我是谁':`）。 */
const QUOTED_RE = /^(['"])(.*)\1$/s;

function unquote(text: string): string {
  const trimmed = text.trim();
  const quoted = QUOTED_RE.exec(trimmed);
  return quoted === null ? trimmed : (quoted[2] ?? '').trim();
}

/** 缩进宽度（制表符按一列算——记忆是手写的短文本，不做制表符展开）。 */
function indentOf(line: string): number {
  return (INDENT_RE.exec(line)?.[0] ?? '').length;
}

/** 注释行与空行都不是内容。 */
function isBlankOrComment(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === '' || trimmed.startsWith('#');
}

/** 一块（键下面缩进更深的行）摊平成内容：去掉列表项前缀与两端空白，按行接起来。 */
function blockContent(lines: readonly string[]): string {
  const parts: string[] = [];
  for (const line of lines) {
    if (isBlankOrComment(line)) continue;
    const item = ITEM_RE.exec(line);
    parts.push((item ? (item[2] ?? '') : line).trim());
  }
  return parts.join('\n');
}

/** 一个键下面缩进更深的行（块值）：从 `index` 往下收到缩进回到 `level` 为止。 */
function blockBelow(lines: readonly string[], index: number, to: number, level: number): string[] {
  const block: string[] = [];
  for (let next = index + 1; next < to; next += 1) {
    const following = lines[next] ?? '';
    if (isBlankOrComment(following)) continue;
    if (indentOf(following) <= level) break;
    block.push(following);
  }
  return block;
}

/** 一个节里、处于 `level` 那一层的条目：键行与列表项都算。 */
function entriesOf(lines: readonly string[], from: number, to: number): { entries: MemoryEntry[]; level: number | null } {
  let level: number | null = null;
  for (let index = from; index < to; index += 1) {
    const line = lines[index] ?? '';
    if (isBlankOrComment(line)) continue;
    level = indentOf(line);
    break;
  }
  if (level === null) return { entries: [], level };

  const entries: MemoryEntry[] = [];
  for (let index = from; index < to; index += 1) {
    const line = lines[index] ?? '';
    if (isBlankOrComment(line) || indentOf(line) !== level) continue;
    const item = ITEM_RE.exec(line);
    const key = item === null ? KEY_RE.exec(line) : null;

    // 这一条的内容：内联值；内联是空的（或块标量引子）就往下收它缩进更深的行
    let content = '';
    let name = '';
    if (item !== null) {
      content = (item[2] ?? '').trim();
    } else if (key !== null) {
      name = unquote(key[2] ?? '');
      const inline = (key[3] ?? '').trim();
      if (inline !== '' && !EMPTY_VALUE_RE.test(inline) && !BLOCK_VALUE_RE.test(inline)) {
        content = inline;
      } else {
        content = blockContent(blockBelow(lines, index, to, level));
      }
    } else {
      // 没写键、也不是列表项的整行散文：也算这一节的一条（宽容读法——学生手写的句子
      // 不该被静默丢掉，投影本来就是原文照搬）。空骨架的判定不受影响：散文也是内容。
      content = line.trim();
    }
    if (content === '') continue; // 空列表／空映射：这一条还没有内容
    entries.push({ key: name, content, line: index + 1 });
  }
  return { entries, level };
}

/** 投影用的一节正文：整行注释不是内容（`isBlankOrComment`，与 `entriesOf` / `blockContent`
 *  同一套判据），空行只是排版。节体里**任何位置**的注释都不进注入——注释是写给人看的说明书，
 *  不是学生画像；学生的每一行照旧原样留着（他改了措辞，注入的就是他改的措辞）。 */
function projectedBody(text: string): string {
  return splitLines(text).filter((line) => !isBlankOrComment(line)).join('\n');
}

/* ── 一份文件 → 一份判读 ────────────────────────────────────────────────── */

/**
 * 判读一份记忆文件的文本。`text` 是 `null`／`undefined` 就是「这份文件不存在」——
 * 判读结果照样给全（`missing` 是规范里的全部节名），不抛错、不造默认内容。
 */
export function readMemoryFile(kind: MemoryKind, text?: string | null): MemoryFileView {
  const canonical = MEMORY_SECTIONS[kind];
  const present = typeof text === 'string';
  const lines = present ? splitLines(text as string) : [];

  const heads: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (HEADING_RE.test(lines[index] ?? '')) heads.push(index);
  }

  const sections: MemorySectionView[] = [];
  heads.forEach((head, position) => {
    const next = heads[position + 1];
    const end = next === undefined ? lines.length - 1 : next - 1;
    const body = lines.slice(head, end + 1);
    // 节体止于最后一个非空非注释行：**下一节标题上方的注释块是下一节的说明书**——模板里
    // 「积累」上方那三行就落在「学习习惯」的 `to` 范围里，收进这一节的正文就会跟着进注入。
    // 标题行既不空也不是注释，所以这里一定收得住。
    while (body.length > 1 && isBlankOrComment(body[body.length - 1] ?? '')) body.pop();
    const { entries } = entriesOf(lines, head + 1, end + 1);
    sections.push({
      heading: unquote((HEADING_RE.exec(lines[head] ?? '')?.[1] ?? '').trim()),
      from: head + 1,
      to: end + 1,
      entries,
      text: body.join('\n'),
    });
  });

  const found = new Set(sections.map((section) => section.heading));
  const empty = sections.every((section) => section.entries.length === 0);
  const injectable = MEMORY_SECTIONS[kind]
    .filter((heading) => (PROFILE_SECTIONS as readonly string[]).includes(heading))
    .map((heading) => sections.find((section) => section.heading === heading))
    .filter((section): section is MemorySectionView => section !== undefined && section.entries.length > 0)
    .map((section) => projectedBody(section.text))
    .join('\n\n');

  const accumulation = sections.filter((section) => section.heading === ACCUMULATION_SECTION);
  return {
    present,
    sections,
    missing: canonical.filter((heading) => !found.has(heading)),
    unknown: sections.map((section) => section.heading)
      .filter((heading) => !canonical.includes(heading)),
    empty,
    injectable,
    accumulations: accumulation.flatMap((section) => section.entries),
  };
}

/** 判读两份记忆。调用方按「文件归属」找到路径、把文本读进来（读不到就传 `null`）。 */
export function readMemory(texts: MemoryTexts = {}): MemoryReport {
  const shared = readMemoryFile('shared', texts.shared);
  const subject = readMemoryFile('subject', texts.subject);
  return {
    shared,
    subject,
    injectable: shared.injectable,
    accumulations: [
      ...shared.accumulations.map((entry) => ({ ...entry, from: 'shared' as const })),
      ...subject.accumulations.map((entry) => ({ ...entry, from: 'subject' as const })),
    ],
    empty: shared.empty && subject.empty,
  };
}
