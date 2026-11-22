import { useMemo } from 'react';
import { resolveLyricRenderQuality } from '../../../utils/lyricRenderQuality';
import type { LyricRenderOverride, LyricRenderQuality } from '../../../types';

// src/render/folia/components/visualizer/renderQuality/useLyricRenderQuality.ts
// The plugin has no global lyric-quality store yet (its player pages draw at device
// pixel ratio 2). The ported styles therefore resolve their own override against a
// fixed 1x/auto baseline; the override in each style's tuning is still honoured.

const GLOBAL_QUALITY: LyricRenderQuality = { scale: 1, antialias: 'auto' };

export const useLyricRenderQuality = (override?: LyricRenderOverride | null): LyricRenderQuality => (
    useMemo(() => resolveLyricRenderQuality(GLOBAL_QUALITY, override), [override])
);
