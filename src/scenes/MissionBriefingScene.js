import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import { createButton } from '../ui/createButton.js';

export default class MissionBriefingScene extends Phaser.Scene {
  constructor() {
    super('MissionBriefing');
  }

  create() {
    this.cameras.main.setBackgroundColor(GAME_CONFIG.palette.black);

    this.header = this.add.text(0, 0, 'INTELLIGENCE DIRECTORATE', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '14px',
      color: GAME_CONFIG.palette.gray,
    }).setOrigin(0.5);

    this.briefing = this.add.text(0, 0,
      'OPERATION NIGHT GLASS\n\nSATELLITE PASS: 03:42 ZULU\nSECTOR: WOODLAND CORRIDOR 7\n\nOBJECTIVE:\nCONDUCT VISUAL RECONNAISSANCE OF THE SECTOR.\n\nTRAINING PHASE — TARGET VALIDATION OFFLINE.',
      {
        fontFamily: GAME_CONFIG.typography.family,
        fontSize: '18px',
        color: GAME_CONFIG.palette.offWhite,
        lineSpacing: 7,
        align: 'left',
      }
    ).setOrigin(0.5);

    this.begin = createButton(this, 0, 0, 'BEGIN RECON', () => this.scene.start('Recon'));
    this.back = createButton(this, 0, 0, 'RETURN', () => this.scene.start('MainMenu'), { width: 180, fontSize: 16 });

    this.scale.on('resize', this.layout, this);
    this.layout(this.scale.gameSize);
  }

  layout(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;
    this.header.setPosition(width / 2, 38);
    this.briefing.setFontSize(width < 540 ? 14 : 18).setWordWrapWidth(Math.min(680, width - 44)).setPosition(width / 2, height * 0.42);
    this.begin.setPosition(width / 2, height - 112);
    this.back.setPosition(width / 2, height - 52);
  }
}
