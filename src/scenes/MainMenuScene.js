import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import { createButton } from '../ui/createButton.js';

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create() {
    this.cameras.main.setBackgroundColor(GAME_CONFIG.palette.black);
    this.scanLines = this.add.graphics().setAlpha(0.13);

    this.title = this.add.text(0, 0, GAME_CONFIG.title, {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '72px',
      fontStyle: 'bold',
      color: GAME_CONFIG.palette.white,
      letterSpacing: 6,
    }).setOrigin(0.5);

    this.subtitle = this.add.text(0, 0, GAME_CONFIG.subtitle, {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '15px',
      color: GAME_CONFIG.palette.lightGray,
      align: 'center',
    }).setOrigin(0.5);

    this.status = this.add.text(0, 0, 'SYSTEM READY // CLEARANCE: TRAINING', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '12px',
      color: GAME_CONFIG.palette.gray,
    }).setOrigin(0.5);

    this.buttons = [
      createButton(this, 0, 0, 'NEW MISSION', () => this.scene.start('MissionBriefing')),
      createButton(this, 0, 0, 'HOW TO PLAY', () => this.showNotice('PAN / ZOOM THE IMAGE\nANALYZE TERRAIN\nMARK TARGETS WHEN TASKED')),
      createButton(this, 0, 0, 'SETTINGS', () => this.showNotice('SETTINGS MODULE\nCOMING IN A LATER PHASE')),
    ];

    this.notice = this.add.text(0, 0, '', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '14px',
      color: GAME_CONFIG.palette.offWhite,
      align: 'center',
      backgroundColor: GAME_CONFIG.palette.nearBlack,
      padding: { x: 16, y: 12 },
    }).setOrigin(0.5).setVisible(false);

    this.scale.on('resize', this.layout, this);
    this.layout(this.scale.gameSize);
  }

  showNotice(message) {
    this.notice.setText(message).setVisible(true).setDepth(20);
    this.time.delayedCall(2200, () => this.notice.setVisible(false));
  }

  layout(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;
    const compact = width < 520;

    this.title.setFontSize(compact ? 54 : 72).setPosition(width / 2, Math.max(105, height * 0.2));
    this.subtitle.setPosition(width / 2, this.title.y + 64).setWordWrapWidth(Math.min(520, width - 36));

    const startY = Math.max(this.subtitle.y + 90, height * 0.46);
    this.buttons.forEach((button, index) => button.setPosition(width / 2, startY + index * 62));
    this.status.setPosition(width / 2, height - 28);
    this.notice.setPosition(width / 2, height / 2);

    this.scanLines.clear();
    this.scanLines.lineStyle(1, 0xf6f6ee, 1);
    for (let y = 0; y < height; y += 6) this.scanLines.lineBetween(0, y, width, y);
  }
}
