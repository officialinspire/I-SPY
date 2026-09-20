/**
 * Phase 18 environmental expansion QA.
 * Covers additive art, GREYWALL, DUSTLINE, and deterministic weather.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEGACY_SPRITE_FRAME_COUNT,
  LEGACY_SPRITE_SHEET_KEYS,
  SPRITE_SHEETS,
  findSprite,
} from '../src/assets/spriteManifest.js';
import {
  ENVIRONMENT_CONDITIONS,
  conditionsForSector,
  isConditionAllowed,
  resolveMissionCondition,
} from '../src/game/environmentConditions.js';
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

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(relative)=>fs.readFileSync(path.join(root,relative),'utf8');
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

function auditSector(id,label,requiredSprites,seedPrefix){
  const entry=getReconMapEntry(id);
  assert(Boolean(entry)&&!entry.training,`${label} is a playable registered sector`);
  assert(listReconMaps().some((item)=>item.id===id),`${label} appears in playable sector list`);

  const map=resolveReconMap(id);
  const schema=validateReconMap(map);
  assert(schema.valid,`${label} passes schema: ${schema.errors.join(' ')}`);

  const usedSprites=(map.layers??[]).flatMap((layer)=>{
    if(layer.type==='areas')return(layer.areas??[]).map((item)=>item.sprite);
    return(layer.items??[]).map((item)=>item.sprite);
  }).filter(Boolean);
  const supplementalUsed=new Set(usedSprites.filter((name)=>requiredSprites.includes(name)));
  assert(supplementalUsed.size>=8,`${label} uses substantial supplemental art (${supplementalUsed.size}/12)`);

  const entities=getMapEntities(map);
  assert(findSelectableOverlaps(entities).length===0,`${label} authored selectable objects do not materially overlap`);

  const locate=createLocateMission(id);
  const locateTarget=entities.find((item)=>item.id===locate.targetId);
  assert(Boolean(locateTarget)&&validateIdentification(locate,locateTarget).correct,`${label} authored LOCATE validates`);

  const count=createCountMission(id);
  const region=getCountRegion(map);
  const tally=countEntitiesInRegion(entities,region,'military_vehicle');
  assert(tally>=2&&count.expectedCount===tally,`${label} authored COUNT tally is valid >=2`);
  assert(validateCountAnswer(count,tally).correct,`${label} authored COUNT answer validates`);

  const change=createChangeDetectionMission(id);
  const passB=simulateEntities(map,change.passBOperations);
  const a=entities.find((item)=>item.id===change.targetId);
  const b=passB.find((item)=>item.id===change.targetId);
  const move=a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;
  assert(move>=MIN_CHANGE_MOVE,`${label} authored CHANGE is visibly separated (${Math.round(move)})`);
  assert(validateChangeIdentification(change,b,'B').correct,`${label} authored CHANGE validates`);

  for(const mode of ['LOCATE','COUNT','CHANGE']){
    for(let i=0;i<36;i+=1){
      const seed=`${seedPrefix}-${mode}-${String(i).padStart(2,'0')}`;
      const mission=createGeneratedMission({seed,mode,map:id});
      const validation=validateGeneratedMission(mission,id);
      assert(validation.valid,`${label} ${mode}/${seed} validates: ${validation.errors.join(' ')}`);
      assert(mission.generated===true,`${label} ${mode}/${seed} stays procedural`);
      assert(mission.mapId===id,`${label} ${mode}/${seed} stays in-sector`);
      assert(isConditionAllowed(id,mission.condition),`${label} ${mode}/${seed} condition is sector-compatible`);
    }
  }
  return supplementalUsed;
}

const urbanUsed=auditSector('greywall-district','GREYWALL DISTRICT',requiredUrban,'QA-18B');
const desertUsed=auditSector('dustline-sector','DUSTLINE SECTOR',requiredDesert,'QA-18C');

// Weather compatibility and deterministic selection across every playable sector.
const seenBySector=new Map();
for(const entry of listReconMaps()){
  const allowed=conditionsForSector(entry.id);
  assert(allowed.length>=1,`${entry.id} declares at least one environmental condition`);
  const seen=new Set();
  for(let i=0;i<72;i+=1){
    const seed=`QA-18D-${entry.id}-${String(i).padStart(2,'0')}`;
    const first=resolveMissionCondition(seed,entry.id);
    const second=resolveMissionCondition(seed,entry.id);
    assert(first===second,`${entry.id}/${seed} condition reproduces identically`);
    assert(allowed.includes(first),`${entry.id}/${seed} condition stays compatible`);
    seen.add(first);
  }
  if(allowed.length>1) assert(seen.size>=2,`${entry.id} exercises multiple allowed conditions`);
  if(allowed.length===3) assert(seen.size===3,`${entry.id} exercises CLEAR RAIN SNOW across QA seeds`);
  seenBySector.set(entry.id,seen);
}

assert(conditionsForSector('dustline-sector').join(',')===ENVIRONMENT_CONDITIONS.CLEAR,
  'DUSTLINE remains CLEAR-only in Phase 18D');
assert(!conditionsForSector('frostline-relay').includes(ENVIRONMENT_CONDITIONS.RAIN),
  'FROSTLINE never selects rain');
assert(!conditionsForSector('riverworks-sector').includes(ENVIRONMENT_CONDITIONS.SNOW),
  'RIVERWORKS never selects snow');

const briefing=read('src/scenes/MissionBriefingScene.js');
const recon=read('src/scenes/ReconScene.js');
const weather=read('src/ui/weatherOverlay.js');
assert(briefing.includes("CONDITIONS: ${this.mission.condition ?? 'CLEAR'}"),
  'briefing displays mission conditions');
assert(recon.includes('createMissionWeatherOverlay')&&recon.includes('this.weatherOverlay?.resize()'),
  'Recon creates and resizes the weather overlay');
assert(recon.includes('this.weatherOverlay?.setPaused(this.paused)'),
  'weather animation pauses with recon');
assert(recon.includes('this.weatherOverlay?.destroy()'),
  'weather overlay is destroyed during recon cleanup');
assert(weather.includes('!reducedMotion')&&weather.includes('reducedMotion ? particle.y'),
  'reduced-motion disables precipitation animation');
assert(!weather.includes('setInteractive')&&!weather.includes('entityNearPoint')&&!weather.includes('entities'),
  'weather layer cannot participate in target hit-testing');
assert(!weather.includes('/audio/')&&!weather.includes('feedback('),
  'Phase 18D weather adds no weather audio');

if(errors.length){
  console.error(`I SPY Phase 18 environment QA FAILED (${errors.length}):`);
  errors.slice(0,40).forEach((message)=>console.error(`  - ${message}`));
  if(errors.length>40)console.error(`  ...and ${errors.length-40} more`);
  process.exit(1);
}

console.log(`I SPY Phase 18 environment QA passed: ${checks} checks.`);
console.log(`GREYWALL urban frames used: ${[...urbanUsed].join(', ')}`);
console.log(`DUSTLINE desert frames used: ${[...desertUsed].join(', ')}`);
console.log([...seenBySector.entries()].map(([id,seen])=>`${id}: ${[...seen].join('/')}`).join(' | '));
