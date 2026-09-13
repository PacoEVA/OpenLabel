import { BarcodeRenderResult, BwipAdapterOptions, renderBarcodeSvg } from './bwip-adapter';

/**
 * OpenLabels - Barcode Vector Cache
 * Keeps generated SVG strings and loaded HTMLImageElements in memory
 * to prevent redundant generator execution during UI hover, pan, zoom, selection, etc.
 */

export interface CachedBarcodeEntry {
  key: string;
  result: BarcodeRenderResult;
  timestamp: number;
}

const MAX_CACHE_ENTRIES = 200;
const svgCache = new Map<string, CachedBarcodeEntry>();
const imageCache = new Map<string, HTMLImageElement>();

/**
 * Computes a deterministic cache key for barcode generation.
 */
export function getBarcodeCacheKey(opts: BwipAdapterOptions): string {
  const parts = [
    opts.symbology,
    opts.data,
    opts.displayValue ? 'text' : 'notext',
    opts.errorCorrection || 'none',
  ];
  return parts.join('::');
}

/**
 * Retrieves a cached render result or invokes renderBarcodeSvg if absent.
 */
export function getOrRenderBarcodeSvg(opts: BwipAdapterOptions): BarcodeRenderResult {
  const key = getBarcodeCacheKey(opts);
  const existing = svgCache.get(key);
  if (existing) {
    return existing.result;
  }

  const result = renderBarcodeSvg(opts);

  // Evict oldest entries if cache exceeds limit
  if (svgCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = svgCache.keys().next().value;
    if (firstKey) {
      svgCache.delete(firstKey);
      imageCache.delete(firstKey);
    }
  }

  svgCache.set(key, {
    key,
    result,
    timestamp: Date.now(),
  });

  return result;
}

/**
 * Obtains or creates an HTMLImageElement from an SVG string for Konva rendering.
 * Returns undefined if window/Image is not available (e.g. Node test environment).
 */
export function getBarcodeImage(
  opts: BwipAdapterOptions,
  onLoaded?: () => void
): { image?: HTMLImageElement; result: BarcodeRenderResult } {
  const key = getBarcodeCacheKey(opts);
  const result = getOrRenderBarcodeSvg(opts);

  if (!result.success) {
    return { result };
  }

  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return { result };
  }

  const existingImage = imageCache.get(key);
  if (existingImage) {
    return { image: existingImage, result };
  }

  const img = new Image();
  // Safe data URI for SVG without requiring external network or dangerous DOM innerHTML
  const encodedSvg = encodeURIComponent(result.svg);
  img.src = `data:image/svg+xml;charset=utf-8,${encodedSvg}`;

  img.onload = () => {
    imageCache.set(key, img);
    if (onLoaded) {
      onLoaded();
    }
  };

  img.onerror = (e) => {
    console.warn(`[BarcodeCache] Failed to load SVG image for key: ${key}`, e);
  };

  return { image: img, result };
}

/**
 * Clears the barcode cache (useful for tests or full resets).
 */
export function clearBarcodeCache(): void {
  svgCache.clear();
  imageCache.clear();
}

/**
 * Returns current count of cached SVG entries.
 */
export function getBarcodeCacheSize(): number {
  return svgCache.size;
}
