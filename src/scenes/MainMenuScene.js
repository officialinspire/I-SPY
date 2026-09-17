import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import { createButton } from '../ui/createButton.js';
import { createLocateMission } from '../game/locateMission.js';
import { createCountMission } from '../game/countMission.js';
import { createChangeDetectionMission } from '../game/changeDetectionMission.js';

export default class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenu'); }

  create() {
    this.cameras.main.setBackgroundColor(GAME_CONFIG.palette.black);
    this.scanLines = this.add.graphics().setAlpha(0.13);

    this.title = this.add.text(0, 0, GAME_CONFIG.title, {
      fontFamily: GAME_CONFIG.typography.family, fontSize: '72px', fontStyle: 'bold',
      color: GAME_CONFIG.palette.white, letterSpacing: 6,
    }).setOrigin(0.5);
    this.subtitle = this.add.text(0, 0, GAME_CONFIG.subtitle, {
      fontFamily: GAME_CONFIG.typography.family, fontSize: '15px', color: GAME_CONFIG.palette.lightGray, align: 'center',
    }).setOrigin(0.5);
    this.status = this.add.text(0, 0, 'SYSTEM READY // CLEARANCE: TRAINING', {
      fontFamily: GAME_CONFIG.typography.family, fontSize: '12px', color: GAME_CONFIG.palette.gray,
    }).setOrigin(0.5);

    this.buttons = [
      createButton(this, 0, 0, 'LOCATE MISSION', () => this.scene.start('MissionBriefing', { mission: createLocateMission() })),
      createButton(this, 0, 0, 'COUNT MISSION', () => this.scene.start('MissionBriefing', { mission: createCountMission() })),
      createButton(this, 0, 0, 'CHANGE MISSION', () => this.scene.start('MissionBriefing', { mission: createChangeDetectionMission() })),
      createButton(this, 0, 0, 'HOW TO PLAY', () => this.showNotice('PAN / ZOOM THE IMAGE\nLOCATE: MARK THE REQUESTED TARGET\nCOUNT: INSPECT THE MARKED REGION AND SUBMIT A TOTAL\nCHANGE: COMPARE PASS A / PASS B AND MARK THE CHANGED OBJECT')),
      createButton(this, 0, 0, 'SETTINGS', () => this.showNotice('SETTINGS MODULE\nCOMING IN A LATER PHASE')),
    ];

    this.notice = this.add.text(0, 0, '', {
      fontFamily: GAME_CONFIG.typography.family, fontSize: '14px', color: GAME_CONFIG.palette.offWhite,
      align: 'center', backgroundColor: GAME_CONFIG.palette.nearBlack, padding: { x: 16, y: 12 },
    }).setOrigin(0.5).setVisible(false);

    this.scale.on('resize', this.layout, this);
    this.layout(this.scale.gameSize);
  }

  showNotice(message) {
    this.notice.setText(message).setVisible(true).setDepth(20);
    this.time.delayedCall(3200, () => this.notice.setVisible(false));
  }

  layout(gameSize) {
    const { width, height } = gameSize;
    const compact = width < 520;
    this.title.setFontSize(compact ? 52 : 72).setPosition(width / 2, Math.max(82, height * 0.15));
    this.subtitle.setPosition(width / 2, this.title.y + 56).setWordWrapWidth(Math.min(520, width - 36));
    const startY = Math.max(this.subtitle.y + 62, height * 0.34);
    const spacing = compact ? 50 : 54;
    this.buttons.forEach((button, index) => button.setPosition(width / 2, startY + index * spacing));
    this.status.setPosition(width / 2, height - 22);
    this.notice.setPosition(width / 2, height / 2).setWordWrapWidth(Math.min(620, width - 44));
    this.scanLines.clear().lineStyle(1, 0xf6f6ee, 1);
    for (let y = 0; y < height; y += 6) this.scanLines.lineBetween(0, y, width, y);
  }
}
