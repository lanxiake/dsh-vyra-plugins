// src/render/folia/hooks/useReducedMotionFor.ts
// Folia's motion-settings store has no counterpart in this plugin yet. The player page
// already freezes its own CSS motion when the system asks; backgrounds read the system
// preference here so the ported animation stays honest.

export const useReducedMotionFor = (_surface?: string): boolean => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
};

export default useReducedMotionFor;
