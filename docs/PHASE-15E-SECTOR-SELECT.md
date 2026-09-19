# Phase 15E — Sector select and multi-map RANDOM missions

Four sectors shipped in Phases 15A–15D, and only a URL could reach three of them. This phase gives
the console a way to say which sector it is pointed at, and gives a seed the ability to choose one
for itself.

## The control

One row, directly under RANDOM MISSION, inside the PRIMARY TASKING section:

```
SECTOR // ANY SECTOR
```

It cycles rather than opening a menu — the same idiom as the settings rows — so the primary action
keeps the emphasis and the menu gains no new modal surface. Five stops, in registry order:

`ANY SECTOR → WOODLAND CORRIDOR 7 → FROSTLINE RELAY → RIVERWORKS SECTOR → BORDER FARMS → ANY SECTOR`

A named sector renders in the button's `selected` state, so "the console is pointed somewhere
specific" is visible without reading the label. The readout beneath the console names the
environment as well as the sector (`SECTOR // FROSTLINE RELAY — ALPINE SNOW`) on hover or keyboard
focus, and the control sits in the Tab order between RANDOM MISSION and the mode cards.

Layout treats the card and its sector row as one measured block, so the row is part of the density
tier the menu picks rather than something laid on top of it. Verified with no overflow at 1440x900,
1280x620, 1024x460, 390x844 portrait and 844x390 landscape; the row keeps its full label down to the
`minimal` tier.

## What a sector selection means

| Selection | RANDOM MISSION | LOCATE / COUNT / CHANGE cards |
| --- | --- | --- |
| `ANY SECTOR` | The seed picks the sector *and* the task | The default sector, exactly as before Phase 15E |
| A named sector | Generation is constrained to that sector | The authored mission for that sector |

The selection persists to `userSettings` as `sector`, so the console remembers where it was pointed.
An unrecognised stored value — a sector that no longer ships — normalises to `ANY SECTOR` rather
than failing to launch.

## Determinism

The sector draw runs on **its own RNG stream**, keyed `` `${seed}:sector` ``, separate from the
mission stream keyed `` `${seed}:${attempt}` ``. That is the whole design, and it buys one property:

> Naming a sector never shifts the mission stream. A seed produces the same mission on a given
> sector whether that sector was drawn by the seed or named by the analyst.

Checked over 200 seeds: for every one, `createGeneratedMission({ seed })` and
`createGeneratedMission({ seed, map: <the sector it drew> })` are byte-identical. The same 200 seeds
reach all four sectors (47 / 60 / 47 / 46).

The pre-15A behavioural fingerprint — 303 seeded missions, sha256
`5a3b3c6cddf9e49f17664cd1c5e3b0192cf056f7b76f88cd987441dd3fcce312` — still matches when woodland is
named explicitly, which is now what the fingerprint harness does. Woodland missions are unchanged.

## URL options

`?map=` joins `?seed=` and `?mode=`, and now also sets what the control displays for that visit:

```
?map=woodland-corridor-7
?map=frostline-relay
?map=riverworks-sector
?map=border-farms
?seed=COLDWAR-77&mode=CHANGE&map=riverworks-sector
```

A `?map=` in the URL overrides the remembered selection for that visit without overwriting it.

## Portable authored missions

`createChangeDetectionMission()` moved a jeep to hard-coded woodland coordinates, which is fine with
one sector and wrong with four. Each sector now authors its own second pass in map metadata:

```json
"changeDetection": {
  "destination": { "x": 1960, "y": 692 },
  "summary": "UTILITY JEEP moved from the valley bench up onto the pass road."
}
```

| Sector | Pass A | Pass B | The move |
| --- | --- | --- | --- |
| WOODLAND CORRIDOR 7 | (1940, 590) | (1515, 870) | compound to the eastern road approach |
| FROSTLINE RELAY | (840, 700) | (1960, 692) | valley bench up onto the pass road |
| RIVERWORKS SECTOR | (1300, 916) | (2000, 1330) | east bank road into the fenced fuel depot |
| BORDER FARMS | (2180, 980) | (1400, 1212) | border staging yard onto the southern farm lane |

Every destination sits inside a spawn zone that already accepts vehicles, so the jeep arrives
somewhere the sector actually has. Woodland's entry reproduces its original destination *and* its
original camera focus and summary text exactly, which is why the fingerprint is unmoved.

A sector that authors nothing still works: the mission derives a move across the map, clamped inside
bounds. That fallback is the reason the feature cannot break a future sector, not a shortcut.

## Validation

`validateReconMap()` now rejects a `changeDetection.destination` that is non-numeric or outside map
bounds, and the release validator additionally requires, per sector, that `jeep-01` exists and that
its authored destination is at least 200 units from its start — a change the analyst can actually
see. `npm run validate`: 2174 checks, 0 warnings.

## Tests

`sector-test.mjs` (54 checks, all passing):

- sector vocabulary — ANY first, every registered sector listed, unknown ids normalise to ANY
- same seed + same sector reproduces the mission, on all four sectors
- every sector generates a solvable LOCATE, COUNT and CHANGE
- ANY reproduces per seed, reaches every sector, and never draws an unregistered one
- naming the drawn sector yields the identical mission (the separate-stream property)
- an unknown `?map=` degrades to a registered sector rather than throwing
- authored missions carry the selected sector, and each CHANGE destination is in bounds, moves the
  subject, and has a sector-specific summary
- woodland's CHANGE destination and focus are unchanged
- `?map=`, `?seed=` and `?mode=` parse together and launch in the named sector

In-browser: the control cycles all five stops, persists across a reload, is overridden by `?map=`,
and launches RANDOM and all three mode cards into the selected sector — 15 sector/mode combinations
driven through to the briefing with no page errors.

## Not done

- No new sprites, no new map, no scoring or gameplay-rule changes.
- The generator is still one code path for all sectors; nothing is specialised per map.
