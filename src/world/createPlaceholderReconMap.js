import { GAME_CONFIG } from '../runtime-config.js';

function hashNoise(x, y) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function createPlaceholderReconMap(scene, width, height) {
  const root = scene.add.container(0, 0);
  const terrain = scene.add.graphics();
  const details = scene.add.graphics();
  const structures = scene.add.graphics();
  root.add([terrain, details, structures]);

  terrain.fillStyle(0xbdbdbd, 1).fillRect(0, 0, width, height);

  const tile = 80;
  for (let y = 0; y < height; y += tile) {
    for (let x = 0; x < width; x += tile) {
      const n = hashNoise(x / tile, y / tile);
      const shade = n > 0.66 ? 0x757575 : n > 0.35 ? 0x999999 : 0xb0b0b0;
      terrain.fillStyle(shade, 0.72).fillRect(x, y, tile, tile);
      if (n > 0.58) {
        details.fillStyle(0x333333, 0.78);
        for (let i = 0; i < 4; i += 1) {
          const px = x + 14 + ((i * 23 + y) % 58);
          const py = y + 12 + ((i * 29 + x) % 58);
          details.fillCircle(px, py, 8 + (i % 2) * 4);
        }
      }
    }
  }

  // Agricultural clearings.
  terrain.fillStyle(0xd9d9d2, 1).fillRect(230, 260, 560, 360);
  terrain.fillStyle(0xc8c8c0, 1).fillRect(1550, 1050, 610, 430);
  for (let x = 250; x < 770; x += 26) details.lineStyle(2, 0x757575, 0.5).lineBetween(x, 275, x, 600);
  for (let y = 1070; y < 1460; y += 25) details.lineStyle(2, 0x757575, 0.45).lineBetween(1570, y, 2140, y);

  // Paved road and dirt tracks.
  details.lineStyle(72, 0x333333, 1).beginPath().moveTo(0, 980).lineTo(700, 900).lineTo(1260, 1010).lineTo(2400, 820).strokePath();
  details.lineStyle(46, 0xbdbdbd, 1).beginPath().moveTo(0, 980).lineTo(700, 900).lineTo(1260, 1010).lineTo(2400, 820).strokePath();
  details.lineStyle(22, 0x757575, 0.8).beginPath().moveTo(520, 900).lineTo(610, 500).lineTo(1120, 420).strokePath();
  details.lineStyle(22, 0x757575, 0.8).beginPath().moveTo(1630, 950).lineTo(1770, 1260).strokePath();

  // River / stream with simple bridge crossing.
  details.lineStyle(112, 0x333333, 1).beginPath().moveTo(1040, 0).lineTo(1110, 380).lineTo(1010, 760).lineTo(1180, 1180).lineTo(1100, 1800).strokePath();
  details.lineStyle(74, 0x757575, 1).beginPath().moveTo(1040, 0).lineTo(1110, 380).lineTo(1010, 760).lineTo(1180, 1180).lineTo(1100, 1800).strokePath();
  structures.fillStyle(0xd9d9d2, 1).fillRect(1090, 930, 170, 82);
  structures.lineStyle(5, 0x333333, 1).strokeRect(1090, 930, 170, 82);

  // Farm cluster.
  drawBuilding(structures, 380, 350, 100, 70);
  drawBuilding(structures, 520, 390, 150, 92);
  drawBuilding(structures, 690, 455, 72, 60);

  // Remote fenced installation.
  structures.lineStyle(5, 0x333333, 0.9).strokeRect(1740, 280, 440, 330);
  for (let x = 1760; x < 2180; x += 40) structures.lineBetween(x, 280, x + 15, 300);
  drawBuilding(structures, 1810, 350, 145, 85);
  drawBuilding(structures, 2000, 405, 105, 145);
  structures.lineStyle(7, 0x333333, 1).strokeCircle(2080, 340, 44);
  structures.lineBetween(2080, 296, 2115, 250);

  // Utility poles.
  structures.lineStyle(4, 0x333333, 0.9);
  for (let x = 180; x < 2300; x += 170) {
    const y = 760 + Math.sin(x * 0.01) * 40;
    structures.lineBetween(x, y - 12, x, y + 12);
    structures.lineBetween(x - 8, y - 7, x + 8, y - 7);
  }

  // Border and coordinate ticks.
  structures.lineStyle(6, 0x171717, 1).strokeRect(3, 3, width - 6, height - 6);
  for (let x = 0; x <= width; x += 300) structures.lineBetween(x, 0, x, 18);
  for (let y = 0; y <= height; y += 300) structures.lineBetween(0, y, 18, y);

  return root;
}

function drawBuilding(graphics, x, y, width, height) {
  graphics.fillStyle(0xe8e8df, 1).fillRect(x, y, width, height);
  graphics.lineStyle(4, 0x333333, 1).strokeRect(x, y, width, height);
  graphics.lineBetween(x, y, x + width, y + height);
}
