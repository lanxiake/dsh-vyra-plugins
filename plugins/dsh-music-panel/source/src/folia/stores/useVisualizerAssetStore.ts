// src/render/folia/stores/useVisualizerAssetStore.ts
// Folia keeps uploaded avatars/emoji/portraits in an asset store backed by IndexedDB.
// The plugin hosts no uploader yet; the store is empty, and the renderers fall back to
// their built-in/cover/colour sources.

const STATE = {
    cappellaAvatars: [],
    cappellaEmoji: [],
    cappellaEmojiPack: null,
    storedMonetPortraitImage: null,
};

export const useVisualizerAssetStore = <T,>(selector?: (state: typeof STATE) => T): T => {
    if (typeof selector === 'function') return selector(STATE);
    return STATE as unknown as T;
};

useVisualizerAssetStore.setState = (patch: Partial<typeof STATE>): void => {
    Object.assign(STATE, patch);
};

useVisualizerAssetStore.getState = (): typeof STATE => STATE;

export default useVisualizerAssetStore;
