# Phase 15C — RIVERWORKS SECTOR

The third authored sector, and the one that stress-tests the schema: a map whose dominant feature is
terrain nothing can stand on.

## The sector

A fictional Cold War industrial river crossing. A canalised channel cuts the map corner to corner
from north-west to south-east; a trunk road crosses it on a two-span bridge at the centre.

| District | Bank | Built from |
| --- | --- | --- |
| Rail and warehouse district | East, north of the road | four parallel `rail` runs, three `warehouse`, `hangar`, `barracks`, fenced with a gate |
| Fenced fuel depot | East, downstream | `fuel_tanks`, `pipeline`, full `fence` perimeter, `gate`, `watchtower` |
| Primary crossing | Centre | two `bridge` spans, `road_straight` approaches on both abutments, `road_intersection` |
| Muddy secondary access road | West | `dirt_track` spurs through `mud`, down to the works |
| Civilian works village | West, south of the road | `farmhouse` as works office, `barn` as storage shed, `warehouse`, civilian trucks |
| Concealed military logistics | Rail yard | `missile_transporter` under a `camouflage_net` among ordinary `crates` and `barrels` |

`smoke` marks two working stacks — the first use of that frame in any sector. No new sprites, no
gameplay logic: the only code touched is the catalog entry and the registry's `MAP_DATA` line.

## The channel

The river is built from 60 rows of `water`, each offset from the last along a centreline that runs
(0, 300) to (1800, 1720), with a thin `rocky` revetment strip down both banks. Terrain areas are
axis-aligned rectangles, so a diagonal can only be a staircase — the design leans into that: an
industrial river is dredged and walled, and a revetted channel is *supposed* to look built.

The first draft used 60-unit rows. At a slope of ~0.79 that steps sideways 47 units per row, and on
screen it read as coarse sawtooth rather than as a wall. Halving the row depth to 30 halved the
tread and the channel now reads as a smooth revetted diagonal at play zoom.

## Nothing may stand in the river

A map with a large water feature has a failure mode the other two do not: the generator moves
entities into spawn zones, and a zone that overlaps the channel parks a truck mid-river. That is not
a hard puzzle, it is a broken one.

So the builder carries an author-time guard that reports any zone or entity intersecting the water,
and the first layout failed it loudly — **six of twelve spawn zones and one entity** were in the
channel, because a diagonal river makes the west bank a widening triangle and half the districts had
been placed as though the banks were vertical. Everything was relocated: the works village, laydown
yard and river plot moved south-west of the crossing, the depot moved downstream and east.

The test suite enforces the same rule three ways: no spawn zone overlaps the channel, no authored
entity sits in it, and **no generated placement lands in it** — 1,036 placements across 300 missions,
zero wet.

## Fairness

The brief asked for military targets visually mixed with believable civilian and industrial decoys,
so the sector does not segregate them:

- Military and civilian trucks share the crossing and the yards.
- The fuel truck stands beside civilian fuel storage — same fuel, different owner.
- The heavy transporter, the highest-value target on the map, sits under a camouflage net among
  ordinary crates and barrels in a working rail yard, not alone in a clearing.
- Six military vehicles, five civilian, three industrial structures.

## Mode viability

| | Result |
| --- | --- |
| LOCATE candidates | 9 |
| Decoy pool | 14 selectable entities with zones |
| COUNT | 2 `road_vehicle` zones, each accepting 4 military types present |
| CHANGE | 9 compatible entities; moved, appeared and disappeared all occur |

750 seeded missions (250 per mode) generate with zero fallbacks and all validate; free-mode over 300
seeds reaches all three modes (93 / 109 / 98); seeds reproduce, and the same seed gives a different
mission here than on woodland.

## Validation

`npm run validate` reports **1639 checks, 0 warnings**. Two rounds of bounds warnings were fixed
first: the southernmost river row and its revetment hung 4 units past the map edge, so each row's
depth is now clamped to what is left of the map.

Woodland is still untouched — its 303-mission fingerprint hashes to `5a3b3c6c…` as it has since
Phase 15A. All three sectors were played into the recon scene in all three modes with no page errors.
