import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import { createButton } from '../ui/createButton.js';
import { createTerminalChrome } from '../ui/presentation.js';
import { createLocateMission } from '../game/locateMission.js';
import { feedback } from '../audio/feedback.js';

export default class ResultsScene extends Phaser.Scene {
  constructor() { super('Results'); }

  create(data = {}) {
    this.data = data;
    this.cameras.main.setBackgroundColor(GAME_CONFIG.palette.black);
    const success = data.success === true;
    const mission = data.mission ?? createLocateMission();
    const score = data.score ?? { baseScore: 0, timeBonus: 0, perfectBonus: 0, totalScore: 0 };
    const seedLine = mission.seed ? `\nMISSION SEED: ${mission.seed}` : '';

    this.chrome = createTerminalChrome(this, {
      station: 'INTELLIGENCE DIRECTORATE // POST-MISSION ANALYSIS',
      classification: GAME_CONFIG.presentation.classification,
    });
    this.panelGraphics = this.add.graphics();

    this.kicker = this.add.text(0, 0, 'ASSESSMENT COMPLETE // ANALYST DEBRIEF', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '11px',
      color: GAME_CONFIG.palette.gray,
      letterSpacing: 1,
    }).setOrigin(0.5);
    this.title = this.add.text(0, 0, success ? 'MISSION COMPLETE' : 'MISSION FAILED', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '32px',
      color: GAME_CONFIG.palette.offWhite,
      letterSpacing: 2,
    }).setOrigin(0.5);
    this.scoreText = this.add.text(0, 0, `TOTAL SCORE // ${score.totalScore ?? 0}`, {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '18px',
      fontStyle: 'bold',
      color: GAME_CONFIG.palette.white,
      letterSpacing: 1,
    }).setOrigin(0.5);

    let bodyText;
    if (mission.mode === 'COUNT') {
      bodyText = `REGION: ${mission.region?.label ?? 'UNKNOWN'}\nCATEGORY: ${mission.targetCategoryLabel ?? 'UNKNOWN'}\nSUBMITTED COUNT: ${data.submittedAnswer ?? 0}\nCORRECT COUNT: ${data.correctAnswer ?? mission.expectedCount ?? 0}\nTIME: ${data.elapsedSeconds ?? 0}s\nINCORRECT SUBMISSIONS: ${data.incorrectSubmissions ?? 0}${seedLine}\n\nSCORING LEDGER\nBASE SCORE: ${score.baseScore ?? 0}\nANSWER PENALTY: -${score.answerPenalty ?? 0}\nTIME BONUS: +${score.timeBonus ?? 0}\nPERFECT BONUS: +${score.perfectBonus ?? 0}`;
    } else if (mission.mode === 'CHANGE') {
      bodyText = `CHANGE TYPE: ${(mission.changeType ?? 'UNKNOWN').replaceAll('_', ' ').toUpperCase()}\nCHANGED OBJECT: ${mission.targetLabel ?? 'UNKNOWN'}\nMARKED PASS: ${data.markedPass ?? 'N/A'}\nTIME: ${data.elapsedSeconds ?? 0}s\nFALSE IDENTIFICATIONS: ${data.falseIdentifications ?? 0}${seedLine}\n\nINTELLIGENCE ASSESSMENT\n${mission.changeSummary ?? 'CHANGE CONFIRMED.'}\n\nSCORING LEDGER\nBASE SCORE: ${score.baseScore ?? 0}\nFALSE ID PENALTY: -${score.falsePenalty ?? 0}\nTIME BONUS: +${score.timeBonus ?? 0}\nPERFECT BONUS: +${score.perfectBonus ?? 0}`;
    } else {
      bodyText = `TARGET: ${data.targetLabel ?? mission.targetLabel ?? 'UNKNOWN'}\nTIME: ${data.elapsedSeconds ?? 0}s\nFALSE IDENTIFICATIONS: ${data.falseIdentifications ?? 0}${seedLine}\n\nSCORING LEDGER\nBASE SCORE: ${score.baseScore ?? 0}\nFALSE ID PENALTY: -${score.falsePenalty ?? 0}\nTIME BONUS: +${score.timeBonus ?? 0}\nPERFECT BONUS: +${score.perfectBonus ?? 0}`;
    }

    this.body = this.add.text(0, 0, bodyText, {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '14px',
      color: GAME_CONFIG.palette.lightGray,
      lineSpacing: 6,
      align: 'left',
    }).setOrigin(0.5);

    this.disposition = this.add.text(0, 0, success ? 'INTELLIGENCE DISPOSITION: ACCEPTED' : 'INTELLIGENCE DISPOSITION: INCOMPLETE', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '10px',
      color: GAME_CONFIG.palette.gray,
    }).setOrigin(0.5);

    this.retry = createButton(this, 0, 0, 'RESTART MISSION', () => this.scene.start('MissionBriefing', { mission }), { width: 250, fontSize: 16 });
    this.menu = createButton(this, 0, 0, 'RETURN TO CONSOLE', () => this.scene.start('MainMenu'), { width: 250, fontSize: 16 });
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
    this.layout(this.scale.gameSize);

    this.time.delayedCall(120, () => feedback(success ? 'complete' : 'fail', success ? [12, 20, 24] : [24, 35, 24]));
  }

  layout(gameSize) {
    const { width, height } = gameSize;
    this.chrome.layout(gameSize);
    const compact = width < 540;
    const panelWidth = Math.min(720, width - (compact ? 28 : 64));
    const panelTop = Math.max(58, height * 0.08);
    const panelBottom = height - 132;

    this.panelGraphics.clear();
    this.panelGraphics.fillStyle(0x171717, 0.34).fillRect(width / 2 - panelWidth / 2, panelTop, panelWidth, Math.max(180, panelBottom - panelTop));
    this.panelGraphics.lineStyle(1, 0xbdbdbd, 0.36).strokeRect(width / 2 - panelWidth / 2, panelTop, panelWidth, Math.max(180, panelBottom - panelTop));
    this.panelGraphics.lineStyle(2, 0xf6f6ee, 0.52).lineBetween(width / 2 - panelWidth / 2, panelTop + 48, width / 2 + panelWidth / 2, panelTop + 48);

    this.kicker.setPosition(width / 2, panelTop + 18);
    this.title.setFontSize(compact ? 24 : 32).setPosition(width / 2, panelTop + 76);
    this.scoreText.setFontSize(compact ? 15 : 18).setPosition(width / 2, panelTop + 112);
    this.body
      .setFontSize(compact ? 11 : 14)
      .setPosition(width / 2, panelTop + (panelBottom - panelTop) * 0.59)
      .setWordWrapWidth(panelWidth - (compact ? 28 : 70));
    this.disposition.setPosition(width / 2, panelBottom - 16).setVisible(height >= 470);
    this.retry.setPosition(width / 2, height - 96);
    this.menu.setPosition(width / 2, height - 46);
  }
}
