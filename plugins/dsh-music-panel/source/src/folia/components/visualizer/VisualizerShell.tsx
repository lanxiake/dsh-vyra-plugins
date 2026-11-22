import React from 'react';
import { resolveThemeFontStack, resolveThemeFontWeight } from '../../utils/fontStacks';
import type { Theme } from '../../types';

// src/render/folia/components/visualizer/VisualizerShell.tsx
// Boundary adaptation of Folia's VisualizerShell. In Folia the shell also owns the
// backdrop, video layer, mod stage layers and the player chrome; in this plugin the
// player page already draws its own backdrop and chrome, so the shell keeps only the
// parts the renderer depends on: the full-bleed box, the theme font and the pointer
// pass-through. The lyric renderer is unchanged.

export interface VisualizerShellProps {
    theme: Theme;
    audioPower?: unknown;
    audioBands?: unknown;
    sharedProps?: unknown;
    children: React.ReactNode;
}

const VisualizerShell = React.forwardRef<HTMLDivElement, VisualizerShellProps>(({ theme, children }, ref) => (
    <div
        ref={ref}
        style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            // Tailwind preflight gives Folia's page the normal 1.5 line box. The host
            // page is a different stacking context, so without this the artist row's
            // italic glyphs get clipped by `truncate` on a shorter inherited line box.
            lineHeight: 1.5,
            fontFamily: resolveThemeFontStack(theme),
            fontWeight: resolveThemeFontWeight(theme, 400),
            // Folia styles own pointer interaction (line seek, scroll, camera drag). Page
            // controls above them carry explicit z-indexes (the settings FAB is z-9999).
            pointerEvents: 'auto',
        }}
    >
        {children}
    </div>
));

VisualizerShell.displayName = 'VisualizerShell';

export default VisualizerShell;
