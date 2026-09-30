# NOIR BOOTH design system

The functional reference was https://photobooth-io.cc/. Only its choose / capture / customize / download workflow was consulted. The workspace layout, components, and identity are original.

The generated studio concept is at `C:/Users/lance/.codex/generated_images/01a0dedd-e502-7050-a6d8-37561ab269b5/exec-1f5094d7-2b53-4838-ae6d-3c794c718d89.png` (built-in Image Gen, UI mockup). It is a design reference, never a shipped UI asset.

## Tokens and structure

- Background #080808; panels #141414; controls #202020; borders #303030; text #F5F5F5; secondary #A3A3A3; primary #F0EDE6.
- DM Sans Variable bold headlines and wordmark; IBM Plex Mono for small section, status, and shot labels. Fonts are bundled locally.
- Desktop: slim header, narrow settings rail, dominant camera stage, live strip panel, quiet footer. Borders are hairlines; radius 3–5px except the shutter and swatches.
- Lucide outline icons: aperture, camera, mirror, camera switch, sound, upload, download, close, retake, image placeholder, disclosure, and selected check. No photographic assets are shipped.
- Compact mobile: camera and shutter first, tabbed settings, then strip and customization. Tablet groups settings above the camera/strip columns.
- Components: App orchestrates session state; camera hook owns stream lifecycle; CameraStage renders live view; SettingsPanel owns compact settings tabs; StripPanel renders the print and editor; Modal provides native focus trapping.

## Intentional refinements from the concept

- Exact user palette, without the generated texture/vignette.
- Narrower desktop sidebars preserve the camera as the main focus.
- The timer defaults consistently to 3 seconds; the concept incorrectly highlighted Off while labeling a 3-second timer.
- Strip shots use a 4:3 crop; grid and Polaroid use square crops. Live view and export always use the chosen crop.
- Camera switch/close are labeled icon controls to fit smaller desktop widths.
- No unimplemented keyboard shortcut is advertised. Every control supports ordinary keyboard navigation.
- Required error, confirmation, retake, customization, and mobile states extend the same component system.

## Rendering contract

Raw local images + per-shot mirroring → identical center crop and pixel color transforms → one full-resolution composition canvas. The visible print is that canvas scaled with CSS. PNG export serializes that same canvas. No CSS filters, screen captures, backend, analytics, or photo uploads to a server.

## Expanded filter collection

The original five options are preserved. Fifteen additional grades bring the selector to 20 looks: Sepia, Noir, Silver, Matte, Golden hour, Rose, Dusty pink, Lavender, Arctic, Ocean, Olive, Amber, Faded film, Vivid, and Instant. New grades combine luminance-based saturation, contrast, and channel tint/lift in the existing shared pixel pipeline. The selector scrolls within a bounded height, remains keyboard accessible, and shows the current look above the list. Mobile uses two columns in the Filter tab.

Downloads serialize the displayed canvas without a second paint. This avoids browser canvas-backend changes altering text antialiasing between preview and download.
