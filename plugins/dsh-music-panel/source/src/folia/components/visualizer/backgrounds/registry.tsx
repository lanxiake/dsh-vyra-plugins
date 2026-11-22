import type { VisualizerBackgroundRegistryEntry } from './definition';
import { DEFAULT_VISUALIZER_BACKGROUND_MODE } from '../../../types/visualizerModes';
import common from './common/entry';
import latent from './latent/entry';
import monet from './monet/entry';
import nomand from './nomand/entry';
import sora from './sora/entry';
import url from './url/entry';

// src/render/folia/components/visualizer/backgrounds/registry.tsx
// Boundary replacement for Folia's Vite `import.meta.glob` discovery: the same six
// entry modules are imported explicitly, and the rest of the registry API is unchanged.
// The entries themselves are the upstream files.

const ENTRIES: VisualizerBackgroundRegistryEntry[] = [
    common,
    monet,
    nomand,
    latent,
    sora,
    url,
].sort((left, right) => left.order - right.order);

const BY_MODE: Partial<Record<string, VisualizerBackgroundRegistryEntry>> = {};
for (const entry of ENTRIES) {
    BY_MODE[entry.mode] = entry;
}

export const VISUALIZER_BACKGROUND_REGISTRY = ENTRIES;

export { DEFAULT_VISUALIZER_BACKGROUND_MODE };

export const hasVisualizerBackgroundMode = (mode: unknown): mode is string => (
    typeof mode === 'string' && Boolean(BY_MODE[mode])
);

export const getVisualizerBackgroundRegistryEntry = (mode: string): VisualizerBackgroundRegistryEntry => (
    BY_MODE[mode] ?? BY_MODE[DEFAULT_VISUALIZER_BACKGROUND_MODE] ?? ENTRIES[0]
);

export const getVisualizerBackgroundModeLabel = (mode: string, t: (key: string) => string): string => {
    const entry = getVisualizerBackgroundRegistryEntry(mode);
    const translated = t(entry.labelKey);
    return !translated || translated === entry.labelKey ? entry.labelFallback : translated;
};

export const VISUALIZER_BACKGROUND_MODE_IDS: string[] = ENTRIES.map((entry) => entry.mode);
