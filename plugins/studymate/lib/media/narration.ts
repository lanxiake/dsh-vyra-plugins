/* ─────────────────────────────────────────────────────────────────────────
   StudyMate · 媒体域 —— narration.md 的解析与对齐

   旁白是第二内容源：learning-coach 与课件同源写，但只写「怎么讲」。
   它必须按 `##` 与课件的二级标题逐字对齐；某节没写就退回自动抽取的旁白。
   这里的判据与课件格式同一条：认不出就报错，不静默错位。
   ───────────────────────────────────────────────────────────────────────── */

const CJK_RE = /[　-〿㐀-䶿一-鿿豈-﫿＀-￯]/;

export interface NarrationSection {
  heading: string;
  text: string;
  paragraphs: string[];
  line: number;
  /** 这一节的自然语言语气指令（Breeze 用；其他 provider 忽略）。 */
  instruction?: string;
}

export interface NarrationProblem {
  file: string;
  line: number;
  message: string;
  code: string;
}

export interface NarrationParseResult {
  version: 1;
  title: string;
  /** 全课默认语气指令；分节 @instruction 覆盖它。 */
  instruction: string;
  sections: NarrationSection[];
  problems: NarrationProblem[];
}

function joinLine(left: string, right: string): string {
  if (left === '') return right;
  if (right === '') return left;
  const gap = CJK_RE.test(left[left.length - 1]) && CJK_RE.test(right[0]) ? '' : ' ';
  return left + gap + right;
}

function problem(file: string, line: number, message: string, code: string): NarrationProblem {
  return { file, line: Math.max(1, line), message, code };
}

export function parseNarration(source: string, file: string): NarrationParseResult {
  const lines = String(source).split(/\r?\n/);
  const problems: NarrationProblem[] = [];
  let cursor = 0;
  let title = '';
  let instruction = '';

  // front matter：只认 title；别的键报错，不猜。
  while (cursor < lines.length && lines[cursor].trim() === '') cursor += 1;
  if (lines[cursor]?.trim() === '---') {
    const open = cursor;
    cursor += 1;
    let closed = false;
    for (; cursor < lines.length; cursor += 1) {
      const line = lines[cursor].trim();
      if (line === '---') {
        closed = true;
        cursor += 1;
        break;
      }
      if (line === '') continue;
      const match = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
      if (!match) {
        problems.push(problem(file, cursor + 1, `front matter 只认 key: value 行，读到 ${JSON.stringify(line)}`, 'front-matter'));
        continue;
      }
      const key = match[1];
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (key === 'title') title = value;
      else if (key === 'instruction') instruction = value;
      else problems.push(problem(file, cursor + 1, `narration.md 的 front matter 只允许 title / instruction，读到 ${key}`, 'front-matter-key'));
    }
    if (!closed) {
      problems.push(problem(file, open + 1, 'narration.md 的 front matter 没有收尾的 ---', 'front-matter-unterminated'));
    }
  }

  const sections: NarrationSection[] = [];
  let current: NarrationSection | null = null;
  let buffer = '';
  let inFence = false;
  let fenceLine = 0;

  const flushParagraph = (): void => {
    if (!current) {
      if (buffer.trim() !== '') {
        problems.push(problem(file, 1, '旁白正文出现在第一个 ## 之前：每段口播都要挂在某一节下面', 'narration-text-before-heading'));
      }
      buffer = '';
      return;
    }
    const text = buffer.trim();
    if (text !== '') current.paragraphs.push(text);
    buffer = '';
  };

  for (let index = cursor; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    const lineNo = index + 1;

    if (inFence) {
      if (line.startsWith('```')) inFence = false;
      continue;
    }

    if (line.startsWith('```')) {
      flushParagraph();
      problems.push(problem(file, lineNo, 'narration.md 里不能写代码围栏：旁白只写口头讲的话', 'narration-fence'));
      inFence = true;
      fenceLine = lineNo;
      continue;
    }

    if (line === '') {
      flushParagraph();
      continue;
    }

    if (line.startsWith('## ')) {
      flushParagraph();
      const heading = line.slice(3).trim();
      if (heading === '') {
        problems.push(problem(file, lineNo, '## 后面要有小节标题', 'narration-heading-empty'));
        continue;
      }
      current = { heading, text: '', paragraphs: [], line: lineNo };
      sections.push(current);
      continue;
    }

    if (line.startsWith('@instruction:')) {
      flushParagraph();
      if (!current) {
        problems.push(problem(file, lineNo, '@instruction 必须挂在某个 ## 小节下面', 'narration-instruction-orphan'));
        continue;
      }
      const value = line.slice('@instruction:'.length).trim();
      if (value === '') {
        problems.push(problem(file, lineNo, '@instruction: 后面要有自然语言描述', 'narration-instruction-empty'));
        continue;
      }
      if (current.instruction) {
        problems.push(problem(file, lineNo, `## ${current.heading} 已有 @instruction，一节只能写一条`, 'narration-instruction-duplicate'));
        continue;
      }
      if (current.paragraphs.length > 0) {
        problems.push(problem(file, lineNo, '@instruction 必须紧跟在 ## 标题下面，写在正文之前', 'narration-instruction-order'));
        continue;
      }
      current.instruction = value;
      continue;
    }

    if (line.startsWith('@')) {
      flushParagraph();
      problems.push(problem(file, lineNo, `认不出 @${line.slice(1).split(':')[0]}：目前只支持 @instruction:`, 'narration-annotation'));
      continue;
    }

    if (line.startsWith('# ') || line.startsWith('### ')) {
      flushParagraph();
      problems.push(problem(file, lineNo, 'narration.md 只允许 ## 小节标题；# 与 ### 都不允许', 'narration-heading-level'));
      continue;
    }

    if (line.startsWith(':::') || line.startsWith('|')) {
      flushParagraph();
      problems.push(problem(file, lineNo, 'narration.md 只写口播文字：不能有 ::: 指令块或表格', 'narration-block'));
      continue;
    }

    if (/^<\/?[A-Za-z][A-Za-z0-9]*(\s|>|\/)/.test(line) || line.startsWith('<!--')) {
      flushParagraph();
      problems.push(problem(file, lineNo, 'narration.md 里不能写 HTML 标签', 'narration-html'));
      continue;
    }

    buffer = joinLine(buffer, line);
  }

  if (inFence) {
    problems.push(problem(file, fenceLine, '代码围栏没有收尾', 'narration-fence-unterminated'));
  }
  flushParagraph();

  for (const section of sections) {
    section.text = section.paragraphs.join('\n\n');
    if (section.text === '') {
      problems.push(problem(file, section.line, `## ${section.heading} 下面没有口播文字`, 'narration-empty-section'));
    }
  }

  if (sections.length === 0) {
    problems.push(problem(file, 1, 'narration.md 里没有任何 ## 小节', 'narration-no-sections'));
  }

  return { version: 1, title, instruction, sections, problems };
}

