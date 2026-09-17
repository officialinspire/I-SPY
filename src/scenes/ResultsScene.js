import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import { createButton } from '../ui/createButton.js';
import { createLocateMission } from '../game/locateMission.js';

export default class ResultsScene extends Phaser.Scene {
  constructor() {
    super('Results');
  }

  create(data = {}) {
    this.data = data;
    this.cameras.main.setBackgroundColor(GAME_CONFIG.palette.black);
    const success = data.success === true;
    const score = data.score ?? { baseScore: 0, falsePenalty: 0, timeBonus: 0, perfectBonus: 0, totalScore: 0 };

    this.title = this.add.text(0, 0, success ? 'MISSION COMPLETE' : 'MISSION FAILED', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '32px',
      color: GAME_CONFIG.palette.offWhite,
    }).setOrigin(0.5);

    this.body = this.add.text(0, 0,
      `TARGET: ${data.targetLabel ?? 'UNKNOWN'}\n` +
      `TIME: ${data.elapsedSeconds ?? 0}s\n` +
      `FALSE IDENTIFICATIONS: ${data.falseIdentifications ?? 0}\n\n` +
      `BASE SCORE: ${score.baseScore}\n` +
      `FALSE ID PENALTY: -${score.falsePenalty}\n` +
      `TIME BONUS: +${score.timeBonus}\n` +
      `PERFECT BONUS: +${score.perfectBonus}\n` +
      `-------------------------\nTOTAL SCORE: ${score.totalScore}`,
      {
        fontFamily: GAME_CONFIG.typography.family,
        fontSize: '15px',
        color: GAME_CONFIG.palette.lightGray,
        lineSpacing: 6,
        align: 'left',
      }
    ).setOrigin(0.5);

    const mission = data.mission ?? createLocateMission();
    this.retry = createButton(this, 0, 0, 'RESTART MISSION', () => this.scene.start('MissionBriefing', { mission }), { width: 250, fontSize: 16 });
    this.menu = createButton(this, 0, 0, 'RETURN TO MENU', () => this.scene.start('MainMenu'), { width: 250, fontSize: 16 });
    this.scale.on('resize', this.layout, this);
    this.layout(this.scale.gameSize);
  }

  layout(gameSize) {
    this.title.setPosition(gameSize.width / 2, gameSize.height * 0.18);
    this.body.setPosition(gameSize.width / 2, gameSize.height * 0.48).setWordWrapWidth(Math.min(600, gameSize.width - 40));
    this.retry.setPosition(gameSize.width / 2, gameSize.height - 112);
    this.menu.setPosition(gameSize.width / 2, gameSize.height - 52);
  }
}
