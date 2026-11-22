/**
 * The lyric worker, inline.
 *
 * Folia parses large lyric documents in a Web Worker (`workers/lyricsParser.worker.ts`).
 * The plugin's client ships as one concatenated script with no worker asset, so this
 * module answers the same calls by running the same parser on the calling thread.
 * Folia's document sizes here are tens of KB; the Worker is an optimisation, not a
 * contract.
 */
import { parseLyricsByFormat, type LyricParseFormat } from '../../utils/lyrics/parserCore';
import type { LyricData } from '../../../shared/types';
import type { LyricProcessingOptions } from '../../utils/lyrics/types';

export const normalizeWorkerFormat = (format: string): LyricParseFormat => {
    if (format === 'yrc' || format === 'qrc' || format === 'krc' || format === 'awlrc' || format === 'enhanced-lrc' || format === 'vtt' || format === 'ttml') {
        return format;
    }
    return 'lrc';
};

export const toWorkerLyricProcessingOptions = (
    options?: LyricProcessingOptions,
): Pick<LyricProcessingOptions, 'includeInterludes'> | undefined => {
    if (!options) return undefined;
    return {
        ...(options.includeInterludes !== undefined ? { includeInterludes: options.includeInterludes } : {}),
    };
};

export const parseLyricsAsync = (
    format: LyricParseFormat,
    content: string,
    translation?: string,
    options?: LyricProcessingOptions,
    romanization?: string,
): Promise<LyricData | null> => Promise.resolve().then(() => (
    parseLyricsByFormat(normalizeWorkerFormat(format), content, translation || '', options, romanization || '')
));
