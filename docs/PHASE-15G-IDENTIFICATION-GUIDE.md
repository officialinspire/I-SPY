# Phase 15G — IDENTIFICATION GUIDE

A recognition manual for every object class the imagery can show, built from the production sprite
sheets themselves.

## Where it sits

`IDENTIFICATION GUIDE` joins ANALYST TRAINING, HOW TO PLAY and SETTINGS in the Main Menu's SYSTEM row.
Four separate offers, none standing in for another: training walks the console, the manual names what
is on the ground, the field guide is a page to read, settings is settings.

SYSTEM now chooses its column count from the *label* rather than from a viewport breakpoint. The
longest label — `IDENTIFICATION GUIDE` — is measured against the width each arrangement would give a
button at the current density tier, and the widest arrangement that still fits wins: four across on a
desktop, two by two on a tablet, one per row on a phone. The first attempt used fixed width
thresholds and put a short landscape window into two tall rows it had no height for; measuring the
label fixed that.

## The manual

`src/game/identificationGuide.js` is data only — five categories, thirty-seven entries, each naming a
frame that actually ships:

| Category | Entries |
| --- | --- |
| MILITARY VEHICLES | tank, apc, military_truck, fuel_truck, jeep, radar_vehicle, missile_transporter, artillery |
| INSTALLATIONS | radar_dish, antenna_array, radio_tower, watchtower, fuel_tanks, bunker_entrance, generator, sam_site |
| CIVILIAN / DECOYS | tractor, civilian_truck, hay_bale, dummy_tank, abandoned_equipment |
| RECON CLUES | tire_tracks, track_marks, footprints, disturbed_soil, cut_vegetation, smoke, crates, barrels, camouflage_net |
| INFRASTRUCTURE | bridge, farmhouse, barn, warehouse, barracks, bunker, hangar |

Every note describes **this game's drawing** of the thing — silhouette, tone, and the context it
usually sits in:

> **TANK** — Tracked armoured silhouette. Look for a compact hull, a turret ring and a gun barrel
> projecting past the front edge.

> **DUMMY TANK** — Reads as a tank at a glance, but the outline is too clean: no track texture, and
> the hull casts no shadow.

Nothing in the manual is a real-world specification and nothing is advice on what to do about an
object. The rule is enforced, not just intended: `validateIdentificationGuide()` rejects any note
carrying a figure, on the grounds that a figure is the shape a specification would take.

The manual is also mission-blind. No entry says where an object appears, which sector carries it, or
what a tasking will ask for, so reading it cannot spoil a mission.

## Guide UI

- **Category tabs** — five across, short titles (`VEHICLES`, `SITES`, `CIVILIAN`, `CLUES`,
  `STRUCTURES`) when the full ones will not fit, folding to two rows rather than clipping when even
  those would be squeezed below a readable size.
- **Sprite grid** — the real frames, at the largest cell that fits the space available. The column
  count is chosen by trying each and keeping the one that yields the biggest cell, then clamped to a
  comfortable range; names appear under the sprites once the cell is big enough to carry them.
- **Detail panel** — enlarged preview, display name, category, and the recognition note. It keeps its
  place rather than opening as a modal, so a phone shows the grid and the detail at once.

Two columns when the window can carry a readable note beside the grid *and* is not portrait — a tall
tablet has height to spend and would otherwise float the pair in the middle of an empty screen — and
stacked otherwise. A short landscape window switches to two columns sooner, because stacking there
leaves neither half usable. In a short panel
the note moves beside the preview, the preview shrinks to leave a readable text column, and the note
steps down a font size until it stops running past the panel it is printed in.

The grid scrolls — wheel, drag, and a proportional indicator — only when a comfortable cell will not
fit, which on the shipped categories means windows narrower than about 340px. Below that the tabs
also fold to two rows and the title is fitted to the content width, so a 300x360 window degrades
rather than clipping; it is well under any real device, and everything on it stays reachable. Cells scrolled out of
the box are hidden as well as masked, so nothing off-screen stays clickable.

**Keyboard:** Tab and Shift+Tab walk tabs → cells → RETURN TO CONSOLE, arrows move within that order,
Enter opens the focused entry, and Escape returns to the console. Focus also previews the entry, so
walking the grid reads the manual without pressing anything.

## Validation

`validateIdentificationGuide()` enforces the manual's own rules, and the release validator runs the
same ones:

- every entry names a frame the sprite sheets register;
- no frame appears twice, so the grid never repeats an image;
- every note is one or two sentences;
- no note carries a figure.

`guide-test.mjs` (24 checks, all passing) goes further than the shipped rules: it asserts each
category holds exactly the classes it was asked for and nothing else, that no console chrome frame is
listed as a recognisable object, that no note reads as a specification or an instruction, and that no
entry names a sector, a mission or a mode.

`npm run validate`: 2695 checks, 0 warnings. `npm run build`: clean.

## Two bugs this found

**Ghost cells.** All thirty-seven cells are built once and shown a category at a time. Switching tabs
hid the previous category's *buttons* but not their sprites or captions, so INSTALLATIONS kept drawing
under RECON CLUES. Cells are now put away as a whole — button, frame and caption — in the one place
that positions them.

**The field guide ran off the bottom of a small phone.** HOW TO PLAY has gained a line for every
console feature since Phase 13, and its panel clamps to the viewport while its text did not, so at
300px wide the page overflowed the panel. The body now steps down a size until the page fits.

## Not done

- No new sprites: the manual shows the frames that already ship.
- No gameplay, scoring or generator changes. The 303-mission seeded fingerprint is unchanged.
- The manual has no search or filter; with thirty-seven entries across five tabs, it would be
  furniture rather than help.
