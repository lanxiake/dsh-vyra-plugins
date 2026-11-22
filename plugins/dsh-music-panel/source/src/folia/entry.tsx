import React from 'react';
import VisualizerPendolo from './components/visualizer/pendolo/VisualizerPendolo';
import { DEFAULT_PENDOLO_TUNING } from './types';

// src/render/folia/entry.tsx
// Build entry for the ported Folia Pendolo renderer. The component is exported as-is;
// the plugin's wrapper (src/render/styles/folia-pendolo.js) builds Folia's
// VisualizerSharedProps and mounts it once.

export { VisualizerPendolo, DEFAULT_PENDOLO_TUNING };
export { buildTimedWords, estimateLrcLineEndTime } from './utils/lyrics/estimatedLineTiming';

export const hasMotion = Boolean(React) && true;
