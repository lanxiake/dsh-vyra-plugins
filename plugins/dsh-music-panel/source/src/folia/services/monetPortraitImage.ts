// src/render/folia/services/monetPortraitImage.ts
// Portrait uploads belong to Folia's settings window; the plugin hosts no uploader yet,
// so these actions report "not supported" without touching storage.

export interface StoredMonetPortraitImage {
    id: string;
    url: string;
    [key: string]: unknown;
}

export const isSupportedMonetPortraitFile = (_file: File): boolean => false;

export const buildStoredMonetPortraitImage = (_file: File): StoredMonetPortraitImage => ({ id: '', url: '' });

export const saveMonetPortraitImage = async (_image: StoredMonetPortraitImage): Promise<void> => undefined;

export const clearMonetPortraitImage = async (): Promise<void> => undefined;
