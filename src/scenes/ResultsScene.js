import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import { createButton } from '../ui/createButton.js';
import { createTerminalChrome } from '../ui/presentation.js';
import { createFocusGroup } from '../ui/focusGroup.js';
import { UI_TOKENS, hexToNumber } from '../ui/designTokens.js';
import { createLocateMission } from '../game/locateMission.js';
import { createGeneratedMission } from '../game/missionGenerator.js';
import { feedback } from '../audio/feedback.js';
import { recordMissionResult, recordOperationOutcome, recordOperationStarted } from '../game/analystRecord.js';
import { operationCleanSweep, resolveOperationMissionResult, restartOperation } from '../game/operationSeries.js';

export default class ResultsScene extends Phaser.Scene {
  constructor() { super('Results'); }

  create(data = {}) {
    this.data = data;
    this.cameras.main.setBackgroundColor(GAME_CONFIG.palette.black);
    const success = data.success === true;
    const mission = data.mission ?? createLocateMission();
    const score = data.score ?? { baseScore: 0, timeBonus: 0, perfectBonus: 0, directiveBonus: 0, totalScore: 0 };
    const performance = data.performance ?? { grade: success ? 'C' : 'C', performanceScore: 0, directive: null };
    const seedLine = mission.seed ? `\nMISSION SEED: ${mission.seed}` : '';
    const gradeLine = `\nPERFORMANCE GRADE: ${performance.grade ?? 'C'} // ${performance.performanceScore ?? 0}`;
    const directiveLine = mission.directive
      ? `\nDIRECTIVE: ${mission.directive.label} // ${performance.directive?.completed ? 'COMPLETE' : 'FAILED'}\nDIRECTIVE BONUS: +${score.directiveBonus ?? 0}`
      : '';

    const recordUpdate = recordMissionResult(mission, {
      ...data,
      success,
      score,
      performance,
      errors: performance.errors ?? 0,
    });
    const operationOutcome = resolveOperationMissionResult(mission, { ...data, success, score, performance });
    const operationFinal = operationOutcome && operationOutcome.status !== 'continue';
    const operationRecord = operationFinal
      ? recordOperationOutcome(operationOutcome.context, operationOutcome.status, data.resultId)
      : null;
    const operationContext = operationOutcome?.context ?? null;
    const operationScore = operationContext?.cumulative?.score ?? score.totalScore ?? 0;
    const operationLabel = operationContext?.kind === 'daily' ? 'DAILY DOSSIER' : 'OPERATION SERIES';
    const titleText = operationOutcome
      ? operationOutcome.status === 'complete' ? `${operationLabel} COMPLETE`
        : operationOutcome.status === 'failed' ? `${operationLabel} FAILED`
          : `MISSION ${operationContext.index + 1} OF ${operationContext.modeOrder.length} COMPLETE`
      : (success ? 'MISSION COMPLETE' : 'MISSION FAILED');

    this.chrome = createTerminalChrome(this, {
      station: 'INTELLIGENCE DIRECTORATE // POST-MISSION ANALYSIS',
      classification: GAME_CONFIG.presentation.classification,
    });
    this.panelGraphics = this.add.graphics();

    this.kicker = this.add.text(0, 0, operationOutcome ? `${operationLabel} // SERIES DEBRIEF` : 'ASSESSMENT COMPLETE // ANALYST DEBRIEF', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '11px',
      color: GAME_CONFIG.palette.gray,
      letterSpacing: 1,
    }).setOrigin(0, 0.5);
    this.title = this.add.text(0, 0, titleText, {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '32px',
      color: operationOutcome ? (operationOutcome.status === 'failed' ? UI_TOKENS.text.negative : UI_TOKENS.text.positiveBright) : (success ? UI_TOKENS.text.positiveBright : UI_TOKENS.text.negative),
      letterSpacing: 2,
    }).setOrigin(0, 0.5);
    this.scoreText = this.add.text(0, 0, `${operationOutcome ? 'SERIES SCORE' : 'TOTAL SCORE'} // ${operationOutcome ? operationScore : (score.totalScore ?? 0)}`, {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '18px',
      fontStyle: 'bold',
      color: UI_TOKENS.text.attention,
      letterSpacing: 1,
    }).setOrigin(1, 0.5);

