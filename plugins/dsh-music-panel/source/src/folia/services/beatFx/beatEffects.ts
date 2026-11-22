// src/render/folia/services/beatFx/beatEffects.ts
// Beat effects are a later phase in this plugin: the ported Pendolo declares the same
// effect ids so nothing else changes, but smart beat stays off and no model runs.

export const BEAT_EFFECT_IDS = {
    sonnetLensTear: 'sonnet.lensTear',
    dioramaRipple: 'diorama.ripple',
    pendoloDrumhead: 'pendolo.drumhead',
    pendoloGearBeats: 'pendolo.gearBeats',
    latentPulse: 'latent.pulse',
    hanabiBeatBursts: 'hanabi.beatBursts',
    hanabiPush: 'hanabi.push',
    temperaInkFlash: 'tempera.inkFlash',
    machiNeonPulse: 'machi.neonPulse',
    machiDrumRipple: 'machi.drumRipple',
} as const;

export interface SmartBeatSettings {
    mode: 'off' | 'cached' | 'on';
    effects?: Record<string, { enabled?: boolean; strength?: number }>;
}

export const smartBeatActive = (settings: SmartBeatSettings | null | undefined): boolean => (
    settings !== null && settings !== undefined && settings.mode !== 'off'
);

export const smartBeatMayAnalyse = (settings: SmartBeatSettings | null | undefined): boolean => (
    settings !== null && settings !== undefined && settings.mode === 'on'
);

export const beatEffectPartId = (id: string, part: string): string => `${id}:${part}`;

export const isBeatEffectPlaying = (_id: string): boolean => false;
