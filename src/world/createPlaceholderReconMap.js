import { RECON_ENTITIES } from './reconEntities.js';

function hashNoise(x, y) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function createPlaceholderReconMap(scene, width, height) {
  const root = scene.add.container(0, 0);
  const terrain = scene.add.graphics();
  const details = scene.add.graphics();
  const structures = scene.add.graphics();
  const objects = scene.add.graphics();
  root.add([terrain, details, structures, objects]);

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

  terrain.fillStyle(0xd9d9d2, 1).fillRect(230, 260, 560, 360);
  terrain.fillStyle(0xc8c8c0, 1).fillRect(1550, 1050, 610, 430);
  for (let x = 250; x < 770; x += 26) details.lineStyle(2, 0x757575, 0.5).lineBetween(x, 275, x, 600);
  for (let y = 1070; y < 1460; y += 25) details.lineStyle(2, 0x757575, 0.45).lineBetween(1570, y, 2140, y);

  details.lineStyle(72, 0x333333, 1).beginPath().moveTo(0, 980).lineTo(700, 900).lineTo(1260, 1010).lineTo(2400, 820).strokePath();
  details.lineStyle(46, 0xbdbdbd, 1).beginPath().moveTo(0, 980).lineTo(700, 900).lineTo(1260, 1010).lineTo(2400, 820).strokePath();
  details.lineStyle(22, 0x757575, 0.8).beginPath().moveTo(520, 900).lineTo(610, 500).lineTo(1120, 420).strokePath();
  details.lineStyle(22, 0x757575, 0.8).beginPath().moveTo(1630, 950).lineTo(1770, 1260).strokePath();

  details.lineStyle(112, 0x333333, 1).beginPath().moveTo(1040, 0).lineTo(1110, 380).lineTo(1010, 760).lineTo(1180, 1180).lineTo(1100, 1800).strokePath();
  details.lineStyle(74, 0x757575, 1).beginPath().moveTo(1040, 0).lineTo(1110, 380).lineTo(1010, 760).lineTo(1180, 1180).lineTo(1100, 1800).strokePath();
  structures.fillStyle(0xd9d9d2, 1).fillRect(1090, 930, 170, 82);
  structures.lineStyle(5, 0x333333, 1).strokeRect(1090, 930, 170, 82);

  drawBuilding(structures, 380, 350, 100, 70);
  drawBuilding(structures, 520, 390, 150, 92);
  drawBuilding(structures, 690, 455, 72, 60);

  structures.lineStyle(5, 0x333333, 0.9).strokeRect(1740, 280, 440, 330);
  for (let x = 1760; x < 2180; x += 40) structures.lineBetween(x, 280, x + 15, 300);
  drawBuilding(structures, 1810, 350, 145, 85);
  drawBuilding(structures, 2000, 405, 105, 145);

  structures.lineStyle(4, 0x333333, 0.9);
  for (let x = 180; x < 2300; x += 170) {
    const y = 760 + Math.sin(x * 0.01) * 40;
    structures.lineBetween(x, y - 12, x, y + 12);
    structures.lineBetween(x - 8, y - 7, x + 8, y - 7);
  }

  drawReconEntities(objects);

  structures.lineStyle(6, 0x171717, 1).strokeRect(3, 3, width - 6, height - 6);
  for (let x = 0; x <= width; x += 300) structures.lineBetween(x, 0, x, 18);
  for (let y = 0; y <= height; y += 300) structures.lineBetween(0, y, 18, y);

  return { root, entities: RECON_ENTITIES };
}

function drawBuilding(graphics, x, y, width, height) {
  graphics.fillStyle(0xe8e8df, 1).fillRect(x, y, width, height);
  graphics.lineStyle(4, 0x333333, 1).strokeRect(x, y, width, height);
  graphics.lineBetween(x, y, x + width, y + height);
}

function drawReconEntities(graphics) {
  RECON_ENTITIES.forEach((entity) => {
    const cx = entity.x + entity.width / 2;
    const cy = entity.y + entity.height / 2;
    graphics.lineStyle(3, 0x333333, 1);
    graphics.fillStyle(0xa7a7a0, 1);

    switch (entity.type) {
      case 'radar_structure':
        graphics.fillCircle(cx, cy, 38);
        graphics.lineStyle(5, 0x333333, 1).strokeCircle(cx, cy, 38);
        graphics.lineBetween(cx - 26, cy + 16, cx + 24, cy - 20);
        graphics.lineBetween(cx, cy + 36, cx, cy + 50);
        break;
      case 'fuel_storage':
        for (let i = 0; i < 3; i += 1) {
          graphics.fillCircle(entity.x + 22 + i * 38, cy, 18);
          graphics.strokeCircle(entity.x + 22 + i * 38, cy, 18);
        }
        break;
      case 'tank':
        graphics.fillRect(entity.x + 6, entity.y + 8, entity.width - 12, entity.height - 16);
        graphics.strokeRect(entity.x, entity.y + 4, entity.width, entity.height - 8);
        graphics.fillCircle(cx, cy, 12);
        graphics.lineBetween(cx + 8, cy, entity.x + entity.width + 14, cy - 4);
        break;
      case 'military_truck':
      case 'civilian_truck':
        graphics.fillRect(entity.x + 4, entity.y + 5, entity.width - 8, entity.height - 10);
        graphics.fillStyle(0x333333, 1).fillCircle(entity.x + 16, entity.y + entity.height, 7).fillCircle(entity.x + entity.width - 16, entity.y + entity.height, 7);
        if (entity.type === 'military_truck') graphics.lineBetween(entity.x + 42, entity.y + 6, entity.x + 42, entity.y + entity.height - 6);
        break;
      case 'tractor':
        graphics.fillRect(entity.x + 12, entity.y + 8, entity.width - 22, entity.height - 14);
        graphics.fillStyle(0x333333, 1).fillCircle(entity.x + 14, entity.y + entity.height - 2, 11).fillCircle(entity.x + entity.width - 10, entity.y + entity.height - 3, 7);
        break;
      default:
        break;
    }
  });
}
