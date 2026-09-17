# I SPY

Cold War-inspired monochrome satellite reconnaissance puzzle game by INSPIRE.

## Current development status

**Phases 0–5 implemented.**

- Phaser 3 + Vite browser-game foundation
- Responsive desktop/mobile scene flow
- Monochrome Cold War / old-handheld presentation
- Pan, zoom, reset, coordinate grid, pause and reconnaissance HUD
- Selectable reconnaissance entities with target marking, confirmation and false-identification handling
- LOCATE mission mode with briefing, countdown, scoring and results
- 80-frame four-tone production sprite library with named Phaser frames
- Data-driven authored map format with runtime validation
- First production sector: `WOODLAND CORRIDOR 7`
- Tagged spawn zones for roads, forest concealment, compound vehicles, fields, structures, radar sites, civilian areas and clue placement

## Authored map system

The first map lives at `assets/maps/woodland-corridor-7.json`. It contains separate terrain, vegetation, infrastructure, structure, object, recon-clue, spawn-zone and metadata layers.

`src/world/authoredReconMap.js` validates every required layer, sprite reference, entity id and spawn-zone boundary before rendering the sector. This keeps later generated missions constrained to valid authored locations.

Debug helpers:

- `?debugTargets=1` — show selectable entity hit boxes
- `?debugMap=1` — show spawn-zone bounds

See `docs/PHASE-5-MAP.md` for the map contract and Phase 6 handoff.

## Locate scoring

- Correct identification: +1000
- False identification: -250 each
- Remaining-time bonus: +5 per second
- Perfect mission bonus: +500 when completed with zero false identifications

## Sprite system

Production art lives in `assets/sprites/`. Phase 4 established five authored SVG sheets with 80 named 64×64 frames using a strict four-tone palette:

- black `#0B0B0B`
- charcoal `#333333`
- light gray `#BDBDBD`
- off-white `#F6F6EE`

See `docs/ART-DIRECTION.md`, `docs/SPRITE-SHEET.md`, and `docs/SPRITE-ASSET-INDEX.md`.

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
- `src/game/` — reusable mission validation and scoring
- `src/world/` — authored-map renderer and map helpers
- `src/assets/` — runtime sprite manifest/registration
- `src/ui/` — shared UI helpers
- `assets/maps/` — authored reconnaissance map data
- `assets/sprites/` — production art sheets
- `docs/` — art, map and integration specifications
- `public/` — static public assets
