# I SPY

Cold War-inspired monochrome satellite reconnaissance puzzle game by INSPIRE.

## Live demo

https://officialinspire.github.io/I-SPY/

## Demo status

**Original Phases 0–11 plus Phase 12A/12B/12C/12D polish work implemented.** Runtime/package version: **`1.2.1-demo`**.

I SPY currently includes:

- Phaser 3 + Vite browser-game foundation
- Responsive desktop/mobile scene flow
- HiDPI rendering up to 2x device resolution
- 2x supersampled SVG sprite rasterization while preserving logical map sizes
- Responsive intelligence-console layout with compact/short-screen handling
- Device safe-area handling for notches and home-indicator regions
- Four-tone Cold War / old-handheld visual language
- Satellite-link acquisition boot sequence and classified intelligence-terminal presentation
- Pan, zoom, reset, coordinate grid, pause, timer, and reconnaissance HUD
- LOCATE missions with target marking, false-identification handling, scoring, and results
- COUNT missions with designated regions, decoys, numeric submission, retries, and scoring
- CHANGE missions with aligned PASS A/PASS B imagery and synchronized wide-screen split comparison
- Seeded replayable RANDOM missions for LOCATE, COUNT, and CHANGE
- Spawn-zone-aware target/decoy placement and solvability validation
- 80-frame production sprite library
- Authored map/state system built around `WOODLAND CORRIDOR 7`
- Runtime-generated terminal SFX and optional haptics
- Persistent master/SFX/haptics/scanline/image-grain settings
- Reduced-motion support
- Automated release validation before every Pages build
- GitHub Actions production build and Pages deployment

See `docs/PHASE-11-RELEASE-AUDIT.md` for the original release audit, `docs/PHASE-12-GRAPHICS.md` for the graphics-resolution pass, `docs/PHASE-12-LAYOUT.md` for the layout/presentation pass, and `docs/PHASE-12-FINAL-QA.md` for the final Phase 12 QA gate.

## Graphics quality

Phase 12A/12B improves image clarity without changing gameplay coordinates or hit boxes. The Phaser backing canvas follows the device pixel ratio up to 2x, antialiasing is enabled for text/graphics/vector-derived textures, CSS no longer forces the final canvas through pixelated scaling, and each 64x64 logical SVG frame is rasterized internally at 128x128 before display.

The visual style remains intentionally monochrome and retro; the higher-density pipeline is meant to make the existing art direction cleaner rather than replace it with a different aesthetic.

## Layout quality

Phase 12C improves composition and responsiveness across Boot, Main Menu, Settings, Mission Briefing, Recon, and Results. Wide menus use a two-column mission console; compact screens retain stacked controls with tighter safe spacing; briefing and debrief screens use left-aligned intelligence-document grids; and Recon groups mission controls into dedicated control rails.

CHANGE split view has a stronger center divider plus explicit PASS A / PASS B labels while preserving the existing synchronized camera behavior. Phase 12D adds device safe-area handling, hardens button press-state cleanup, and stacks the debrief score beneath the title on narrow displays to prevent overlap.

Gameplay coordinates, validation, scoring, authored map data, and generator logic are unchanged by the Phase 12 presentation work.

## Release validation

Run the static release validator with:

```bash
npm run validate
```

It checks version alignment, viewport/safe-area configuration, authored-map structure, required spawn tags, the 80-frame sprite manifest, map sprite resolution/bounds, unique entity IDs, authored mission-target integrity, and core scene registration. GitHub Pages runs this validator automatically before the production Vite build.

## Audio, feedback, and settings

Phase 10 adds a dependency-free Web Audio feedback system with restrained terminal/radio cues for UI taps, imagery acquisition, marking, confirmations, incorrect identifications, the final ten seconds, mission completion, and mission failure.

Settings are stored locally on the device and include:

- Master level: 100 / 75 / 50 / 25 / 0 percent
- Sound effects: on/off
- Haptics: on/off
- CRT scanlines: on/off
- Recon image grain: on/off

Unsupported Web Audio and vibration APIs fail silently and do not block gameplay. See `docs/PHASE-10-FEEDBACK.md`.

## Random mission generator

