import VisualizerBackgroundRenderer from './components/visualizer/backgrounds/VisualizerBackgroundRenderer';
import {
    DEFAULT_VISUALIZER_BACKGROUND_MODE,
    VISUALIZER_BACKGROUND_REGISTRY,
    VISUALIZER_BACKGROUND_MODE_IDS,
    getVisualizerBackgroundRegistryEntry,
    hasVisualizerBackgroundMode,
} from './components/visualizer/backgrounds/registry';
import {
    DEFAULT_LATENT_BACKGROUND_TUNING,
    DEFAULT_MONET_BACKGROUND_TUNING,
    DEFAULT_NOMAND_BACKGROUND_TUNING,
    DEFAULT_SORA_BACKGROUND_TUNING,
} from './types';

// src/render/folia/backgrounds-entry.tsx
// Build entry for Folia's six shell backgrounds (common / monet / nomand / latent /
// sora / url). The renderer and entries are the upstream files; the registry is the
// explicit boundary described in backgrounds/registry.tsx.

export {
    VisualizerBackgroundRenderer,
    VISUALIZER_BACKGROUND_REGISTRY,
    VISUALIZER_BACKGROUND_MODE_IDS,
    DEFAULT_VISUALIZER_BACKGROUND_MODE,
    getVisualizerBackgroundRegistryEntry,
    hasVisualizerBackgroundMode,
    DEFAULT_LATENT_BACKGROUND_TUNING,
    DEFAULT_MONET_BACKGROUND_TUNING,
    DEFAULT_NOMAND_BACKGROUND_TUNING,
    DEFAULT_SORA_BACKGROUND_TUNING,
};
