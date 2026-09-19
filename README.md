# I SPY

Cold War-inspired monochrome satellite reconnaissance puzzle game by INSPIRE.

## Live demo

https://officialinspire.github.io/I-SPY/

## Demo status

**Original Phases 0–11 plus Phase 12A–12D, Phase 13A–13F, the complete Phase 14A–14F sprite-art overhaul, and Phase 15A–15I multi-sector, training and onboarding work implemented, with Phase 13, Phase 14 and Phase 15 release audits and a Phase 15J bug-fix pass.** Runtime/package version: **`1.2.2-demo`**.

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
- Registry of four playable sectors plus a training range, with a SECTOR control and `?map=`
- Per-sector authored CHANGE second passes and COUNT regions
- ANALYST TRAINING: a six-step scripted tutorial on its own range, untimed and unscored
- IDENTIFICATION GUIDE: a five-category recognition manual built from the shipped sprite frames
- First-run ANALYST ORIENTATION panel, offered once and never forced
- Runtime-generated terminal SFX and feature-detected haptics at four strength levels
- User-gated local intro, centralized crossfading menu/gameplay music, and guarded target samples
- Persistent master/music/SFX/haptics/scanline/image-grain/sector/training settings
- Reduced-motion support
- Automated release validation before every Pages build
- GitHub Actions production build and Pages deployment

See `docs/PHASE-16-AUDIO.md` for the startup/audio lifecycle and final Phase 16 audit. See `docs/PHASE-11-RELEASE-AUDIT.md` for the original release audit, `docs/PHASE-12-GRAPHICS.md` for the graphics-resolution pass, `docs/PHASE-12-LAYOUT.md` for the layout/presentation pass, `docs/PHASE-12-FINAL-QA.md` for the final Phase 12 QA gate, `docs/PHASE-13A-INTERACTION.md` for the interaction design system, `docs/PHASE-13B-MAIN-MENU.md` for the main-menu redesign, `docs/PHASE-13-GRAPHICS.md` for the reconnaissance art pass, `docs/PHASE-13D-RECON-INTERACTION.md` for the recon interaction pass, `docs/PHASE-13E-MODE-UX.md` for the mode-specific UX pass, `docs/PHASE-14-SPRITE-ART.md` for the complete high-fidelity 80-frame sprite-art overhaul and consistency audit, and `docs/PHASE-15-RELEASE-AUDIT.md` for the Phase 15 release-candidate audit. The Phase 15 feature passes are documented in `docs/PHASE-15A-MAP-REGISTRY.md`, `docs/PHASE-15B-FROSTLINE-RELAY.md`, `docs/PHASE-15C-RIVERWORKS-SECTOR.md`, `docs/PHASE-15D-BORDER-FARMS.md`, `docs/PHASE-15E-SECTOR-SELECT.md`, `docs/PHASE-15F-ANALYST-TRAINING.md`, `docs/PHASE-15G-IDENTIFICATION-GUIDE.md`, `docs/PHASE-15H-HAPTICS.md` and `docs/PHASE-15I-ORIENTATION.md`.

## Interaction design system

Phase 13A introduces `src/ui/designTokens.js` as the single source for interactive styling: palette, panel surfaces, semantic text roles, motion timings, and the ~44px minimum touch target. Shared buttons now carry semantic variants — `primary`, `secondary`, `tactical`, `warning`, `danger`, `success`, `disabled` — with distinct idle, hover, focus, pressed, selected, and disabled treatments, so primary actions are obvious and equipment controls read differently from navigation.

The base stays terminal black and charcoal; restrained Cold War equipment color is spent deliberately — muted phosphor green for positive/active state, desaturated amber for the action to take, muted red for discard or failure, off-white for neutral readout. Reconnaissance imagery itself remains monochrome.

Keyboard users get a visible focus ring with Tab/arrow navigation and Enter/Space activation on the menu, briefing, and debrief screens; Recon keeps its existing mission hotkeys. Touch never depends on hover, small controls get expanded hit areas, press state recovers on every release path, and reduced-motion users get the same state changes with no movement.

