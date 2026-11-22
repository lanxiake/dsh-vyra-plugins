// src/render/folia/hooks/useLucideIcons.ts
// Folia preloads the theme's lyric icons through this hook. The plugin's themes carry
// no lyric icon set (its covers are canonical), so the revision never changes and the
// renderer falls back to the Star glyph for the balance wheel.

export const useLucideIcons = (_names?: string[]): number => 0;
