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
