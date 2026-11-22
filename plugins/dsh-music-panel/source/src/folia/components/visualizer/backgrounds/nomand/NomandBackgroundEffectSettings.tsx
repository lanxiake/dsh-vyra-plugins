import type { NomandBackgroundEffect } from '../../../../types';

// src/render/folia/components/visualizer/backgrounds/nomand/NomandBackgroundEffectSettings.tsx
// Boundary port: the background renderer and entry only need the effect list and their
// labels. Folia's file also builds the settings-window picture grid; this plugin's
// settings window is not hosted yet, so the UI half is omitted and the data is kept.

export const EFFECTS: NomandBackgroundEffect[] = [
    'dithering',
    'fluted-glass',
    'paper-texture',
    'halftone-dots',
    'lens-distortion',
];

export const EFFECT_LABEL_KEYS: Record<NomandBackgroundEffect, string> = {
    dithering: 'options.nomandBackgroundEffectDithering',
    'fluted-glass': 'options.nomandBackgroundEffectFlutedGlass',
    'paper-texture': 'options.nomandBackgroundEffectPaperTexture',
    'halftone-dots': 'options.nomandBackgroundEffectHalftoneDots',
    'lens-distortion': 'options.nomandBackgroundEffectLensDistortion',
};

export default function NomandBackgroundEffectSettings() {
    return null;
}
