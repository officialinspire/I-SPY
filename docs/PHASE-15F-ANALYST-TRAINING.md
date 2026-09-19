# Phase 15F — ANALYST TRAINING

A guided, six-step introduction to the recon console, on a range built for teaching.

## The shape of it

`ANALYST TRAINING` joins HOW TO PLAY and SETTINGS in the Main Menu's SYSTEM row. It does not replace
the field guide: one is a page to read, the other walks the console. The SYSTEM row is three-up where
there is width for it and folds to two rows — training over the pair — when the console stacks, so no
label is ever squeezed.

The tutorial **is** the recon console rather than a copy of it. `TrainingScene` extends
`EnhancedReconScene`, the same scene that flies live taskings, so MARK / CANCEL / CONFIRM, the tally
steppers, the pass segments, split view, RESET VIEW, pan, wheel and pinch all behave exactly as they
will in a real mission. Nothing is re-implemented for the tutorial; what the subclass changes is the
frame around them:

| Live mission | Training |
| --- | --- |
| Timer counts down, expiry ends the mission | No timer at all; the HUD reads `TRAINING` |
| Score, false-ID and rejected-tally penalties | No score; every counter is reset after coaching |
| A correct call ends the mission and opens Results | A correct call completes the step; the console stays live to practise on |
| Seeded generation picks the sector and task | Authored missions only, always on the training range |

## The six steps

| # | Step | Teaches | Will not advance until |
| --- | --- | --- | --- |
| 1 | NAVIGATION | drag to pan, wheel/pinch to zoom, RESET VIEW | the trainee has panned, zoomed **and** pressed RESET VIEW |
| 2 | IDENTIFICATION | "study silhouette and surrounding context" | — (a step to read; the object is bracketed) |
| 3 | MARKING | MARK TARGET, placing the candidate reticle, CANCEL, CONFIRM | a confirmed mark on the training target |
| 4 | COUNT | + / −, the number keys, SUBMIT COUNT | the correct total is submitted |
| 5 | CHANGE | PASS A / PASS B, split view, marking the change | PASS B has been viewed **and** the moved object confirmed |
| 6 | COMPLETE | — | — (`ANALYST CERTIFICATION COMPLETE`) |

Requirements are recorded by overriding the console's own methods — `zoomAt`, `resetView`,
`setActivePass`, `enableSplitView`, `finishMission` — rather than by watching input separately, so
what the checklist ticks is exactly what the console did. Split view satisfies the pass requirement
too: it shows both passes at once, which is the lesson either way.

Steps 1–3 share one LOCATE mission and therefore one scene: navigation and marking never reload the
world. Only a change of mode (LOCATE → COUNT → CHANGE) rebuilds it, so the tutorial builds three
worlds, not six.

## Tutorial UI

A compact panel under the HUD, on the left on desktop and full-width on a phone: step counter, title,
three lines of instruction, the checklist with `[ ]` / `[✓]`, then NEXT, SKIP TUTORIAL and
BACK TO MENU. NEXT is disabled until the step's requirements are met, and on the final step the panel
becomes a centred certification card with a single RETURN TO MAIN MENU.

Short landscape screens leave barely any room between the HUD and the control rail, so below 238px of
working height the panel drops its prose and shows the step, the checklist and the buttons. A press
anywhere on the panel belongs to the panel — `isHudPoint` is extended to cover it — so dragging near
it can never pan the imagery underneath.

SKIP TUTORIAL and BACK TO MENU are not the same door:

- **BACK TO MENU** keeps the place. `tutorialStep` is stored, and ANALYST TRAINING offers to resume
  there.
- **SKIP TUTORIAL** clears it. The console stops offering to pick up where it was.

`tutorialCompleted` is stored when the certification step is reached. **Nothing reads it to decide
whether to show the tutorial** — training is never forced, at first launch or any other. The flag only
marks the menu control as complete and changes its readout.

