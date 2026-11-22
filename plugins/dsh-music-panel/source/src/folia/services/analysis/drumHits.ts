// src/render/folia/services/analysis/drumHits.ts
// htdemucs drum stems are not analysed in this plugin yet. The Pendolo drum-head effect
// therefore never has hits, and the renderer draws its untouched clockwork.

export const DRUM_KICK = 1;
export const DRUM_SNARE = 2;
export const DRUM_HAT = 3;

export interface DrumHits {
    times: number[];
    strengths: number[];
    kinds: number[];
    drumEnergy: number;
    mixEnergy: number;
    until?: number;
}

export const getDrumHits = (_key: string): DrumHits | null => null;

export const isDrumStemReady = (): boolean => false;
