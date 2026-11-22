import type { IconNode, LucideIcon } from 'lucide-react';

// src/render/folia/services/lucideIconResolver.ts
// Folia resolves theme icons from a lazily loaded lucide icon map. The plugin's themes
// do not carry icons, so the resolver always misses and callers use their fallback.

export const resolveLucideIcon = (_name: string | null | undefined): LucideIcon | null => null;

export const resolveLucideIconNode = (_name: string | null | undefined): IconNode | null => null;

export const getLucideIconStatus = (_name: string | null | undefined): 'ready' | 'loading' | 'missing' => 'ready';

export const loadLucideIcons = async (_names?: readonly string[]): Promise<void> => undefined;

export const resolveLucideIconNames = (_names?: readonly string[] | null): string[] => [];

export const preloadLucideIcons = async (_names?: readonly string[]): Promise<void> => undefined;
