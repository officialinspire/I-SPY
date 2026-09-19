# Phase 15B — FROSTLINE RELAY

The second authored sector, and the first real test of the Phase 15A registry: a map was added by
writing one JSON file, one catalog entry and one line of `MAP_DATA`. Nothing else in the game
needed to know, and WOODLAND CORRIDOR 7 is untouched — its 303-mission generator fingerprint still
hashes to `5a3b3c6c…`.

## The sector

A fictional Cold War alpine communications corridor: a snow valley pinched between two rocky
massifs, carrying a telegraph line and a service road that climbs west to east in three benches to a
relay station on the ridge.

| Landmark | Where | Built from |
| --- | --- | --- |
| Mountain road | Three benches at y 940 / 820 / 700, joined by graded dirt spurs | `road_straight`, `road_curve`, `road_intersection`, `dirt_track` |
| Radar ridge | Fenced shelf on the north-east massif | `radar_dish`, `antenna_array`, `radio_tower`, `sam_site`, `watchtower` |
| Frozen service compound | West of the valley, fenced, with a gate onto the road | `warehouse`, `barracks`, `hangar`, `fuel_tanks`, `pipeline` |
| Communications station | Ridge shelf beside the radar | `radio_tower`, `generator`, `antenna_array` |
| Bunker approach | South-east outcrop with a rail spur | `bunker`, `bunker_entrance`, `trench`, `rail` |
| Civilian maintenance area | Isolated in the south-west snowfield | `farmhouse`, `barn`, `tractor`, `civilian_truck` |

No new sprites. Every frame comes from the existing 80-frame library.

## Looking different from WOODLAND CORRIDOR 7

Woodland reads as a north-south river corridor: a mid-grey speckled floor split vertically by water
and rock, with dense forest clusters and one straight east-west highway. Frostline inverts that
grammar:

- **A high-key `snow` floor** instead of `ground`, so the whole sector is brighter and the
  four-tone sprites sit darker against it.
- **Banding is horizontal.** Two rocky massifs run east-west across the top and bottom with the
  valley between them, rather than a band running top to bottom.
- **The road climbs.** Three benches at different heights joined by graded spurs, instead of one
  straight run.
- **Sparse coniferous cover.** Scattered `conifer`, standing `dead_tree` and wind-thrown timber
  instead of closed `forest_cluster` canopy.
- **A telegraph line** of `pole` segments follows the corridor for its whole length — the feature
  that names the sector.

Two composition passes were needed. The first draft put a `water` tarn and a `bridge` in the valley:
on screen the tarn read as a hole punched in the snowfield and the bridge crossed nothing, so both
were cut. The same pass added **edge bumps** — small patches painted in the same sprite as the band
they sit against — so the massif and corridor boundaries fray instead of following a set square.

## Fairness

Targets and decoys share contexts, not just a palette:

- **Four strategic installations** share the ridge (radar, antenna array, relay mast, SAM site), so
  no single silhouette is the only tall structure and a LOCATE objective has to be read rather than
  guessed.
- **Six military vehicles** spread across road, compound and treeline zones, alongside **civilian
  decoys** — `civilian_truck` on the same corridor, `tractor` in the same open ground — so vehicle
  class cannot be inferred from where a vehicle is.
- Nothing is brighter, outlined or larger for being a target. The metadata target (`radar-01`) sits
  inside a fenced compound with three peers.

## Mode viability

Measured the way the generator measures it, not asserted:

| | Result |
| --- | --- |
| LOCATE candidates | 10 entities are selectable, in a target category and have a compatible zone |
| Decoy pool | 14 selectable entities with zones (generator draws up to 3) |
| COUNT | 3 `road_vehicle` zones, each accepting 4–5 military vehicle types present on the map |
| CHANGE | 10 compatible entities; moved, appeared and disappeared events all occur |

750 seeded missions (250 per mode) generate with **zero fallbacks** and every one passes
`validateGeneratedMission`. Free-mode generation over 300 seeds reaches all three modes
(114 / 88 / 98). Seeds are reproducible on this map, and the same seed produces a different mission
here than on woodland.

## Validation

`npm run validate` grew from 265 checks to 736 as the new sector went through the same schema, and
reports **0 warnings** — every coordinate, including the un-rotated footprint of every north-south
run, sits inside the map bounds. Entity ids are unique, every sprite name resolves, all eight
required layers and all eight required spawn-zone tags are present, and the metadata target
resolves to a real entity.

A first pass did warn twice: a seven-segment `rail` spur overran the eastern edge by 3 units. It is
six segments now.
