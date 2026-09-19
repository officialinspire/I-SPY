import { findSprite } from '../assets/spriteManifest.js';

/**
 * The recognition manual.
 *
 * Every entry names a frame that actually ships in the production sprite
 * sheets, and each note describes *this game's drawing* of the thing — its
 * silhouette, tone and the context it usually sits in. Nothing here is a
 * real-world specification and nothing here is advice on what to do about an
 * object; the manual exists so an analyst can tell one shape from another.
 *
 * It is also deliberately mission-blind. No entry says where an object
 * appears, which sector carries it or what any tasking will ask for, so
 * reading the manual can never spoil a mission.
 */

const entry = (sprite, name, note) => Object.freeze({ sprite, name, note });

export const GUIDE_CATEGORIES = Object.freeze([
  Object.freeze({
    id: 'military-vehicles',
    title: 'MILITARY VEHICLES',
    shortTitle: 'VEHICLES',
    summary: 'Military road and field vehicles, drawn in the same four tones as everything around them.',
    entries: Object.freeze([
      entry('tank', 'TANK', 'Tracked armoured silhouette. Look for a compact hull, a turret ring and a gun barrel projecting past the front edge.'),
      entry('apc', 'ARMOURED PERSONNEL CARRIER', 'A blunter tracked hull with no projecting barrel. Flatter and squarer on top than a tank.'),
      entry('military_truck', 'MILITARY TRUCK', 'A short cab with a long ribbed load bed behind it. The ribbing across the bed is the giveaway.'),
      entry('fuel_truck', 'FUEL TRUCK', 'A smooth cylinder sits where a load bed would be, so the outline is rounded rather than ribbed.'),
      entry('jeep', 'UTILITY JEEP', 'The smallest military shape on the sheet: a short open body with four wheels and no load bed.'),
      entry('radar_vehicle', 'RADAR VEHICLE', 'A truck chassis carrying a dish or panel. Something curved breaks the roofline of an otherwise plain rectangle.'),
      entry('missile_transporter', 'MISSILE TRANSPORTER', 'The longest vehicle drawn. A low multi-axle trailer carries one covered cylinder along its whole length.'),
      entry('artillery', 'TOWED ARTILLERY PIECE', 'Towed rather than driven: a short body with splayed trail legs behind it and a thin barrel line in front.'),
    ]),
  }),
  Object.freeze({
    id: 'installations',
    title: 'INSTALLATIONS',
    shortTitle: 'SITES',
    summary: 'Fixed equipment and emplacements. Regular geometry where the terrain around it is irregular.',
    entries: Object.freeze([
      entry('radar_dish', 'RADAR DISH', 'A circle seen from directly above, bright at the rim and darker towards the centre, usually standing on cleared ground.'),
      entry('antenna_array', 'ANTENNA ARRAY', 'A rectangular frame of parallel elements. It reads as a ladder of even stripes rather than a solid shape.'),
      entry('radio_tower', 'RADIO TOWER', 'A slim mast with guy lines running out from it. The lines cover more ground than the mast itself.'),
      entry('watchtower', 'WATCHTOWER', 'A small square platform raised on legs, with a bright roof plate and a hard shadow directly beneath it.'),
      entry('fuel_tanks', 'FUEL TANKS', 'Circles of matching size grouped together, each with a bright rim and a flat top.'),
      entry('bunker_entrance', 'BUNKER ENTRANCE', 'A dark opening set into a bank of earth, with a short approach cut leading up to it.'),
      entry('generator', 'GENERATOR', 'A small boxed unit with a ribbed face, usually set beside the larger structure it serves.'),
      entry('sam_site', 'AIR DEFENCE SITE', 'A cleared circular pad with emplacements spaced evenly around its edge. The regularity of the spacing is the clue.'),
    ]),
  }),
  Object.freeze({
    id: 'civilian-decoys',
    title: 'CIVILIAN / DECOYS',
    shortTitle: 'CIVILIAN',
    summary: 'Working countryside and deliberate imitations. These share the sheet and the palette with military shapes.',
    entries: Object.freeze([
      entry('tractor', 'TRACTOR', 'A small civilian body with large rear wheels and much smaller front ones, so the outline is lopsided.'),
      entry('civilian_truck', 'CIVILIAN TRUCK', 'Close in size to a military truck, but the bed is plain and lighter in tone with no canopy ribbing.'),
      entry('hay_bale', 'HAY BALE', 'A small bright block, almost always in rows or clusters on open field rather than alone.'),
      entry('dummy_tank', 'DUMMY TANK', 'Reads as a tank at a glance, but the outline is too clean: no track texture, and the hull casts no shadow.'),
      entry('abandoned_equipment', 'ABANDONED EQUIPMENT', 'A broken outline with no symmetry. Parts lie at angles that no working machine would hold.'),
    ]),
  }),
  Object.freeze({
    id: 'recon-clues',
    title: 'RECON CLUES',
    shortTitle: 'CLUES',
    summary: 'Marks left on the ground. They describe what passed, not what is there now.',
    entries: Object.freeze([
      entry('tire_tracks', 'TYRE TRACKS', 'A pair of thin parallel lines at a fixed spacing, curving together where a vehicle turned.'),
      entry('track_marks', 'TRACK MARKS', 'Broader bands than tyre tracks, cross-hatched along their length by tracked running gear.'),
      entry('footprints', 'FOOTPRINTS', 'A short scattered trail of small marks, uneven in spacing and never quite straight.'),
      entry('disturbed_soil', 'DISTURBED SOIL', 'A patch in a different tone from the ground around it, with a ragged edge where the surface was broken.'),
      entry('cut_vegetation', 'CUT VEGETATION', 'A cleared patch meeting standing growth along a straight edge. The straightness is what to notice.'),
      entry('smoke', 'SMOKE', 'A soft plume with no hard outline, thinning as it drifts away from its source.'),
      entry('crates', 'CRATES', 'Small bright rectangles stacked on a regular grid, with hard shadows in the gaps between them.'),
      entry('barrels', 'BARRELS', 'Small circles in clusters, each with a bright rim: the round counterpart to crates.'),
      entry('camouflage_net', 'CAMOUFLAGE NET', 'A mottled sheet with a soft, irregular edge, draped over something whose outline still shows through it.'),
    ]),
  }),
  Object.freeze({
    id: 'infrastructure',
    title: 'INFRASTRUCTURE',
    shortTitle: 'STRUCTURES',
    summary: 'Buildings and crossings. They anchor a sector and give everything else a scale to be read against.',
    entries: Object.freeze([
      entry('bridge', 'BRIDGE', 'A short deck carried over water, with the road line picking up again on both banks.'),
      entry('farmhouse', 'FARMHOUSE', 'A small dwelling with a pitched roof ridge down the middle, usually facing a yard or a track.'),
      entry('barn', 'BARN', 'Larger than a farmhouse, with a long unbroken roof and wide doors at one end.'),
      entry('warehouse', 'WAREHOUSE', 'A large flat-roofed rectangle with evenly spaced bays along the roofline.'),
      entry('barracks', 'BARRACKS', 'A long narrow block with a repeating pattern of openings running the length of both sides.'),
      entry('bunker', 'BUNKER', 'A low thick-walled block with rounded corners, darker in tone than the buildings near it.'),
      entry('hangar', 'HANGAR', 'A wide curved roof with a large opening at one end, tall enough to read as shelter for vehicles.'),
    ]),
  }),
]);

