# I SPY

Cold War-inspired monochrome satellite reconnaissance puzzle game by INSPIRE.

## Current development status

**Phases 0–3 implemented.**

- Phaser 3 + Vite browser-game foundation
- Responsive desktop/mobile scene flow
- Monochrome Cold War / handheld-inspired presentation
- Pan, zoom, reset, coordinate grid, pause and reconnaissance HUD
- Fictional woodland/rural reconnaissance training map
- Selectable reconnaissance entities with metadata and optional debug bounds
- MARK TARGET workflow with temporary marker, confirm and cancel
- LOCATE mission mode with mission briefing, countdown, false-identification tracking and results
- Centralized scoring values and reusable mission-validation helpers

## Locate scoring

- Correct identification: +1000
- False identification: -250 each
- Remaining-time bonus: +5 per second
- Perfect mission bonus: +500 when completed with zero false identifications

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
- `assets/` — future maps, sprites, and UI art
- `public/` — static public assets

The current graphics are intentionally generated placeholders. A later phase will replace them with the authored black-and-white reconnaissance sprite sheet and tilemap system.
