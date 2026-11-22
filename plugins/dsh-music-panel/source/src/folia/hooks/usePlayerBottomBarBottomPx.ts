// src/render/folia/hooks/usePlayerBottomBarBottomPx.ts
// Boundary adaptation: the plugin page keeps the player chrome always present, so the
// subtitle sits at Folia's desktop baseline (32px bar offset + 80px clearance = 112px).
// There is no draggable floating bar / compact dock here, so those inputs stay constant.

export const PLAYER_BOTTOM_BAR_BASE_OFFSET_PX = 32
export const PLAYER_SUBTITLE_CLEARANCE_PX = 80

export const usePlayerBottomBarBottomPx = (_?: unknown): number => PLAYER_BOTTOM_BAR_BASE_OFFSET_PX

export const usePlayerSubtitleBottomPx = (isPlayerChromeHidden?: boolean): number =>
  (isPlayerChromeHidden ? PLAYER_BOTTOM_BAR_BASE_OFFSET_PX : PLAYER_BOTTOM_BAR_BASE_OFFSET_PX + PLAYER_SUBTITLE_CLEARANCE_PX)

export const usePlayerSubtitleYieldsToDock = (_?: unknown): boolean => false

export default usePlayerBottomBarBottomPx;
