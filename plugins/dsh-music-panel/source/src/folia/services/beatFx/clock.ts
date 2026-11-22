// src/render/folia/services/beatFx/clock.ts
// The pure part of Folia's beat clock that the Pendolo renderer imports: the weak-beat
// floor and the accent gain arithmetic. The clock itself lives in beatFxLive and is not
// running yet, so these values only keep the wave formulas numerically valid.

export interface BeatFxEvent {
    t: number;
    kind: string;
    impact?: number;
    rhythmic?: boolean;
    downbeat?: boolean;
    barPos?: number;
    bands?: { low?: number; mid?: number; high?: number };
}

export const BEAT_FX_WEAK_BEAT_FLOOR = 0.35;

export const resolveBeatFxAccentGain = (
    event: Pick<BeatFxEvent, 'impact' | 'rhythmic'> | null | undefined,
    trackScale: number,
): number => {
    if (event?.rhythmic === false) return 0;
    if (!event || event.impact === undefined) return trackScale;
    return (BEAT_FX_WEAK_BEAT_FLOOR + (1 - BEAT_FX_WEAK_BEAT_FLOOR) * event.impact) * trackScale;
};
