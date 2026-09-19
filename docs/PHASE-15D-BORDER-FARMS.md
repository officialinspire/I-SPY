# Phase 15D — BORDER FARMS

The fourth authored sector, and the one defined by a negative: nothing on it is tall or dense enough
to block a sightline.

## The sector

A fictional Cold War agricultural borderland. A quilt of crop blocks divided by hedgerows and farm
lanes, a village farm compound in the south-west, a drainage ditch with a muddy ford across the
middle, and a fortified post along the eastern border fence.

| Feature | Where | Built from |
| --- | --- | --- |
| Crop fields | Twelve blocks, 50% of the sector | `field`, with one ploughed block in `dirt` and one pasture in `ground` |
| Hedgerows | Between the blocks | 37 `hedge` segments in east-west and north-south runs |
| Farm lanes | Along the field boundaries | `dirt_track`, meeting one metalled `road_straight` approach from the west |
| Village farm compound | South-west | `farmhouse`, `barn`, `warehouse`, `fence`, `gate`, farm fuel tanks, generator shed |
| Muddy crossing | Centre | a 46-unit `water` ditch with `mud` at the ford where the lane crosses |
| Hidden vehicle staging | East, behind the hangar | military trucks, APC and `camouflage_net` on a churned `dirt` pad |
| Border installation | Eastern fence line | `bunker`, `bunker_entrance`, two `watchtower`, `barracks`, radar and masts |

## Openness

The other three sectors are all enclosed in some way — woodland by canopy, frostline by ridges,
riverworks by industry. This one is defined by the absence of that, and the tests say so rather than
the prose:

- **50% of the sector is crop field**, the single dominant terrain.
- **Zero `forest_cluster`** anywhere: there is no closed canopy on the map. Trees are hedgerow
  standards, placed singly.
- Hedgerows divide, they do not enclose: 37 segments in lines, not masses.

Two blocks carry a different crop state — one ploughed, one pasture — so the quilt has tonal
variety and an analyst has something to navigate by. A first pass converted three blocks and dropped
field coverage to 44%, under the openness threshold; the third block went back to crop rather than
the threshold coming down.

## Military embedded in civilian infrastructure

The brief asked for military activity embedded subtly, so the sector does not segregate it:

- A **fuel truck stands in the farmyard beside the farm's own fuel tanks** — same silhouette family,
  different owner.
- A **towed artillery piece sits under a net in a hedgerow**, the same hedgerow line that runs the
  length of the fields.
- **Military and civilian trucks share three spawn zones** (`lane-main`, `lane-east`, `farmyard`),
  so vehicle class cannot be inferred from where a vehicle is standing.
- **Civilian objects outnumber military ones 10 to 6.** The farmland is not a backdrop for the
  military presence; the military presence is a minority of what is on the map.

## Nothing may stand in the ditch

The riverworks guard came with the builder, and it earned its place again: the first layout put
**three spawn zones and an entity in the drainage ditch**. All moved to its southern bank.

The generated-placement check needed sharpening for this sector, though. Entities never land in the
water — 0 of 729 entity placements across 300 missions — but roughly seven clue *decorations* per
300 missions do, because the generator scatters clue sprites within ±110/±90 of an anchor and the
ditch runs the width of the map between zones. Tyre tracks and disturbed soil at the bank of a
46-unit farm ditch are what a ford looks like, so the check now separates the two: **zero wet
entities, required**; clue decoration bounded at 2% and currently 0.7%.

## Mode viability

| | Result |
| --- | --- |
| LOCATE candidates | 9 |
| Decoy pool | 17 selectable entities with zones — the largest of the four sectors |
| COUNT | 2 `road_vehicle` lanes, each accepting 4 military types present |
| CHANGE | 9 compatible entities; moved, appeared and disappeared all occur |

750 seeded missions generate with zero fallbacks and all validate; free-mode over 300 seeds reaches
all three modes (100 / 102 / 98); seeds reproduce, and the same seed gives a different mission here
than on woodland.

## Validation

`npm run validate` reports **2160 checks, 0 warnings**. One bounds warning was fixed on the way: the
border fence is a north-south run, and at a 63.33-unit segment the rotated footprint of its first
post sat a third of a unit above the map edge. Squaring the segment to 64 makes the rotated box land
exactly on `y = top`.

Woodland is still untouched at fingerprint `5a3b3c6c…`, and the registry, frostline and riverworks
suites all still pass.