`RANDOM MISSION` creates a replayable mission from a deterministic seed. The generator can choose LOCATE, COUNT, or CHANGE and varies compatible object placement, decoys, clue sprites, time limits, briefing text, and subtle imagery degradation.

The generator validates the mission before play. Invalid generations are retried up to the configured attempt limit; if no valid result can be created, I SPY falls back to an authored mission instead of presenting an impossible puzzle.

Developer/query controls:

- `?seed=COLDWAR-77` — reproduce a generated mission
- `?mode=LOCATE` — constrain generation to LOCATE
- `?mode=COUNT` — constrain generation to COUNT
- `?mode=CHANGE` — constrain generation to CHANGE
- `?debugMission=1` — display generator seed/attempt metadata
- `?debugTargets=1` — show selectable entity hit boxes
- `?debugMap=1` — show spawn-zone bounds

Example: `?seed=COLDWAR-77&mode=CHANGE&debugMission=1`

## Mission modes

### LOCATE

Find and mark the requested target.

Scoring:

- Correct identification: +1000
- False identification: -250 each
- Remaining-time bonus: +5 per second
- Perfect mission bonus: +500 with zero false identifications

### COUNT

Inspect the highlighted reconnaissance region and submit the number of objects matching the requested category. Civilian and unrelated objects can act as visual decoys.

Controls:

- On-screen `-` / `+`
- `SUBMIT COUNT`
- Keyboard digits
- Backspace
- Arrow Up / Arrow Down
- Enter

Scoring:

- Correct answer: +1000
- Incorrect submission: -300 each
- Remaining-time bonus: +5 per second
- Perfect mission bonus: +500 when the first submission is correct

### CHANGE

Compare two aligned satellite passes and identify the changed object.

Controls:

- `VIEW PASS A / VIEW PASS B`
- Keyboard `A` / `B`
- `MARK CHANGE`
- `SPLIT VIEW` at 980 px+ viewport width
- Keyboard `S` toggles split view

Scoring:

- Correct changed-object identification: +1000
- False identification: -250 each
- Remaining-time bonus: +5 per second
- Perfect mission bonus: +500 with zero false identifications

## Art and presentation

Production art lives in `assets/sprites/` and uses a strict four-tone palette:

- black `#0B0B0B`
- charcoal `#333333`
- light gray `#BDBDBD`
- off-white `#F6F6EE`

The presentation layer uses classified-console framing, a short satellite acquisition sequence, typewriter briefing text, restrained CRT scanlines/vignette, and formal intelligence debrief language. Effects are intentionally subtle so reconnaissance imagery remains readable.

## Development

```bash
npm install
npm run validate
npm run dev
```

Production build:

```bash
npm run validate
npm run build
```

## Project structure

- `src/scenes/` — Phaser scene flow and recon feedback/layout wrapper
- `src/game/` — mission definitions, scoring, and seeded generation
- `src/world/` — authored-map renderer, state operations, and map helpers
- `src/assets/` — runtime sprite manifest/registration
- `src/audio/` — synthesized feedback engine
- `src/settings/` — persistent user preferences
- `src/ui/` — shared UI and presentation helpers
- `assets/maps/` — authored reconnaissance map data
- `assets/sprites/` — production art sheets
- `scripts/` — dependency-free release validation
- `docs/` — art, map, generator, presentation, feedback, graphics, layout, and release-audit specifications

## Roadmap status

- Phase 0 — Foundation ✅
- Phase 1 — Recon map engine ✅
- Phase 2 — Target identification ✅
- Phase 3 — LOCATE ✅
- Phase 4 — Sprite system ✅
- Phase 5 — Authored woodland map ✅
- Phase 6 — COUNT ✅
- Phase 7 — CHANGE ✅
- Phase 8 — Seeded mission generator ✅
- Phase 9 — Cold War presentation ✅
- Phase 10 — Audio / haptics / settings ✅
- Phase 11 — MVP release audit ✅
- Phase 12A — HiDPI rendering sharpness ✅
- Phase 12B — Sprite raster-quality pass ✅
- Phase 12C — Responsive layout and UI polish ✅
- Phase 12D — Final visual QA and deployment gate ✅