## Main menu

Phase 13B rebuilds the Main Menu as an operations console: a title block, a status bar reading SATELLITE LINK / IMAGE CHANNEL / ANALYST STATION, then PRIMARY TASKING, MISSION ARCHIVE // TRAINING MODES and SYSTEM sections inside a framed console.

RANDOM MISSION is the emphasized primary tasking; LOCATE, COUNT and CHANGE are equal-weight mission cards, each with a one-line description, an existing UI sprite icon and its own restrained accent (phosphor, steel, amber). A readout beneath the console echoes whichever control is hovered or keyboard-focused. Layout picks the richest of four density tiers that fits the viewport and stacks cards on narrow or tall-portrait screens, so short landscape screens drop ornament rather than overlap. Settings still opens inside the same scene.

Phase 15F adds `ANALYST TRAINING` and Phase 15G adds `IDENTIFICATION GUIDE`, beside HOW TO PLAY and
SETTINGS. Four separate offers, none standing in for another: training walks the console, the manual
names what is on the ground, the field guide is a page to read. The SYSTEM row picks its column count
by measuring its longest label against the width each arrangement would give it at the current
density tier — four across on a desktop, two by two on a tablet, one per row on a phone.

Phase 15E adds one row under RANDOM MISSION: `SECTOR // ANY SECTOR`. It cycles through ANY SECTOR
and the four registered sectors rather than opening a menu, so the primary action keeps the emphasis
and the menu gains no new modal surface. The card and its sector row are measured as one block, so
the row is part of the density tier rather than laid on top of it. The selection persists, and a
named sector renders in the button's selected state. See `docs/PHASE-15E-SECTOR-SELECT.md`.

## First-run orientation

On a device's first launch — and only then — the Main Menu opens with a compact `ANALYST ORIENTATION`
panel offering `BEGIN TRAINING`, `IDENTIFICATION GUIDE` and `SKIP`. None of the three starts a
mission. It is dismissible by a button, by `ESC` or by a tap outside it, and whichever route is taken
records `orientationSeen`, so it is offered once and never stands in a returning analyst's way again.
While it is open the console behind it is disabled rather than merely covered.

Once training has been completed, the menu carries a small `ANALYST CERTIFIED` standing at the right
end of the SYSTEM rule, beside the control it refers to. It records a certification and gates nothing.

Both flags live in the same local settings record as volume and haptics — on the device, no accounts,
no login, no cloud. See `docs/PHASE-15I-ORIENTATION.md`.

## Analyst training

`ANALYST TRAINING` is a six-step guided introduction: navigation (pan, zoom, reset view),
identification, marking (mark, cancel, confirm), count, change detection, then
`ANALYST CERTIFICATION COMPLETE`. Each step names what it teaches and will not advance until the
trainee has actually done it — NEXT stays disabled until pan, zoom *and* reset view have been used, a
mark has been confirmed, the correct tally submitted, or PASS B viewed and the moved object called.

The tutorial is the recon console rather than a copy of it: `TrainingScene` extends the scene that
flies live taskings, so every control behaves exactly as it will in a real mission. What it changes is
the frame — no timer, no score, no penalties, no generation, and a compact step panel with NEXT, SKIP
TUTORIAL and BACK TO MENU that is mobile-safe and thins out on short landscape screens. BACK TO MENU
keeps the place so training can resume; SKIP TUTORIAL clears it.

It runs on `TRAINING RANGE ALPHA`, an authored range of three isolated instruction bays with empty
ground between them. The range is registered like any other map but is not a sector: it never appears
in the SECTOR picker and no seed or `?map=` can put a live mission on it.

`tutorialCompleted` is stored locally when the certification step is reached, and only marks the menu
control — training is never forced, at first launch or any other.
See `docs/PHASE-15F-ANALYST-TRAINING.md`.

## Identification guide

