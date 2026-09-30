import { applyEffect, defaultEffect, type EffectSettings } from './effects';

export const layouts = [
  { id: 'strip3', name: '3-strip', count: 3, ratio: 4 / 3 },
  { id: 'strip4', name: '4-strip', count: 4, ratio: 4 / 3 },
  { id: 'grid', name: '2 × 2 grid', count: 4, ratio: 1 },
  { id: 'polaroid', name: 'Polaroid', count: 1, ratio: 1 },
] as const;
export type LayoutId = typeof layouts[number]['id'];
export const filters = [
  { id: 'original', name: 'Original', color: '#292929' },
  { id: 'bw', name: 'Black & white', color: '#a6a6a6' },
  { id: 'warm', name: 'Warm film', color: '#b6a080' },
  { id: 'cool', name: 'Cool tone', color: '#8da2ad' },
  { id: 'vintage', name: 'Soft vintage', color: '#999a83' },
  { id: 'sepia', name: 'Sepia', color: '#ac8962' },
  { id: 'noir', name: 'Noir', color: '#555555' },
  { id: 'silver', name: 'Silver', color: '#bdc4ce' },
  { id: 'matte', name: 'Matte', color: '#9e968d' },
  { id: 'golden', name: 'Golden hour', color: '#cba365' },
  { id: 'rose', name: 'Rose', color: '#c68f9b' },
  { id: 'dusty', name: 'Dusty pink', color: '#b49a9c' },
  { id: 'lavender', name: 'Lavender', color: '#aa9ebb' },
  { id: 'arctic', name: 'Arctic', color: '#b1c6d1' },
  { id: 'ocean', name: 'Ocean', color: '#65959d' },
  { id: 'olive', name: 'Olive', color: '#95966b' },
  { id: 'amber', name: 'Amber', color: '#bb8954' },
  { id: 'faded', name: 'Faded film', color: '#b3af9d' },
  { id: 'vivid', name: 'Vivid', color: '#b77567' },
  { id: 'instant', name: 'Instant', color: '#b5aa84' },
] as const;
export type FilterId = typeof filters[number]['id'];

type ColorGrade = { saturation: number; contrast: number; gain: readonly [number, number, number]; lift: readonly [number, number, number] };
// Deliberately restrained color grades: luminance-based saturation, contrast,
// then channel tint/lift. Applied to pixels, never as export-only CSS effects.
const colorGrades: Record<Exclude<FilterId, 'original' | 'bw' | 'warm' | 'cool' | 'vintage'>, ColorGrade> = {
  sepia:   { saturation: 0, contrast: .96, gain: [1.12, .88, .64], lift: [20, 12, 5] },
  noir:    { saturation: 0, contrast: 1.55, gain: [1, 1, 1], lift: [-7, -7, -7] },
  silver:  { saturation: 0, contrast: .94, gain: [.96, 1, 1.07], lift: [8, 8, 10] },
  matte:   { saturation: .8, contrast: .77, gain: [1.02, 1, .96], lift: [8, 8, 10] },
  golden:  { saturation: 1.08, contrast: 1.02, gain: [1.08, 1.01, .78], lift: [12, 7, 3] },
  rose:    { saturation: .92, contrast: .96, gain: [1.08, .94, 1.01], lift: [14, 2, 8] },
  dusty:   { saturation: .58, contrast: .79, gain: [1.06, .95, .98], lift: [16, 8, 12] },
  lavender:{ saturation: .78, contrast: .9, gain: [1.01, .93, 1.11], lift: [10, 5, 16] },
  arctic:  { saturation: .72, contrast: 1.04, gain: [.93, 1.02, 1.08], lift: [6, 12, 17] },
  ocean:   { saturation: .88, contrast: 1.12, gain: [.82, 1.04, 1.08], lift: [0, 5, 9] },
  olive:   { saturation: .66, contrast: 1.05, gain: [1.01, 1.04, .8], lift: [7, 8, 3] },
  amber:   { saturation: .82, contrast: 1.13, gain: [1.12, .95, .72], lift: [8, 1, 0] },
  faded:   { saturation: .45, contrast: .69, gain: [1.03, 1.02, .93], lift: [16, 14, 16] },
  vivid:   { saturation: 1.4, contrast: 1.14, gain: [1.02, 1.01, 1.02], lift: [0, 0, 0] },
  instant: { saturation: .84, contrast: 1.18, gain: [1.04, 1.03, .88], lift: [10, 8, 12] },
};
export const frameColors = [
  { name: 'Black', value: '#080808', ink: '#f5f5f5' },
  { name: 'White', value: '#ffffff', ink: '#151515' },
  { name: 'Cream', value: '#eee8dc', ink: '#151515' },
  { name: 'Charcoal', value: '#363636', ink: '#f5f5f5' },
] as const;
export interface Photo { image: HTMLImageElement; mirrored: boolean; takenAt: Date }
export interface FrameSettings {
  color: number; spacing: number; padding: number; caption: string;
  showDate: boolean; decoration: 'none' | 'stars' | 'hearts' | 'timestamp';
}
export const defaultFrame: FrameSettings = { color: 2, spacing: 14, padding: 28, caption: '', showDate: false, decoration: 'none' };

