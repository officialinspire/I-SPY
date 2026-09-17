import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import { createButton } from '../ui/createButton.js';
import { createLocateMission } from '../game/locateMission.js';

export default class MissionBriefingScene extends Phaser.Scene {
  constructor() { super('MissionBriefing'); }

  create(data = {}) {
    this.mission = data.mission ?? createLocateMission();
    this.cameras.main.setBackgroundColor(GAME_CONFIG.palette.black);
    this.header = this.add.text(0, 0, 'INTELLIGENCE DIRECTORATE', {
      fontFamily: GAME_CONFIG.typography.family, fontSize: '14px', color: GAME_CONFIG.palette.gray,
    }).setOrigin(0.5);

    const regionLine = this.mission.region ? `\nREGION: ${this.mission.region.label}` : '';
    const countInstruction = this.mission.mode === 'COUNT' ? '\n\nCOUNT ONLY THE REQUESTED CATEGORY. CIVILIAN OR UNRELATED OBJECTS MAY BE PRESENT.' : '';
    this.briefing = this.add.text(0, 0,
      `${this.mission.operation}\n\nSATELLITE PASS: ${this.mission.satellitePass}\nSECTOR: ${this.mission.sector}\nMODE: ${this.mission.mode}${regionLine}\n\nOBJECTIVE:\n${this.mission.objective}${countInstruction}\n\nTIME WINDOW: ${this.mission.timeLimitSeconds} SECONDS`,
      { fontFamily: GAME_CONFIG.typography.family, fontSize: '18px', color: GAME_CONFIG.palette.offWhite, lineSpacing: 7, align: 'left' }
    ).setOrigin(0.5);

    this.begin = createButton(this, 0, 0, 'BEGIN RECON', () => this.scene.start('Recon', { mission: this.mission }));
    this.back = createButton(this, 0, 0, 'RETURN', () => this.scene.start('MainMenu'), { width: 180, fontSize: 16 });
    this.scale.on('resize', this.layout, this);
    this.layout(this.scale.gameSize);
  }

  layout(gameSize) {
    const { width, height } = gameSize;
    this.header.setPosition(width / 2, 38);
    this.briefing.setFontSize(width < 540 ? 13 : 18).setWordWrapWidth(Math.min(700, width - 44)).setPosition(width / 2, height * 0.40);
    this.begin.setPosition(width / 2, height - 112);
    this.back.setPosition(width / 2, height - 52);
  }
}
