# Phase 8 — Seeded Mission Generator

Phase 8 turns the authored Woodland Corridor 7 sector into a replayable mission source while preserving the fairness rules established in Phases 2–7.

## Generator entry point

`src/game/missionGenerator.js` exports:

- `createGeneratedMission({ seed, mode, map })`
- `validateGeneratedMission(mission, map)`
- `getGeneratorOptions(search)`

If no seed is supplied, a new seed is created. Supplying the same seed and mode reproduces the same mission data.

Supported generated modes:

- `LOCATE`
- `COUNT`
- `CHANGE`

## Seed/query workflow

The main menu's `RANDOM MISSION` button reads optional URL query parameters:

- `?seed=COLDWAR-77`
- `?mode=LOCATE`
- `?mode=COUNT`
- `?mode=CHANGE`
- `?debugMission=1`

Example:

`?seed=COLDWAR-77&mode=CHANGE&debugMission=1`

`debugMission=1` exposes the active seed and generation attempt in the briefing/recon HUD. Results retain the seed for replay.

## Deterministic randomization

The seed is hashed and fed to a local PRNG. Generation can vary:

- mission type
- operation name / briefing wording
- target selection
- compatible target location
- decoy relocation
- clue-package placement
- COUNT region selection
- CHANGE event type
- satellite-pass times
- time limit
- subtle image grain
- subtle haze
- subtle contrast reduction

No network randomness or server state is required.

## Spawn-zone placement

Generated object placement is constrained by authored `spawn-zones` from `assets/maps/woodland-corridor-7.json`.

An entity is compatible with a zone when the zone's `accepts` list contains that entity's `type` or sprite name. This prevents obviously invalid placements such as a road truck in the middle of a river.

COUNT missions currently use authored `road_vehicle` zones so military vehicles and a civilian-truck decoy can share a plausible analysis corridor.

## LOCATE generation

Generated LOCATE missions:

1. Choose a selectable military vehicle or strategic installation with at least one compatible spawn zone.
2. Move it to a compatible location.
3. Relocate a small number of valid decoys.
4. Add a small clue package around the target area.
5. Randomize briefing wording, pass time, time limit and imagery modifiers.
6. Validate that the target remains visible/selectable.

## COUNT generation

Generated COUNT missions:

1. Select an authored road-vehicle zone.
2. Move one or more compatible military vehicles into the region.
3. Place a civilian truck in the same corridor when available as a visual decoy.
4. Derive the displayed grid label from the generated region.
5. Calculate the correct answer from the post-operation entity state.
6. Validate that the region is in bounds and contains at least one requested object.

The correct answer is never stored as an arbitrary magic number.

## CHANGE generation

Generated CHANGE missions use the same authored base map for both passes.

Supported generated event families in Phase 8:

- vehicle moved
- vehicle disappeared
- vehicle appeared

`worldOperations` establish the shared baseline for PASS A and PASS B. `passBOperations` then introduce the actual change. This preserves exact terrain alignment.

The generic runtime state layer remains capable of adding clue sprites and added entities for later change families such as trenches, construction, damaged infrastructure or blocked routes.

## Solvability validation

Each generated mission is checked before it is returned to the game.

Validation currently checks:

- supported mode
- seed presence
- positive time limit
- generated operation bounds
- LOCATE target visibility/selectability
- COUNT region bounds
- COUNT target count greater than zero
- COUNT answer matches generated state
- CHANGE target visible in at least one pass
- CHANGE state materially differs between PASS A and PASS B

Generation retries up to `GAME_CONFIG.generator.maxAttempts`. If every attempt fails, the system returns the authored mission for the requested mode instead of presenting an invalid puzzle.

## Visual variation and fairness

Generated missions may apply subtle deterministic grain, haze and contrast changes. These effects are intentionally restrained.

For CHANGE missions, the same single-view effect is used on both pass states. When split comparison is enabled, the atmosphere overlay is hidden so image degradation cannot create a false visual difference between the two halves.

## Phase 9 handoff

Phase 9 can focus on the full Cold War presentation pass: stronger intelligence-terminal framing, restrained CRT behavior, typewriter briefing treatment, acquisition transitions and presentation polish without changing the mission-generation rules established here.