// Pixel transforms work in Safari as well as Chromium. The exact same transform
// is used for live view, thumbnails, the composition preview, and the PNG.
export function applyFilter(ctx: CanvasRenderingContext2D, width: number, height: number, filter: FilterId) {
  if (filter === 'original') return;
  const pixels = ctx.getImageData(0, 0, width, height);
  const d = pixels.data;
  const grade = colorGrades[filter as keyof typeof colorGrades];
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (filter === 'bw') {
      const l = (r * .2126 + g * .7152 + b * .0722 - 128) * 1.08 + 128;
      d[i] = d[i + 1] = d[i + 2] = l;
    } else if (filter === 'warm') {
      d[i] = r * 1.05 + 7; d[i + 1] = g * 1.01 + 3; d[i + 2] = b * .9;
    } else if (filter === 'cool') {
      d[i] = r * .93; d[i + 1] = g * 1.01 + 2; d[i + 2] = b * 1.07 + 5;
    } else if (filter === 'vintage') {
      const l = r * .299 + g * .587 + b * .114;
      d[i] = (r * .7 + l * .3) * .87 + 25;
      d[i + 1] = (g * .7 + l * .3) * .87 + 21;
      d[i + 2] = (b * .7 + l * .3) * .8 + 24;
    } else if (grade) {
      const l = r * .2126 + g * .7152 + b * .0722;
      d[i] = ((l + (r - l) * grade.saturation - 128) * grade.contrast + 128) * grade.gain[0] + grade.lift[0];
      d[i + 1] = ((l + (g - l) * grade.saturation - 128) * grade.contrast + 128) * grade.gain[1] + grade.lift[1];
      d[i + 2] = ((l + (b - l) * grade.saturation - 128) * grade.contrast + 128) * grade.gain[2] + grade.lift[2];
    }
  }
  ctx.putImageData(pixels, 0, 0);
}

