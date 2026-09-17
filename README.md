# I SPY

Cold War-inspired monochrome satellite reconnaissance puzzle game by INSPIRE.

## Current development status

**Phases 0–4 implemented.**

- Phaser 3 + Vite browser-game foundation
- Responsive desktop/mobile scene flow
- Monochrome Cold War / handheld-inspired presentation
- Pan, zoom, reset, coordinate grid, pause and reconnaissance HUD
- Fictional woodland/rural reconnaissance training map
- Selectable reconnaissance entities with metadata and optional debug bounds
- MARK TARGET workflow with temporary marker, confirm and cancel
- LOCATE mission mode with mission briefing, countdown, false-identification tracking and results
- Centralized scoring values and reusable mission-validation helpers
- 80-frame authored four-tone reconnaissance sprite library
- Runtime sprite manifest and named Phaser frame registration
- Locked Cold War / old-handheld art-direction specification

## Locate scoring

- Correct identification: +1000
- False identification: -250 each
- Remaining-time bonus: +5 per second
- Perfect mission bonus: +500 when completed with zero false identifications

## Phase 4 sprite library

Production art lives in `assets/sprites/` as five transparent SVG sprite sheets: environment, infrastructure, targets/installations, intel clues/decoys/change states, and UI overlays. Every sheet uses 64×64 deterministic frames and a strict four-tone palette.

`src/assets/spriteManifest.js` is the runtime source of truth for sheet keys, asset URLs, frame names, categories and coordinates. `BootScene` preloads the SVG sheets and registers named Phaser frames without changing the current gameplay map.

See `docs/ART-DIRECTION.md` and `docs/SPRITE-SHEET.md` for the complete visual and integration contract.

## Debug target bounds

Append `?debugTargets=1` to the local game URL to reveal entity selection bounds for development testing. Debug bounds are disabled by default.

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Project structure

- `src/scenes/` — Phaser scene flow
- `src/game/` — reusable mission validation and scoring logic
- `src/world/` — reconnaissance map and entity metadata
- `src/ui/` — shared UI helpers
- `src/assets/` — sprite manifest and texture-frame registration
- `assets/sprites/` — production sprite sheets
- `assets/maps/` — future authored map data
- `docs/` — art and integration specifications
- `public/` — static public assets
