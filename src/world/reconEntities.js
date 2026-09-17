export const RECON_ENTITIES = Object.freeze([
  { id: 'mil-truck-01', type: 'military_truck', label: 'MILITARY TRUCK', category: 'military_vehicle', target: false, selectable: true, x: 1450, y: 880, width: 74, height: 34, difficulty: 1, clueTags: ['road', 'convoy'] },
  { id: 'tank-01', type: 'tank', label: 'TANK', category: 'military_vehicle', target: false, selectable: true, x: 1910, y: 690, width: 72, height: 46, difficulty: 2, clueTags: ['tracked', 'tree-line'] },
  { id: 'farmhouse-01', type: 'farmhouse', label: 'FARMHOUSE', category: 'civilian_structure', target: false, selectable: true, x: 380, y: 350, width: 100, height: 70, difficulty: 1, clueTags: ['farm'] },
  { id: 'civil-truck-01', type: 'civilian_truck', label: 'CIVILIAN TRUCK', category: 'civilian_vehicle', target: false, selectable: true, x: 625, y: 850, width: 64, height: 30, difficulty: 2, clueTags: ['road', 'decoy'] },
  { id: 'radar-01', type: 'radar_structure', label: 'RADAR INSTALLATION', category: 'strategic_installation', target: true, selectable: true, x: 2040, y: 292, width: 104, height: 104, difficulty: 2, clueTags: ['fenced-compound', 'antenna', 'power'] },
  { id: 'barn-01', type: 'barn', label: 'BARN', category: 'civilian_structure', target: false, selectable: true, x: 520, y: 390, width: 150, height: 92, difficulty: 1, clueTags: ['farm'] },
  { id: 'fuel-tanks-01', type: 'fuel_storage', label: 'FUEL STORAGE TANKS', category: 'industrial_structure', target: false, selectable: true, x: 1840, y: 500, width: 120, height: 64, difficulty: 2, clueTags: ['compound', 'storage'] },
  { id: 'tractor-01', type: 'tractor', label: 'TRACTOR', category: 'civilian_vehicle', target: false, selectable: true, x: 710, y: 530, width: 58, height: 34, difficulty: 2, clueTags: ['field', 'decoy'] },
]);

export function entityAtPoint(x, y, entities = RECON_ENTITIES) {
  return entities.find((entity) => (
    x >= entity.x && x <= entity.x + entity.width &&
    y >= entity.y && y <= entity.y + entity.height
  )) ?? null;
}
