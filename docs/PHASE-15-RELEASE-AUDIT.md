# Phase 15 — Release-candidate audit

A full pass over the Phase 15 branch: the map registry, all four sectors in all three analysis
modes, the seeded generator and its URL options, ANALYST TRAINING, the IDENTIFICATION GUIDE, the
haptics rework, and responsive layout at the five audit viewports. No features were added. One
defect was found; it was reproduced first, then fixed.

The seeded generator is untouched. The pre-registry fingerprint of 303 woodland missions still
hashes `5a3b3c6cddf9e49f17664cd1c5e3b0192cf056f7b76f88cd987441dd3fcce312`, as it has through every
Phase 15 commit.

## Defect found and fixed

### COUNT asked RIVERWORKS SECTOR to tally a rectangle drawn for WOODLAND CORRIDOR 7

**Severity: high — it affects the puzzle.** `COUNT_REGION` was a module constant, drawn by hand for
the only map that existed when COUNT was built: `GRID DELTA-3`, at `500,500` and `1550x500`. Phase
15A–15D added three more sectors, and `createCountMission()` kept reading that same rectangle
whatever sector it was given. Each sector has its own spatial grammar, so the rectangle landed
somewhere different — and in RIVERWORKS SECTOR it landed across the canalised channel that runs
corner to corner:

- 18 rows of water fell inside the highlighted count area, so the region an analyst was asked to
  tally was mostly river;
- it held **one** military vehicle, while **five** sat outside it;
- a one-object tally is not a counting puzzle. The mode still "worked" — submit `1` and the mission
  is correct — which is why it survived the per-mode smoke tests.

BORDER FARMS and FROSTLINE RELAY were tolerable by luck rather than by design (2 and 5 vehicles),
and no sector but woodland had ever had its count region looked at.

**Fix.** A sector may now author the grid square its tally is taken over, in map metadata, next to
the CHANGE second pass it already authors:

- `DEFAULT_COUNT_REGION`, `getCountRegion()`, `entityCenterInRegion()` and `countEntitiesInRegion()`
  moved into `src/world/reconMapSchema.js`. They read maps and hold no map data of their own, so the
  release validator — which must stay free of any module that imports map JSON — can run the same
  rectangle the game uses. `src/game/countMission.js` re-exports them, so every existing call site
  is unchanged.
- `createCountMission()` resolves the region per sector: the map's own `metadata.countRegion` if it
  authors one, otherwise `DEFAULT_COUNT_REGION`. The objective line and the on-map COUNT AREA label
  both read the resolved region, so the briefing names the square that is drawn.
- RIVERWORKS SECTOR authors `GRID ECHO-4` at `1200,300`, `900x750`: clear of the channel, three
  military vehicles inside it and a civilian truck as a distractor.
- WOODLAND CORRIDOR 7 authors nothing and keeps `GRID DELTA-3` exactly as shipped, so the sector
  that was audited in Phase 13 is byte-identical.

**Guards, so it cannot come back.** `validateReconMap()` now bounds-checks `metadata.countRegion`
the way it bounds-checks the CHANGE destination, and the release validator counts the tally each
registered sector would actually be asked for and fails under two. That guard immediately caught a
second map: TRAINING RANGE ALPHA sat under the generic rectangle with one vehicle in it, so the
range now names its tutorial bay, `RANGE BAY B`, as its count region as well.

COUNT totals per sector after the fix: woodland 3, frostline 5, **riverworks 3 (was 1)**, border
farms 2, training range 3.

## Verified, no change needed

**Map registry.** All five registered maps load from disk, match their catalog entry and pass
`validateReconMap()`. No call site assumes the default sector where a `mapId` is required: every
mission builder resolves from its `mapSource`, the recon scene builds `mission.mapId`, and the one
remaining default is `resolveReconMap()`'s deliberate warn-and-fall-back for an id that no longer
ships.

**Every sector in every mode.** All twelve combinations were played in a browser from the tasking
order into the recon scene, with pan, zoom and reset exercised in each: no page errors, no console
errors, no overflow.

**RANDOM.** Map selection and mission selection are both deterministic and reproduce from a seed.
The sector draw runs on its own `<seed>:sector` RNG stream, so naming a sector does not shift the
mission stream. `?seed=`, `?mode=` and `?map=` all parse and apply, alone and in combination.

**Tutorial.** Pan, zoom, reset, mark, cancel, confirm, count, pass switch and change marking each
have to be performed before the step advances; SKIP TUTORIAL and BACK TO MENU leave cleanly, and
completion persists as `tutorialCompleted`, with the stored step resuming where it was left.

**Identification guide.** Every listed entry names a registered sprite frame, no frame appears
twice, every note is one or two figure-free sentences naming no sector, mission or mode, and all
five categories navigate by tab, arrows, Enter and Escape as well as by touch.

