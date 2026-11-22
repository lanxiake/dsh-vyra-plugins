// src/render/folia/stores/visualizerSettingsPersistence.ts
// The plugin has no Folia settings store; stored tuning reads fall back to defaults.

export const readStoredTuning = <T,>(_key: string, fallback: T): T => fallback;

export const writeStoredTuning = (_key: string, _value: unknown): void => undefined;

export const readStoredBoolean = (_key: string, fallback: boolean): boolean => fallback;

export const readStoredNumber = (_key: string, fallback: number): number => fallback;