    let bodyText;
    if (mission.mode === 'COUNT') {
      bodyText = `REGION: ${mission.region?.label ?? 'UNKNOWN'}\nCATEGORY: ${mission.targetCategoryLabel ?? 'UNKNOWN'}\nSUBMITTED COUNT: ${data.submittedAnswer ?? 0}\nCORRECT COUNT: ${data.correctAnswer ?? mission.expectedCount ?? 0}\nTIME: ${data.elapsedSeconds ?? 0}s\nINCORRECT SUBMISSIONS: ${data.incorrectSubmissions ?? 0}${gradeLine}${directiveLine}${seedLine}\n\nSCORING LEDGER\nBASE SCORE: ${score.baseScore ?? 0}\nANSWER PENALTY: -${score.answerPenalty ?? 0}\nTIME BONUS: +${score.timeBonus ?? 0}\nPERFECT BONUS: +${score.perfectBonus ?? 0}\nDIRECTIVE BONUS: +${score.directiveBonus ?? 0}`;
    } else if (mission.mode === 'CHANGE') {
      bodyText = `CHANGE TYPE: ${(mission.changeType ?? 'UNKNOWN').replaceAll('_', ' ').toUpperCase()}\nCHANGED OBJECT: ${mission.targetLabel ?? 'UNKNOWN'}\nMARKED PASS: ${data.markedPass ?? 'N/A'}\nTIME: ${data.elapsedSeconds ?? 0}s\nFALSE IDENTIFICATIONS: ${data.falseIdentifications ?? 0}${gradeLine}${directiveLine}${seedLine}\n\nINTELLIGENCE ASSESSMENT\n${mission.changeSummary ?? 'CHANGE CONFIRMED.'}\n\nSCORING LEDGER\nBASE SCORE: ${score.baseScore ?? 0}\nFALSE ID PENALTY: -${score.falsePenalty ?? 0}\nTIME BONUS: +${score.timeBonus ?? 0}\nPERFECT BONUS: +${score.perfectBonus ?? 0}\nDIRECTIVE BONUS: +${score.directiveBonus ?? 0}`;
    } else {
      bodyText = `TARGET: ${data.targetLabel ?? mission.targetLabel ?? 'UNKNOWN'}\nTIME: ${data.elapsedSeconds ?? 0}s\nFALSE IDENTIFICATIONS: ${data.falseIdentifications ?? 0}${gradeLine}${directiveLine}${seedLine}\n\nSCORING LEDGER\nBASE SCORE: ${score.baseScore ?? 0}\nFALSE ID PENALTY: -${score.falsePenalty ?? 0}\nTIME BONUS: +${score.timeBonus ?? 0}\nPERFECT BONUS: +${score.perfectBonus ?? 0}\nDIRECTIVE BONUS: +${score.directiveBonus ?? 0}`;
    }

    const recordFlags = [
      recordUpdate.newBestScore ? 'NEW BEST SCORE' : null,
      recordUpdate.newFastestTime ? 'NEW FASTEST TIME' : null,
    ].filter(Boolean);
    const recordStatus = recordUpdate.duplicate
      ? 'MISSION ALREADY LOGGED'
      : (recordFlags.length ? recordFlags.join(' // ') : 'MISSION LOGGED');
    bodyText += `\n\nANALYST RECORD\n${recordStatus}\nCURRENT STREAK: ${recordUpdate.streak}`;

    if (operationOutcome) {
      const cumulative = operationContext.cumulative;
      const progress = Math.min(operationContext.index + 1, operationContext.modeOrder.length);
      bodyText += `\n\n${operationLabel}\nPROGRESS: ${progress}/${operationContext.modeOrder.length} // WINS ${cumulative.wins} // ERRORS ${cumulative.errors}\nSERIES SCORE: ${cumulative.score} // DIRECTIVES: ${cumulative.directives}\nGRADES: ${cumulative.grades.join(' / ')}`;
      if (operationOutcome.status === 'continue') {
        bodyText += `\nNEXT TASKING: ${operationOutcome.nextMission.mode}`;
      } else {
        const clean = operationCleanSweep(operationContext);
        const pb = operationRecord?.newDailyBest || operationRecord?.newBest;
        const operationStatus = operationRecord?.duplicate
          ? 'RESULT ALREADY LOGGED'
          : (pb ? 'NEW OPERATION BEST' : 'RECORD RETAINED');
        bodyText += `\nCLEAN SWEEP: ${clean ? 'YES' : 'NO'} // ${operationStatus}`;
        if (operationContext.kind === 'daily') {
          bodyText += `\nUTC DATE: ${operationContext.dailyDate} // ${operationContext.replay ? 'REPLAY' : 'FIRST ATTEMPT'}`;
        }
      }
    }

