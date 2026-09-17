import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import { createButton } from '../ui/createButton.js';
import { createTerminalChrome, prefersReducedMotion, typeText } from '../ui/presentation.js';
import { createLocateMission } from '../game/locateMission.js';
import { getGeneratorOptions } from '../game/missionGenerator.js';

export default class MissionBriefingScene extends Phaser.Scene {
  constructor() { super('MissionBriefing'); }

  create(data = {}) {
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
    }).setOrigin(0.5);
    this.documentCode = this.add.text(0, 0, `FILE: ${this.mission.id ?? 'UNASSIGNED'} // EYES ONLY`, {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '10px',
      color: GAME_CONFIG.palette.gray,
    }).setOrigin(0.5);

    const generatorOptions = getGeneratorOptions();
    const regionLine = this.mission.region ? `\nREGION: ${this.mission.region.label}` : '';
    const generatedLine = this.mission.generated ? '\nSOURCE: PROCEDURAL RECON TASKING' : '';
    const seedLine = generatorOptions.debugMission && this.mission.seed ? `\nGENERATOR SEED: ${this.mission.seed}\nGENERATION ATTEMPT: ${this.mission.generationAttempt ?? 'FALLBACK'}` : '';
    const countInstruction = this.mission.mode === 'COUNT'
      ? '\n\nANALYST NOTE:\nCOUNT ONLY THE REQUESTED CATEGORY. CIVILIAN OR UNRELATED OBJECTS MAY BE PRESENT.'
      : '';
    const changeInstruction = this.mission.mode === 'CHANGE'
      ? `\n\nIMAGE COMPARISON:\n${this.mission.passA?.label ?? 'PASS A'}: ${this.mission.passA?.time ?? 'UNKNOWN'}\n${this.mission.passB?.label ?? 'PASS B'}: ${this.mission.passB?.time ?? 'UNKNOWN'}\nTERRAIN ALIGNMENT IS IDENTICAL. MARK THE CHANGED OBJECT.`
      : '';

    this.fullBriefing = `${this.mission.operation}\n\nSATELLITE PASS: ${this.mission.satellitePass}\nSECTOR: ${this.mission.sector}\nMODE: ${this.mission.mode}${regionLine}${generatedLine}${seedLine}\n\nPRIMARY OBJECTIVE:\n${this.mission.objective}${countInstruction}${changeInstruction}\n\nANALYSIS WINDOW: ${this.mission.timeLimitSeconds} SECONDS`;

    this.briefing = this.add.text(0, 0, '', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '16px',
      color: GAME_CONFIG.palette.offWhite,
      lineSpacing: 7,
      align: 'left',
    }).setOrigin(0.5);

    this.stamp = this.add.text(0, 0, 'RESTRICTED', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '14px',
      fontStyle: 'bold',
      color: GAME_CONFIG.palette.lightGray,
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setAngle(-4).setAlpha(0.68);

    this.acquisition = this.add.text(0, 0, '', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '15px',
      color: GAME_CONFIG.palette.offWhite,
      align: 'center',
      backgroundColor: GAME_CONFIG.palette.nearBlack,
      padding: { x: 18, y: 14 },
    }).setOrigin(0.5).setDepth(50).setVisible(false);

    this.begin = createButton(this, 0, 0, 'ACQUIRE IMAGERY', () => this.beginRecon());
    this.back = createButton(this, 0, 0, 'RETURN', () => this.scene.start('MainMenu'), { width: 180, fontSize: 16 });

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
    const compact = width < 540;
    const panelWidth = Math.min(780, width - (compact ? 28 : 70));
    const panelTop = Math.max(64, height * 0.10);
    const panelBottom = height - 136;

    this.documentGraphics.clear();
    this.documentGraphics.fillStyle(0x171717, 0.38).fillRect(width / 2 - panelWidth / 2, panelTop, panelWidth, Math.max(120, panelBottom - panelTop));
    this.documentGraphics.lineStyle(1, 0xbdbdbd, 0.38).strokeRect(width / 2 - panelWidth / 2, panelTop, panelWidth, Math.max(120, panelBottom - panelTop));
    this.documentGraphics.lineStyle(2, 0xf6f6ee, 0.55).lineBetween(width / 2 - panelWidth / 2, panelTop + 44, width / 2 + panelWidth / 2, panelTop + 44);

    this.header.setPosition(width / 2, panelTop + 20);
    this.documentCode.setPosition(width / 2, panelTop + 58).setVisible(height >= 430);
    this.briefing
      .setFontSize(compact ? 11 : 15)
      .setWordWrapWidth(panelWidth - (compact ? 30 : 64))
      .setPosition(width / 2, panelTop + (panelBottom - panelTop) * 0.55);
    this.stamp.setPosition(width / 2 + panelWidth * 0.32, panelTop + 68).setVisible(width >= 500);
    this.begin.setPosition(width / 2, height - 100);
    this.back.setPosition(width / 2, height - 48);
    this.acquisition.setPosition(width / 2, height / 2).setWordWrapWidth(Math.min(520, width - 44));
  }
}
