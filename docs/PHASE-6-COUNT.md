# Phase 6 — COUNT Mode

Phase 6 adds the second complete I SPY mission type: **COUNT**.

## First mission

**Operation Tally Sheet** asks the analyst to count all entities in category `military_vehicle` inside **Grid Delta-3** on Woodland Corridor 7.

The region is defined in world coordinates and is rendered as a restrained monochrome boundary. It intentionally contains civilian/unrelated objects as visual decoys; mission validation counts only entities whose authored metadata matches the requested category.

## Mission data

COUNT missions use the same common mission fields as LOCATE (`id`, `operation`, `satellitePass`, `sector`, `mode`, `objective`, and `timeLimitSeconds`) and add:

- `targetCategory`
- `targetCategoryLabel`
- `region`
- `expectedCount`

`src/game/countMission.js` derives `expectedCount` from authored entity metadata rather than hardcoding the answer.

An entity belongs to the requested region when its center point falls within the region bounds. This makes boundary behavior deterministic for differently sized sprites.

## Player controls

Touch/mouse:

- `-` and `+` adjust the answer
- `SUBMIT COUNT` validates it

Keyboard:

- number keys enter a value
- Backspace removes the last digit
- Arrow Up / Arrow Down increment/decrement
- Enter submits

Incorrect submissions do not end the mission. They add a scoring penalty and the player may reassess until the timer expires.

## Scoring

Configured centrally in `src/runtime-config.js`:

- correct answer: +1000
- incorrect submission: -300 each
- remaining time: +5 per second
- perfect bonus: +500 when the first submission is correct

The total score is clamped to zero.

## Presentation

COUNT mode keeps the same pan/zoom reconnaissance controls as LOCATE. The selected analysis region is marked without altering or highlighting individual objects. The camera reset centers the requested region.

## Phase 7 handoff

The next planned core mode is CHANGE DETECTION. It should preserve the authored base terrain while applying pass-specific object/state changes from mission data so two aligned reconnaissance passes can be compared reliably.
