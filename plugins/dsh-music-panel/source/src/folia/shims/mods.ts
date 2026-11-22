// src/render/folia/shims/mods.ts
// Folia's Folium mod registries are host features this plugin does not run. The imports
// only render optional stage layers, so an empty stub is the correct boundary.

export const FoliumStageLayerSlot = () => null;
export const getStageLayerSlot = () => null;
export const listMods = () => [];
export const getMod = () => null;
export const registries = { visualizers: null, backgrounds: null, tunings: null };

export const useFoliumTunings = (_mode?: string): Record<string, unknown> => ({});

export default {};
