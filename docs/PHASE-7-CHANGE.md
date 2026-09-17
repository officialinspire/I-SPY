# Phase 7 — Change Detection

Phase 7 adds the third core I SPY mission type: **CHANGE**.

## First mission

`OPERATION SECOND LOOK` presents two perfectly aligned reconnaissance passes of `WOODLAND CORRIDOR 7`:

- PASS A — 05:12 ZULU
- PASS B — 05:27 ZULU

The first authored change is a military jeep that moves from its original compound position to the eastern road approach. The player must compare the passes and mark the changed object.

## State-driven architecture

The game does not maintain two separately authored maps. `ReconScene` creates two runtime instances from the same authored map data. PASS B is derived by applying a small state-operation list.

Current generic state operations in `src/world/authoredReconMap.js`:

- `move_entity`
- `hide_entity` / `remove_entity`
- `add_entity`
- `add_sprite`

This supports future change missions such as vehicles appearing/disappearing, new equipment, new trenches, road obstructions, construction, and other authored intelligence changes without duplicating the terrain map.

## Comparison controls

Single view:

- `VIEW PASS A / VIEW PASS B` toggles imagery while preserving camera coordinates and zoom.
- Keyboard `A` and `B` switch directly between passes.

Wide-screen split view:

- Available at 980 px viewport width or larger.
- `SPLIT VIEW` presents PASS A on the left and PASS B on the right.
- The second camera uses the exact same scroll and zoom values as the primary camera.
- Panning or zooming either half keeps both halves synchronized.
- Keyboard `S` toggles split view.

Mobile and narrow screens retain the A/B toggle flow rather than shrinking two reconnaissance images below useful inspection size.

## Identification and scoring

The player selects `MARK CHANGE`, then selects an object in either pass and confirms it. Validation is based on authored entity identity, so the changed vehicle may be correctly identified at its PASS A or PASS B location.

Scoring:

- Correct changed-object identification: +1000
- False identification: -250
- Remaining time: +5 per second
- Perfect bonus: +500 with zero false identifications

The mission ends on a correct identification or when the timer reaches zero.

## Alignment rule

PASS A and PASS B always originate from the exact same map and camera coordinate system. State changes mutate only listed objects. This prevents accidental terrain drift from becoming a false clue.

## Phase 8 handoff

The mission generator can now randomize:

- which compatible entity changes,
- which supported state operation is applied,
- mission wording,
- target location,
- decoys and clue packages,
- time limits,
- deterministic mission seeds.
