import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import { createButton } from '../ui/createButton.js';
import { createTerminalChrome } from '../ui/presentation.js';
import { createFocusGroup } from '../ui/focusGroup.js';
import { UI_TOKENS, hexToNumber } from '../ui/designTokens.js';
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
    }).setOrigin(0, 0.5);
    this.title = this.add.text(0, 0, success ? 'MISSION COMPLETE' : 'MISSION FAILED', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '32px',
      color: success ? UI_TOKENS.text.positiveBright : UI_TOKENS.text.negative,
      letterSpacing: 2,
    }).setOrigin(0, 0.5);
    this.scoreText = this.add.text(0, 0, `TOTAL SCORE // ${score.totalScore ?? 0}`, {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '18px',
      fontStyle: 'bold',
      color: UI_TOKENS.text.attention,
      letterSpacing: 1,
    }).setOrigin(1, 0.5);

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
    }).setOrigin(0, 0);

    this.disposition = this.add.text(0, 0, success ? 'INTELLIGENCE DISPOSITION: ACCEPTED' : 'INTELLIGENCE DISPOSITION: INCOMPLETE', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '10px',
      color: success ? UI_TOKENS.text.positive : UI_TOKENS.text.negative,
    }).setOrigin(0, 0.5);

    this.retry = createButton(this, 0, 0, 'RESTART MISSION', () => this.scene.start('MissionBriefing', { mission }), { width: 250, fontSize: 16, variant: 'primary' });
    this.menu = createButton(this, 0, 0, 'RETURN TO CONSOLE', () => this.scene.start('MainMenu'), { width: 250, fontSize: 16, variant: 'secondary' });
    this.focusGroup = createFocusGroup(this, [this.retry, this.menu]);
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
    this.layout(this.scale.gameSize);

    this.time.delayedCall(120, () => feedback(success ? 'complete' : 'fail'));
  }

  layout(gameSize) {
    const { width, height } = gameSize;
    this.chrome.layout(gameSize);
    const compact = width < 600;
    const narrowHeader = width < 520;
    const short = height < 560;
    const sideMargin = compact ? 18 : 36;
    const panelWidth = Math.min(860, width - sideMargin * 2);
    const panelLeft = width / 2 - panelWidth / 2;
    const controlsHeight = compact ? 116 : 82;
    const panelTop = Math.max(54, short ? 52 : height * 0.07);
    const panelBottom = Math.max(panelTop + (narrowHeader ? 252 : 230), height - controlsHeight - 22);
    const panelHeight = panelBottom - panelTop;
    const paddingX = compact ? 18 : 30;
    const headerDividerY = panelTop + (narrowHeader ? 146 : 124);

    this.panelGraphics.clear();
    const statusAccent = hexToNumber(this.data?.success === true ? UI_TOKENS.color.phosphor : UI_TOKENS.color.rust);
    this.panelGraphics.fillStyle(hexToNumber(UI_TOKENS.surface.panel), UI_TOKENS.surface.panelAlpha).fillRect(panelLeft, panelTop, panelWidth, panelHeight);
    this.panelGraphics.lineStyle(1, hexToNumber(UI_TOKENS.surface.panelBorder), UI_TOKENS.surface.panelBorderAlpha).strokeRect(panelLeft, panelTop, panelWidth, panelHeight);
    this.panelGraphics.lineStyle(2, statusAccent, 0.7).lineBetween(panelLeft, panelTop + 48, panelLeft + panelWidth, panelTop + 48);
    this.panelGraphics.lineStyle(1, hexToNumber(UI_TOKENS.surface.divider), 0.24).lineBetween(panelLeft + paddingX, headerDividerY, panelLeft + panelWidth - paddingX, headerDividerY);
    this.panelGraphics.lineStyle(1, hexToNumber(UI_TOKENS.surface.divider), 0.22).lineBetween(panelLeft + paddingX, panelBottom - 32, panelLeft + panelWidth - paddingX, panelBottom - 32);

    this.kicker.setFontSize(compact ? 9 : 11).setPosition(panelLeft + paddingX, panelTop + 24);
    this.title.setFontSize(compact ? 23 : (short ? 26 : 32)).setPosition(panelLeft + paddingX, panelTop + 82);

    if (narrowHeader) {
      this.scoreText
        .setOrigin(0, 0.5)
        .setFontSize(13)
        .setPosition(panelLeft + paddingX, panelTop + 116);
    } else {
      this.scoreText
        .setOrigin(1, 0.5)
        .setFontSize(compact ? 14 : 18)
        .setPosition(panelLeft + panelWidth - paddingX, panelTop + 82);
    }

    const bodyTop = panelTop + (narrowHeader ? 158 : (short ? 136 : 145));
    this.body
      .setFontSize(short ? (compact ? 9 : 10) : (compact ? 11 : 13))
      .setLineSpacing(short ? 2 : 5)
      .setPosition(panelLeft + paddingX, bodyTop)
      .setWordWrapWidth(panelWidth - paddingX * 2);

    this.disposition
      .setFontSize(compact ? 8 : 10)
      .setPosition(panelLeft + paddingX, panelBottom - 17)
      .setVisible(height >= 430);

    if (compact) {
      this.retry.setPosition(width / 2, height - 90);
      this.menu.setPosition(width / 2, height - 42);
    } else {
      this.retry.setPosition(width / 2 - 135, height - 48);
      this.menu.setPosition(width / 2 + 135, height - 48);
    }
  }
}
