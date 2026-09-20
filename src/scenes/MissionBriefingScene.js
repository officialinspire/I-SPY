import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import { createButton } from '../ui/createButton.js';
import { createTerminalChrome, prefersReducedMotion, typeText } from '../ui/presentation.js';
import { createFocusGroup } from '../ui/focusGroup.js';
import { UI_TOKENS, hexToNumber } from '../ui/designTokens.js';
import { createLocateMission } from '../game/locateMission.js';
import { getGeneratorOptions } from '../game/missionGenerator.js';
import { resolveReconMapEntry } from '../world/mapRegistry.js';
import { musicManager, MUSIC_STATES } from '../audio/musicManager.js';

export default class MissionBriefingScene extends Phaser.Scene {
  constructor() { super('MissionBriefing'); }

  create(data = {}) {
    // Phaser reuses Scene instances after shutdown. Reset this per-run guard
    // so a completed mission cannot leave the next briefing permanently locked.
    this.transitioning = false;
    musicManager.request(MUSIC_STATES.MENU);
    this.mission = data.mission ?? createLocateMission();
    this.reducedMotion = prefersReducedMotion();
    this.cameras.main.setBackgroundColor(GAME_CONFIG.palette.black);
    this.chrome = createTerminalChrome(this, {
      station: 'INTELLIGENCE DIRECTORATE // MISSION TASKING',
      classification: GAME_CONFIG.presentation.classification,
    });
    this.documentGraphics = this.add.graphics();

    this.header = this.add.text(0, 0, 'INTELLIGENCE TASKING ORDER', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '13px',
      color: GAME_CONFIG.palette.lightGray,
      letterSpacing: 2,
    }).setOrigin(0, 0.5);
    this.documentCode = this.add.text(0, 0, `FILE: ${this.mission.id ?? 'UNASSIGNED'} // EYES ONLY`, {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '10px',
      color: GAME_CONFIG.palette.gray,
    }).setOrigin(1, 0.5);

    const generatorOptions = getGeneratorOptions();
    // The sector line names the map the recon scene will build, so a mission
    // that carries only a mapId still reads correctly on the tasking order.
    const sector = this.mission.sector ?? resolveReconMapEntry(this.mission).title;
    const regionLine = this.mission.region ? `\nREGION: ${this.mission.region.label}` : '';
    const generatedLine = this.mission.generated ? '\nSOURCE: PROCEDURAL RECON TASKING' : '';
    const seedLine = generatorOptions.debugMission && this.mission.seed ? `\nGENERATOR SEED: ${this.mission.seed}\nGENERATION ATTEMPT: ${this.mission.generationAttempt ?? 'FALLBACK'}` : '';
    const countInstruction = this.mission.mode === 'COUNT'
      ? '\n\nANALYST NOTE:\nCOUNT ONLY THE REQUESTED CATEGORY. CIVILIAN OR UNRELATED OBJECTS MAY BE PRESENT.'
      : '';
    const changeInstruction = this.mission.mode === 'CHANGE'
      ? `\n\nIMAGE COMPARISON:\n${this.mission.passA?.label ?? 'PASS A'}: ${this.mission.passA?.time ?? 'UNKNOWN'}\n${this.mission.passB?.label ?? 'PASS B'}: ${this.mission.passB?.time ?? 'UNKNOWN'}\nTERRAIN ALIGNMENT IS IDENTICAL. MARK THE CHANGED OBJECT.`
      : '';
    const directiveLine = this.mission.directive
      ? `\n\nSECONDARY DIRECTIVE // ${this.mission.directive.label}\n${this.mission.directive.description}`
      : '';
    const series = this.mission.operationSeries;
    const operationLine = series
      ? `\nOPERATION SERIES: ${series.kind === 'daily' ? 'DAILY DOSSIER' : series.id} // MISSION ${series.index + 1} OF ${series.modeOrder.length}${series.replay ? ' // REPLAY' : ''}${series.dailyDate ? `\nUTC DOSSIER DATE: ${series.dailyDate}` : ''}`
      : '';

    this.fullBriefing = `${this.mission.operation}\n\nSATELLITE PASS: ${this.mission.satellitePass}\nSECTOR: ${sector}\nMODE: ${this.mission.mode}\nCONDITIONS: ${this.mission.condition ?? 'CLEAR'}${regionLine}${operationLine}${generatedLine}${seedLine}\n\nPRIMARY OBJECTIVE:\n${this.mission.objective}${countInstruction}${changeInstruction}${directiveLine}\n\nANALYSIS WINDOW: ${this.mission.timeLimitSeconds} SECONDS`;

