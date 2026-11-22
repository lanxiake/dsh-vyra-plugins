// Boundary shim for Folia's stem registry.
//
// The plugin does not ship htdemucs, so the stem gesture is never scheduled.
// `crossfadeGraph` only needs the stem names and the sweep constants at runtime;
// keeping the real `stems.ts` out of the bundle avoids pulling the model and GPU
// scheduler into the client.

export const STEM_NAMES = ['drums', 'bass', 'other', 'vocals'] as const
export type StemName = (typeof STEM_NAMES)[number]

export type TrackStems = {
  from: number
  buffers: Record<StemName, AudioBuffer>
}