**Haptics.** OFF / LIGHT / STANDARD / STRONG scale pulse durations only; a settings record written
before Phase 15H migrates `hapticsEnabled: true` to STANDARD and `false` to OFF; panning, zooming,
holding and viewing imagery never vibrate; hovering and keyboard focus never vibrate; a rapid burst
never stacks two pulses inside the repeat guard; an absent Vibration API is a silent no-op with the
settings row inert; and the haptic channel reads neither `sfxEnabled` nor `masterVolume`, so sound
and touch stay independently configurable.

**Responsiveness.** The console, the orientation panel, the guide, the guide's return path, the
tutorial and the recon HUD were each captured at 1440x900, 1024x700, 800x420, 390x844 and 360x640 —
thirty captures, no horizontal or vertical overflow at any of them. The SYSTEM row keeps all four
controls on one line down to 800x420 and stacks to one column on the phone viewports; the tutorial
panel clears the mode rail at 360x640; the guide keeps a readable grid and detail panel at every
size.

## Noted, deliberately not changed

`?map=` accepts any **registered** map id, which includes `training-range-alpha`, while the SECTOR
control offers only the four playable sectors. A URL naming the training range produces a valid,
playable, validated mission on it. That is an undocumented URL affordance rather than a defect, and
closing it would be a behaviour change, not a regression fix — so it was left alone. The range now
authors its own count region, so that path tallies a real bay rather than a bad rectangle.

## Checks

`npm run validate` — 2789 checks, 0 warnings. `npm run build` — clean.

---

# Phase 15J — bug-fix and regression pass

A second pass over the shipped Phase 15 build, fixing verified defects only. No features, maps,
sprites, modes or scoring were added or changed. Each defect below was reproduced against the
deployed build before it was fixed, and every fix is held by a test that fails on that build.

## Generation

### 1. Generated objects could land on top of each other

**Severity: high — it affects the puzzle.** Placement drew a position inside a spawn zone without
asking what was already there, so a moved target, a moved decoy or an appeared contact could come to
rest materially on top of another selectable object. A buried silhouette cannot be recognised, and a
mark on the pair resolves to one of them for reasons the analyst cannot see.

**Measured.** Over 768 seeded missions (four sectors x three modes x 64 fixed seeds), the shipped
generator produced **236** missions in which something it had placed overlapped another selectable
object by at least a quarter of the smaller footprint. After the fix: **0**.

**Fix.** `src/world/reconMapSchema.js` gained `entityOverlapRatio()` and `findSelectableOverlaps()`
— shared area as a fraction of the *smaller* footprint, hidden and non-selectable objects skipped,
`OVERLAP_LIMIT` at 25% so a clipped corner stays allowed. `validateGeneratedMission()` now rejects
any mission whose own operations produced an over-limit pair, in PASS A and, for CHANGE, in PASS B
as well; `add_entity` is included, so an appeared contact is judged like anything else. Rejection
feeds the generator's existing retry loop, which was the sanctioned mechanism, so generation stays
deterministic and no placement logic was rewritten. Overlap is judged only against what the mission
placed: a map's own crowding is the map's to answer for, and the release validator now answers it.

### 2. Generated COUNT could ask for a tally of one

**Severity: medium.** `createCountGenerated` chose one to three vehicles for the region, so the
expected answer could be 1 — a yes/no question wearing a counting task's clothes. **68 of 256**
seeded COUNT missions asked for a tally of 1. The validator now requires `expectedCount >= 2`
(`MIN_GENERATED_COUNT`) and retries below it. Scoring is untouched. After the fix: **0**.

### 3. A generated CHANGE could "move" an object eight pixels

**Severity: medium.** The move check was per-axis and asked only for more than 8 units, which is
registration noise between two frames rather than something that drove away. **9** of the 768 seeded
missions passed on a move under 90 units. The check is now Euclidean against `MIN_CHANGE_MOVE = 90`.
Appeared and disappeared events are unchanged. After the fix: **0**.

## Interaction

### 4. An exact overlap was marked back to front

**Severity: high.** `entityAtPoint()` walked the entity list forwards and returned the first match.
Entities are drawn in that same order, and an added contact is appended, so the first match is the
object drawn *underneath*: where two objects overlapped, the analyst clicked the sprite they could
see and marked the one they could not. The search now runs in reverse, so the object on top — the
one that was clicked — wins, and it only considers objects that can be marked at all.
`entityNearPoint()` keeps its two steps: exact hit first, then the touch-tolerance ring.

### 5. BORDER FARMS parked a truck inside a barn

**Severity: high.** `mil-truck-02` overlapped `barn-01` by **64%** of the truck, and clipped
`generator-01` by 14%. The truck moved 67 units, from `420,1220` to `400,1284` — still in the same
farmyard, now alongside the barn rather than under it. It stays inside the `farmyard` spawn zone, it
is nowhere near the sector's COUNT region, and the COUNT total is unchanged. An audit of all five
maps found no other over-limit pair; FROSTLINE RELAY's `mil-truck-02` clips `fuel-tanks-01` by 9%,
which is the ordinary crowding the limit is set to allow. The release validator now fails on any
authored selectable pair over the limit, so this cannot be re-authored by accident.

