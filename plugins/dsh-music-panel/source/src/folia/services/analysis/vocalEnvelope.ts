// src/render/folia/services/analysis/vocalEnvelope.ts
// htdemucs vocal stems are not analysed in this plugin yet. Nebbia falls back to its
// band-driven rain, exactly like Folia on an unanalysed track.

export const VOCAL_FPS = 50;

export interface VocalEnvelope {
    fps: number;
    db: Float32Array;
    top: number;
    onsets: number[];
    from?: number;
}

export const getVocalEnvelope = (_key: string): VocalEnvelope | null => null;

export const isVocalEnvelopeReady = (): boolean => false;
