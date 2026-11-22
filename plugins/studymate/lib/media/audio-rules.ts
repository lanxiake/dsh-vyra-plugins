/* ─────────────────────────────────────────────────────────────────────────
   StudyMate · 媒体域 —— 纯音频写作规则

   音频用户没有文字和图片，课件里的「如图」「上表」「看这段代码」在耳朵里是断的。
   这一层只做**提醒**，不阻断生成：确定性兜底旁白本来就会带视觉指代，
   等 narration.md 成为强制交付后再把 blocking 打开。
   ───────────────────────────────────────────────────────────────────────── */

const CJK_RE = /[　-〿㐀-䶿一-鿿豈-﫿＀-￯]/;

/** 粗略估算口播时长：中文按字、英文按词，4.5 单位/秒。TTS 会用真实时长覆盖。 */
export function estimateSpeechSeconds(text: string): number {
  const cjk = (text.match(new RegExp(CJK_RE.source, 'g')) ?? []).length;
  const latin = (text.match(/[A-Za-z0-9]+/g) ?? []).length;
  return Math.max(2, Math.ceil((cjk + latin * 2) / 4.5));
}

export type AudioProblemSeverity = 'blocking' | 'warning';

export interface AudioProblem {
  file: string;
  line: number;
  code: string;
  severity: AudioProblemSeverity;
  message: string;
}

export interface AudioSceneLike {
  heading: string;
  narration: string;
  line?: number;
}

export interface AudioRuleOptions {
  file: string;
  /** 单句软上限（码点）；默认 38。 */
  maxSentenceChars?: number;
  /** 单节软上限（估算秒数）；默认 240 秒。 */
  maxSectionSeconds?: number;
}

const VISUAL_DEIXIS_RE = /(如图所示|如图|见图|上图|下图|上表|下表|看这张图|看这张表|看这段代码|这个按钮|屏幕上)/g;
const SPATIAL_DEIXIS_RE = /(左边|右边|表格里|表中)/g;
const SUMMARY_RE = /(小结|关键是|记住|一句话|总结|所以说)/;

function matches(pattern: RegExp, text: string): string[] {
  const found = text.match(pattern) ?? [];
  return [...new Set(found)];
}

/** 检查最终会进音频的旁白（包括自动兜底）。返回逐条提醒。 */
export function validateAudioOnly(
  scenes: AudioSceneLike[],
  options: AudioRuleOptions,
): AudioProblem[] {
  const problems: AudioProblem[] = [];
  const maxSentence = options.maxSentenceChars ?? 38;
  const maxSection = options.maxSectionSeconds ?? 240;

  for (const scene of scenes) {
    const line = scene.line ?? 1;
    const text = scene.narration;

    for (const hit of matches(VISUAL_DEIXIS_RE, text)) {
      problems.push({
        file: options.file,
        line,
        code: 'audio-visual-deixis',
        severity: 'warning',
        message: `${scene.heading}：出现视觉指代「${hit}」。音频里要描述，不要指图 / 表 / 代码`,
      });
    }

    for (const hit of matches(SPATIAL_DEIXIS_RE, text)) {
      problems.push({
        file: options.file,
        line,
        code: 'audio-spatial-deixis',
        severity: 'warning',
        message: `${scene.heading}：出现空间指代「${hit}」。要么改成语言描述，要么确认听众能在脑中建立位置`,
      });
    }

    for (const sentence of text.split(/[。！？!?；;\n]+/).map((part) => part.trim()).filter(Boolean)) {
      const length = [...sentence].length;
      if (length > maxSentence) {
        problems.push({
          file: options.file,
          line,
          code: 'audio-long-sentence',
          severity: 'warning',
          message: `${scene.heading}：一句话 ${length} 字，建议拆成两句：「${sentence.slice(0, 24)}…」`,
        });
      }
    }

    const seconds = estimateSpeechSeconds(text);
    if (seconds > maxSection) {
      problems.push({
        file: options.file,
        line,
        code: 'audio-long-section',
        severity: 'warning',
        message: `${scene.heading}：估算约 ${Math.round(seconds / 60)} 分钟，建议拆成 4 分钟以内的小节`,
      });
    }

    if (!SUMMARY_RE.test(text)) {
      problems.push({
        file: options.file,
        line,
        code: 'audio-no-summary',
        severity: 'warning',
        message: `${scene.heading}：没看到小结句。结尾加一句「这一节的关键是……」`,
      });
    }
  }

  return problems;
}