`IDENTIFICATION GUIDE` is a recognition manual built from the production sprite sheets themselves:
five categories — MILITARY VEHICLES, INSTALLATIONS, CIVILIAN / DECOYS, RECON CLUES, INFRASTRUCTURE —
and thirty-seven entries, each showing the actual registered frame with a display name and a one or
two sentence note on how to recognise *this game's drawing* of it. No frame appears twice.

Category tabs, a sprite grid sized to the space available, and a detail panel with an enlarged
preview that keeps its place rather than opening as a modal, so a phone shows both at once. Tab and
the arrows walk tabs, cells and the return control; Enter opens the focused entry and Escape returns
to the console. The grid scrolls only when a comfortable cell will not fit.

The manual carries no real-world specifications and no tactical advice — `validateIdentificationGuide()`
rejects a note carrying a figure — and it is mission-blind, so reading it cannot spoil a mission.
See `docs/PHASE-15G-IDENTIFICATION-GUIDE.md`.

## Graphics quality

Phase 12A/12B improves image clarity without changing gameplay coordinates or hit boxes. The Phaser backing canvas follows the device pixel ratio up to 2x, antialiasing is enabled for text/graphics/vector-derived textures, CSS no longer forces the final canvas through pixelated scaling, and each 64x64 logical SVG frame is rasterized internally at 128x128 before display.

The visual style remains intentionally monochrome and retro; the higher-density pipeline is meant to make the existing art direction cleaner rather than replace it with a different aesthetic.

## Phase 14 sprite art

Phase 14 redraws all five production sprite sheets while preserving the frozen 80-frame runtime contract. Targets, infrastructure, terrain/vegetation, intelligence clues/decoys, and UI symbols now share a denser four-tone tactical-reconnaissance language with upper-left highlights, lower-right deep shadows, stronger silhouettes, and purpose-built mechanical/material detail. The final UI sheet uses fictional analyst reticles, lock brackets, confirmation marks, grids, framing corners and terminal-panel symbology instead of generic app-icon shapes.

All five sheets remain 256×256, 4×4, and 64×64 per logical frame with the same names/order, map coordinates, hitboxes and manifest API. The final cross-sheet audit verified all 80 clipped cells, exact palette compliance, no gradients/filters/scripts/text, target/decoy fairness, and consistent perspective/lighting. See `docs/PHASE-14-SPRITE-ART.md`.

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

## Release-candidate audits

The Phase 15 branch was audited before release: the map registry, all four sectors in all three
analysis modes, the seeded generator and its URL options, ANALYST TRAINING, the IDENTIFICATION
GUIDE, the haptics rework, and responsive layout at 1440x900, 1024x700, 800x420, 390x844 and
360x640. One defect was found and fixed: COUNT asked every sector to tally `GRID DELTA-3`, the
rectangle drawn by hand for WOODLAND CORRIDOR 7 when it was the only map. In RIVERWORKS SECTOR that
rectangle lands across the canalised channel and held one military vehicle while five sat outside
it, which is a puzzle that is not a puzzle. A sector now authors its own count region in map
metadata, the same way it already authors its CHANGE second pass; the release validator counts the
tally each sector would actually be asked for and fails under two. Woodland keeps `GRID DELTA-3`
byte-identically and the 303-mission generator fingerprint is unchanged. See
`docs/PHASE-15-RELEASE-AUDIT.md`.

Phase 15J followed as a bug-fix pass over the shipped build, adding nothing. Eleven defects were
reproduced against the deployed build and fixed: generated objects could land materially on top of
each other (236 of 768 seeded missions), a generated COUNT could ask for a tally of one (68 of 256),
a generated CHANGE could "move" an object eight pixels, an exact overlap was marked back to front
because the hit test walked the draw order forwards, BORDER FARMS parked a truck 64% inside a barn,
the identification guide's masked grid took clicks it could not show and put its lower rows beyond
the keyboard, a category was laid out against the category just left, the settings rows for sound,
volume and haptics acknowledged the state you had just left (turning sound on was silent; stepping
haptics pulsed twice), and HOW TO PLAY closed itself after nine seconds. The release gate grew an
authored-overlap check, selectable `radar-01` / `jeep-01` requirements, and a generator QA suite of
7861 assertions over 768 seeded missions that CI runs before the build. See
`docs/PHASE-15-RELEASE-AUDIT.md`.

