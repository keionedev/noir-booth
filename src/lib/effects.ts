export const effects = [
  { id: 'none', name: 'No effect', description: 'Just you, in your chosen color.' },
  { id: 'grain', name: 'Film grain', description: 'A little texture, like a favorite negative.' },
  { id: 'vignette', name: 'Vignette', description: 'Soft shadows at the edges. You at the center.' },
  { id: 'leak', name: 'Light leak', description: 'A warm wash of light across the frame.' },
  { id: 'glow', name: 'Soft glow', description: 'Dreamy light with a gentle, diffused finish.' },
  { id: 'prism', name: 'Prism', description: 'Offset reflections, like light through glass.' },
  { id: 'mirror', name: 'Mirror split', description: 'A clean left-to-right reflection. Strength adjusts the crop; zero turns it off.' },
  { id: 'pixel', name: 'Pixel', description: 'Big pixels. A small dose of nostalgia.' },
  { id: 'vhs', name: 'VHS lines', description: 'A quiet nod to home-video days.' },
  { id: 'kaleidoscope', name: 'Kaleidoscope', description: 'Four reflections, one moment. Strength brings you closer.' },
  { id: 'mirror-stack', name: 'Mirror stack', description: 'An upside-down twin. Strength adjusts the crop; zero turns it off.' },
  { id: 'fisheye', name: 'Fisheye', description: 'A playful wide-angle bulge, right at the center.' },
  { id: 'tunnel', name: 'Tunnel', description: 'Pull the center inward for a little optical illusion.' },
  { id: 'ripple', name: 'Ripple', description: 'A still, wavy reflection, like looking through water.' },
  { id: 'motion', name: 'Motion trail', description: 'Soft echoes that stretch out from your pose.' },
  { id: 'rgb', name: 'RGB split', description: 'Separate the color channels for an analog glitch.' },
  { id: 'halftone', name: 'Halftone', description: 'Your photo in ink dots, straight off the printed page.' },
  { id: 'poster', name: 'Posterize', description: 'Bold blocks of color with a graphic finish.' },
  { id: 'solar', name: 'Solarize', description: 'Reverse the highlights for a darkroom experiment.' },
] as const;

export type EffectId = typeof effects[number]['id'];
export interface EffectSettings { id: EffectId; amount: number }
export const defaultEffect: EffectSettings = { id: 'none', amount: 65 };

const scratchCanvases = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
let grain: HTMLCanvasElement | undefined;

