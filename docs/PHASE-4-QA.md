# Phase 4 QA

- Five SVG sprite sheets committed under `assets/sprites/`.
- 80 named 64×64 frames total.
- Four-tone authored palette locked to black, charcoal, light gray and off-white.
- Asset URLs use static `new URL(..., import.meta.url)` references so Vite can include them in production builds.
- `BootScene` preloads all sheets and registers named Phaser frames.
- Existing Locate gameplay remains on placeholder map graphics to isolate this art/integration change from gameplay logic.
- Repository-level code inspection completed.

A local `npm run build` could not be executed from the tool sandbox because outbound DNS access to GitHub/npm is unavailable there; no runtime failure was observed through repository inspection, but the next local/CI run should confirm the production bundle.
