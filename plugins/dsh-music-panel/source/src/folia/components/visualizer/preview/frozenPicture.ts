// src/render/folia/components/visualizer/preview/frozenPicture.ts
// Folia's freeze-frame utility is not needed by the background renderers this plugin
// hosts; the two data attributes are what the background components read, so they are
// the same values without pulling the 284-line DOM probe.

export const WAIT_MARK = 'data-picture-wait';
export const ARRIVING_MARK = 'data-picture-arriving';
