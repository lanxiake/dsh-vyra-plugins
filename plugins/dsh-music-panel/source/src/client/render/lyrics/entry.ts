/**
 * Build entry for Folia's lyric pipeline.
 *
 * `src/utils/lyrics/**` is a verbatim copy of Folia's tree (parsers for LRC / enhanced
 * LRC / YRC / QRC / KRC / TTML, the staff-credit policy, chorus effects, render hints).
 * The plugin's client is a plain concatenation, so this entry bundles the parser into
 * `lyrics.bundle.js` and the client calls `MPFoliaLyrics.parse` instead of rolling its
 * own LRC parser.
 */
import { LyricParserFactory } from '../../utils/lyrics/LyricParserFactory';
import type { RawLyricSource } from '../../utils/lyrics/types';

export { LyricParserFactory } from '../../utils/lyrics/LyricParserFactory';
export { detectNonTtmlTimedLyricFormat } from '../../utils/lyrics/formatDetection';
export { serializeEnhancedLrc } from '../../utils/lyrics/enhancedLrcSerializer';
export { ensureLyricDataRenderHints } from '../../utils/lyrics/renderHints';
export { resolveLyricProcessingOptions } from '../../utils/lyrics/filtering';
export { applyLyricStaffPolicy } from '../../utils/lyrics/staffCreditsPolicy';
export { applyChorusRangesByTime, applyDetectedChorusEffects } from '../../utils/lyrics/chorusEffects';
export { isPureMusicLyricLines, isPureMusicLyricText } from '../../utils/lyrics/pureMusic';
export { clearLyricOffsets, readLyricOffset, writeLyricOffset } from '../../utils/lyrics/lyricOffsetMemory';
export { applyLyricLineRules, compileLyricLineRules, LYRIC_LINE_PRESETS } from '../../utils/lyrics/lyricLineRules';
export {
  SEGMENTATION_DELIMITER,
  applyLyricWordSegmentation,
  buildSegmentationBoundaries,
  buildSegmentationExportText,
  countAppliedSegmentationLines,
  createLyricSegmentationRecord,
  getLyricLineSegmentationKey,
  isLyricSegmentationRecord,
  parseSegmentationImport,
  SegmentationImportError,
} from '../../utils/lyrics/lyricSegmentationRecord';
import { applyLyricLineRules, compileLyricLineRules } from '../../utils/lyrics/lyricLineRules';
import { applyLyricStaffPolicy } from '../../utils/lyrics/staffCreditsPolicy';
import { applyChorusRangesByTime, applyDetectedChorusEffects } from '../../utils/lyrics/chorusEffects';
import type { ChorusRange } from '../../utils/lyrics/chorusEffects';
import type { LyricData } from '../../../shared/types';

/**
 * Parse one raw lyric source exactly as Folia does.
 *
 * @param source Folia's discriminated union (local / qrc / netease / navidrome / embedded)
 * @param options Folia's processing options (interludes, chorus ranges, song id)
 */
export function parse(source: RawLyricSource, options: Record<string, unknown> = {}) {
  return LyricParserFactory.parse(source, options as never);
}

/**
 * The display-time pass Folia's `createLyricsSetter` applies, in the same order:
 * the staff-credit policy first, then chorus decoration (ranges by time, or the
 * text-repetition fallback when no ranges are known).
 *
 * Not here: the listener's saved word split (`applyLyricWordSegmentation`) and
 * icu-folia's automatic one (`applyAutoWordSegmentation`). Folia's setter bakes both
 * after this pass, and so does the client (`mpPrepareLyrics` in src/16-lyrics.js):
 * this module stays pure so the parser can run wherever it is called.
 */
export function prepare(lyrics: LyricData | null, options: {
  policy?: 'keep' | 'smart' | 'hide';
  chorusRanges?: ChorusRange[];
  rules?: Array<Record<string, unknown>>;
} = {}): LyricData | null {
  if (!lyrics) return null;
  // Folia's order: the listener's line rules first, then the staff-credit policy.
  const rules = Array.isArray(options.rules) ? options.rules : [];
  const filtered = rules.length > 0
    ? applyLyricLineRules(lyrics, compileLyricLineRules(rules as never))
    : lyrics;
  let next = applyLyricStaffPolicy(filtered, { policy: options.policy ?? 'smart' });
  if (!next) return null;
  if (next.lines.some((line) => line.isChorus)) return next;
  const ranges = Array.isArray(options.chorusRanges) ? options.chorusRanges : [];
  if (ranges.length > 0) return applyChorusRangesByTime(next, ranges);
  const rebuilt = next.lines.map((line) => `[00:00.00]${line.fullText}`).join('\n');
  return applyDetectedChorusEffects(next, rebuilt);
}

// ── icu-folia engines from fetched data ─────────────────────────────────────
//
// Folia builds these engines from Vite virtual modules (dev/icuFolia/icuFoliaDataPlugin.mjs).
// The plugin has no Vite: the Host serves the same two payloads gzipped (lib/assets/icu-folia)
// and this builds the engines from them. The construction below is engines.ts step for step;
// it is duplicated here because that file must stay a verbatim copy of Folia's.

import { createJieba } from '../../utils/lyrics/icuFolia/jieba';
import { CHINESE_DEMOTED_WORDS, CHINESE_EXTRA_WORDS } from '../../utils/lyrics/icuFolia/jiebaLexicon';
import { createJapaneseParser } from '../../utils/lyrics/icuFolia/budouxJapanese';
import { applyAutoWordSegmentation, isIcuFoliaReady, loadIcuFolia } from '../../utils/lyrics/icuFolia';
import type { IcuFoliaEngines } from '../../utils/lyrics/icuFolia/segmenter';

export { applyAutoWordSegmentation, isIcuFoliaReady };

export interface IcuFoliaData {
  dict: { words: string; freqs: string; total: number };
  hmm: {
    start: Record<string, number>;
    trans: Record<string, Record<string, number>>;
    emit: Record<string, [string, string]>;
    t2s: string;
  };
}

/** Load icu-folia's engines from the Host's data. Resolves true when they are ready. */
export function loadIcuFoliaFromData(data: IcuFoliaData): Promise<boolean> {
  return loadIcuFolia(async () => {
    const { dict, hmm } = data;
    const jieba = createJieba({
      words: dict.words,
      freqs: dict.freqs,
      total: dict.total,
      hmm: { start: hmm.start as never, trans: hmm.trans as never, emit: hmm.emit as never },
    }, { maxHmmWordLength: 2 });
    CHINESE_EXTRA_WORDS.forEach((word) => jieba.addWord(word));
    CHINESE_DEMOTED_WORDS.forEach((word) => jieba.addWord(word, 1));

    const map = new Map<string, string>();
    for (let index = 0; index + 1 < hmm.t2s.length; index += 2) map.set(hmm.t2s[index], hmm.t2s[index + 1]);
    const simplify = (text: string) => Array.from(text, (char) => map.get(char) ?? char).join('');
    const japanese = createJapaneseParser();
    const engines: IcuFoliaEngines = {
      cutChinese(text: string) {
        let cursor = 0;
        return jieba.cut(simplify(text)).map((word) => {
          const original = text.slice(cursor, cursor + word.length);
          cursor += word.length;
          return original;
        });
      },
      parseJapanese: (text) => japanese.parse(text),
    };
    return engines;
  });
}
