# I SPY

Cold War-inspired monochrome satellite reconnaissance puzzle game by INSPIRE.

## Live demo

https://officialinspire.github.io/I-SPY/

## Demo status

**Original Phases 0–11 plus Phase 12A/12B/12C/12D and Phase 13A–13F polish work implemented, with a Phase 13 release-candidate audit.** Runtime/package version: **`1.2.2-demo`**.

I SPY currently includes:

- Phaser 3 + Vite browser-game foundation
- Responsive desktop/mobile scene flow
- HiDPI rendering up to 2x device resolution
- 2x supersampled SVG sprite rasterization while preserving logical map sizes
- Responsive intelligence-console layout with compact/short-screen handling
- Device safe-area handling for notches and home-indicator regions
- Four-tone Cold War / old-handheld visual language for reconnaissance imagery
- Seamless terrain, top-down roof plans and silhouette-readable vehicles across the sprite library
- Centralized UI design tokens with semantic button variants and restrained equipment color
- Reconnaissance operations-console main menu with mode cards, icons and status readouts
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

See `docs/PHASE-11-RELEASE-AUDIT.md` for the original release audit, `docs/PHASE-12-GRAPHICS.md` for the graphics-resolution pass, `docs/PHASE-12-LAYOUT.md` for the layout/presentation pass, `docs/PHASE-12-FINAL-QA.md` for the final Phase 12 QA gate, `docs/PHASE-13A-INTERACTION.md` for the interaction design system, `docs/PHASE-13B-MAIN-MENU.md` for the main-menu redesign, `docs/PHASE-13-GRAPHICS.md` for the reconnaissance art pass, `docs/PHASE-13D-RECON-INTERACTION.md` for the recon interaction pass, and `docs/PHASE-13E-MODE-UX.md` for the mode-specific UX pass.

## Interaction design system

Phase 13A introduces `src/ui/designTokens.js` as the single source for interactive styling: palette, panel surfaces, semantic text roles, motion timings, and the ~44px minimum touch target. Shared buttons now carry semantic variants — `primary`, `secondary`, `tactical`, `warning`, `danger`, `success`, `disabled` — with distinct idle, hover, focus, pressed, selected, and disabled treatments, so primary actions are obvious and equipment controls read differently from navigation.

The base stays terminal black and charcoal; restrained Cold War equipment color is spent deliberately — muted phosphor green for positive/active state, desaturated amber for the action to take, muted red for discard or failure, off-white for neutral readout. Reconnaissance imagery itself remains monochrome.

Keyboard users get a visible focus ring with Tab/arrow navigation and Enter/Space activation on the menu, briefing, and debrief screens; Recon keeps its existing mission hotkeys. Touch never depends on hover, small controls get expanded hit areas, press state recovers on every release path, and reduced-motion users get the same state changes with no movement.

## Main menu

Phase 13B rebuilds the Main Menu as an operations console: a title block, a status bar reading SATELLITE LINK / IMAGE CHANNEL / ANALYST STATION, then PRIMARY TASKING, MISSION ARCHIVE // TRAINING MODES and SYSTEM sections inside a framed console.

RANDOM MISSION is the emphasized primary tasking; LOCATE, COUNT and CHANGE are equal-weight mission cards, each with a one-line description, an existing UI sprite icon and its own restrained accent (phosphor, steel, amber). A readout beneath the console echoes whichever control is hovered or keyboard-focused. Layout picks the richest of four density tiers that fits the viewport and stacks cards on narrow or tall-portrait screens, so short landscape screens drop ornament rather than overlap. Settings still opens inside the same scene.

## Graphics quality

Phase 12A/12B improves image clarity without changing gameplay coordinates or hit boxes. The Phaser backing canvas follows the device pixel ratio up to 2x, antialiasing is enabled for text/graphics/vector-derived textures, CSS no longer forces the final canvas through pixelated scaling, and each 64x64 logical SVG frame is rasterized internally at 128x128 before display.

The visual style remains intentionally monochrome and retro; the higher-density pipeline is meant to make the existing art direction cleaner rather than replace it with a different aesthetic.

## Layout quality

Phase 12C improves composition and responsiveness across Boot, Main Menu, Settings, Mission Briefing, Recon, and Results. Wide menus use a two-column mission console; compact screens retain stacked controls with tighter safe spacing; briefing and debrief screens use left-aligned intelligence-document grids; and Recon groups mission controls into dedicated control rails.

CHANGE split view has a stronger center divider plus explicit PASS A / PASS B labels while preserving the existing synchronized camera behavior. Phase 12D adds device safe-area handling, hardens button press-state cleanup, and stacks the debrief score beneath the title on narrow displays to prevent overlap.

Gameplay coordinates, validation, scoring, authored map data, and generator logic are unchanged by the Phase 12 presentation work.

## Reconnaissance art

Phase 13C re-authored the four gameplay sprite sheets. Terrain tiles are seamless and full-bleed instead of bordered squares, so the map no longer reads as a grid; roads, tracks, fences, rail and pipelines are authored east-west and rotated for north-south runs; buildings are top-down roof plans with a ridge, two roof planes and an eaves shadow; and every vehicle heads east with a silhouette distinct enough to identify without any highlighting.

One sun direction (upper left) gives structures depth without perspective, and intermediate values are dithered from the four tones rather than faked with opacity. Clues stay quiet — disturbed soil, camouflage netting and smoke are dithered mid-tones — and civilian decoys are built from the same parts as the military vehicles, so nothing on the map identifies a target for the player. Frame names, frame sizes, map positions, hitboxes and entity metadata are unchanged.

