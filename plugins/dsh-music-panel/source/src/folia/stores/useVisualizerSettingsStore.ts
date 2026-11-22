// src/render/folia/stores/useVisualizerSettingsStore.ts
// Folia keeps the smart-beat mode and the global render quality in a zustand store.
// The plugin has neither yet: beat effects arrive in a later phase, so the ported
// Pendolo reads "smart beat off" and draws its base picture only.

export interface SmartBeatSettings {
    mode: 'off' | 'cached' | 'on';
    effects?: Record<string, { enabled?: boolean; strength?: number }>;
}

export interface VisualizerSettingsState {
    smartBeat: SmartBeatSettings;
    visualizerFrameRate?: number;
}

const STATE: VisualizerSettingsState = {
    smartBeat: { mode: 'off', effects: {} },
    visualizerFrameRate: 60,
};

export const useVisualizerSettingsStore = <T,>(selector?: (state: VisualizerSettingsState) => T): T => {
    if (typeof selector === 'function') return selector(STATE);
    return STATE as unknown as T;
};

useVisualizerSettingsStore.getState = (): VisualizerSettingsState => STATE;
