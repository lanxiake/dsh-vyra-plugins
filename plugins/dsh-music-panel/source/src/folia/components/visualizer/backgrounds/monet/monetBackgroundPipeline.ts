import type { MonetBackgroundImage, MonetBackgroundTuning, Theme } from '../../../types';
import { paintMonetBackground, MONET_BACKGROUND_WIDTH, MONET_BACKGROUND_HEIGHT } from '../../monet/monetBackgroundPaint';
import type { MonetBackgroundPaintRequest } from '../../monet/monetBackgroundPaint';

// src/render/folia/components/visualizer/backgrounds/monet/monetBackgroundPipeline.ts
// Boundary port of Folia's pipeline. The reference paints the poster in a Worker
// (`monetBackground.worker.ts`); this plugin's client is one concatenated script with
// no separate worker file, so the same `paintMonetBackground` runs on an OffscreenCanvas
// in a one-at-a-time queue. The cache key, image loading and blob hand-off are the
// upstream ones, so the picture is identical.

interface PictureEntry {
    url: Promise<string | null>;
    holders: number;
}

const monetBackgroundCache = new Map<string, PictureEntry>();

interface BuildMonetBackgroundOptions {
    coverUrl?: string | null;
    monetBackgroundImage?: MonetBackgroundImage | null;
    theme: Theme;
    tuning: MonetBackgroundTuning;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const resolveSourceUrl = ({
    coverUrl,
    monetBackgroundImage,
    tuning,
}: Pick<BuildMonetBackgroundOptions, 'coverUrl' | 'monetBackgroundImage' | 'tuning'>) => (
    tuning.backgroundSource === 'uploaded-global'
        ? monetBackgroundImage?.url ?? coverUrl ?? null
        : coverUrl ?? monetBackgroundImage?.url ?? null
);

const loadImage = async (src: string): Promise<HTMLImageElement> => {
    const image = new Image();
    if (!src.startsWith('blob:') && !src.startsWith('data:')) {
        image.crossOrigin = 'anonymous';
    }
    image.decoding = 'async';
    const loadPromise = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    });
    image.src = src;
    try {
        await image.decode();
    } catch {
        await loadPromise;
    }
    return image;
};

export const getMonetBackgroundCacheKey = ({
    coverUrl,
    monetBackgroundImage,
    theme,
    tuning,
}: BuildMonetBackgroundOptions) => JSON.stringify({
    sourceUrl: resolveSourceUrl({ coverUrl, monetBackgroundImage, tuning }),
    uploadedId: tuning.backgroundSource === 'uploaded-global' ? monetBackgroundImage?.id ?? null : null,
    theme: {
        backgroundColor: theme.backgroundColor,
        primaryColor: theme.primaryColor,
        accentColor: theme.accentColor,
    },
    tuning: {
        backgroundSource: tuning.backgroundSource,
        backgroundBlurPx: tuning.backgroundBlurPx,
        backgroundOverlayOpacity: tuning.backgroundOverlayOpacity,
        backgroundGrayscale: tuning.backgroundGrayscale,
        backgroundSaturation: tuning.backgroundSaturation,
        backgroundWash: tuning.backgroundWash,
        backgroundWashColorMode: tuning.backgroundWashColorMode,
        backgroundWashCustomColor: tuning.backgroundWashCustomColor,
        backgroundStreaksEnabled: tuning.backgroundStreaksEnabled,
    },
});

let isCanvasFilterSupportedCached: boolean | null = null;

export const checkCanvasFilterSupport = (): boolean => {
    if (isCanvasFilterSupportedCached !== null) return isCanvasFilterSupportedCached;
    if (typeof document === 'undefined') return false;
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 2;
        const ctx = canvas.getContext('2d');
        if (!ctx || typeof ctx.filter !== 'string') {
            isCanvasFilterSupportedCached = false;
            return false;
        }
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 2, 2);
        ctx.filter = 'blur(1px)';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 1, 1);
        const imgData = ctx.getImageData(1, 1, 1, 1);
        isCanvasFilterSupportedCached = imgData.data[0] > 0;
        return isCanvasFilterSupportedCached;
    } catch {
        isCanvasFilterSupportedCached = false;
        return false;
    }
};

