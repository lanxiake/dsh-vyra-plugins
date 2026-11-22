import { LyricData } from '../../../shared/types';
import { LyricProcessingOptions, RawLyricSource } from './types';

export interface LyricAdapter<T extends RawLyricSource> {
    parse(source: T, options?: LyricProcessingOptions): Promise<LyricData | null>;
}