export function renderPhoto(canvas: HTMLCanvasElement, source: CanvasImageSource, sourceWidth: number, sourceHeight: number, width: number, height: number, mirrored: boolean, filter: FilterId, effect: EffectSettings = defaultEffect) {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Your browser could not create an image canvas.');
  const targetRatio = width / height, sourceRatio = sourceWidth / sourceHeight;
  const cropW = sourceRatio > targetRatio ? sourceHeight * targetRatio : sourceWidth;
  const cropH = sourceRatio > targetRatio ? sourceHeight : sourceWidth / targetRatio;
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  if (mirrored) { ctx.translate(width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(source, (sourceWidth - cropW) / 2, (sourceHeight - cropH) / 2, cropW, cropH, 0, 0, width, height);
  ctx.restore();
  applyFilter(ctx, width, height, filter);
  applyEffect(ctx, width, height, effect);
}

// Keep one color-graded base and one effect result, not a history of every look.
// Strength/frame edits reuse the base; weak keys release replaced/cleared photos.
const photoCache = new WeakMap<Photo, { key: string; effectKey: string; base: HTMLCanvasElement; canvas: HTMLCanvasElement }>();
export function processedPhoto(photo: Photo, width: number, height: number, filter: FilterId, effect: EffectSettings) {
  const key = `${width}:${height}:${photo.mirrored}:${filter}`;
  let cached = photoCache.get(photo);
  if (!cached) {
    cached = { key: '', effectKey: '', base: document.createElement('canvas'), canvas: document.createElement('canvas') };
    photoCache.set(photo, cached);
  }
  if (cached.key !== key) {
    renderPhoto(cached.base, photo.image, photo.image.naturalWidth, photo.image.naturalHeight, width, height, photo.mirrored, filter);
    cached.key = key; cached.effectKey = '';
  }
  if (effect.id === 'none' || effect.amount === 0) return cached.base;
  const effectKey = `${effect.id}:${effect.amount}`;
  if (cached.effectKey !== effectKey) {
    const canvas = cached.canvas;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Your browser could not create the photo effect.');
    ctx.clearRect(0, 0, width, height); ctx.drawImage(cached.base, 0, 0);
    applyEffect(ctx, width, height, effect);
    cached.effectKey = effectKey;
  }
  return cached.canvas;
}

export function compositionSize(layoutId: LayoutId, frame: FrameSettings) {
  const layout = layouts.find(l => l.id === layoutId)!;
  const columns = layoutId === 'grid' ? 2 : 1;
  const rows = layout.count / columns;
  const photoW = layoutId === 'grid' ? 600 : 960;
  const photoH = Math.round(photoW / layout.ratio);
  const padding = frame.padding * 2, gap = frame.spacing * 2;
  const footer = layoutId === 'polaroid' ? 270 : 170;
  return { width: photoW * columns + padding * 2 + gap * (columns - 1), height: photoH * rows + gap * (rows - 1) + padding * 2 + footer, photoW, photoH, columns, padding, gap, footer };
}

export function renderComposition(canvas: HTMLCanvasElement, photos: (Photo | null)[], layoutId: LayoutId, filter: FilterId, frame: FrameSettings, date: Date, effect: EffectSettings = defaultEffect) {
  const s = compositionSize(layoutId, frame), layout = layouts.find(l => l.id === layoutId)!;
  if (canvas.width !== s.width) canvas.width = s.width;
  if (canvas.height !== s.height) canvas.height = s.height;
  // Keep print rendering on one backend: exporting must not change later
  // redraws through a browser's GPU-to-CPU canvas migration.
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Your browser could not create the photo strip.');
  const colors = frameColors[frame.color];
  ctx.fillStyle = colors.value; ctx.fillRect(0, 0, s.width, s.height);
  for (let i = 0; i < layout.count; i++) {
    const x = s.padding + (i % s.columns) * (s.photoW + s.gap);
    const y = s.padding + Math.floor(i / s.columns) * (s.photoH + s.gap);
    const photo = photos[i];
    if (photo) {
      ctx.drawImage(processedPhoto(photo, s.photoW, s.photoH, filter, effect), x, y);
    } else {
      ctx.fillStyle = '#202020'; ctx.fillRect(x, y, s.photoW, s.photoH);
      ctx.fillStyle = '#a3a3a3'; ctx.font = '55px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left'; ctx.fillText(`0${i + 1}`, x + 35, y + 77);
    }
  }
  ctx.fillStyle = colors.ink; ctx.textAlign = 'center';
  const base = s.height - s.padding - s.footer;
  const caption = frame.caption.trim();
  ctx.font = `${caption ? 500 : 700} ${caption ? 52 : 58}px "DM Sans Variable", sans-serif`;
  ctx.fillText(caption || 'N O I R  B O O T H', s.width / 2, base + (layoutId === 'polaroid' ? 100 : 68), s.width - s.padding * 2);
  const details: string[] = [];
  if (frame.showDate) details.push(date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase());
  if (frame.decoration === 'timestamp') details.push(date.toLocaleTimeString('en-GB', { hour12: false }));
  ctx.font = '32px "IBM Plex Mono", monospace';
  if (details.length) ctx.fillText(details.join('  /  '), s.width / 2, base + (layoutId === 'polaroid' ? 154 : 111), s.width - 40);
  if (frame.decoration === 'stars' || frame.decoration === 'hearts') {
    ctx.font = '32px sans-serif';
    ctx.fillText(frame.decoration === 'stars' ? '✦  ·  ✦' : '♡  ♡  ♡', s.width / 2, base + s.footer - 5);
  }
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image(); img.src = src;
  await img.decode(); return img;
}

export async function imageFromCanvas(canvas: HTMLCanvasElement, quality = .97) {
  // Async encoding avoids a large base64 string and a synchronous JPEG encode.
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Photo encoding failed.')), 'image/jpeg', quality));
  const url = URL.createObjectURL(blob);
  try { return await loadImage(url); } finally { URL.revokeObjectURL(url); }
}

export async function importPhoto(file: File): Promise<Photo> {
  if (!/^image\/(jpeg|png|webp|avif|gif|bmp|heic|heif)$/.test(file.type)) throw new Error('Choose a JPG, PNG, WebP, or another supported image.');
  if (file.size > 30 * 1024 * 1024) throw new Error('That image is too large. Choose a photo under 30 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('This image is empty.');
    // Normalize orientation and bound memory for very large phone photographs.
    const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is not available in this browser.');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { image: await imageFromCanvas(canvas, .96), mirrored: false, takenAt: new Date() };
  } catch {
    throw new Error('This photo could not be opened. Try a JPG, PNG, or WebP image.');
  } finally { URL.revokeObjectURL(url); }
}

export function abortableDelay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(id); reject(new DOMException('Cancelled', 'AbortError')); };
    const id = window.setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  });
}
