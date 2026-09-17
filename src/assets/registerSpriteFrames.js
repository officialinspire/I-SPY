import { SPRITE_SHEETS, frameFor } from './spriteManifest.js';

export function preloadSpriteSheets(scene){
  Object.values(SPRITE_SHEETS).forEach((sheet)=>scene.load.svg(sheet.key,sheet.url,{width:sheet.width,height:sheet.height}));
}

export function registerSpriteFrames(scene){
  Object.values(SPRITE_SHEETS).forEach((sheet)=>{
    const texture=scene.textures.get(sheet.key);
    if(!texture||texture.key==='__MISSING')return;
    sheet.names.forEach((name)=>{
      if(texture.has(name))return;
      const frame=frameFor(sheet,name);
      texture.add(name,0,frame.x,frame.y,frame.w,frame.h);
    });
  });
}
