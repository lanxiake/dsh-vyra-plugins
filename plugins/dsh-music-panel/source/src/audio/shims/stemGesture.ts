// Boundary shim for Folia's stem gesture constants.
//
// Only the values used by `crossfadeGraph` are kept; the gesture arithmetic that
// needs the actual stem envelopes lives in the upstream module and is not bundled.

export const OTHER_SWEEP_HZ: readonly [number, number] = [25, 2200]
export const OTHER_SWEEP_END = 0.92
