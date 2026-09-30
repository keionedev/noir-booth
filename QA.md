# NOIR BOOTH — verification and handoff

Latest verification: September 28, 2026.

## Filter expansion update

- Added 15 new grades, for 20 looks including Original. Existing five options preserved.
- Added a bounded, scrollable filter list with current-look label and mobile keyboard navigation.
- Fixed an export edge case discovered by repeated filter/download testing: the PNG now serializes the displayed canvas directly, without repainting text and risking a change in browser antialiasing.
- Current production deployment: `dpl_3wvEeESFJyZ6zVcGvvdEgiUczUXC`, status **READY**, at the same public URL below.
- Local TypeScript/Vite build passed. The full production browser suite now contains **21 tests**; the final Playwright result was `passed` with no failed tests.
- Added coverage verifies all 20 looks produce distinct output and agree across live view, thumbnail, composition, and downloaded PNG. Every filter's downloaded PNG matched its preview byte-for-byte.
- Mobile keyboard navigation reaches and selects the final filter, Instant, with no horizontal overflow. Desktop/mobile accessibility checks still pass.
- Updated files: `src/lib/photobooth.ts` (grades), `src/components/SettingsPanel.tsx` (selector), `src/styles.css` (bounded list), `src/components/StripPanel.tsx` (direct canvas export), `tests/booth.spec.ts` (regression coverage), and README/design/QA documentation.
- Production desktop and mobile filter screenshots were visually inspected. Real physical camera/browser testing remains outside the automated synthetic-camera checks.

## Initial production deployment

- Public URL: https://noir-booth-blond.vercel.app/
- Project: `keionedev/noir-booth`
- Deployment: `dpl_GYU6HvJHU6Qv3VhTN4Z5jjND1PXC`
- Target: production; status: **READY**, confirmed using Vercel CLI inspect.
- Framework: Vite / React / TypeScript / Tailwind CSS.
- Remote build duration: 15 seconds; post-build: 11 seconds.
- Source uploaded directly from the local workspace; no Git commit or remote repository was created.
- Public HTTP request returned **200**, the correct page title, and the intended camera, CSP, and content-type headers.
- Production opened in the Codex browser; no console warnings or errors were reported by its log check.
- No backend functions, analytics, log drain, or continuous monitoring service was added. Browser checks are point-in-time verification.

The Vercel connector's deployment method was unavailable and its deployment lookup returned 404; deployment and status were successfully verified with the authenticated CLI and the actual public URL.

## Tests actually executed

`npm run build` passed locally; the Vercel production build also passed.

`BOOTH_BASE_URL=https://noir-booth-blond.vercel.app npm test` (environment variable set with PowerShell syntax on Windows): **19 passed in 34.1 seconds** using headless Microsoft Edge through Playwright.

Coverage:

1. Camera is not requested on initial page load; capture/download are disabled until ready; help dialog closes with Escape and restores focus.
2. Local file import, all five filters, frame color, spacing, padding, caption, date, decoration, and PNG download. Downloaded PNG bytes exactly match the composition canvas PNG. No third-party network requests in this workflow.
3. Synthetic live camera, visible countdown, correct shot count, mirroring, single-photo retake preserving other shots, switching, and stopping tracks on close.
4. Cancel/resume preserves completed photos and resumes at the next empty slot; closing the camera cancels an active countdown.
5–7. Four-shot strip, grid, and Polaroid have the correct slot counts and output sizes; destructive layout changes require confirmation.
8–10. Denied permission, missing camera, and busy camera each show an actionable error with a working upload alternative.
11. Invalid image recovery, replacing one photo by upload, and confirmed new-session clearing.
12–15. 320, 390, 768, and 1024px responsive widths with no horizontal overflow, working mobile tabs, and customization.
16. Reduced-motion disables flash; sound toggle updates its accessible state.
17. Axe WCAG 2 A/AA and 2.1 AA checks: **zero violations** on desktop and mobile with expanded customization.
18. Late camera permission completion after cancellation immediately stops the arriving tracks and leaves the camera off.
19. Square live crop fits within the mobile viewfinder; closing during countdown preserves the empty slot.

Camera tests use generated red/blue frames. No real webcam or personal files were accessed. Real-device camera behavior in Safari, Firefox, and individual phones was not tested; that is the remaining hardware/browser validation limit.

## Visual comparison

The built-in Image Gen studio concept is documented in `DESIGN.md`, including its original absolute path. The concept and latest production screenshots were opened with `view_image` during the final comparison. Desktop screenshot was captured at **1505×1045**, matching the concept's width and target viewport; the full-page capture includes the complete footer. Responsive screenshot was captured at **390×844** with full-page output.

Codex's in-app browser was used first for visual inspection and help interaction. Its screenshot capture failed at an explicit test viewport, including a CDP screenshot timeout. Playwright/Edge supplied the reliable responsive screenshots and synthetic-camera automation.

| Comparison point | Result and refinement |
| --- | --- |
| Copy and navigation | User heading, subtitle, brand, how-to link, sound control, and footer preserved; no added marketing sections. Removed the concept's unimplemented U shortcut hint. |
| Layout and spacing | Three-column studio retained. Narrow settings rail and restrained right panel leave the camera dominant. Reduced excessive camera height and centered the viewfinder corners after max-height sizing. |
| Typography | Bold DM Sans heading paired with IBM Plex Mono status/section labels. Increased printed strip labels for preview readability. |
| Palette and surfaces | Exact requested black/panel/control/border/text colors; flat surfaces, subtle borders, small radii, no generated vignette or decorative gradients. |
| Icons and controls | Consistent outline icons, circular shutter, selected states, disabled camera actions, and labeled icon controls. Fixed missing mobile sound label found by Axe. |
| Photo composition | Cream paper preview, numbered empty slots, immediate customization, matching crop/filter/mirror pipeline and byte-identical PNG output. |
| Responsive and motion | Camera/shutter first, compact settings tabs, then print. No horizontal scroll at tested widths; reduced-motion flash suppression verified. |

The final implementation was visually verified against the studio concept, with the intentional functional refinements listed in `DESIGN.md`. No unresolved material visual defects were found in the inspected screens. This is a faithful implementation of the chosen design direction, not a pixel-for-pixel copy of a generated mockup.

## Final files

- `output/noir-booth-desktop.png`: final production desktop screenshot for handoff.
- `README.md`: run/build/deploy instructions, behavior, and source-file ownership map.
- `DESIGN.md`: design system and intentional concept refinements.
- `tests/booth.spec.ts`: repeatable browser regression coverage.

Transient `.qa` and Playwright result folders were removed after review. They are recreated by later test runs. Credentials, `.vercel`, dependency folders, and build output remain excluded from Git.