## Recon interaction

Phase 13D gives the recon workspace four distinct interaction states. Normal analysis shows a grab cursor and a phosphor HUD rule; marking active switches to a crosshair, an amber HUD rule, a `MARKING ACTIVE` banner and a reticle that tracks the pointer; a placed mark draws a neutral candidate reticle with distinct CONFIRM and CANCEL actions; and a resolved call turns that mark phosphor or rust in place.

Marking now resolves on pointer release after a drag-threshold check, so dragging pans the imagery with marking still armed and only a tap marks. Presses that land on a HUD control never reach the map, the HUD tap guard is converted into HUD space so it matches where the HUD is actually drawn, and confirmation is single-shot. Touch gets a slightly larger invisible selection tolerance than a mouse while authored metadata bounds stay authoritative — no sprite is enlarged and no hitbox changes. Nothing reacts to what is under the pointer, and result feedback lands only on the analyst's own mark, so no interaction leaks answers.

## Mode tools

Phase 13E gives the workspace one information hierarchy — objective, timer, mode state, primary action, secondary utilities — and then makes each mode's tools its own. A mode chip under the objective carries state (`LOCATE · MARKING`), tinted amber while marking, phosphor while a mark is pending and rust while held, and each mode shows one counter rather than a paragraph.

COUNT defines its area by dimming everything outside it with phosphor corner brackets, and separates a captioned ADJUST group (larger steppers, a bordered tally readout) from a captioned SUBMIT action; a refused total turns the readout muted red until the number changes, without interrupting inspection. CHANGE replaces the VIEW PASS toggle with a PASS A | PASS B segmented control whose live segment is lit, and switching passes plays a brief opaque wipe that never shows both passes at once. Split view labels each pane with its own pass and time and keeps the two cameras exactly synchronised.

## Release-candidate audit

The Phase 13 build was audited end to end before release: menu and panel layout at four viewports,
the full mission flow, all three analysis modes, the seeded generator, artwork, input and
accessibility, feedback, and responsive behaviour. Eight defects were reproduced and fixed, the
largest being that the recon HUD inherited the camera's zoom — at maximum zoom the objective, the
timer and every control left the screen — and that split view framed the two passes
`360 * (1 - zoom)` pixels apart, which is a fairness bug in a comparison puzzle. The HUD now renders
through its own camera fixed at 1x and both panes share identical viewports. No mission generation,
validation, scoring or map data changed. See `docs/PHASE-13-RELEASE-AUDIT.md`.

## Release validation

Run the static release validator with:

```bash
npm run validate
```

It checks version alignment, viewport/safe-area configuration, authored-map structure, required spawn tags, the 80-frame sprite manifest, map sprite resolution/bounds, unique entity IDs, authored mission-target integrity, and core scene registration. GitHub Pages runs this validator automatically before the production Vite build.

## Deployment

`.github/workflows/deploy-pages.yml` validates, builds and publishes `dist/` to GitHub Pages on
every push to `main`.

**The repository's Pages source must be set to "GitHub Actions"** (Settings → Pages → Build and
deployment → Source). With the alternative setting, "Deploy from a branch", Pages serves the
repository files verbatim instead of the built application: visitors receive the source
`index.html`, whose `<script type="module" src="/src/main.js">` points at the un-bundled dev entry.
That request returns GitHub's 404 page, the browser rejects the module for its `text/html` MIME
type, and the site renders as a black screen — while the deploy workflow still reports success,
because it uploads and registers its artifact correctly either way.

If the site is ever blank, `index.html` shows a boot notice naming the failed resource after five
seconds, which distinguishes this misconfiguration from an application error.

## Audio, feedback, and settings

Phase 10 adds a dependency-free Web Audio feedback system with restrained terminal/radio cues for UI taps, imagery acquisition, marking, confirmations, incorrect identifications, the final ten seconds, mission completion, and mission failure.

Phase 13F rebuilt that system around named cues. Callers ask for `feedback('arm')` rather than describing a waveform, so every event — hover, press, mission card, acquisition, marking, selection, cancel, confirmation, false identification, pass switch, count adjustment, count submission, pause/resume, completion, failure — has exactly one voice and exactly one call site. Everything is still synthesised at runtime from short square blips, pitch slides and band-limited noise clicks: a military terminal, not an arcade cabinet. A per-event repeat guard makes it impossible for rapid navigation to stack a cue on itself, haptics stay sparing (a small pulse for selection, a pattern only for outcomes), and microanimations stay in the 80–160 ms band — a 90 ms press, a 140 ms panel fade, a 150 ms reticle settle — with nothing in the reconnaissance imagery animating in a way that could reveal an answer. See `docs/PHASE-13F-FEEDBACK.md`.

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
- `docs/` — art, map, generator, presentation, feedback, graphics, layout, interaction, and release-audit specifications

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
- Phase 13A — Interaction design system and shared button overhaul ✅
- Phase 13B — Main menu operations-console redesign ✅
- Phase 13C — Reconnaissance graphics and environmental art ✅
- Phase 13D — Recon interaction and marking polish ✅
- Phase 13E — Mode-specific gameplay UX ✅
- Phase 13F — Microinteraction and feedback polish ✅
- Phase 13 RC — Release-candidate audit and fixes ✅
