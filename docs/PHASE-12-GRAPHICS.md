# Phase 12A / 12B — Graphics Resolution and Sprite Quality

## Goal

Improve the deployed demo's visual clarity without changing mission mechanics, authored-map coordinates, hit boxes, or the four-tone Cold War intelligence-terminal art direction.

## HiDPI rendering

The Phaser renderer now uses the device pixel ratio, capped at 2x to balance visual quality and GPU/memory cost. Logical game dimensions remain CSS-pixel based, while the backing canvas can carry up to four times the pixel area of the old 1x canvas.

Changes:

- renderer resolution follows `window.devicePixelRatio` up to 2x
- antialiasing is enabled for Phaser graphics, vector-derived textures, and text
- `roundPixels` remains enabled to keep map placement stable
- CSS no longer forces the completed canvas through `image-rendering: pixelated`
- CRT scanlines/vignette were slightly softened so they do not overpower the sharper imagery

## Sprite supersampling

The production sprite sheets remain authored as 256x256 SVG sheets containing sixteen logical 64x64 frames. Phaser now rasterizes each SVG sheet at 512x512 before frame registration.

That means:

- logical frame size: 64x64
- raster frame size: 128x128
- authored-map display sizes: unchanged
- entity bounds and selection logic: unchanged
- source art and four-tone palette: unchanged

This gives the renderer more source detail on Retina/HiDPI displays and prevents 64-pixel source frames from being enlarged to fill a higher-density canvas.

## Quality/performance limits

`GAME_CONFIG.rendering` centralizes the quality budget:

- `maxDevicePixelRatio: 2`
- `spriteRasterScale: 2`

The 2x caps are intentional. They significantly improve clarity on common modern displays without allowing 3x/4x mobile screens to multiply GPU load unnecessarily.

## Regression constraints

Phase 12A/12B does not change:

- mission generation
- LOCATE / COUNT / CHANGE rules
- scoring
- timers
- map coordinates
- entity hit boxes
- zoom limits
- input behavior

The production GitHub Pages workflow remains the deployment/build verification gate.
