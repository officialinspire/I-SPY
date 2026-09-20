import { GAME_CONFIG } from '../runtime-config.js';

const environmentUrl=new URL('../../assets/sprites/i-spy-environment-sheet.svg',import.meta.url).href;
const infrastructureUrl=new URL('../../assets/sprites/i-spy-infrastructure-sheet.svg',import.meta.url).href;
const targetsUrl=new URL('../../assets/sprites/i-spy-targets-sheet.svg',import.meta.url).href;
const intelUrl=new URL('../../assets/sprites/i-spy-intel-sheet.svg',import.meta.url).href;
const uiUrl=new URL('../../assets/sprites/i-spy-ui-sheet.svg',import.meta.url).href;
const environmentSupplementalUrl=new URL('../../assets/sprites/i-spy-environment-supplemental-sheet.svg',import.meta.url).href;

const environment=['ground','dirt','mud','field','water','rocky','snow','crater','conifer','deciduous','dead_tree','forest_cluster','bush','hedge','stump','fallen_tree'];
const infrastructure=['road_straight','road_curve','road_intersection','dirt_track','rail','bridge','fence','gate','pole','pipeline','farmhouse','barn','warehouse','barracks','bunker','hangar'];
const targets=['tank','apc','military_truck','fuel_truck','jeep','radar_vehicle','missile_transporter','artillery','radar_dish','antenna_array','radio_tower','watchtower','fuel_tanks','bunker_entrance','generator','sam_site'];
const intel=['tire_tracks','track_marks','footprints','disturbed_soil','cut_vegetation','smoke','crates','barrels','camouflage_net','tractor','civilian_truck','hay_bale','destroyed_bridge','trench','dummy_tank','abandoned_equipment'];
const ui=['reticle','reticle_lock','marker_confirm','marker_unverified','question','exclamation','grid_dot','grid_cross','scanline_h','scanline_v','corner_tl','corner_tr','corner_bl','corner_br','panel','cursor'];

// Phase 18A is deliberately additive. These names live on their own sheet so
// the original five 4x4 sheets — and all 80 legacy frame indexes — stay fixed.
const environmentSupplemental=[
  'urban_pavement','urban_sidewalk','urban_alley','urban_rubble',
  'apartment_block','admin_block','garage_workshop','dense_warehouse',
  'damaged_building','concrete_barrier','streetlight','utility_pole',
  'desert_sand','desert_rocky','desert_dune','desert_wadi',
  'dry_scrub','dead_shrub','rock_outcrop','desert_road',
  'desert_checkpoint','desert_shelter','desert_fuel_site','desert_ruin',
];

const sourceFrameSize=GAME_CONFIG.sprites.frameSize;
const rasterScale=GAME_CONFIG.rendering.spriteRasterScale;
const rasterFrameSize=sourceFrameSize*rasterScale;

const makeSheet=(key,url,names,categories,{columns=4,rows=4}={})=>Object.freeze({
  key,
  url,
  columns,
  rows,
  width:columns*sourceFrameSize*rasterScale,
  height:rows*sourceFrameSize*rasterScale,
  frameWidth:rasterFrameSize,
  frameHeight:rasterFrameSize,
  logicalFrameWidth:sourceFrameSize,
  logicalFrameHeight:sourceFrameSize,
  rasterScale,
  names:Object.freeze(names),
  categories:Object.freeze(categories),
});

export const LEGACY_SPRITE_SHEET_KEYS=Object.freeze(['environment','infrastructure','targets','intel','ui']);
export const LEGACY_SPRITE_FRAME_COUNT=80;

export const SPRITE_SHEETS=Object.freeze({
  environment:makeSheet('ispy-environment',environmentUrl,environment,['terrain','terrain','vegetation','vegetation']),
  infrastructure:makeSheet('ispy-infrastructure',infrastructureUrl,infrastructure,['infrastructure','infrastructure','utility_building','building']),
  targets:makeSheet('ispy-targets',targetsUrl,targets,['vehicle','vehicle','installation','installation']),
  intel:makeSheet('ispy-intel',intelUrl,intel,['clue','clue','decoy','change_decoy']),
  ui:makeSheet('ispy-ui',uiUrl,ui,['ui','ui','ui','ui']),
  environmentSupplemental:makeSheet(
    'ispy-environment-supplemental',
    environmentSupplementalUrl,
    environmentSupplemental,
    ['urban_terrain','urban_structure','urban_infrastructure','desert_terrain','desert_vegetation','desert_structure'],
    {columns:4,rows:6},
  ),
});

export const SPRITE_PALETTE=Object.freeze({black:'#0B0B0B',charcoal:'#333333',light:'#BDBDBD',white:'#F6F6EE'});

export function frameFor(sheet,name){
  const index=sheet.names.indexOf(name);
  if(index<0)return null;
  const columns=sheet.columns??4;
  return Object.freeze({
    index,
    x:(index%columns)*sheet.frameWidth,
    y:Math.floor(index/columns)*sheet.frameHeight,
    w:sheet.frameWidth,
    h:sheet.frameHeight,
    logicalW:sheet.logicalFrameWidth,
    logicalH:sheet.logicalFrameHeight,
    category:sheet.categories[Math.floor(index/columns)],
  });
}

export function findSprite(name){
  for(const [sheetName,sheet] of Object.entries(SPRITE_SHEETS)){
    const frame=frameFor(sheet,name);
    if(frame)return Object.freeze({sheetName,sheet,frame});
  }
  return null;
}
