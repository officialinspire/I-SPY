import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import { createButton } from '../ui/createButton.js';

export default class ResultsScene extends Phaser.Scene {
  constructor() {
    super('Results');
  }

  create(data = {}) {
    this.cameras.main.setBackgroundColor(GAME_CONFIG.palette.black);
    this.title = this.add.text(0, 0, data.success === false ? 'MISSION FAILED' : 'ASSESSMENT COMPLETE', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '32px',
      color: GAME_CONFIG.palette.offWhite,
    }).setOrigin(0.5);
    this.body = this.add.text(0, 0, 'RESULTS MODULE RESERVED FOR MISSION PHASES.', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '15px',
      color: GAME_CONFIG.palette.gray,
    }).setOrigin(0.5);
    this.menu = createButton(this, 0, 0, 'RETURN TO MENU', () => this.scene.start('MainMenu'));
    this.scale.on('resize', this.layout, this);
    this.layout(this.scale.gameSize);
  }

  layout(gameSize) {
    this.title.setPosition(gameSize.width / 2, gameSize.height * 0.35);
    this.body.setPosition(gameSize.width / 2, gameSize.height * 0.48).setWordWrapWidth(Math.min(600, gameSize.width - 40));
    this.menu.setPosition(gameSize.width / 2, gameSize.height * 0.68);
  }
}
