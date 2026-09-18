# Phase 13D — Reconnaissance gameplay interaction polish

Phase 13D makes inspecting, marking, confirming and cancelling read as four distinct states with
four distinct behaviours. Puzzle answers, scoring, mission generation and target validation are
untouched: `validateIdentification`, `validateChangeIdentification`, `validateCountAnswer` and every
score function are called exactly as before, with the same arguments.

Almost all of the new behaviour lives in `EnhancedReconScene` and two shared helpers. `ReconScene`
took four surgical edits — pointer handling, the mark lifecycle, a single-shot confirm guard, and
the HUD tap guard — rather than a rewrite.

## Interaction states

| State | Console |
| --- | --- |
| **Normal analysis** | `grab` cursor, `grabbing` while dragging. Phosphor HUD rule. No reticle. |
| **Marking active** | `crosshair` cursor, amber HUD rule, `MARKING ACTIVE // TAP AN OBJECT` banner in the HUD, MARK button in its selected tactical state, and an amber reticle that tracks the pointer with a slow targeting sweep. |
| **Object selected** | Neutral off-white candidate reticle at the mark, MARK PENDING, CONFIRM (success) and CANCEL (danger) as visually distinct actions, `default` cursor. |
| **Confirmed** | The mark itself turns phosphor on a correct call and muted rust on a false ID, with the existing audio and haptic cue. |

The pointer reticle never reacts to what is underneath it, and the candidate marker is tonally
neutral until the analyst commits, so neither one can be swept across the image to reveal which
shapes are selectable objects. Result feedback is drawn at the marked point and nowhere else, so a
wrong call says nothing about the objects around it.

## Tap versus drag

Marking used to place a candidate on *pointer down*, which meant an armed analyst could not pan at
all and any press became a mark. Marking now resolves on *pointer up*, and only when:

- the pointer travelled no further than `GAME_CONFIG.recon.dragThreshold` (4px — a value that
  existed in config but was never used),
- the press did not start or end on a HUD control,
- it is the only pointer down (a second finger makes the gesture a pinch, never a tap),
- the point is outside the HUD guard.

So a drag pans the imagery with marking still armed, and a tap marks. Panning and zooming redraw the
candidate marker, which is sized in screen pixels rather than world units, so a mark keeps a
constant on-screen size instead of ballooning as the analyst zooms in.

## HUD tap guard

HUD objects use `scrollFactor(0)`, but the camera still applies its zoom around the viewport centre,
so at the default 0.75 zoom the HUD was drawn roughly 22px lower and 160px right of its own
coordinates. The guard tested raw screen coordinates, which blocked taps on clear imagery above the
HUD while letting taps through the band the HUD actually covers. Phase 13D converted the pointer
into HUD coordinates first so the guard matched what was drawn.

> **Superseded by the Phase 13 release-candidate audit.** The HUD now renders through its own
> camera fixed at 1x, so HUD coordinates and screen coordinates are the same thing again and the
> guard tests the pointer directly. See `docs/PHASE-13-RELEASE-AUDIT.md`.

Separately, a press that lands on a HUD control no longer reaches the map at all: Phaser emits
game-object events before scene-level ones, so a `gameobjectdown` / `gameobjectup` flag tells the
map handlers to stand down. This also fixes a pre-existing quirk where pressing CONFIRM or CANCEL
while marking was armed dropped a fresh mark underneath the button.

## Touch tolerance

`entityNearPoint()` keeps authored metadata bounds authoritative: a mark inside an entity's real
footprint always resolves to that entity. Only when a mark misses everything does the nearest
entity within tolerance win — 16 screen pixels for touch, 7 for a mouse, converted to world units
through the live camera zoom. No sprite was enlarged, no hitbox changed, and the tolerance applies
equally to targets and decoys, so it cannot bias identification.

Verified as an A/B: the same tap point 10px below a truck's footprint resolves to
`IDENTIFICATION READY` under touch and `NO CLEAR OBJECT` under a mouse.

## Things that can no longer go wrong

- **Repeated confirmation.** `confirmCandidate()` is single-shot behind a `resolvingIdentification`
  flag, so a double press scores one false ID, plays one cue and fires one transition.
- **Duplicated SFX.** Identical status messages within 320ms do not re-trigger audio or haptics.
- **Stale marker state.** The marker's camera is resolved late, so leaving split view cannot leave
  it bound to a destroyed camera; arming, cancelling and mission end all reset the tone.
- **Accidental pan when confirming**, and **accidental selection after dragging** — see above.

## Motion

The reticle's sweep and breathing ring are the only added motion, and `prefers-reduced-motion`
users get the same reticle drawn statically. The result flash is a colour change, not a movement.

## Verification

- `npm run validate` — 273 checks, 0 warnings. `npm run build` — clean.
- Chromium against the production build: cursor transitions across all three states; drag-then-release
  with marking armed pans without marking; tap marks; CANCEL clears in one press; a double CONFIRM
  produces exactly one false ID; the rejected flash appears at the mark and clears; a correct call
  reaches `MISSION COMPLETE` with 0 false identifications and the perfect bonus intact; LOCATE,
  COUNT and CHANGE all play; reduced-motion renders the static reticle. No console or page errors.
