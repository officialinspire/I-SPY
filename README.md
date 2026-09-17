# I SPY

Cold War-inspired monochrome satellite reconnaissance puzzle game by INSPIRE.

## Current development status

**Phases 0–7 implemented.**

- Phaser 3 + Vite browser-game foundation
- Responsive desktop/mobile scene flow
- Monochrome Cold War / old-handheld presentation
- Pan, zoom, reset, coordinate grid, pause and reconnaissance HUD
- Selectable reconnaissance entities with target marking, confirmation and false-identification handling
- LOCATE mission mode with briefing, countdown, scoring and results
- COUNT mission mode with designated analysis region, decoy-aware category counting, numeric controls, retries, countdown, scoring and results
- CHANGE mission mode with aligned PASS A / PASS B imagery, toggle comparison, synchronized wide-screen split view, marking, countdown, scoring and results
- 80-frame four-tone production sprite library with named Phaser frames
- Data-driven authored map format with runtime validation
- State-driven recon changes derived from one authored map rather than duplicated terrain files
- First production sector: `WOODLAND CORRIDOR 7`
- Tagged spawn zones for roads, forest concealment, compound vehicles, fields, structures, radar sites, civilian areas and clue placement

## Mission modes

### LOCATE

Find and mark the requested target.

Scoring:

- Correct identification: +1000
- False identification: -250 each
- Remaining-time bonus: +5 per second
- Perfect mission bonus: +500 when completed with zero false identifications

### COUNT

Inspect the highlighted reconnaissance region and submit the number of objects matching the requested category. The first mission, **Operation Tally Sheet**, asks the player to count military vehicles inside **Grid Delta-3** while civilian and unrelated objects act as visual decoys.

Controls:

- On-screen `-` / `+` buttons adjust the count
- `SUBMIT COUNT` validates the answer
- Keyboard digits enter a count directly
- Backspace edits the entered count
- Arrow Up / Arrow Down adjust the count
- Enter submits

Scoring:

- Correct answer: +1000
- Incorrect submission: -300 each
- Remaining-time bonus: +5 per second
- Perfect mission bonus: +500 when the first submission is correct

### CHANGE

Compare two aligned satellite passes and identify the object that changed. The first mission, **Operation Second Look**, tracks a military jeep that changes position between PASS A and PASS B.

Controls:

- `VIEW PASS A / VIEW PASS B` toggles the two aligned passes
- Keyboard `A` / `B` switches directly between passes
- `MARK CHANGE` selects the changed object in either pass
- On viewports 980 px or wider, `SPLIT VIEW` shows PASS A on the left and PASS B on the right
- Split-view pan and zoom stay synchronized
- Keyboard `S` toggles split view on supported viewport widths

Scoring:

- Correct changed-object identification: +1000
- False identification: -250 each
- Remaining-time bonus: +5 per second
- Perfect mission bonus: +500 with zero false identifications

## Authored map and state system

The first map lives at `assets/maps/woodland-corridor-7.json`. It contains separate terrain, vegetation, infrastructure, structure, object, recon-clue, spawn-zone and metadata layers.

`src/world/authoredReconMap.js` validates every required layer, sprite reference, entity id and spawn-zone boundary before rendering the sector. Phase 7 also exposes runtime entity visuals and generic state operations so PASS B can be derived from PASS A without hand-authoring a second map.

Supported runtime state operations currently include:

- move entity
- hide/remove entity
- add entity
- add sprite/change clue

Debug helpers:

- `?debugTargets=1` — show selectable entity hit boxes
- `?debugMap=1` — show spawn-zone bounds

See `docs/PHASE-5-MAP.md`, `docs/PHASE-6-COUNT.md`, and `docs/PHASE-7-CHANGE.md` for mode and map contracts.

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
- `src/world/` — authored-map renderer, state operations and map helpers
- `src/assets/` — runtime sprite manifest/registration
- `src/ui/` — shared UI helpers
- `assets/maps/` — authored reconnaissance map data
- `assets/sprites/` — production art sheets
- `docs/` — art, map and integration specifications
- `public/` — static public assets
