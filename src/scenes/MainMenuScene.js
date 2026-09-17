import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import { createButton } from '../ui/createButton.js';
import { createTerminalChrome, prefersReducedMotion } from '../ui/presentation.js';
import { createLocateMission } from '../game/locateMission.js';
import { createCountMission } from '../game/countMission.js';
import { createChangeDetectionMission } from '../game/changeDetectionMission.js';
import { createGeneratedMission, getGeneratorOptions } from '../game/missionGenerator.js';

export default class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenu'); }

  create() {
    this.cameras.main.setBackgroundColor(GAME_CONFIG.palette.black);
    this.reducedMotion = prefersReducedMotion();
    this.chrome = createTerminalChrome(this, {
      station: 'INTELLIGENCE DIRECTORATE // IMAGE ANALYSIS STATION 04',
      classification: GAME_CONFIG.presentation.classification,
    });
    this.panelGraphics = this.add.graphics().setDepth(0);

    this.title = this.add.text(0, 0, GAME_CONFIG.title, {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '72px',
      fontStyle: 'bold',
      color: GAME_CONFIG.palette.white,
      letterSpacing: 8,
    }).setOrigin(0.5);
    this.subtitle = this.add.text(0, 0, GAME_CONFIG.subtitle, {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '14px',
      color: GAME_CONFIG.palette.lightGray,
      align: 'center',
      letterSpacing: 2,
    }).setOrigin(0.5);
    this.consoleLabel = this.add.text(0, 0, 'ORBITAL IMAGERY ANALYSIS CONSOLE', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '11px',
      color: GAME_CONFIG.palette.gray,
      letterSpacing: 1,
    }).setOrigin(0.5);
    this.status = this.add.text(0, 0, 'SYSTEM READY // SATELLITE LINK: STANDBY // CLEARANCE: TRAINING', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '10px',
      color: GAME_CONFIG.palette.gray,
    }).setOrigin(0.5);

    this.buttons = [
      createButton(this, 0, 0, 'RANDOM MISSION', () => this.launchGeneratedMission()),
      createButton(this, 0, 0, 'LOCATE MISSION', () => this.scene.start('MissionBriefing', { mission: createLocateMission() })),
      createButton(this, 0, 0, 'COUNT MISSION', () => this.scene.start('MissionBriefing', { mission: createCountMission() })),
      createButton(this, 0, 0, 'CHANGE MISSION', () => this.scene.start('MissionBriefing', { mission: createChangeDetectionMission() })),
      createButton(this, 0, 0, 'HOW TO PLAY', () => this.showNotice('PAN / ZOOM THE IMAGE\nRANDOM: SEEDED REPLAYABLE MISSION\nLOCATE: MARK THE REQUESTED TARGET\nCOUNT: INSPECT THE MARKED REGION AND SUBMIT A TOTAL\nCHANGE: COMPARE PASS A / PASS B AND MARK THE CHANGED OBJECT')),
      createButton(this, 0, 0, 'SETTINGS', () => this.showNotice('SYSTEM CONFIGURATION MODULE\nAUDIO / FEEDBACK CONTROLS SCHEDULED FOR PHASE 10')),
    ];

    this.notice = this.add.text(0, 0, '', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '13px',
      color: GAME_CONFIG.palette.offWhite,
      align: 'center',
      backgroundColor: GAME_CONFIG.palette.nearBlack,
      padding: { x: 18, y: 14 },
    }).setOrigin(0.5).setDepth(40).setVisible(false);

    if (!this.reducedMotion) {
      this.linkIndicator = this.add.text(0, 0, '■', {
        fontFamily: GAME_CONFIG.typography.family,
        fontSize: '10px',
        color: GAME_CONFIG.palette.lightGray,
      }).setOrigin(0.5);
      this.tweens.add({ targets: this.linkIndicator, alpha: 0.25, duration: 850, yoyo: true, repeat: -1 });
    }

    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
    this.layout(this.scale.gameSize);
  }

  launchGeneratedMission() {
    const options = getGeneratorOptions();
    const mission = createGeneratedMission({ seed: options.seed, mode: options.mode });
    this.scene.start('MissionBriefing', { mission });
  }

  showNotice(message) {
    this.notice.setText(message).setVisible(true);
    this.time.delayedCall(3600, () => this.notice.setVisible(false));
  }

  layout(gameSize) {
    const { width, height } = gameSize;
    const compact = width < 520;
    this.chrome.layout(gameSize);

    this.title.setFontSize(compact ? 48 : 68).setPosition(width / 2, Math.max(82, height * 0.14));
    this.subtitle.setPosition(width / 2, this.title.y + 52).setWordWrapWidth(Math.min(560, width - 44));
    this.consoleLabel.setPosition(width / 2, this.subtitle.y + 31);

    const startY = Math.max(this.consoleLabel.y + 48, height * 0.32);
    const spacing = compact ? 45 : 49;
    this.buttons.forEach((button, index) => button.setPosition(width / 2, startY + index * spacing));

    const panelWidth = Math.min(compact ? width - 48 : 430, width - 40);
    const panelTop = startY - 29;
    const panelBottom = startY + (this.buttons.length - 1) * spacing + 29;
    this.panelGraphics.clear();
    this.panelGraphics.fillStyle(0x171717, 0.42).fillRect(width / 2 - panelWidth / 2, panelTop, panelWidth, panelBottom - panelTop);
    this.panelGraphics.lineStyle(1, 0xbdbdbd, 0.32).strokeRect(width / 2 - panelWidth / 2, panelTop, panelWidth, panelBottom - panelTop);
    this.panelGraphics.lineStyle(2, 0xf6f6ee, 0.58);
    this.panelGraphics.lineBetween(width / 2 - panelWidth / 2, panelTop, width / 2 - panelWidth / 2 + 18, panelTop);
    this.panelGraphics.lineBetween(width / 2 + panelWidth / 2 - 18, panelBottom, width / 2 + panelWidth / 2, panelBottom);

    this.status.setPosition(width / 2, height - 37).setVisible(height >= 420);
    this.linkIndicator?.setPosition(Math.max(34, width / 2 - 242), height - 37).setVisible(width >= 620 && height >= 420);
    this.notice.setPosition(width / 2, height / 2).setWordWrapWidth(Math.min(640, width - 44));
  }
}
