# I SPY art direction

## North star

I SPY should look like a fictional Cold War satellite-reconnaissance workstation interpreted through a late-1980s monochrome handheld game. The player is an imagery analyst, not an action-game pilot, so the art rewards observation rather than highlighting answers.

## Hard palette

Authored reconnaissance sprites use exactly four tones:

- `#0B0B0B` — black / deepest silhouette
- `#333333` — charcoal / primary mass
- `#BDBDBD` — light gray / secondary plane
- `#F6F6EE` — off-white / highlight

Runtime UI may continue using the project's near-black and middle gray, but sprite-sheet artwork stays four-tone.

## Shape language

- top-down or near-top-down reconnaissance viewpoint
- chunky geometric forms and crisp edges
- no painterly anti-aliasing or gradients
- minimal perspective and restrained internal detail
- silhouettes, spatial context and clue patterns do most of the recognition work
- subtle dithering/noise is acceptable when it does not hide gameplay information
- no glow, neon, color-coded targets or glossy modern UI

## Fairness rule

Targets must not be brighter, cleaner or more detailed than civilian decoys. A tank, radar site or military truck should sit naturally among roads, farm equipment, structures and vegetation. Difficult targets can be supported by indirect clues such as tire tracks, disturbed soil, cut vegetation, smoke, crates or camouflage netting.

## Cold War flavor

Preferred reference language is fictional and generic: satellite-film contact sheets, reconnaissance-map symbology, 1960s–1980s field intelligence displays, monochrome CRT terminals, early portable computers and Game Boy-era pixel art. Avoid copying real classified imagery, real facility layouts or distinctive current operational sites.

## Production constraints

Every production sheet is transparent, built on a deterministic 64×64 frame grid and contains no labels inside frame boundaries. That keeps the artwork usable in Phaser, Tiled-style map data and future automated build tooling.
