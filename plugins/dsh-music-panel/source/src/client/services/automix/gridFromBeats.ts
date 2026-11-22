/**
 * Folia's Beat This! grid boundary.
 *
 * The model runner lives outside this plugin; this module is the pure
 * beats → uniform grid conversion `analyseTrack` accepts when a grid exists.
 */

export interface BeatGrid {
    beats: number[];
    downbeats: number[];
}

export interface BeatThisGrid {
    bpm: number;
    outroBpm: number | null;
    beatOffset: number;
    downbeatOffset: number | null;
    headDownbeatOffset: number | null;
    beatsPerBar: number;
}

const OUTRO_WINDOW_SEC = 30;
const MIN_BEATS = 8;

const modulo = (value: number, span: number) => ((value % span) + span) % span;

const median = (values: readonly number[]): number => {
    if (!values.length) return NaN;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = sorted.length >> 1;
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const intervals = (times: readonly number[]): number[] => {
    const out: number[] = [];
    for (let index = 1; index < times.length; index += 1) out.push(times[index] - times[index - 1]);
    return out;
};

/** Folds real beat times into the uniform {offset, period} grid. */
export const gridFromBeats = (
    grid: BeatGrid,
    options: { partial?: boolean } = {},
): BeatThisGrid | null => {
    if (grid.beats.length < MIN_BEATS) return null;
    const period = median(intervals(grid.beats));
    if (!Number.isFinite(period) || period <= 0) return null;

    const last = grid.beats[grid.beats.length - 1];
    const beatOffset = modulo(last, period);

    const spans = intervals(grid.downbeats).map(span => Math.round(span / period));
    const perBar = Math.round(median(spans.filter(span => span >= 2 && span <= 12)));
    const beatsPerBar = Number.isFinite(perBar) && perBar >= 2 ? perBar : 4;
    const barSec = period * beatsPerBar;

    const outroFrom = last - OUTRO_WINDOW_SEC;
    const outroBeats = grid.beats.filter(beat => beat >= outroFrom);
    const outroPeriod = outroBeats.length >= MIN_BEATS ? median(intervals(outroBeats)) : NaN;

    return {
        bpm: 60 / period,
        outroBpm: options.partial || !Number.isFinite(outroPeriod) || outroPeriod <= 0
            ? null
            : 60 / outroPeriod,
        beatOffset,
        downbeatOffset: grid.downbeats.length
            ? modulo(grid.downbeats[grid.downbeats.length - 1], barSec)
            : null,
        headDownbeatOffset: grid.downbeats.length ? modulo(grid.downbeats[0], barSec) : null,
        beatsPerBar,
    };
};
