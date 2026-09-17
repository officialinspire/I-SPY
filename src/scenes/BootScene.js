import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import { preloadSpriteSheets, registerSpriteFrames } from '../assets/registerSpriteFrames.js';

export default class BootScene extends Phaser.Scene {
  constructor(){super('Boot');}

  preload(){preloadSpriteSheets(this);}

  create(){
    registerSpriteFrames(this);
    const {width,height}=this.scale;
    this.cameras.main.setBackgroundColor(GAME_CONFIG.palette.black);
    this.add.text(width/2,height/2-18,'RECONNAISSANCE SYSTEM',{fontFamily:GAME_CONFIG.typography.family,fontSize:'22px',color:GAME_CONFIG.palette.offWhite}).setOrigin(0.5);
    this.add.text(width/2,height/2+18,'SPRITE LIBRARY ACQUIRED // INITIALIZING...',{fontFamily:GAME_CONFIG.typography.family,fontSize:'14px',color:GAME_CONFIG.palette.gray}).setOrigin(0.5);
    this.time.delayedCall(450,()=>this.scene.start('MainMenu'));
  }
}