The Phase 13 build was audited end to end before release: menu and panel layout at four viewports,
the full mission flow, all three analysis modes, the seeded generator, artwork, input and
accessibility, feedback, and responsive behaviour. Eight defects were reproduced and fixed, the
largest being that the recon HUD inherited the camera's zoom — at maximum zoom the objective, the
timer and every control left the screen — and that split view framed the two passes
`360 * (1 - zoom)` pixels apart, which is a fairness bug in a comparison puzzle. The HUD now renders
through its own camera fixed at 1x and both panes share identical viewports. No mission generation,
validation, scoring or map data changed. See `docs/PHASE-13-RELEASE-AUDIT.md`.

## Map registry

Sectors live in a registry rather than in a hard-coded import. `src/world/mapCatalog.js` lists what
exists (id, title, environment, description, difficulty, recommended zoom, source path),
`src/world/mapRegistry.js` binds each entry to its map data and resolves a sector from an id, a
registry entry or raw data, and `src/world/reconMapSchema.js` holds `validateReconMap()` free of any
map data so the release validator can run the game's own rules over every registered map in Node.

Four sectors ship, each with its own spatial grammar: **WOODLAND CORRIDOR 7** (rural woodland, a
north-south river and road corridor under canopy), **FROSTLINE RELAY** (alpine snow, a valley banded
east-west between two rocky massifs), **RIVERWORKS SECTOR** (an industrial river crossing, with a
canalised channel cut corner to corner) and **BORDER FARMS** (open agricultural borderland, a
patchwork of crop fields divided by hedgerows with a fortified post on the eastern fence line). A mission carries a `mapId` and
the recon scene builds *that* sector; an unknown id warns and falls
back to the default rather than throwing.

The Main Menu's SECTOR control picks which sector missions are drawn from. On `ANY SECTOR` a seed
chooses the sector as well as the task; on a named sector both RANDOM and the LOCATE / COUNT /
CHANGE cards stay inside it. The sector draw runs on its own RNG stream, keyed `<seed>:sector`, so
naming a sector never shifts the mission stream: a seed produces the same mission on a given sector
whether that sector was drawn by the seed or named by the analyst. The pre-registry fingerprint of
303 seeded woodland missions still hashes identically. `?map=<id>` joins `?seed=` and `?mode=` as a
generator option and also sets what the control displays for that visit. Each sector authors its own
CHANGE second pass in map metadata, so change detection is portable rather than pinned to woodland's
coordinates. See `docs/PHASE-15A-MAP-REGISTRY.md` and `docs/PHASE-15E-SECTOR-SELECT.md`.

## Release validation

Run the static release validator with:

```bash
npm run validate
```

It checks version alignment, viewport/safe-area configuration, the 80-frame sprite manifest, core scene registration, the haptic vocabulary — nothing on hover or focus, every pulse inside its bounds, and every pattern keeping its rhythm across strength levels — and the identification guide's own rules — every entry naming a registered frame, no frame appearing twice, and every note staying a short figure-free description — then walks the map registry: every registered sector is loaded from disk, matched against its catalog entry, and put through `validateReconMap()` — the same schema the game uses — covering layers, spawn tags, sprite resolution and bounds, unique entity IDs and mission-target integrity. It also requires each map to carry the change-detection subject `jeep-01` and, where a sector authors a second-pass destination, that the destination is inside bounds and far enough from the start to be a visible move. It also checks every sector's count region: inside the map, and holding a tally worth taking rather than a single object. It checks that no two authored selectable objects overlap by a quarter of the smaller one, and that every map carries a selectable `radar-01` and `jeep-01`. `npm run validate` then runs `scripts/generator-qa.mjs`, which plays the real generator over every sector and mode for 64 fixed seeds and holds each of the 768 missions to the rules that make one solvable and fair — a visible target, a tally of at least two that matches the plate, a CHANGE move big enough to see, no object buried under another, no out-of-bounds operation, and the same seed reproducing the same mission. GitHub Pages runs this validator automatically before the production Vite build.

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