### 6. The identification guide's masked grid took input it could not show

**Severity: medium.** The grid is clipped by a geometry mask, which Phaser's hit testing knows
nothing about, so a cell scrolled half out of the box still answered clicks in the part that was not
drawn. The wheel scrolled the grid wherever the pointer was, including while reading the detail
panel. A drag to scroll opened whichever cell it began on when the finger lifted. And cells below
the fold were hidden to stop the stray clicks, which put them beyond the keyboard as well: at a
window where the last row sits outside the box, **Tab reached six of the nine entries**.

**Fix.** `createButton` gained an optional `pointerGuard`, asked on press *and* on release, so the
owner of a mask can say whether a pointer is somewhere its button can be pressed; keyboard
activation never consults it. The guide's cells use it to require the pointer inside the grid box
and to veto a press that has turned into a drag (past a six-pixel threshold). The wheel handler asks
the same question. Cells below the fold stay visible and focusable — the mask does the clipping —
and focusing one scrolls it into view. After the fix Tab reaches all nine.

### 7. A category was laid out against the category just left

**Severity: low.** `layout()` measured the summary's height to position everything under it, then
set the summary's text at the end of the pass. A category switch therefore measured the previous
category's text. It was invisible in the shipped build only because `selectCategory` runs the layout
twice and the second pass saw the text the first had set. The text is now written before anything
measures it, so one pass is correct. (`selectCategory` still calls `layout` explicitly, because the
argument it passes to `showEntry` as `layoutAfter` is its own `silent` flag.)

### 8. The settings rows answered in the state you had just left

**Severity: medium.** A button's press cue fires before its handler runs, so the three rows that
change how feedback itself behaves acknowledged the old state:

- turning SOUND EFFECTS on was **silent**, because the cue was voiced while sound was still off;
- raising MASTER LEVEL from zero was **silent**, for the same reason;
- stepping HAPTICS pulsed **twice** — once at the strength being left and once at the new one — and
  stepping to OFF still pulsed.

Measured against the shipped build: SFX OFF -> ON started 0 notes; MASTER 0 -> 100% started 0 notes;
stepping to STANDARD vibrated `[6, 16]`, to STRONG `[10, 23]`, and to OFF `[15]`.

**Fix.** Those three rows take `pressSound: false` and voice themselves after the change. Now:
SFX OFF -> ON is heard, MASTER 0 -> non-zero is heard at the new level, each haptic step is exactly
one pulse at the new strength (`[6]`, `[10]`, `[15]`) and OFF is `[]`. Sound and touch stay
independent: with SFX off and master at zero, the haptics row still pulses once and starts no notes.

### 9. HOW TO PLAY closed itself mid-sentence

**Severity: low.** The field guide carried a 9000ms auto-dismiss, so it was taken away while being
read. The timer is gone; it closes on a backdrop tap or ESC, which is what its own hint says.

## Validation

### 10. Authored mission validation

The release validator now requires every registered map — training range included, because its
lessons mark the same two objects — to carry a **selectable** `radar-01` and a **selectable**
`jeep-01`, and to hold an authored COUNT total of at least two. It also fails on any authored
selectable overlap over the limit. 2809 checks, up from 2789.

### 11. Generator QA in the release gate

`scripts/generator-qa.mjs` plays the real generator over every playable sector and mode for 64 fixed
seeds — 768 missions, 7861 assertions — and holds each result to the rules above: a visible,
selectable LOCATE target; a COUNT of at least two that matches the plate; a CHANGE whose target
state genuinely differs, whose move clears the minimum, and whose disappeared target existed in
PASS A; no material overlap in either pass; no out-of-bounds operation; and the same seed, map and
mode reproducing an identical mission. It imports the runtime generator and the runtime schema
rather than restating either. `npm run validate` now runs it after the static validator, and CI runs
`npm run validate` before the production build, so a generator that can produce an unplayable
mission cannot deploy.

To make that possible in plain Node, `src/world/mapRegistry.js` now spells its five JSON imports
with `with { type: 'json' }`. Vite builds it unchanged; Node 22 can now import the generator
directly, so the QA needs no bundler and no second copy of anything.

## The generator fingerprint moved, on purpose

The 303-mission woodland fingerprint that Phase 15A–15I held at
`5a3b3c6cddf9e49f17664cd1c5e3b0192cf056f7b76f88cd987441dd3fcce312` is now
`3fb71cf852bf71a259bbd224dada220a123e4185b1a6736f7af651c3c760106a`. That is the point of this pass:
a stricter validator sends some seeds to a different attempt in the retry loop. **212 of the 300
missions are byte-identical**; the 88 that changed are the ones the old rules let through with an
overlap, a tally of one, or a move too small to see. The fingerprint is re-pinned at the new value
for the next refactor to be measured against.

## Checks

`npm run validate` — 2809 static checks, 0 warnings, then 7861 generator assertions over 768
missions. `npm run build` — clean.
