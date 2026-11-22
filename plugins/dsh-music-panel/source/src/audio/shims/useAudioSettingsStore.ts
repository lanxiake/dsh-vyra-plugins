// Boundary shim for Folia's audio settings store.
//
// `playbackFade.ts` reads exactly one boolean from it. The plugin's settings
// live in `prefs`; the controller is constructed with the live value instead of
// dragging zustand and the whole Folia settings store into the bundle.

export const useAudioSettingsStore = {
  getState: () => ({ playbackFadeEnabled: true }),
}