function grainTexture() {
  if (grain) return grain;
  grain = document.createElement('canvas');
  grain.width = 320; grain.height = 320;
  const ctx = grain.getContext('2d')!;
  const data = ctx.createImageData(320, 320);
  // A fixed seed keeps the texture still and reproducible at every output size.
  let seed = 1977;
  for (let i = 0; i < data.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = seed >>> 24;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return grain;
}

function copyFrame(ctx: CanvasRenderingContext2D, width: number, height: number) {
  let copy = scratchCanvases.get(ctx.canvas);
  if (!copy) { copy = document.createElement('canvas'); scratchCanvases.set(ctx.canvas, copy); }
  if (copy.width !== width) copy.width = width;
  if (copy.height !== height) copy.height = height;
  const copyCtx = copy.getContext('2d', { willReadFrequently: true })!;
  copyCtx.clearRect(0, 0, width, height);
  copyCtx.drawImage(ctx.canvas, 0, 0, width, height);
  return copy;
}

// A single map per destination canvas bounds memory while avoiding recalculating
// trigonometry for every video frame. Changing strength replaces the old map.
const warpMaps = new WeakMap<HTMLCanvasElement, { key: string; map: Uint32Array }>();
const pixelBuffers = new WeakMap<HTMLCanvasElement, ImageData>();

function outputPixels(ctx: CanvasRenderingContext2D, width: number, height: number) {
  let pixels = pixelBuffers.get(ctx.canvas);
  if (!pixels || pixels.width !== width || pixels.height !== height) {
    pixels = ctx.createImageData(width, height); pixelBuffers.set(ctx.canvas, pixels);
  }
  return pixels;
}

function warp(ctx: CanvasRenderingContext2D, width: number, height: number, id: EffectId, strength: number) {
  const key = `${width}:${height}:${id}:${strength}`;
  let cached = warpMaps.get(ctx.canvas);
  if (cached?.key !== key) {
    const map = new Uint32Array(width * height);
    for (let y = 0; y < height; y++) {
      const ny = (y + .5) / height * 2 - 1;
      const wave = id === 'ripple' ? Math.sin(ny * Math.PI * 5) * width * .03 * strength : 0;
      for (let x = 0; x < width; x++) {
        const nx = (x + .5) / width * 2 - 1, radius = nx * nx + ny * ny;
        let sx = x, sy = y;
        if (id === 'ripple') sx += wave;
        else if (radius < 1) {
          const factor = 1 + (id === 'fisheye' ? -.62 : .8) * strength * (1 - radius);
          sx = (nx * factor + 1) * width / 2 - .5;
          sy = (ny * factor + 1) * height / 2 - .5;
        }
        map[y * width + x] = (Math.min(height - 1, Math.max(0, Math.round(sy))) * width + Math.min(width - 1, Math.max(0, Math.round(sx)))) * 4;
      }
    }
    cached = { key, map }; warpMaps.set(ctx.canvas, cached);
  }
  const source = ctx.getImageData(0, 0, width, height).data;
  const output = outputPixels(ctx, width, height), dest = output.data;
  for (let i = 0; i < cached.map.length; i++) {
    const sourceIndex = cached.map[i], target = i * 4;
    dest[target] = source[sourceIndex]; dest[target + 1] = source[sourceIndex + 1];
    dest[target + 2] = source[sourceIndex + 2]; dest[target + 3] = source[sourceIndex + 3];
  }
  ctx.putImageData(output, 0, 0);
}

function reflect(ctx: CanvasRenderingContext2D, width: number, height: number, vertical: boolean) {
  const copy = copyFrame(ctx, width, height);
  ctx.save();
  // Reflect already-rendered pixels at full opacity. This also handles odd sizes
  // by sharing the center pixel, with no seam or translucent double exposure.
  ctx.beginPath();
  if (vertical) {
    ctx.rect(0, Math.floor(height / 2), width, Math.ceil(height / 2)); ctx.clip();
    ctx.translate(0, height); ctx.scale(1, -1);
  } else {
    ctx.rect(Math.floor(width / 2), 0, Math.ceil(width / 2), height); ctx.clip();
    ctx.translate(width, 0); ctx.scale(-1, 1);
  }
  ctx.drawImage(copy, 0, 0); ctx.restore();
}

function mirrorFrame(ctx: CanvasRenderingContext2D, width: number, height: number, id: EffectId, strength: number) {
  const copy = copyFrame(ctx, width, height), zoom = 1 + strength * .45;
  const cropW = width / zoom, cropH = height / zoom;
  ctx.drawImage(copy, (width - cropW) / 2, (height - cropH) / 2, cropW, cropH, 0, 0, width, height);
  if (id !== 'mirror-stack') reflect(ctx, width, height, false);
  if (id !== 'mirror') reflect(ctx, width, height, true);
}

// Effects use normalized geometry and standard compositing, without Canvas.filter.
// Live view, saved photos and uploads all pass through this same function.
export function applyEffect(ctx: CanvasRenderingContext2D, width: number, height: number, effect: EffectSettings) {
  const strength = Math.max(0, Math.min(1, effect.amount / 100));
  if (effect.id === 'none' || strength === 0) return;
  ctx.save();
  try {
    if (effect.id === 'grain') {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = strength * .7;
      ctx.drawImage(grainTexture(), 0, 0, width, height);
    } else if (effect.id === 'vignette') {
      ctx.scale(width, height);
      const shade = ctx.createRadialGradient(.5, .5, .15, .5, .5, .71);
      shade.addColorStop(0, 'transparent'); shade.addColorStop(.5, `rgba(0,0,0,${strength * .12})`);
      shade.addColorStop(1, `rgba(0,0,0,${strength * .88})`);
      ctx.fillStyle = shade; ctx.fillRect(0, 0, 1, 1);
    } else if (effect.id === 'leak') {
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = strength;
      ctx.scale(width, height);
      const light = ctx.createRadialGradient(.04, .32, 0, .04, .32, .95);
      light.addColorStop(0, '#ffd99bea'); light.addColorStop(.3, '#f0643caa'); light.addColorStop(1, '#eb234b00');
      ctx.fillStyle = light; ctx.fillRect(0, 0, 1, 1);
    } else if (effect.id === 'glow') {
      // A small downsample creates portable diffusion, including older Safari.
      const copy = copyFrame(ctx, 40, Math.max(1, Math.round(40 * height / width)));
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = strength * .45;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(copy, 0, 0, width, height);
    } else if (effect.id === 'prism') {
      const copy = copyFrame(ctx, width, height);
      const shift = width * .055 * strength;
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = strength * .24;
      ctx.drawImage(copy, -shift, 0, width + shift * 2, height);
      ctx.drawImage(copy, shift, -height * .015, width, height * 1.03);
    } else if (effect.id === 'mirror' || effect.id === 'mirror-stack' || effect.id === 'kaleidoscope') {
      mirrorFrame(ctx, width, height, effect.id, strength);
    } else if (effect.id === 'pixel') {
      const columns = Math.round(96 - strength * 78);
      const copy = copyFrame(ctx, columns, Math.max(1, Math.round(columns * height / width)));
      ctx.imageSmoothingEnabled = false; ctx.drawImage(copy, 0, 0, width, height);
    } else if (effect.id === 'vhs') {
      const step = height / 150;
      ctx.fillStyle = `rgba(0,0,0,${strength * .42})`;
      for (let y = 0; y < height; y += step) ctx.fillRect(0, y, width, step * .38);
      ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(115,151,189,${strength * .1})`;
      ctx.fillRect(0, 0, width, height);
    } else if (effect.id === 'fisheye' || effect.id === 'tunnel' || effect.id === 'ripple') {
      warp(ctx, width, height, effect.id, strength);
    } else if (effect.id === 'motion') {
      const copy = copyFrame(ctx, width, height);
      ctx.globalAlpha = strength * .14;
      for (let i = 1; i <= 4; i++) {
        const offset = width * .016 * strength * i;
        ctx.drawImage(copy, offset, 0, width, height);
        ctx.drawImage(copy, -offset, 0, width, height);
      }
    } else if (effect.id === 'rgb') {
      const source = ctx.getImageData(0, 0, width, height).data;
      const output = outputPixels(ctx, width, height), dest = output.data;
      const shift = Math.max(1, Math.round(width * .025 * strength));
      for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
          const i = (row + x) * 4;
          dest[i] = source[(row + Math.max(0, x - shift)) * 4];
          dest[i + 1] = source[i + 1];
          dest[i + 2] = source[(row + Math.min(width - 1, x + shift)) * 4 + 2];
          dest[i + 3] = source[i + 3];
        }
      }
      ctx.putImageData(output, 0, 0);
    } else if (effect.id === 'halftone') {
      const columns = Math.round(90 - strength * 55), rows = Math.max(1, Math.round(columns * height / width));
      const copy = copyFrame(ctx, columns, rows);
      const pixels = copy.getContext('2d')!.getImageData(0, 0, columns, rows).data;
      const cellW = width / columns, cellH = height / rows;
      ctx.fillStyle = '#eee8dc'; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#141414'; ctx.beginPath();
      for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
        const i = (y * columns + x) * 4;
        const ink = 1 - (pixels[i] * .2126 + pixels[i + 1] * .7152 + pixels[i + 2] * .0722) / 255;
        const radius = Math.sqrt(ink) * Math.min(cellW, cellH) * .57;
        const cx = (x + .5) * cellW, cy = (y + .5) * cellH;
        ctx.moveTo(cx + radius, cy); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      }
      ctx.fill();
    } else if (effect.id === 'poster' || effect.id === 'solar') {
      const pixels = ctx.getImageData(0, 0, width, height), data = pixels.data;
      const levels = Math.round(10 - strength * 7), step = 255 / (levels - 1);
      for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) {
        const value = data[i + c];
        data[i + c] = effect.id === 'poster' ? Math.round(value / step) * step : value + ((value > 127 ? 255 - value : value) - value) * strength;
      }
      ctx.putImageData(pixels, 0, 0);
    }
  } finally { ctx.restore(); }
}