export interface NarrationAlignmentOptions {
  lessonHeadings: string[];
  lessonTitle?: string;
  file: string;
}

/** 章节必须逐字匹配课件的二级标题；顺序必须一致；缺节允许（用自动旁白兜底）。 */
export function validateNarration(
  narration: NarrationParseResult,
  options: NarrationAlignmentOptions,
): NarrationProblem[] {
  const problems = [...narration.problems];
  if (narration.title && options.lessonTitle && narration.title !== options.lessonTitle) {
    problems.push(problem(
      options.file, 1,
      `narration.md 的 title「${narration.title}」与课件标题「${options.lessonTitle}」不一致`,
      'narration-title-mismatch',
    ));
  }

  const index = new Map<string, number>();
  options.lessonHeadings.forEach((heading, position) => {
    if (!index.has(heading)) index.set(heading, position);
  });

  const seen = new Set<string>();
  let lastPosition = -1;
  for (const section of narration.sections) {
    if (seen.has(section.heading)) {
      problems.push(problem(options.file, section.line,
        `## ${section.heading} 重复出现；一节只能有一段口播`, 'narration-duplicate-heading'));
      continue;
    }
    seen.add(section.heading);
    const position = index.get(section.heading);
    if (position === undefined) {
      problems.push(problem(options.file, section.line,
        `## ${section.heading} 在课件里没有对应的二级标题（必须逐字一致）`, 'narration-unknown-heading'));
      continue;
    }
    if (position < lastPosition) {
      problems.push(problem(options.file, section.line,
        `## ${section.heading} 的顺序与课件不一致：请按课件从上到下写`, 'narration-order'));
      continue;
    }
    lastPosition = position;
  }

  return problems;
}
