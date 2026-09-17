import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import { createButton } from '../ui/createButton.js';
import { createLocateMission } from '../game/locateMission.js';

export default class ResultsScene extends Phaser.Scene {
  constructor() { super('Results'); }

  create(data = {}) {
    this.data = data;
    this.cameras.main.setBackgroundColor(GAME_CONFIG.palette.black);
    const success = data.success === true;
    const mission = data.mission ?? createLocateMission();
    const score = data.score ?? { baseScore: 0, timeBonus: 0, perfectBonus: 0, totalScore: 0 };

    this.title = this.add.text(0, 0, success ? 'MISSION COMPLETE' : 'MISSION FAILED', {
      fontFamily: GAME_CONFIG.typography.family, fontSize: '32px', color: GAME_CONFIG.palette.offWhite,
    }).setOrigin(0.5);

    let bodyText;
    if (mission.mode === 'COUNT') {
      bodyText = `REGION: ${mission.region?.label ?? 'UNKNOWN'}\nCATEGORY: ${mission.targetCategoryLabel ?? 'UNKNOWN'}\nSUBMITTED COUNT: ${data.submittedAnswer ?? 0}\nCORRECT COUNT: ${data.correctAnswer ?? mission.expectedCount ?? 0}\nTIME: ${data.elapsedSeconds ?? 0}s\nINCORRECT SUBMISSIONS: ${data.incorrectSubmissions ?? 0}\n\nBASE SCORE: ${score.baseScore ?? 0}\nANSWER PENALTY: -${score.answerPenalty ?? 0}\nTIME BONUS: +${score.timeBonus ?? 0}\nPERFECT BONUS: +${score.perfectBonus ?? 0}\n-------------------------\nTOTAL SCORE: ${score.totalScore ?? 0}`;
    } else if (mission.mode === 'CHANGE') {
      bodyText = `CHANGE TYPE: ${(mission.changeType ?? 'UNKNOWN').replaceAll('_', ' ').toUpperCase()}\nCHANGED OBJECT: ${mission.targetLabel ?? 'UNKNOWN'}\nMARKED PASS: ${data.markedPass ?? 'N/A'}\nTIME: ${data.elapsedSeconds ?? 0}s\nFALSE IDENTIFICATIONS: ${data.falseIdentifications ?? 0}\n\nINTELLIGENCE ASSESSMENT:\n${mission.changeSummary ?? 'CHANGE CONFIRMED.'}\n\nBASE SCORE: ${score.baseScore ?? 0}\nFALSE ID PENALTY: -${score.falsePenalty ?? 0}\nTIME BONUS: +${score.timeBonus ?? 0}\nPERFECT BONUS: +${score.perfectBonus ?? 0}\n-------------------------\nTOTAL SCORE: ${score.totalScore ?? 0}`;
    } else {
      bodyText = `TARGET: ${data.targetLabel ?? 'UNKNOWN'}\nTIME: ${data.elapsedSeconds ?? 0}s\nFALSE IDENTIFICATIONS: ${data.falseIdentifications ?? 0}\n\nBASE SCORE: ${score.baseScore ?? 0}\nFALSE ID PENALTY: -${score.falsePenalty ?? 0}\nTIME BONUS: +${score.timeBonus ?? 0}\nPERFECT BONUS: +${score.perfectBonus ?? 0}\n-------------------------\nTOTAL SCORE: ${score.totalScore ?? 0}`;
    }

    this.body = this.add.text(0, 0, bodyText, {
      fontFamily: GAME_CONFIG.typography.family, fontSize: '15px', color: GAME_CONFIG.palette.lightGray,
      lineSpacing: 6, align: 'left',
    }).setOrigin(0.5);

    this.retry = createButton(this, 0, 0, 'RESTART MISSION', () => this.scene.start('MissionBriefing', { mission }), { width: 250, fontSize: 16 });
    this.menu = createButton(this, 0, 0, 'RETURN TO MENU', () => this.scene.start('MainMenu'), { width: 250, fontSize: 16 });
    this.scale.on('resize', this.layout, this);
    this.layout(this.scale.gameSize);
  }

  layout(gameSize) {
    this.title.setPosition(gameSize.width / 2, gameSize.height * 0.12);
    this.body.setFontSize(gameSize.width < 540 ? 12 : 15).setPosition(gameSize.width / 2, gameSize.height * 0.46).setWordWrapWidth(Math.min(680, gameSize.width - 40));
    this.retry.setPosition(gameSize.width / 2, gameSize.height - 108);
    this.menu.setPosition(gameSize.width / 2, gameSize.height - 50);
  }
}
