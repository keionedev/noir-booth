import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { filters } from '../src/lib/photobooth';
import { effects } from '../src/lib/effects';

const screenshotPath = (name: string) => join(tmpdir(), `noir-booth-${name}.png`);

async function fakeCamera(page: Page, error = '', delayed = false, detailed = false) {
  await page.addInitScript(({ error, delayed, detailed }) => {
    const qa = { calls: [] as MediaStreamConstraints[], streams: [] as MediaStream[], error };
    Object.assign(window, { __qa: qa });
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async (constraints: MediaStreamConstraints) => {
      qa.calls.push(constraints);
      if (qa.error) throw new DOMException('Test camera error', qa.error);
      const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 600;
      const ctx = canvas.getContext('2d')!;
      const draw = () => {
        ctx.fillStyle = '#e05030'; ctx.fillRect(0, 0, 400, 600); ctx.fillStyle = '#3050e0'; ctx.fillRect(400, 0, 400, 600);
        if (detailed) {
          const gradient = ctx.createLinearGradient(0, 0, 800, 600);
          gradient.addColorStop(0, '#af7848'); gradient.addColorStop(.5, '#387977'); gradient.addColorStop(1, '#ede2c3');
          ctx.fillStyle = gradient; ctx.fillRect(0, 0, 800, 600);
          for (let i = 0; i < 8; i++) {
            ctx.fillStyle = i % 2 ? '#202534' : '#dccaa9';
            ctx.beginPath(); ctx.arc(115 + i * 70, 170 + i * 30, 35 + i * 5, 0, Math.PI * 2); ctx.fill();
          }
          ctx.fillStyle = '#faf3db'; ctx.font = 'bold 46px sans-serif'; ctx.fillText('STUDIO / 08', 70, 500);
        }
      };
      draw();
      const stream = canvas.captureStream(20), interval = setInterval(draw, 50);
      const track = stream.getVideoTracks()[0], stop = track.stop.bind(track);
      track.stop = () => { clearInterval(interval); stop(); };
      qa.streams.push(stream);
      if (delayed) await new Promise<void>(resolve => { Object.assign(window, { releaseCamera: resolve }); });
      return stream;
    } });
    Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { configurable: true, value: async () => [{ kind: 'videoinput', deviceId: 'front', label: 'Test front' }, { kind: 'videoinput', deviceId: 'back', label: 'Test back' }] });
  }, { error, delayed, detailed });
}

async function fixture(page: Page) {
  const data = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 800; c.height = 600;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#e05030'; ctx.fillRect(0, 0, 400, 600);
    ctx.fillStyle = '#3050e0'; ctx.fillRect(400, 0, 400, 600);
    return c.toDataURL('image/png').split(',')[1];
  });
  return { name: 'test-photo.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') };
}

async function upload(page: Page, count = 3) {
  const file = await fixture(page);
  await page.locator('input[type=file]').setInputFiles(Array.from({ length: count }, (_, index) => ({ ...file, name: `test-${index}.png` })));
  await expect(page.locator('.toast')).toContainText(`${count} photo`);
}

async function compositionPixel(page: Page, x = 180, y = 180) {
  return page.getByTestId('composition').evaluate((c: HTMLCanvasElement, point) => Array.from(c.getContext('2d')!.getImageData(point.x, point.y, 1, 1).data), { x, y });
}

test('initial privacy, desktop design, help keyboard behavior', async ({ page }) => {
  await fakeCamera(page);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => (window as any).__qa.calls.length)).toBe(0);
  await expect(page.getByRole('button', { name: 'Download photo', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Start photo session' })).toBeDisabled();
  await page.screenshot({ path: screenshotPath('desktop'), fullPage: true });
  await page.getByRole('button', { name: 'How it works' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'How it works' })).toBeFocused();
  expect(errors).toEqual([]);
});