## TRAINING RANGE ALPHA

`assets/maps/training-range-alpha.json`: three isolated instruction bays on an enclosed apron either
side of a range road, with the ground between them deliberately empty. A trainee is learning the
console, not reading a sector.

| Bay | Holds | For |
| --- | --- | --- |
| A — identification pad | one `tank`, with no similar silhouette within 420 units | steps 2 and 3 |
| B — tally bay | three military vehicles and one civilian tractor | step 4 |
| C — movement bay | the `jeep-01` that moves onto the range road | step 5 |

The civilian tractor in bay B is the point of the count lesson: the step says count only military
vehicles, and a wrong answer is available to give.

The range is registered like any other map — same schema, same validation, same renderer — but it is
not a sector. `mapCatalog` marks it `training: true`, and the registry splits `RECON_MAPS` (all maps)
from `SECTOR_MAPS` (the four playable sectors). The picker lists sectors, the generator draws from
sectors, and `normalizeSector('training-range-alpha')` returns `any`, so no seed and no `?map=` can
put a live mission on the range.

## Validation

- `validateReconMap()` now checks an authored `metadata.training` block: the object a lesson points at
  must exist, and its count region must be inside the map.
- The release validator checks, per map, that `jeep-01` exists and that an authored change destination
  is in bounds and at least 200 units from the start.
- It also checks that an authored training change framing still holds **both** positions of the moving
  object once the camera is clamped to the map. This caught a real bug: the first framing asked for
  ground past the map's eastern edge, and the camera silently clamped 173 units west of it, putting the
  moved jeep somewhere other than where the lesson said it would be.

`npm run validate`: 2651 checks, 0 warnings. `npm run build`: clean.

## Tests

`training-test.mjs` (39 checks, all passing) covers the registry split, that no seed in 300 can draw
the range, the script's shape and required actions per step, that every step's mission is authored and
untimed, that steps 1–3 share a mission and only three worlds are ever built, that the identification
target is uncrowded, that the count region holds exactly three military vehicles plus a civilian
distractor, that the change is one obvious in-bounds move that leaves the count region alone, and that
a stale stored step can never point off the script.

In-browser, the whole tutorial was driven end to end at 1440x900: NEXT refuses to advance step 1 until
pan, zoom and reset are all done; the bracket appears on the target; CANCEL then a re-mark and CONFIRM
completes step 3; a deliberately wrong tally is coached and the correct one completes step 4; PASS B
plus a confirmed mark completes step 5; the certification card appears and returns to the menu. The
menu was checked for overflow at 1440x900, 1280x620, 1024x460, 390x844 portrait and 844x390 landscape.

## A bug the tutorial found

Driving all six steps in one session threw
`Cannot read properties of null (reading 'drawImage')` at the step 5 → 6 transition. The stack led to
`ReconScene.setMissionControlsEnabled`, which walks `locateButtons`, `countButtons` **and**
`changeButtons` regardless of mode.

The recon scene instance is reused from one mission to the next — `scene.start('Recon', …)` restarts
the same instance — but those arrays are only ever assigned by the mode that built them, so a COUNT
run still held the LOCATE run's buttons, whose game objects had been destroyed with the previous run.
Touching one repaints a `Text` with no canvas.

The tutorial reaches this quickly because it moves through all three modes in one session, but the
defect is in `ReconScene`, not in the tutorial: any path that restarts the scene into a different mode
and then walks every mode's controls is exposed. Both `setMissionControlsEnabled` and `getUiObjects`
do that. `createHud()` now clears the per-mode control and readout fields before building this run's,
and `EnhancedReconScene` clears the `countRejected` flag for the same reason. I did not get the live
mission flow to reproduce it in the browser, so what is verified is the training path and the cause.

## Not done

- No new sprites.
- No change to scoring, to the generator, or to how live missions behave.
- The seeded-mission fingerprint (303 missions) is unchanged.