type PaintRequest = Omit<MonetBackgroundPaintRequest, 'id'>;

const paintPicture = async (request: PaintRequest): Promise<Blob | null> => {
    try {
        const canvas = typeof OffscreenCanvas !== 'undefined'
            ? new OffscreenCanvas(MONET_BACKGROUND_WIDTH, MONET_BACKGROUND_HEIGHT)
            : Object.assign(document.createElement('canvas'), {
                width: MONET_BACKGROUND_WIDTH,
                height: MONET_BACKGROUND_HEIGHT,
            });
        const context = canvas.getContext('2d');
        if (!context) throw new Error('no 2D context');
        paintMonetBackground(context as CanvasRenderingContext2D, request.image, request.colors, request.tuning, request.blurPx);
        const picture = 'convertToBlob' in canvas
            ? await (canvas as OffscreenCanvas).convertToBlob({ type: 'image/jpeg', quality: 0.92 })
            : await new Promise<Blob | null>((resolve) => {
                (canvas as HTMLCanvasElement).toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
            });
        return picture;
    } catch (error) {
        console.warn('[MonetBackground] The picture could not be painted:', error);
        return null;
    } finally {
        request.image.close();
    }
};

interface PaintJob {
    request: PaintRequest;
    wanted: () => boolean;
    settle: (picture: Blob | null | undefined) => void;
}

const queuedPaints: PaintJob[] = [];
let painting = false;

const paintNext = () => {
    if (painting) return;
    const job = queuedPaints.shift();
    if (!job) return;
    if (!job.wanted()) {
        job.request.image.close();
        job.settle(undefined);
        paintNext();
        return;
    }
    painting = true;
    void paintPicture(job.request).then((picture) => {
        painting = false;
        job.settle(picture);
        paintNext();
    });
};

const paintOffThread = (request: PaintRequest, wanted: () => boolean) => new Promise<Blob | null | undefined>((settle) => {
    queuedPaints.push({ request, wanted, settle });
    paintNext();
});

const buildMonetBackgroundUrl = async (
    options: BuildMonetBackgroundOptions,
    wanted: () => boolean,
): Promise<string | null | undefined> => {
    const sourceUrl = resolveSourceUrl(options);
    if (!sourceUrl) return null;
    const image = await createImageBitmap(await loadImage(sourceUrl));
    const picture = await paintOffThread({
        image,
        colors: {
            backgroundColor: options.theme.backgroundColor,
            primaryColor: options.theme.primaryColor,
            accentColor: options.theme.accentColor,
        },
        tuning: options.tuning,
        blurPx: checkCanvasFilterSupport() ? clamp(options.tuning.backgroundBlurPx, 0, 60) : null,
    }, wanted);
    if (!picture) return picture;
    const url = URL.createObjectURL(picture);
    const decoded = new Image();
    decoded.src = url;
    try {
        await decoded.decode();
    } catch (error) {
        URL.revokeObjectURL(url);
        throw error;
    }
    return url;
};

export const wantMonetBackgroundUrl = (options: BuildMonetBackgroundOptions): { url: Promise<string | null>; release: () => void } => {
    const cacheKey = getMonetBackgroundCacheKey(options);
    let entry = monetBackgroundCache.get(cacheKey);
    if (!entry) {
        const made: PictureEntry = { url: Promise.resolve(null), holders: 0 };
        const wanted = () => {
            if (made.holders > 0) return true;
            if (monetBackgroundCache.get(cacheKey) === made) monetBackgroundCache.delete(cacheKey);
            return false;
        };
        const forget = () => {
            if (monetBackgroundCache.get(cacheKey) === made) monetBackgroundCache.delete(cacheKey);
        };
        made.url = buildMonetBackgroundUrl(options, wanted).then(
            (url) => {
                if (url === null) forget();
                return url ?? null;
            },
            (error: unknown) => {
                console.warn('[MonetBackground] The picture could not be made:', error);
                forget();
                return null;
            },
        );
        monetBackgroundCache.set(cacheKey, made);
        entry = made;
    }
    const held = entry;
    held.holders += 1;
    let released = false;
    return {
        url: held.url,
        release: () => {
            if (!released) {
                released = true;
                held.holders -= 1;
            }
        },
    };
};