test('uploads, all filters, customization and byte-exact high-resolution export', async ({ page }) => {
  const external: string[] = [];
  const origin = new URL(String(test.info().project.use.baseURL)).origin;
  page.on('request', req => { if (/^https?:/.test(req.url()) && new URL(req.url()).origin !== origin) external.push(req.url()); });
  await page.goto('/'); await upload(page);
  const original = await compositionPixel(page);
  expect(original[0]).toBeGreaterThan(original[2]);
  await page.getByRole('button', { name: 'Black & white', exact: true }).click();
  const bw = await compositionPixel(page); expect(bw[0]).toBe(bw[1]); expect(bw[1]).toBe(bw[2]);
  const values: number[][] = [];
  for (const filter of ['Warm film', 'Cool tone', 'Soft vintage']) {
    await page.getByRole('button', { name: filter, exact: true }).click();
    values.push(await compositionPixel(page));
  }
  expect(new Set(values.map(v => v.join(','))).size).toBe(3);
  await page.getByRole('button', { name: 'White frame', exact: true }).click();
  expect((await compositionPixel(page, 0, 0)).slice(0, 3)).toEqual([255, 255, 255]);
  await page.getByRole('button', { name: 'Customize frame' }).click();
  await page.getByLabel('A few words').fill('A little Sunday ♡');
  await page.getByLabel('Add the date').check();
  await page.getByLabel('Little details').selectOption('stars');
  await page.getByLabel('Photo spacing').fill('30');
  await page.getByLabel('Frame padding').fill('40');
  const canvas = page.getByTestId('composition');
  await expect(canvas).toHaveJSProperty('width', 1120);
  await expect(canvas).toHaveJSProperty('height', 2610);
  await page.screenshot({ path: screenshotPath('customized'), fullPage: true });
  const preview = await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL('image/png').split(',')[1]);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download photo', exact: true }).click();
  const download = await downloadPromise;
  const downloaded = await readFile((await download.path())!);
  expect(downloaded.equals(Buffer.from(preview, 'base64'))).toBe(true);
  expect(external).toEqual([]);
});

