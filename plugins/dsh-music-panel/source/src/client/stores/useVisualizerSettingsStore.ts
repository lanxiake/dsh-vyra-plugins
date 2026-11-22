// Shim for Folia's settings store: our panel keeps these in prefs.
const state = {
  randomVisualizerModePerSong: false,
  visualizerBackgroundMode: 'auto',
  visualizerOpacity: 1,
  visualizerFrameRate: 60,
  smartBeat: { mode: 'off', effects: {} },
  tune: () => undefined,
}
export const useVisualizerSettingsStore = Object.assign(() => state, {
  getState: () => state,
  setState: () => undefined,
  subscribe: () => () => undefined,
})
export default useVisualizerSettingsStore
