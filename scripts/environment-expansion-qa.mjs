/**
 * Phase 18A/18B environment + urban content QA.
 *
 * Protects the additive sprite contract and proves GREYWALL DISTRICT works
 * through the same authored and procedural mission paths as every other sector.
 */
import {
  LEGACY_SPRITE_FRAME_COUNT,
  LEGACY_SPRITE_SHEET_KEYS,
  SPRITE_SHEETS,
  findSprite,
} from '../src/assets/spriteManifest.js';
import { createLocateMission, validateIdentification } from '../src/game/locateMission.js';
import { createCountMission, validateCountAnswer } from '../src/game/countMission.js';
import { createChangeDetectionMission, validateChangeIdentification } from '../src/game/changeDetectionMission.js';
import {
  MIN_CHANGE_MOVE,
  createGeneratedMission,
  simulateEntities,
  validateGeneratedMission,
} from '../src/game/missionGenerator.js';
import {
  countEntitiesInRegion,
  findSelectableOverlaps,
  getCountRegion,
  getMapEntities,
  validateReconMap,
} from '../src/world/reconMapSchema.js';
import { getReconMapEntry, listReconMaps, resolveReconMap } from '../src/world/mapRegistry.js';

const errors=[];
let checks=0;
const assert=(condition,message)=>{checks+=1;if(!condition)errors.push(message);};

const legacyNames=LEGACY_SPRITE_SHEET_KEYS.flatMap((key)=>SPRITE_SHEETS[key].names);
assert(legacyNames.length===LEGACY_SPRITE_FRAME_COUNT,
  `legacy sprite contract remains ${LEGACY_SPRITE_FRAME_COUNT} frames`);

const supplemental=SPRITE_SHEETS.environmentSupplemental;
const requiredUrban=[
  'urban_pavement','urban_sidewalk','urban_alley','urban_rubble',
  'apartment_block','admin_block','garage_workshop','dense_warehouse',
  'damaged_building','concrete_barrier','streetlight','utility_pole',
];
const requiredDesert=[
  'desert_sand','desert_rocky','desert_dune','desert_wadi',
  'dry_scrub','dead_shrub','rock_outcrop','desert_road',
  'desert_checkpoint','desert_shelter','desert_fuel_site','desert_ruin',
];
assert(supplemental.names.length===24,'supplemental sprite sheet contains 24 additive frames');
[...requiredUrban,...requiredDesert].forEach((name)=>{
  assert(Boolean(findSprite(name)),`supplemental frame resolves: ${name}`);
});

const entry=getReconMapEntry('greywall-district');
assert(Boolean(entry) && !entry.training,'GREYWALL DISTRICT is a playable registered sector');
assert(listReconMaps().some((item)=>item.id==='greywall-district'),'urban sector appears in playable sector list');

const map=resolveReconMap('greywall-district');
const schema=validateReconMap(map);
assert(schema.valid,`urban map passes schema: ${schema.errors.join(' ')}`);

const usedSprites=(map.layers??[]).flatMap((layer)=>{
  if(layer.type==='areas') return (layer.areas??[]).map((item)=>item.sprite);
  return (layer.items??[]).map((item)=>item.sprite);
}).filter(Boolean);
const urbanSupplementalUsed=new Set(usedSprites.filter((name)=>requiredUrban.includes(name)));
assert(urbanSupplementalUsed.size>=8,
  `urban map uses a meaningful portion of supplemental art (${urbanSupplementalUsed.size}/12)`);

const entities=getMapEntities(map);
assert(findSelectableOverlaps(entities).length===0,'urban authored selectable objects do not materially overlap');

const locate=createLocateMission('greywall-district');
const locateTarget=entities.find((item)=>item.id===locate.targetId);
assert(locate.mapId==='greywall-district' && Boolean(locateTarget),'urban authored LOCATE target resolves');
assert(validateIdentification(locate,locateTarget).correct,'urban authored LOCATE target validates');

const count=createCountMission('greywall-district');
const region=getCountRegion(map);
const authoredCount=countEntitiesInRegion(entities,region,'military_vehicle');
assert(authoredCount>=2 && count.expectedCount===authoredCount,'urban authored COUNT has a valid tally >=2');
assert(validateCountAnswer(count,authoredCount).correct,'urban authored COUNT answer validates');

const change=createChangeDetectionMission('greywall-district');
const passB=simulateEntities(map,change.passBOperations);
const targetA=entities.find((item)=>item.id===change.targetId);
const targetB=passB.find((item)=>item.id===change.targetId);
const move=targetA&&targetB?Math.hypot(targetA.x-targetB.x,targetA.y-targetB.y):0;
assert(move>=MIN_CHANGE_MOVE,`urban authored CHANGE is visibly separated (${Math.round(move)})`);
assert(validateChangeIdentification(change,targetB,'B').correct,'urban authored CHANGE target validates');

for(const mode of ['LOCATE','COUNT','CHANGE']){
  for(let i=0;i<36;i+=1){
    const seed=`QA-18B-${mode}-${String(i).padStart(2,'0')}`;
    const mission=createGeneratedMission({seed,mode,map:'greywall-district'});
    const validation=validateGeneratedMission(mission,'greywall-district');
    assert(validation.valid,`${mode}/${seed} validates: ${validation.errors.join(' ')}`);
    assert(mission.generated===true,`${mode}/${seed} uses procedural generation rather than fallback`);
    assert(mission.mapId==='greywall-district',`${mode}/${seed} remains in GREYWALL DISTRICT`);
  }
}

if(errors.length){
  console.error(`I SPY Phase 18A/18B QA FAILED (${errors.length}):`);
  errors.slice(0,30).forEach((message)=>console.error(`  - ${message}`));
  if(errors.length>30)console.error(`  ...and ${errors.length-30} more`);
  process.exit(1);
}

console.log(`I SPY Phase 18A/18B QA passed: ${checks} checks.`);
console.log(`GREYWALL DISTRICT supplemental urban frames used: ${[...urbanSupplementalUsed].join(', ')}`);
