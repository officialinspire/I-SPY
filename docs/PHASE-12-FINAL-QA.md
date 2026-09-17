# Phase 12D — Final graphics and layout QA

Phase 12D closes the Phase 12 graphics/presentation work with a focused regression audit. It does not change mission rules, scoring, authored map content, seeded generation, target validation, or camera mechanics.

## Verified fixes

### Device safe areas

The game shell now respects `env(safe-area-inset-*)` while retaining `viewport-fit=cover`. This keeps the Phaser viewport away from display cutouts and home-indicator regions when the browser exposes those insets, while remaining full-screen on ordinary desktop/mobile viewports.

### Button press-state cleanup

Shared buttons now clear their pressed scale when the pointer exits, is cancelled, or releases outside the control. This prevents a button from visually remaining at the pressed scale after an interrupted touch/mouse interaction.

### Narrow debrief header

On narrow screens, `TOTAL SCORE` now stacks below the mission-complete/failed title instead of competing for the same horizontal row. The scoring body begins below the expanded header divider.

## Automated release validation

`scripts/validate-release.mjs` is dependency-free and runs as `npm run validate` before every GitHub Pages production build.

The validator checks:

- package/runtime version equality
- `viewport-fit=cover` and safe-area CSS presence
- no forced `image-rendering: pixelated` on the final canvas
- all required authored-map layers
- all required spawn-zone tags
- exactly 80 unique registered sprite frames
- every authored map sprite resolves through the sprite manifest
- authored sprite coordinates are numeric; intentional edge clipping is reported as a warning
- authored entity IDs remain unique
- the authored mission target references a real entity
- Boot, Main Menu, Mission Briefing, Enhanced Recon, and Results remain registered in the application entry point

## Regression scope

Reviewed presentation paths:

- Boot / acquisition
- Main Menu
- Settings
- Mission Briefing
- LOCATE recon controls
- COUNT recon controls
- CHANGE single-pass and split-view presentation
- Results / debrief
- responsive compact and short-screen rules
- reduced-motion presentation contract
- HiDPI / supersampled sprite configuration

The underlying gameplay modules, authored map, seeded mission generator, scoring formulas, and validation rules are intentionally unchanged by this pass.

## Release gate

A Phase 12D release is considered deployable only when GitHub Actions completes all of the following from the merged `main` commit:

1. dependency installation
2. `npm run validate`
3. Pages configuration
4. `npm run build`
5. Pages artifact upload
6. GitHub Pages deployment