export function listGuideCategories() {
  return GUIDE_CATEGORIES;
}

export function getGuideCategory(id) {
  return GUIDE_CATEGORIES.find((category) => category.id === id) ?? GUIDE_CATEGORIES[0];
}

/** Every entry in the manual, in reading order, tagged with its category. */
export function listGuideEntries() {
  return GUIDE_CATEGORIES.flatMap((category) => category.entries.map((item) => ({ ...item, categoryId: category.id, categoryTitle: category.title })));
}

/** Sentences are counted the way a reader counts them: by terminators. */
function countSentences(note) {
  return (String(note).match(/[.!?](\s|$)/g) ?? []).length;
}

/**
 * The manual's own rules, checked here so the release validator and the game
 * enforce the same ones:
 *
 * - every entry names a frame the sprite sheets actually register;
 * - no frame is shown twice, so the grid never repeats an image;
 * - every note is one or two sentences about the drawing;
 * - no note carries a figure, which is the shape a specification would take.
 */
export function validateIdentificationGuide() {
  const errors = [];
  const seen = new Map();

  if (!GUIDE_CATEGORIES.length) errors.push('The identification guide has no categories.');

  for (const category of GUIDE_CATEGORIES) {
    if (!category.id || !category.title || !category.shortTitle) errors.push(`Category '${category.id ?? 'unknown'}' needs an id, a title and a short title.`);
    if (!category.entries?.length) errors.push(`Category '${category.id}' has no entries.`);
    for (const item of category.entries ?? []) {
      if (!item.sprite) { errors.push(`An entry in '${category.id}' has no sprite.`); continue; }
      if (!findSprite(item.sprite)) errors.push(`Entry '${item.sprite}' in '${category.id}' is not a registered sprite frame.`);
      if (seen.has(item.sprite)) errors.push(`Sprite '${item.sprite}' appears in both '${seen.get(item.sprite)}' and '${category.id}'.`);
      else seen.set(item.sprite, category.id);
      if (!item.name) errors.push(`Entry '${item.sprite}' has no display name.`);
      const sentences = countSentences(item.note);
      if (!item.note || sentences < 1 || sentences > 2) errors.push(`Entry '${item.sprite}' needs a one or two sentence recognition note (found ${sentences}).`);
      if (/\d/.test(item.note ?? '')) errors.push(`Entry '${item.sprite}' carries a figure in its note; the manual describes shapes, not specifications.`);
    }
  }

  return { valid: errors.length === 0, errors, entryCount: seen.size };
}