Phase 15H enriched the haptic channel on the devices that have one. Every named event carries either
a single short pulse (press 10ms, select 16ms, relay 12ms) or, for an outcome, a pattern
(confirm `[16, 20, 26]`, fail `[30, 38, 30]`). `hover` and `focus` carry none, and nothing fires while
panning, zooming, holding a control or simply viewing imagery — structurally, since the scene that
owns pan and zoom voices nothing at all.

Strength is a stored preference, `hapticsLevel = off | light | standard | strong`, and a device that
stored the old on/off switch migrates to STANDARD or OFF. The Vibration API offers duration and no
amplitude, so the levels scale how long each pulse runs; inside a pattern only the pulses scale and
the pauses keep their length, so the rhythm is the same at any strength. `navigator.vibrate` is
feature-detected — there is no user-agent sniffing anywhere — and a browser without it gets a silent
no-op and a settings row that says `HAPTICS // UNAVAILABLE`. Beyond the per-event repeat guard, an
incidental pulse is dropped while an outcome pattern is still playing, so a stray press cannot cut a
debrief short. See `docs/PHASE-15H-HAPTICS.md`.

Settings are stored locally on the device and include:

- Master level: 100 / 75 / 50 / 25 / 0 percent
- Sound effects: on/off
- Haptics: off / light / standard / strong
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
- `?map=frostline-relay` — constrain generation to one sector (`woodland-corridor-7`, `frostline-relay`, `riverworks-sector`, `border-farms`)
- `?debugMission=1` — display generator seed/attempt metadata
- `?debugTargets=1` — show selectable entity hit boxes
- `?debugMap=1` — show spawn-zone bounds

Example: `?seed=COLDWAR-77&mode=CHANGE&map=riverworks-sector&debugMission=1`

Without `?map=` the Main Menu's SECTOR selection applies; on `ANY SECTOR` the seed picks the sector too.

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

Each sector names the grid square its tally is taken over in map metadata — `GRID DELTA-3` in WOODLAND CORRIDOR 7, `GRID ECHO-4` in RIVERWORKS SECTOR — so the region is drawn for the ground it covers rather than reused from another sector. A generated COUNT mission draws its own region instead.

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
- `src/game/` — mission definitions, scoring, seeded generation, the training script, and the recognition manual
- `src/world/` — authored-map renderer, state operations, and map helpers
- `src/assets/` — runtime sprite manifest/registration
- `src/audio/` — synthesized feedback engine
- `src/settings/` — persistent user preferences
- `src/ui/` — shared UI and presentation helpers
- `assets/maps/` — authored reconnaissance map data
- `assets/sprites/` — production art sheets
- `scripts/` — dependency-free release validation
- `docs/` — art, map, generator, presentation, feedback, graphics, layout, interaction, training, and release-audit specifications

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
- Phase 14A — High-fidelity sprite-art contract ✅
- Phase 14B — Target/installation sprite redraw ✅
- Phase 14C — Infrastructure sprite redraw ✅
- Phase 14D — Environment/vegetation sprite redraw ✅
- Phase 14E — Intel/clue/decoy sprite redraw ✅
- Phase 14F — UI sprite redraw + full-library consistency audit ✅
- Phase 15A — Multi-map architecture and map registry ✅
- Phase 15B — FROSTLINE RELAY authored map ✅
- Phase 15C — RIVERWORKS SECTOR authored map ✅
- Phase 15D — BORDER FARMS authored map ✅
- Phase 15E — Sector select and multi-map RANDOM missions ✅
- Phase 15F — ANALYST TRAINING interactive tutorial ✅
- Phase 15G — IDENTIFICATION GUIDE recognition manual ✅
- Phase 15H — Haptics plus: patterns, strength levels, feature detection ✅
- Phase 15I — First-run orientation and certification standing ✅
- Phase 15 RC — Release-candidate audit and fixes ✅
- Phase 15J — Bug-fix and regression pass ✅
