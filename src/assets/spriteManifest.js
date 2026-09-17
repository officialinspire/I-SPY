const makeUrl=(file)=>new URL(`../../assets/sprites/${file}`,import.meta.url).href;
const environment=['ground','dirt','mud','field','water','rocky','snow','crater','conifer','deciduous','dead_tree','forest_cluster','bush','hedge','stump','fallen_tree'];
const infrastructure=['road_straight','road_curve','road_intersection','dirt_track','rail','bridge','fence','gate','pole','pipeline','farmhouse','barn','warehouse','barracks','bunker','hangar'];
const targets=['tank','apc','military_truck','fuel_truck','jeep','radar_vehicle','missile_transporter','artillery','radar_dish','antenna_array','radio_tower','watchtower','fuel_tanks','bunker_entrance','generator','sam_site'];
const intel=['tire_tracks','track_marks','footprints','disturbed_soil','cut_vegetation','smoke','crates','barrels','camouflage_net','tractor','civilian_truck','hay_bale','destroyed_bridge','trench','dummy_tank','abandoned_equipment'];
const ui=['reticle','reticle_lock','marker_confirm','marker_unverified','question','exclamation','grid_dot','grid_cross','scanline_h','scanline_v','corner_tl','corner_tr','corner_bl','corner_br','panel','cursor'];
const makeSheet=(key,file,names,categories)=>Object.freeze({key,url:makeUrl(file),width:256,height:256,frameWidth:64,frameHeight:64,names:Object.freeze(names),categories:Object.freeze(categories)});
export const SPRITE_SHEETS=Object.freeze({
 environment:makeSheet('ispy-environment','i-spy-environment-sheet.svg',environment,['terrain','terrain','vegetation','vegetation']),
 infrastructure:makeSheet('ispy-infrastructure','i-spy-infrastructure-sheet.svg',infrastructure,['infrastructure','infrastructure','utility_building','building']),
 targets:makeSheet('ispy-targets','i-spy-targets-sheet.svg',targets,['vehicle','vehicle','installation','installation']),
 intel:makeSheet('ispy-intel','i-spy-intel-sheet.svg',intel,['clue','clue','decoy','change_decoy']),
 ui:makeSheet('ispy-ui','i-spy-ui-sheet.svg',ui,['ui','ui','ui','ui']),
});
export const SPRITE_PALETTE=Object.freeze({black:'#0B0B0B',charcoal:'#333333',light:'#BDBDBD',white:'#F6F6EE'});
export function frameFor(sheet,name){const index=sheet.names.indexOf(name);if(index<0)return null;return Object.freeze({index,x:(index%4)*64,y:Math.floor(index/4)*64,w:64,h:64,category:sheet.categories[Math.floor(index/4)]});}
export function findSprite(name){for(const [sheetName,sheet] of Object.entries(SPRITE_SHEETS)){const frame=frameFor(sheet,name);if(frame)return Object.freeze({sheetName,sheet,frame});}return null;}