    this.body = this.add.text(0, 0, bodyText, {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '14px',
      color: GAME_CONFIG.palette.lightGray,
      lineSpacing: 6,
      align: 'left',
    }).setOrigin(0, 0);

    const dispositionText = operationOutcome
      ? operationOutcome.status === 'continue' ? 'OPERATION DISPOSITION: CONTINUE'
        : operationOutcome.status === 'complete' ? 'OPERATION DISPOSITION: COMPLETE'
          : 'OPERATION DISPOSITION: TERMINATED'
      : (success ? 'INTELLIGENCE DISPOSITION: ACCEPTED' : 'INTELLIGENCE DISPOSITION: INCOMPLETE');
    this.disposition = this.add.text(0, 0, dispositionText, {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '10px',
      color: operationOutcome ? (operationOutcome.status === 'failed' ? UI_TOKENS.text.negative : UI_TOKENS.text.positive) : (success ? UI_TOKENS.text.positive : UI_TOKENS.text.negative),
    }).setOrigin(0, 0.5);

    const nextAction = () => {
      if (operationOutcome) {
        if (operationOutcome.status === 'continue') {
          this.scene.start('MissionBriefing', { mission: operationOutcome.nextMission });
          return;
        }
        const restarted = restartOperation(operationContext);
        recordOperationStarted({ kind: restarted.context.kind, dailyDate: restarted.context.dailyDate });
        this.scene.start('MissionBriefing', { mission: restarted.mission });
        return;
      }
      if (!success) {
        this.scene.start('MissionBriefing', { mission });
        return;
      }
      const nextMission = createGeneratedMission({ mode: mission.mode, map: mission.mapId });
      this.scene.start('MissionBriefing', { mission: nextMission });
    };
    const primaryLabel = operationOutcome
      ? operationOutcome.status === 'continue' ? 'CONTINUE OPERATION'
        : operationContext.kind === 'daily' ? 'REPLAY DAILY DOSSIER'
          : operationOutcome.status === 'failed' ? 'RETRY OPERATION' : 'REPLAY OPERATION'
      : (success ? 'NEXT MISSION' : 'RETRY MISSION');
    this.retry = createButton(this, 0, 0, primaryLabel, nextAction, { width: 250, fontSize: 16, variant: 'primary' });
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
    const controlsHeight = compact ? 148 : 82;
    const paddingX = compact ? 18 : 30;
    const bodyOffset = narrowHeader ? 158 : (short ? 136 : 145);

    // The debrief is measured before the panel is drawn, so the panel can be
    // sized to the debrief instead of stretching to the bottom of the window
    // and leaving a deep empty box under the last ledger line.
    const extendedDebrief = Boolean(this.data?.mission?.operationSeries);
    const baseBodyFont = short ? (compact ? 9 : 10) : (compact ? 11 : 13);
    this.body
      .setFontSize(extendedDebrief ? Math.max(7, baseBodyFont - 2) : baseBodyFont)
      .setLineSpacing(extendedDebrief ? (short ? 1 : 3) : (short ? 2 : 5))
      .setWordWrapWidth(panelWidth - paddingX * 2);

    const showDisposition = height >= 430;
    const areaTop = Math.max(54, short ? 46 : 62);
    const areaBottom = Math.max(areaTop + 230, height - controlsHeight - 22);
    const panelHeight = Phaser.Math.Clamp(bodyOffset + this.body.height + (showDisposition ? 58 : 26),
      narrowHeader ? 252 : 230, areaBottom - areaTop);
    const panelTop = Math.round(areaTop + (areaBottom - areaTop - panelHeight) / 2);
    const panelBottom = panelTop + panelHeight;
    const headerDividerY = panelTop + (narrowHeader ? 146 : 124);
    const bodyTop = panelTop + bodyOffset;
    this.body.setPosition(panelLeft + paddingX, bodyTop);

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

    this.disposition
      .setFontSize(compact ? 8 : 10)
      .setPosition(panelLeft + paddingX, panelBottom - 17)
      .setVisible(showDisposition);

    if (compact) {
      // Stacked controls need a gap between them and have to clear the
      // terminal chrome caption along the bottom edge.
      this.retry.setPosition(width / 2, height - 112);
      this.menu.setPosition(width / 2, height - 58);
    } else {
      this.retry.setPosition(width / 2 - 135, height - 48);
      this.menu.setPosition(width / 2 + 135, height - 48);
    }
  }
}