test('capture counts, visible countdown, live mirror, retake, switch and close tracks', async ({ page }) => {
  await fakeCamera(page); await page.goto('/');
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
  await expect(page.getByText('Live view', { exact: true })).toBeVisible();
  await expect.poll(async () => page.locator('.live-canvas').evaluate((c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(150, 150, 1, 1).data[2])).toBeGreaterThan(200);
  await page.getByRole('button', { name: 'Start photo session' }).click();
  await expect(page.locator('.countdown')).toHaveText('3');
  await expect(page.getByRole('button', { name: 'Download photo', exact: true })).toBeEnabled({ timeout: 20000 });
  expect((await compositionPixel(page))[2]).toBeGreaterThan(200);
  await page.getByRole('button', { name: 'Mirror camera' }).click();
  await page.getByRole('button', { name: 'Select photo 2 to retake or replace' }).click();
  await page.getByRole('button', { name: 'Timer off', exact: true }).click();
  await page.getByRole('button', { name: 'Retake photo 2', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download photo', exact: true })).toBeEnabled();
  expect((await compositionPixel(page, 180, 930))[0]).toBeGreaterThan(200);
  expect((await compositionPixel(page, 180, 180))[2]).toBeGreaterThan(200);
  await page.getByRole('button', { name: 'Switch camera', exact: true }).click();
  await expect(page.getByText('Live view', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__qa.streams[0].getTracks()[0].readyState)).toBe('ended');
  await page.getByRole('button', { name: 'Close camera', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__qa.streams.every((s: MediaStream) => s.getTracks().every(t => t.readyState === 'ended')))).toBe(true);
});

test('cancel countdown keeps partial photos and resumes only empty slots', async ({ page }) => {
  await fakeCamera(page); await page.goto('/');
  await page.getByRole('button', { name: 'Timer off', exact: true }).click();
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
  await expect(page.getByText('Live view', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start photo session' }).click();
  await expect(page.getByRole('button', { name: 'Select photo 1 to retake or replace' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel capture session' }).click();
  await expect(page.getByRole('status')).toContainText('Session paused');
  await expect(page.getByTestId('composition')).toHaveAttribute('aria-label', /1 of 3/);
  await page.getByRole('button', { name: '3 second timer', exact: true }).click();
  await page.getByRole('button', { name: 'Start photo session' }).click();
  await expect(page.locator('.shot-label')).toHaveText('Shot 2 of 3');
  await page.getByRole('button', { name: 'Close camera', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start photo session' })).toBeDisabled();
  await expect(page.getByTestId('composition')).toHaveAttribute('aria-label', /1 of 3/);
});

for (const [name, count, width, height] of [['4-strip', 4, 1072, 3246], ['2 × 2 grid', 4, 1340, 1510], ['Polaroid', 1, 1072, 1342]] as const) {
  test(`${name} layout composes and exports ${count} photos`, async ({ page }) => {
    await page.goto('/'); await page.getByRole('button', { name, exact: true }).click();
    await upload(page, count);
    await expect(page.getByRole('button', { name: 'Download photo', exact: true })).toBeEnabled();
    await expect(page.getByTestId('composition')).toHaveJSProperty('width', width);
    await expect(page.getByTestId('composition')).toHaveJSProperty('height', height);
    await page.getByRole('button', { name: 'New session', exact: true }).click();
    await page.getByRole('button', { name: 'Keep this session' }).click();
    await expect(page.getByTestId('composition')).toHaveAttribute('aria-label', new RegExp(`${count} of ${count}`));
    await page.getByRole('button', { name: '3-strip', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Clear & change layout' }).click();
    await expect(page.getByTestId('composition')).toHaveAttribute('aria-label', /0 of 3/);
  });
}

for (const [error, text] of [['NotAllowedError', 'Camera access was denied'], ['NotFoundError', 'No camera was found'], ['NotReadableError', 'Your camera is busy']]) {
  test(`camera ${error} has a usable upload fallback`, async ({ page }) => {
    await fakeCamera(page, error); await page.goto('/');
    await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
    await expect(page.getByText(text, { exact: false })).toBeVisible();
    await upload(page);
    await expect(page.getByRole('button', { name: 'Download photo', exact: true })).toBeEnabled();
  });
}

test('invalid uploads recover, and individual upload replacement preserves other photos', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await expect(page.getByRole('status')).toContainText('could not be opened');
  await upload(page);
  const first = await compositionPixel(page);
  await page.getByRole('button', { name: 'Select photo 2 to retake or replace' }).click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload replacement', exact: true }).click();
  const chooser = await chooserPromise; await chooser.setFiles(await fixture(page));
  await expect(page.locator('.toast')).toContainText('1 photo added');
  expect(await compositionPixel(page)).toEqual(first);
  await page.getByRole('button', { name: 'New session', exact: true }).click();
  await page.getByRole('button', { name: 'Start new session' }).click();
  await expect(page.getByTestId('composition')).toHaveAttribute('aria-label', /0 of 3/);
});

for (const width of [320, 390, 768, 1024]) {
  test(`responsive ${width}px, no horizontal overflow and accessible controls`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 }); await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width <= 700) {
      await page.getByRole('button', { name: 'Timer', exact: true }).click();
      await page.getByRole('button', { name: '10 second timer', exact: true }).click();
      await page.getByRole('button', { name: 'Filter', exact: true }).click();
      await page.getByRole('button', { name: 'Warm film', exact: true }).click();
      await page.getByRole('button', { name: 'Layout', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Customize frame' }).click();
    await page.getByLabel('A few words').fill('A memory worth keeping');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390) await page.screenshot({ path: screenshotPath('mobile'), fullPage: true });
  });
}

test('reduced motion disables the flash and respects sound toggle', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await fakeCamera(page); await page.goto('/');
  await page.getByRole('button', { name: 'Sound off', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sound on', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Timer off', exact: true }).click();
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
  await expect(page.getByText('Live view', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start photo session' }).click();
  await expect(page.locator('.shutter-flash')).toHaveCSS('display', 'none');
  await page.getByRole('button', { name: 'Cancel capture session' }).click();
});

test('keyboard labels and contrast pass accessibility checks on desktop and mobile', async ({ page }) => {
  await page.goto('/');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Customize frame' }).click();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
});

test('late camera permission response is discarded after cancel', async ({ page }) => {
  await fakeCamera(page, '', true);
  await page.goto('/');
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel camera request', exact: true }).click();
  await page.evaluate(() => (window as any).releaseCamera());
  await expect(page.getByRole('heading', { name: 'Camera’s off', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__qa.streams[0].getTracks()[0].readyState)).toBe('ended');
});

test('live square crop fits the mobile stage and closing during countdown stops capture', async ({ page }) => {
  await fakeCamera(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.getByRole('button', { name: 'Polaroid', exact: true }).click();
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
  await expect(page.getByText('Live view', { exact: true })).toBeVisible();
  const live = await page.locator('.live-canvas').boundingBox(), stage = await page.locator('.viewfinder').boundingBox();
  expect(live!.width / live!.height).toBeCloseTo(1, 1);
  expect(live!.width).toBeLessThanOrEqual(stage!.width);
  expect(live!.height).toBeLessThanOrEqual(stage!.height + 1);
  await page.getByRole('button', { name: 'Start photo session' }).click();
  await expect(page.locator('.countdown')).toHaveText('3');
  await page.getByRole('button', { name: 'Close camera', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start photo session' })).toBeDisabled();
  await expect(page.getByTestId('composition')).toHaveAttribute('aria-label', /0 of 1/);
});

test('all 20 looks are distinct and match live view, thumbnails, print and PNG', async ({ page }) => {
  test.setTimeout(90000);
  await fakeCamera(page); await page.goto('/');
  await page.getByRole('button', { name: 'Polaroid', exact: true }).click();
  await page.getByRole('button', { name: 'Timer off', exact: true }).click();
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
  await expect(page.getByText('Live view', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start photo session' }).click();
  await expect(page.getByRole('button', { name: 'Download photo', exact: true })).toBeEnabled();
  await expect(page.getByRole('group', { name: 'Photo filters' }).getByRole('button')).toHaveCount(20);
  const signatures = new Set<string>();
  for (const filter of filters) {
    await page.getByRole('button', { name: filter.name, exact: true }).click();
    await expect(page.getByRole('button', { name: filter.name, exact: true })).toHaveAttribute('aria-pressed', 'true');
    const printPixel = await compositionPixel(page);
    signatures.add(printPixel.join(','));
    await expect.poll(async () => {
      const live = await page.locator('.live-canvas').evaluate((c: HTMLCanvasElement) => Array.from(c.getContext('2d')!.getImageData(100, 100, 1, 1).data));
      return Math.max(...live.slice(0, 3).map((value, i) => Math.abs(value - printPixel[i])));
    }).toBeLessThanOrEqual(3);
    const thumb = await page.locator('.thumbnail canvas').evaluate((c: HTMLCanvasElement) => Array.from(c.getContext('2d')!.getImageData(20, 20, 1, 1).data));
    expect(thumb).toEqual(printPixel);
    const preview = await page.getByTestId('composition').evaluate((c: HTMLCanvasElement) => c.toDataURL('image/png').split(',')[1]);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download (photo|again)/ }).click();
    const download = await downloadPromise;
    const png = await readFile((await download.path())!);
    expect(png.equals(Buffer.from(preview, 'base64')), filter.name).toBe(true);
  }
  expect(signatures.size).toBe(20);
  await page.getByRole('button', { name: 'Close camera', exact: true }).click();
});

test('new filter list supports mobile scrolling and keyboard selection', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  const first = page.getByRole('button', { name: 'Original', exact: true });
  await first.click();
  for (let i = 1; i < filters.length; i++) await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Instant', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Instant', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.filter-selection')).toContainText('Instant');
  expect(await page.locator('.filter-options').evaluate(el => el.scrollTop > 0)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: screenshotPath('filters-mobile'), fullPage: true });
});

async function samplePhoto(page: Page, selector: string, composition = false) {
  return page.locator(selector).evaluate((canvas: HTMLCanvasElement, print) => {
    const sample = document.createElement('canvas'); sample.width = 32; sample.height = 32;
    const ctx = sample.getContext('2d', { willReadFrequently: true })!;
    if (print) ctx.drawImage(canvas, 56, 56, 960, 960, 0, 0, 32, 32);
    else ctx.drawImage(canvas, 0, 0, 32, 32);
    return Array.from(ctx.getImageData(0, 0, 32, 32).data);
  }, composition);
}

async function rawPhotoDigest(page: Page) {
  return page.getByTestId('composition').evaluate((canvas: HTMLCanvasElement) => {
    const data = canvas.getContext('2d')!.getImageData(56, 56, 960, 960).data;
    let hash = 2166136261;
    for (const byte of data) hash = Math.imul(hash ^ byte, 16777619);
    return hash >>> 0;
  });
}

test('all camera effects layer with color, adjust strength and export the exact preview', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await fakeCamera(page, '', false, true); await page.goto('/');
  await page.getByRole('button', { name: 'Polaroid', exact: true }).click();
  await page.getByRole('button', { name: 'Warm film', exact: true }).click();
  await page.getByRole('button', { name: 'Timer off', exact: true }).click();
  await page.getByRole('button', { name: 'Effects', exact: true }).click();
  await expect(page.getByLabel('Effect strength')).toBeDisabled();
  await expect(page.getByRole('group', { name: 'Camera effects' }).getByRole('button')).toHaveCount(effects.length);
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
  await expect(page.getByText('Live view', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start photo session' }).click();
  await expect(page.getByRole('button', { name: 'Download photo', exact: true })).toBeEnabled();
  const baseline = await samplePhoto(page, '[data-testid=composition]', true);
  const baselineDigest = await rawPhotoDigest(page);
  const signatures = new Set<string>();
  for (const effect of effects.slice(1)) {
    await page.getByRole('button', { name: effect.name, exact: true }).click();
    await page.getByLabel('Effect strength').fill('100');
    await expect(page.locator('.effect-badge')).toHaveText(`${effect.name} · 100%`);
    const print = await samplePhoto(page, '[data-testid=composition]', true);
    expect(print, effect.name).not.toEqual(baseline);
    signatures.add(print.join(','));
    await expect.poll(async () => {
      const live = await samplePhoto(page, '.live-canvas');
      return live.reduce((sum, value, i) => sum + Math.abs(value - print[i]), 0) / live.length;
    }, { message: `${effect.name}: live/print match including scale and JPEG tolerance` }).toBeLessThan(10);
    const thumbnail = await samplePhoto(page, '.thumbnail canvas');
    expect(thumbnail.reduce((sum, value, i) => sum + Math.abs(value - print[i]), 0) / thumbnail.length).toBeLessThan(6);
    const preview = await page.getByTestId('composition').evaluate((c: HTMLCanvasElement) => c.toDataURL('image/png').split(',')[1]);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download (photo|again)/ }).click();
    const png = await readFile((await (await downloadPromise).path())!);
    expect(png.equals(Buffer.from(preview, 'base64')), effect.name).toBe(true);
    await page.getByLabel('Effect strength').fill('0');
    expect(await rawPhotoDigest(page), `${effect.name}: zero strength restores the original pixels`).toBe(baselineDigest);
  }
  expect(signatures.size).toBe(effects.length - 1);
  await page.getByRole('button', { name: 'Light leak', exact: true }).click();
  await page.getByLabel('Effect strength').fill('65');
  await page.screenshot({ path: screenshotPath('effects-desktop'), fullPage: true });
  await page.getByRole('button', { name: 'Reset filter & effect', exact: true }).click();
  await expect(page.getByRole('button', { name: 'No effect', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Effect strength')).toBeDisabled();
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Original', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('frame edits reuse photo pixels and filter changes invalidate the cache', async ({ page }) => {
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.getImageData;
    Object.assign(window, { pixelReads: 0 });
    CanvasRenderingContext2D.prototype.getImageData = function(...args: Parameters<typeof original>) {
      if (this.canvas.width >= 600) (window as any).pixelReads++;
      return original.apply(this, args);
    };
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Warm film', exact: true }).click();
  await upload(page);
  await expect(page.getByRole('button', { name: 'Download photo', exact: true })).toBeEnabled();
  await page.evaluate(() => { (window as any).pixelReads = 0; });
  await page.getByRole('button', { name: 'Customize frame', exact: true }).click();
  await page.getByLabel('A few words').pressSequentially('A little moment, kept.');
  await page.getByLabel('Photo spacing').fill('30');
  await page.getByLabel('Frame padding').fill('40');
  await page.getByRole('button', { name: 'White frame', exact: true }).click();
  expect(await page.evaluate(() => (window as any).pixelReads)).toBe(0);
  await page.getByRole('button', { name: 'Cool tone', exact: true }).click();
  expect(await page.evaluate(() => (window as any).pixelReads)).toBe(3);
});

for (const fallback of [false, true]) {
  test(`mobile preview scales to the screen, suspends offscreen and resumes (${fallback ? 'fallback' : 'video frames'})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(({ fallback }) => {
      if (fallback) Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', { value: undefined });
      const original = CanvasRenderingContext2D.prototype.drawImage;
      Object.assign(window, { liveDraws: 0 });
      CanvasRenderingContext2D.prototype.drawImage = function(...args: any[]) {
        if (args[0] instanceof HTMLVideoElement) (window as any).liveDraws++;
        return original.apply(this, args as Parameters<typeof original>);
      };
    }, { fallback });
    await fakeCamera(page); await page.goto('/');
    await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).liveDraws)).toBeGreaterThan(2);
    const width = await page.locator('.live-canvas').evaluate((c: HTMLCanvasElement) => c.width);
    expect(width).toBeGreaterThanOrEqual(320); expect(width).toBeLessThan(600);
    await page.getByRole('button', { name: 'Effects', exact: true }).click();
    await page.getByRole('button', { name: 'Prism', exact: true }).click();
    await page.getByLabel('Effect strength').focus(); await page.keyboard.press('ArrowRight');
    await expect(page.getByLabel('Effect strength')).toHaveValue('70');
    await expect(page.getByRole('button', { name: 'Prism', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    await page.screenshot({ path: screenshotPath('effects-mobile'), fullPage: true });
    await page.getByRole('button', { name: 'New session', exact: true }).scrollIntoViewIfNeeded();
    // Wait for the observer to report the camera is fully outside the viewport.
    await expect.poll(() => page.locator('.viewfinder').evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThan(0);
    await page.waitForTimeout(150);
    const paused = await page.evaluate(() => (window as any).liveDraws);
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => (window as any).liveDraws)).toBe(paused);
    await page.locator('.viewfinder').scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => (window as any).liveDraws)).toBeGreaterThan(paused);
    await page.getByRole('button', { name: 'Close camera', exact: true }).click();
    const closed = await page.evaluate(() => (window as any).liveDraws);
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => (window as any).liveDraws)).toBe(closed);
  });
}

async function horizontalSymmetry(page: Page, selector: string, composition = false) {
  return page.locator(selector).evaluate((canvas: HTMLCanvasElement, print) => {
    const width = print ? 960 : canvas.width, height = print ? 960 : canvas.height;
    const data = canvas.getContext('2d')!.getImageData(print ? 56 : 0, print ? 56 : 0, width, height).data;
    let difference = 0, transparent = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < Math.ceil(width / 2); x++) {
      const left = (y * width + x) * 4, right = (y * width + width - 1 - x) * 4;
      for (let c = 0; c < 3; c++) difference = Math.max(difference, Math.abs(data[left + c] - data[right + c]));
      if (data[left + 3] !== 255 || data[right + 3] !== 255) transparent++;
    }
    return { difference, transparent, width };
  }, composition);
}

test('Mirror split has solid symmetric halves at every strength, including an odd-width live view', async ({ page }) => {
  await page.setViewportSize({ width: 1505, height: 1019 });
  await fakeCamera(page, '', false, true); await page.goto('/');
  await page.getByRole('button', { name: 'Polaroid', exact: true }).click();
  await page.getByRole('button', { name: 'Timer off', exact: true }).click();
  await page.getByRole('button', { name: 'Effects', exact: true }).click();
  await page.getByRole('button', { name: 'Mirror split', exact: true }).click();
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
  await expect(page.getByText('Live view', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start photo session' }).click();
  await expect(page.getByRole('button', { name: 'Download photo', exact: true })).toBeEnabled();
  expect((await horizontalSymmetry(page, '.live-canvas')).width % 2).toBe(1);
  for (const strength of [5, 25, 65, 100]) {
    await page.getByLabel('Effect strength').fill(String(strength));
    await expect.poll(async () => (await horizontalSymmetry(page, '.live-canvas')).difference).toBe(0);
    const print = await horizontalSymmetry(page, '[data-testid=composition]', true);
    expect(print.difference, `symmetry at ${strength}%`).toBe(0);
    expect(print.transparent).toBe(0);
    expect((await horizontalSymmetry(page, '.thumbnail canvas')).difference).toBeLessThanOrEqual(1);
  }
  await page.getByLabel('Effect strength').fill('65');
  await page.getByRole('button', { name: 'Mirror camera', exact: true }).click();
  await page.getByRole('button', { name: 'Select photo 1 to retake or replace' }).click();
  await page.getByRole('button', { name: 'Retake photo 1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download photo', exact: true })).toBeEnabled();
  expect((await horizontalSymmetry(page, '[data-testid=composition]', true)).difference).toBe(0);
  await page.getByRole('button', { name: 'Dismiss message', exact: true }).click();
  await page.screenshot({ path: screenshotPath('mirror-fixed'), fullPage: true });
  await page.getByLabel('Effect strength').fill('0');
  expect((await horizontalSymmetry(page, '[data-testid=composition]', true)).difference).toBeGreaterThan(30);
  // Uploaded photos use their own orientation and receive the same solid reflection.
  await page.getByRole('button', { name: 'Select photo 1 to retake or replace' }).click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload replacement', exact: true }).click();
  await (await chooserPromise).setFiles(await fixture(page));
  await expect(page.locator('.toast')).toContainText('1 photo added');
  await page.getByLabel('Effect strength').fill('65');
  expect((await horizontalSymmetry(page, '[data-testid=composition]', true)).difference).toBe(0);
  const left = await compositionPixel(page, 180, 180), right = await compositionPixel(page, 900, 180);
  expect(left).toEqual(right); expect(right[0]).toBeGreaterThan(200); expect(right[2]).toBeLessThan(80);
});

test('expanded effects remain compact and keyboard accessible on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 }); await page.goto('/');
  await page.getByRole('button', { name: 'Effects', exact: true }).click();
  await page.getByRole('button', { name: 'No effect', exact: true }).click();
  for (let i = 1; i < effects.length; i++) await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Solarize', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Solarize', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('.effect-options').evaluate(el => el.scrollTop > 0 && el.clientHeight <= 300)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: screenshotPath('expanded-effects-mobile'), fullPage: true });
});
