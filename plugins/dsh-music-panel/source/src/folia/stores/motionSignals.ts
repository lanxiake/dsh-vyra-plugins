import { motionValue } from 'framer-motion';

// src/render/folia/stores/motionSignals.ts
// Only the two signals Folia's Latent background reads. Beat effects are not wired in
// this phase, so both stay at 0 and the background draws its band-driven picture.

export const beatImpact = motionValue(0);
export const downbeatImpact = motionValue(0);
