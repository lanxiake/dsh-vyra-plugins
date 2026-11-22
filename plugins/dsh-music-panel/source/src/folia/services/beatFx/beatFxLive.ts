// src/render/folia/services/beatFx/beatFxLive.ts
// Live beat envelopes (Folia's beat_this clock). Not wired yet: every reader sees
// "not ready" and the renderers draw their base picture, exactly like Folia does on
// an unanalysed track with smart beat off.

export const isBeatFxReady = (): boolean => false;

export const getBeatEffectStrength = (_effectId: string): number => 0;

export const getBeatFxBeatPeriod = (): number => 0.5;

export const getBeatFxHeard = (): { key: string; time: number | null } => ({ key: '', time: null });

export const getBeatFxLastBeat = (): unknown => null;

export const getBeatFxLastDownbeat = (): unknown => null;

export const getBeatFxTrackScale = (): number => 1;

export const getBeatFxFiredCounts = (): Record<string, number> => ({});

export const getBeatFxEvents = (): unknown[] => [];

export const getBeatFxIntensities = (): Record<string, number> => ({});

export const getBeatFxRotationSign = (): number => 1;

export const isBeatFxHearing = (): boolean => false;

export const isBeatEffectPlaying = (_id: string): boolean => false;
