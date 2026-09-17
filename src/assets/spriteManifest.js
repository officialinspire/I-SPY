import { GAME_CONFIG } from '../runtime-config.js';

const environmentUrl=new URL('../../assets/sprites/i-spy-environment-sheet.svg',import.meta.url).href;
const infrastructureUrl=new URL('../../assets/sprites/i-spy-infrastructure-sheet.svg',import.meta.url).href;
const targetsUrl=new URL('../../assets/sprites/i-spy-targets-sheet.svg',import.meta.url).href;
const intelUrl=new URL('../../assets/sprites/i-spy-intel-sheet.svg',import.meta.url).href;
const uiUrl=new URL('../../assets/sprites/i-spy-ui-sheet.svg',import.meta.url).href;
const environment=['ground','dirt','mud','field','water','rocky','snow','crater','conifer','deciduous','dead_tree','forest_cluster','bush','hedge','stump','fallen_tree'];
const infrastructure=['road_straight','road_curve','road_intersection','dirt_track','rail','bridge','fence','gate','pole','pipeline','farmhouse','barn','warehouse','barracks','bunker','hangar'];
const targets=['tank','apc','military_truck','fuel_truck','jeep','radar_vehicle','missile_transporter','artillery','radar_dish','antenna_array','radio_tower','watchtower','fuel_tanks','bunker_entrance','generator','sam_site'];
const intel=['tire_tracks','track_marks','footprints','disturbed_soil','cut_vegetation','smoke','crates','barrels','camouflage_net','tractor','civilian_truck','hay_bale','destroyed_bridge','trench','dummy_tank','abandoned_equipment'];
const ui=['reticle','reticle_lock','marker_confirm','marker_unverified','question','exclamation','grid_dot','grid_cross','scanline_h','scanline_v','corner_tl','corner_tr','corner_bl','corner_br','panel','cursor'];

const sourceSheetSize=256;
const sourceFrameSize=GAME_CONFIG.sprites.frameSize;
const rasterScale=GAME_CONFIG.rendering.spriteRasterScale;
const rasterSheetSize=sourceSheetSize*rasterScale;
const rasterFrameSize=sourceFrameSize*rasterScale;

const makeSheet=(key,url,names,categories)=>Object.freeze({
  key,
  url,
  width:rasterSheetSize,
  height:rasterSheetSize,
  frameWidth:rasterFrameSize,
  frameHeight:rasterFrameSize,
  logicalFrameWidth:sourceFrameSize,
  logicalFrameHeight:sourceFrameSize,
  rasterScale,
  names:Object.freeze(names),
  categories:Object.freeze(categories),
});

export const SPRITE_SHEETS=Object.freeze({
 environment:makeSheet('ispy-environment',environmentUrl,environment,['terrain','terrain','vegetation','vegetation']),
 infrastructure:makeSheet('ispy-infrastructure',infrastructureUrl,infrastructure,['infrastructure','infrastructure','utility_building','building']),
 targets:makeSheet('ispy-targets',targetsUrl,targets,['vehicle','vehicle','installation','installation']),
 intel:makeSheet('ispy-intel',intelUrl,intel,['clue','clue','decoy','change_decoy']),
 ui:makeSheet('ispy-ui',uiUrl,ui,['ui','ui','ui','ui']),
});
export const SPRITE_PALETTE=Object.freeze({black:'#0B0B0B',charcoal:'#333333',light:'#BDBDBD',white:'#F6F6EE'});
export function frameFor(sheet,name){const index=sheet.names.indexOf(name);if(index<0)return null;return Object.freeze({index,x:(index%4)*sheet.frameWidth,y:Math.floor(index/4)*sheet.frameHeight,w:sheet.frameWidth,h:sheet.frameHeight,logicalW:sheet.logicalFrameWidth,logicalH:sheet.logicalFrameHeight,category:sheet.categories[Math.floor(index/4)]});}
export function findSprite(name){for(const [sheetName,sheet] of Object.entries(SPRITE_SHEETS)){const frame=frameFor(sheet,name);if(frame)return Object.freeze({sheetName,sheet,frame});}return null;}
