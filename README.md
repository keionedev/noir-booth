# NOIR BOOTH

A private online photobooth built with React, TypeScript, Tailwind CSS, and Vite. Open straight into the studio, take or upload photos, customize a print, and download a high-resolution PNG. No backend or login.

**Live site:** https://noir-booth-blond.vercel.app/

## Run

Requires Node.js 22.12+ (or a supported newer version).

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Camera access requires a secure context: localhost for development, or HTTPS in production. Camera permission is requested only after pressing **Enable camera**.

```sh
npm run build
npm run preview
npm test
```

Tests use installed Microsoft Edge through Playwright. To test a deployment, set `BOOTH_BASE_URL` to its HTTPS URL before running `npm test`. All camera tests use synthetic frames; no real webcam or personal photos are accessed.

## Features

- 3-photo and 4-photo strips, 2×2 grid, and Polaroid.
- Off / 3 / 5 / 10-second timers, automatic capture, cancel/resume, camera switching, mirroring, optional shutter sound.
- Adjustable screen fill light with warm, neutral, and cool tones for dark rooms. It lights the subject during the preview and countdown without drawing an overlay into the saved photo.
- 20 looks (Original plus 19 filters), identical in live view, thumbnails, the print, and export. The compact filter list scrolls and supports keyboard selection.
- 18 camera effects: film grain, vignette, light leak, soft glow, prism, mirror split, pixelation, VHS lines, kaleidoscope, mirror stack, fisheye, tunnel, ripple, motion trail, RGB split, halftone, posterize, and solarize. Combine one effect with any color filter, adjust strength from 0–100%, or reset both. Effects also work on uploads and existing photos. The effects list remains compact and scrollable on desktop and mobile.
- Individual retakes or file replacements; multi-file upload with type, size, and decoding checks.
- Four frame colors, spacing, padding, 36-character caption, optional date, stars, hearts, and a film timestamp.
- High-resolution PNG export. The preview is the export canvas itself, scaled to fit the interface.
- Native modal confirmation before clearing photos, keyboard controls, reduced-motion support, mobile settings tabs.
- Larger camera workspace with compact capture controls. Fixed-height settings keep filter/effect changes from shifting the camera; long lists scroll inside the panel. Tablet widths place the strip below the booth, and desktop frame customization scrolls independently. Retake status stays beside the shutter without adding another row.

## Privacy and behavior

Photos remain in browser memory. There is no upload endpoint, external image service, analytics, or persistence. Fonts are served with the app. Download before refreshing or leaving. Uploads preserve their orientation and are not mirrored; the camera mirror setting is recorded individually when each shot is taken. Changing a filter or effect updates all photos; changing a layout with photos asks before clearing them. Stopping capture retains completed shots, and starting again fills empty slots. Switching browser tabs pauses an active session.

Mirror split reflects the left half onto the right at full opacity, including at low strength. Mirror stack reflects the top onto the bottom; kaleidoscope reflects both axes. For these effects, strength adjusts the crop, rather than blending in an asymmetric original. Zero strength restores the untouched photo. The camera Mirror toggle controls the orientation before the effect is applied.

## Camera and editing performance

Live view follows incoming video frames, with an animation-frame fallback for older browsers and a 30fps processing cap. Processing resolution follows the display size and backs off when rendering is slow. Preview work pauses when the camera leaves the viewport or the browser tab is hidden; this does not close an enabled camera. Close camera explicitly to release the device. Captured images and PNGs retain their full resolution.

Each photo retains only its current color-graded base and effect result. Caption, frame color, padding, and spacing reuse these pixels; strength changes reuse the graded base. Fisheye, tunnel, and ripple cache one coordinate map per canvas and reuse pixel buffers; changing strength or size replaces the map. Weakly held caches can be collected when photos are replaced or cleared. Capture and imports encode asynchronously with `toBlob`, avoiding large base64 strings. Effects use Canvas compositing and pixel transforms without relying on `CanvasRenderingContext2D.filter`.

Implementation references: [video frame callbacks](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback) and [Canvas optimization](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas).

Images are center-cropped at 4:3 for strips and 1:1 for grid/Polaroid. Default PNG sizes are 1072×2498, 1072×3246, 1340×1510, and 1072×1342 respectively. Frame spacing/padding change these dimensions. Camera resolution ultimately depends on the device. HEIC decoding depends on browser support; an unsupported image produces a clear error with JPG/PNG/WebP alternatives.

## Code map

| File | Responsibility |
| --- | --- |
| `src/App.tsx` | Session, countdown, capture, upload, sound, retake, and confirmation state |
| `src/hooks/useCamera.ts` | Opt-in media permission, switching, errors, request races, and track cleanup |
| `src/hooks/useLivePreview.ts` | Adaptive preview resolution, video-frame scheduling, visibility suspension, cleanup |
| `src/lib/photobooth.ts` | Crop/filter engine, two-stage photo cache, composition geometry, asynchronous encoding, timers |
| `src/lib/effects.ts` | 18 effects, solid symmetrical reflections, cached distortion maps, deterministic grain, adjustable strength |
| `src/components/CameraStage.tsx` | Live canvas, camera toolbar, countdown, shutter, and camera-off UI |
| `src/components/SettingsPanel.tsx` | Layout, timer, filters, effects, strength/reset, and mobile settings navigation |
| `src/components/StripPanel.tsx` | Print canvas, thumbnails, customization controls, and PNG downloads |
| `src/components/Modal.tsx` | Keyboard-accessible native dialog and focus restoration |
| `src/styles.css` | Studio design tokens, reusable controls, breakpoints, motion preferences |
| `src/main.tsx` | React entry and locally bundled fonts |
| `index.html`, `public/favicon.svg` | Page metadata and original aperture-style favicon |
| `tests/booth.spec.ts`, `playwright.config.ts` | Browser regression, export equality, privacy, accessibility, and responsive checks |
| `vite.config.ts`, `tsconfig.json`, `package*.json` | Vite/Tailwind, TypeScript, dependencies, and reproducible build |
| `vercel.json`, `.vercelignore` | Vite deployment configuration and production browser policies |
| `.gitignore` | Excludes credentials, dependency/build output, and transient test files |
| `DESIGN.md`, `QA.md` | Design rationale, intentional concept refinements, and verification evidence |

## Deploy

This is a static Vite app. On Vercel use framework **Vite**, build command `npm run build`, output directory `dist`. No application environment variables are required. The project is linked to `keionedev/noir-booth`. `.vercel` and `.env*` must remain untracked.

```sh
npx vercel --prod
```

Physical webcam behavior on individual phones, Safari, and Firefox still benefits from testing on those actual devices. Automated verification is performed in Chromium/Edge, including mobile-sized viewports; it does not substitute for real-device hardware testing.
