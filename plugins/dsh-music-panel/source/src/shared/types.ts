/**
 * Folia's global types, where the rest of its source expects them.
 *
 * The vendored lyric pipeline (`src/utils/lyrics/**`) imports `../../types`, exactly
 * as it does in Folia's tree. The plugin's port keeps Folia's `src/types.ts` at
 * `src/folia/types.ts`, so this file is the same module under the path those
 * imports expect — one copy, no divergence.
 */
export * from '../folia/types';
