// src/render/folia/services/temperaLayerImages.ts
// Tempera's uploaded image layers live in Folia's asset store (IndexedDB). The plugin
// hosts no uploader yet, so layers resolve to an empty set and the style draws its
// typography without user images.

export const loadTemperaLayerImageBlobs = async (_placements?: unknown): Promise<Map<string, Blob>> => new Map();

export const loadTemperaLayerImages = async (): Promise<unknown[]> => [];

export const saveTemperaLayerImage = async (): Promise<void> => undefined;

export const clearTemperaLayerImages = async (): Promise<void> => undefined;

export const importTemperaImageArchive = async (): Promise<void> => undefined;

export const exportTemperaImageArchive = async (): Promise<Blob | null> => null;