    this.briefing = this.add.text(0, 0, '', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '15px',
      color: GAME_CONFIG.palette.offWhite,
      lineSpacing: 6,
      align: 'left',
    }).setOrigin(0, 0);

    this.stamp = this.add.text(0, 0, 'RESTRICTED', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '14px',
      fontStyle: 'bold',
      color: UI_TOKENS.text.negative,
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setAngle(-4).setAlpha(0.68);

    this.acquisition = this.add.text(0, 0, '', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '15px',
      color: UI_TOKENS.text.attention,
      align: 'center',
      backgroundColor: GAME_CONFIG.palette.nearBlack,
      padding: { x: 18, y: 14 },
    }).setOrigin(0.5).setDepth(50).setVisible(false);

    this.begin = createButton(this, 0, 0, 'ACQUIRE IMAGERY', () => this.beginRecon(), { variant: 'primary', pressSound: 'acquire' });
    this.back = createButton(this, 0, 0, 'RETURN', () => this.scene.start('MainMenu'), { width: 180, fontSize: 16, variant: 'secondary' });
    this.focusGroup = createFocusGroup(this, [this.begin, this.back]);

    typeText(this, this.briefing, this.fullBriefing, {
      charsPerSecond: GAME_CONFIG.presentation.typewriterCharsPerSecond,
    });

    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
    this.layout(this.scale.gameSize);
  }

  beginRecon() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.focusGroup?.clearFocus();
    this.begin.setVisible(false);
    this.back.setVisible(false);
    this.acquisition.setText('SATELLITE PASS SELECTED\nACQUIRING ORBITAL IMAGERY...').setVisible(true);
    const delay = this.reducedMotion ? 80 : GAME_CONFIG.presentation.acquisitionDelayMs;
    if (!this.reducedMotion) {
      this.time.delayedCall(Math.round(delay * 0.55), () => this.acquisition.setText('IMAGE LOCK CONFIRMED\nOPENING ANALYSIS CHANNEL...'));
    }
    this.time.delayedCall(delay, () => this.scene.start('Recon', { mission: this.mission }));
  }

  layout(gameSize) {
    const { width, height } = gameSize;
    this.chrome.layout(gameSize);
    const compact = width < 600;
    const short = height < 560;
    const sideMargin = compact ? 18 : 36;
    const panelWidth = Math.min(900, width - sideMargin * 2);
    const panelLeft = width / 2 - panelWidth / 2;
    const controlsHeight = compact ? 148 : 82;
    const paddingX = compact ? 18 : 30;
    const bodyOffset = short ? 62 : 70;
    const briefingFont = short ? (compact ? 9 : 10) : (compact ? 11 : 14);

    this.briefing
      .setFontSize(briefingFont)
      .setLineSpacing(short ? 2 : 5)
      .setWordWrapWidth(panelWidth - paddingX * 2);

    // The order is still typing itself out, so the panel is measured against
    // the finished text rather than the characters printed so far. Without
    // this the dossier stretched to the bottom of the window whatever it had
    // to say, leaving most of the sheet empty.
    const typed = this.briefing.text;
    if (typed !== this.fullBriefing) this.briefing.setText(this.fullBriefing);
    const briefingHeight = this.briefing.height;
    if (typed !== this.fullBriefing) this.briefing.setText(typed);

    const stampVisible = width >= 540 && height >= 430;
    const areaTop = Math.max(54, short ? 46 : 62);
    const areaBottom = Math.max(areaTop + 210, height - controlsHeight - 22);
    const panelHeight = Phaser.Math.Clamp(bodyOffset + briefingHeight + (stampVisible ? 78 : 44),
      210, areaBottom - areaTop);
    const panelTop = Math.round(areaTop + (areaBottom - areaTop - panelHeight) / 2);
    const panelBottom = panelTop + panelHeight;
    const briefingTop = panelTop + bodyOffset;
    this.briefing.setPosition(panelLeft + paddingX, briefingTop);

    this.documentGraphics.clear();
    this.documentGraphics.fillStyle(hexToNumber(UI_TOKENS.surface.panel), UI_TOKENS.surface.panelAlpha).fillRect(panelLeft, panelTop, panelWidth, panelHeight);
    this.documentGraphics.lineStyle(1, hexToNumber(UI_TOKENS.surface.panelBorder), UI_TOKENS.surface.panelBorderAlpha).strokeRect(panelLeft, panelTop, panelWidth, panelHeight);
    this.documentGraphics.lineStyle(2, hexToNumber(UI_TOKENS.surface.panelAccent), UI_TOKENS.surface.panelAccentAlpha).lineBetween(panelLeft, panelTop + 48, panelLeft + panelWidth, panelTop + 48);
    this.documentGraphics.lineStyle(1, hexToNumber(UI_TOKENS.surface.divider), 0.22).lineBetween(panelLeft + paddingX, panelBottom - 30, panelLeft + panelWidth - paddingX, panelBottom - 30);

    this.header.setFontSize(compact ? 11 : 13).setPosition(panelLeft + paddingX, panelTop + 24);
    this.documentCode.setFontSize(compact ? 8 : 10).setPosition(panelLeft + panelWidth - paddingX, panelTop + 24).setVisible(width >= 470);

    this.stamp
      .setFontSize(short ? 11 : 14)
      .setPosition(panelLeft + panelWidth - (compact ? 58 : 82), panelBottom - 52)
      .setVisible(stampVisible);

    if (compact) {
      // Stacked controls need a gap between them and have to clear the
      // terminal chrome caption along the bottom edge.
      this.begin.setPosition(width / 2, height - 112);
      this.back.setPosition(width / 2, height - 58);
    } else {
      this.begin.setPosition(width / 2 - 115, height - 48);
      this.back.setPosition(width / 2 + 150, height - 48);
    }

    this.acquisition.setPosition(width / 2, height / 2).setWordWrapWidth(Math.min(520, width - 36));
  }
}
