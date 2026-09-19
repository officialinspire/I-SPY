import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import { createButton } from '../ui/createButton.js';
import { createTerminalChrome, prefersReducedMotion } from '../ui/presentation.js';
import { createFocusGroup } from '../ui/focusGroup.js';
import { UI_TOKENS, hexToNumber } from '../ui/designTokens.js';
import { SPRITE_SHEETS } from '../assets/spriteManifest.js';
import { createLocateMission } from '../game/locateMission.js';
import { createCountMission } from '../game/countMission.js';
import { createChangeDetectionMission } from '../game/changeDetectionMission.js';
import { createGeneratedMission, getGeneratorOptions } from '../game/missionGenerator.js';
import { createDailyDossier, createOperationSeries, utcDateKey } from '../game/operationSeries.js';
import { getDailyStatus, recordOperationStarted } from '../game/analystRecord.js';
import { isAnySector, listSectorOptions, normalizeSector, sectorTitle } from '../world/mapRegistry.js';
import { cycleHapticsLevel, cycleMasterVolume, getSettings, updateSettings } from '../settings/userSettings.js';
import { feedback, hapticsSupported } from '../audio/feedback.js';
import { TRAINING_STEP_COUNT, resumeTrainingStep } from '../game/trainingMissions.js';
import { fadeIn } from '../ui/presentation.js';
import { INSPIRE_LOGO_KEY } from '../assets/brandAssets.js';
import { musicManager, MUSIC_STATES } from '../audio/musicManager.js';

const DEFAULT_READOUT = 'SELECT A TASKING TO BEGIN';
const GUIDE_READOUT = 'IDENTIFICATION GUIDE // RECOGNITION MANUAL FOR EVERY OBJECT CLASS';

/** Shown once, on a device's first launch. Two offers and a way past them. */
const ORIENTATION_BODY = [
  // Flowing sentences rather than hand-broken lines: the panel wraps them to
  // whatever width it has, so a phone does not inherit a desktop's line ends.
  'THIS CONSOLE READS SATELLITE IMAGERY. TWO THINGS HELP BEFORE A FIRST TASKING, AND NEITHER IS REQUIRED.',
  '',
  'ANALYST TRAINING WALKS THE CONSOLE, STEP BY STEP.',
  'IDENTIFICATION GUIDE NAMES WHAT IS ON THE GROUND.',
];

const FIELD_GUIDE = [
  'PAN AND ZOOM THE IMAGERY WITH DRAG, WHEEL OR PINCH.',
  '',
  'RANDOM   SEEDED, REPLAYABLE TASKING IN ANY MODE.',
  'LOCATE   MARK THE REQUESTED TARGET, THEN CONFIRM.',
  'COUNT    INSPECT THE MARKED GRID AND SUBMIT A TOTAL.',
  'CHANGE   COMPARE PASS A / PASS B AND MARK THE CHANGE.',
  '',
  'OPERATION SERIES LINKS LOCATE, COUNT AND CHANGE IN ONE SECTOR.',
  'DAILY DOSSIER IS THE UTC-DATED OPERATION FOR THIS BUILD.',
  'ANALYST RECORD STORES LOCAL PERSONAL BESTS AND STREAKS.',
  '',
  'SECTOR PICKS THE MAP. ANY SECTOR LETS THE SEED CHOOSE.',
  '',
  'ANALYST TRAINING WALKS THE CONSOLE STEP BY STEP.',
  'IDENTIFICATION GUIDE NAMES EVERY SHAPE ON THE IMAGERY.',
  '',
  'ESC PAUSES RECON. TAB WALKS CONSOLE CONTROLS.',
];

/**
 * Density tiers, richest first. Layout picks the first one whose composed
 * height fits the viewport, so short landscape screens degrade by dropping
 * ornament rather than by overlapping.
 */
const TIERS = [
  {
    id: 'full',
    titleFont: 62, subtitleFont: 14, statusFont: 10, sectionFont: 10, readoutFont: 10,
    primaryHeight: 84, primaryFont: 21, sectorHeight: 34, sectorFont: 11, cardHeight: 78, cardFont: 16, descriptionFont: 10,
    systemHeight: 44, systemFont: 13, iconSize: 26,
    sectionGap: 20, labelGap: 16, headerGap: 22,
    showSubtitle: true, showStatus: true, showDescriptions: true, showReadout: true, showIcons: true,
  },
  {
    id: 'mid',
    titleFont: 46, subtitleFont: 12, statusFont: 9, sectionFont: 9, readoutFont: 9,
    primaryHeight: 72, primaryFont: 18, sectorHeight: 32, sectorFont: 10, cardHeight: 68, cardFont: 14, descriptionFont: 9,
    systemHeight: 40, systemFont: 12, iconSize: 22,
    sectionGap: 15, labelGap: 13, headerGap: 16,
    showSubtitle: true, showStatus: true, showDescriptions: true, showReadout: true, showIcons: true,
  },
  {
    id: 'tight',
    titleFont: 30, subtitleFont: 9, statusFont: 8, sectionFont: 8, readoutFont: 8,
    primaryHeight: 54, primaryFont: 15, sectorHeight: 28, sectorFont: 9, cardHeight: 50, cardFont: 12, descriptionFont: 8,
    systemHeight: 36, systemFont: 11, iconSize: 18,
    sectionGap: 10, labelGap: 9, headerGap: 11,
    showSubtitle: true, showStatus: true, showDescriptions: true, showReadout: false, showIcons: true,
  },
  {
    id: 'minimal',
    titleFont: 26, subtitleFont: 9, statusFont: 8, sectionFont: 8, readoutFont: 8,
    primaryHeight: 46, primaryFont: 14, sectorHeight: 26, sectorFont: 9, cardHeight: 40, cardFont: 12, descriptionFont: 8,
    systemHeight: 32, systemFont: 10, iconSize: 16,
    sectionGap: 8, labelGap: 8, headerGap: 8,
    showSubtitle: false, showStatus: true, showDescriptions: false, showReadout: false, showIcons: false,
  },
];

/** Gap between the tasking card and the sector row it is tied to. */
function sectorGap(tier) {
  return Math.round(tier.sectionGap * 0.4);
}

/** The tasking card plus its sector row, measured as one block. */
function primaryBlockHeight(tier) {
  return tier.primaryHeight + sectorGap(tier) + tier.sectorHeight;
}

const SYSTEM_GAP = 14;
/** The longest SYSTEM label decides how many will fit across a row. */
const SYSTEM_LABEL_CHARS = 'IDENTIFICATION GUIDE'.length;

/**
 * SYSTEM holds four controls and its labels are long, so the column count is
 * the widest arrangement whose cells can still hold the longest label at this
 * tier's font — four across on a desktop, two by two on a tablet, one per row
 * on a phone. Measuring the label rather than the viewport is what keeps a
 * short landscape window from folding to two tall rows it has no height for.
 */
function systemColumns(tier, innerWidth, count) {
  // Courier advances at roughly 0.6em, plus the button's own padding.
  const needed = SYSTEM_LABEL_CHARS * tier.systemFont * 0.6 + 28;
  for (const columns of [4, 2, 1]) {
    if (columns > count) continue;
    if ((innerWidth - SYSTEM_GAP * (columns - 1)) / columns >= needed) return columns;
  }
  return 1;
}

function systemBlockHeight(tier, innerWidth, count) {
  const rows = Math.ceil(count / systemColumns(tier, innerWidth, count));
  return rows * tier.systemHeight + (rows - 1) * sectorGap(tier);
}

export default class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenu'); }

  create() {
    musicManager.request(MUSIC_STATES.MENU);
    this.cameras.main.setBackgroundColor(GAME_CONFIG.palette.black);
    this.reducedMotion = prefersReducedMotion();
    this.settingsOpen = false;
    this.noticeOpen = false;
    this.orientationOpen = false;
    // ?map= wins for this visit; otherwise the console remembers the last
    // sector the analyst selected. Either way the registry has the last word,
    // so a retired sector id degrades to ANY rather than to a broken launch.
    const requestedMap = getGeneratorOptions().map;
    this.sector = normalizeSector(requestedMap ?? getSettings().sector);
    this.chrome = createTerminalChrome(this, {
      station: 'INTELLIGENCE DIRECTORATE // IMAGE ANALYSIS STATION 04',
      classification: GAME_CONFIG.presentation.classification,
    });

    this.consoleGraphics = this.add.graphics().setDepth(0);
    this.createHeader();
    this.createTasking();
    this.createSystemRow();
    this.createBranding();
    this.createNoticePanel();
    this.createSettingsPanel();
    this.createOrientationPanel();

    // Orientation first in the walk order: while it is open the console
    // behind it is disabled, and the focus group skips anything unfocusable.
    this.focusGroup = createFocusGroup(this, [...this.orientationButtons, ...this.buttons, ...this.settingsButtons], {
      onFocus: (button) => this.setReadout(this.readoutFor(button)),
    });

    // Offered once, on the first launch this device has ever had, and never
    // in the way of anyone who has already seen it.
    if (!getSettings().orientationSeen) this.showOrientation();

    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
    this.layout(this.scale.gameSize);
  }

  createBranding() {
    this.brandLogo = this.add.image(0, 0, INSPIRE_LOGO_KEY).setOrigin(1, 0.5).setAlpha(0.62);
    this.brandLink = this.add.text(0, 0, 'www.inspireclothing.art', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '9px',
      color: UI_TOKENS.text.faint,
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    this.brandLink.on('pointerup', () => {
      window.open('https://www.inspireclothing.art', '_blank', 'noopener,noreferrer');
    });
  }

  /** UI sprite frame, or undefined when the sheet is unavailable. */
  uiIcon(name) {
    const key = SPRITE_SHEETS.ui.key;
    if (!this.textures.exists(key) || !this.textures.get(key).has(name)) return undefined;
    return { texture: key, frame: name };
  }

  createHeader() {
    this.title = this.add.text(0, 0, GAME_CONFIG.title, {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '62px',
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

    const statusStyle = (color) => ({
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '10px',
      color,
      letterSpacing: 1,
    });
    this.linkIndicator = this.add.rectangle(0, 0, 6, 6, hexToNumber(UI_TOKENS.color.phosphor)).setOrigin(0.5);
    this.statusLink = this.add.text(0, 0, '', statusStyle(UI_TOKENS.text.positive)).setOrigin(0, 0.5);
    this.statusChannel = this.add.text(0, 0, '', statusStyle(UI_TOKENS.text.muted)).setOrigin(0.5);
    this.statusStation = this.add.text(0, 0, '', statusStyle(UI_TOKENS.text.muted)).setOrigin(1, 0.5);

    if (!this.reducedMotion) {
      this.tweens.add({ targets: this.linkIndicator, alpha: 0.25, duration: 900, yoyo: true, repeat: -1 });
    }

    const sectionStyle = {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '10px',
      color: UI_TOKENS.text.faint,
      letterSpacing: 2,
    };
    this.primarySectionLabel = this.add.text(0, 0, 'PRIMARY TASKING', sectionStyle).setOrigin(0, 0.5);
    this.archiveSectionLabel = this.add.text(0, 0, 'MISSION ARCHIVE // TRAINING MODES', sectionStyle).setOrigin(0, 0.5);
    this.systemSectionLabel = this.add.text(0, 0, 'SYSTEM', sectionStyle).setOrigin(0, 0.5);
    this.sectionLabels = [this.primarySectionLabel, this.archiveSectionLabel, this.systemSectionLabel];
    // A small standing on the SYSTEM rule, beside the control it refers to.
    // It records a certification; it gates nothing.
    this.certifiedMark = this.add.text(0, 0, 'ANALYST CERTIFIED', {
      ...sectionStyle,
      color: UI_TOKENS.text.positive,
    }).setOrigin(1, 0.5).setVisible(false);

    this.readout = this.add.text(0, 0, DEFAULT_READOUT, {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '10px',
      color: UI_TOKENS.text.faint,
      align: 'center',
      letterSpacing: 1,
    }).setOrigin(0.5);
  }

  createTasking() {
    this.randomCard = createButton(this, 0, 0, 'RANDOM MISSION', () => this.launchGeneratedMission(), {
      variant: 'primary',
      pressSound: 'card',
      icon: this.uiIcon('reticle_lock'),
      description: 'GENERATE A SEEDED INTELLIGENCE TASK.',
      width: 480,
      height: 84,
      fontSize: 21,
      onHover: (hovered) => this.setReadout(hovered ? this.readoutFor(this.randomCard) : DEFAULT_READOUT),
    });

    // One restrained row under the tasking card: the sector the console is
    // pointed at. It cycles rather than opening a menu, in the same idiom as
    // the settings rows, so the primary action keeps the emphasis.
    this.sectorButton = createButton(this, 0, 0, '', () => this.cycleSector(), {
      variant: 'secondary',
      pressSound: 'toggle',
      width: 480,
      height: 34,
      fontSize: 11,
      onHover: (hovered) => this.setReadout(hovered ? this.readoutFor(this.sectorButton) : DEFAULT_READOUT),
    });
    this.refreshSectorLabel();

    const modes = [
      {
        label: 'LOCATE',
        description: 'IDENTIFY A REQUESTED OBJECT.',
        icon: 'reticle',
        accentColor: UI_TOKENS.color.phosphorBright,
        launch: () => this.scene.start('MissionBriefing', { mission: createLocateMission(this.authoredMapId()) }),
      },
      {
        label: 'COUNT',
        description: 'COUNT A REQUESTED CATEGORY INSIDE A GRID.',
        icon: 'grid_dot',
        accentColor: UI_TOKENS.color.steelBright,
        launch: () => this.scene.start('MissionBriefing', { mission: createCountMission(this.authoredMapId()) }),
      },
      {
        label: 'CHANGE',
        description: 'COMPARE TWO RECONNAISSANCE PASSES.',
        icon: 'scanline_v',
        accentColor: UI_TOKENS.color.amber,
        launch: () => this.scene.start('MissionBriefing', { mission: createChangeDetectionMission(this.authoredMapId()) }),
      },
    ];

    this.modeCards = modes.map((mode) => {
      const card = createButton(this, 0, 0, mode.label, mode.launch, {
        variant: 'tactical',
        pressSound: 'card',
        icon: this.uiIcon(mode.icon),
        description: mode.description,
        accentColor: mode.accentColor,
        width: 260,
        height: 78,
        fontSize: 16,
        onHover: (hovered) => this.setReadout(hovered ? this.readoutFor(card) : DEFAULT_READOUT),
      });
      return card;
    });
  }

  createSystemRow() {
    // Training is a separate offer from the field guide: one walks the console,
    // the other is a page to read. Neither replaces the other.
    this.trainingButton = createButton(this, 0, 0, 'ANALYST TRAINING', () => this.startTraining(), {
      variant: 'secondary',
      width: 220,
      height: 44,
      fontSize: 13,
      onHover: (hovered) => this.setReadout(hovered ? this.trainingReadout() : DEFAULT_READOUT),
    });
    // Three separate offers, and none of them stands in for another: training
    // walks the console, the manual names what is on the ground, the field
    // guide is a page to read.
    this.guideButton = createButton(this, 0, 0, 'IDENTIFICATION GUIDE', () => this.scene.start('IdentificationGuide'), {
      variant: 'secondary',
      width: 220,
      height: 44,
      fontSize: 13,
      onHover: (hovered) => this.setReadout(hovered ? GUIDE_READOUT : DEFAULT_READOUT),
    });
    this.howToPlayButton = createButton(this, 0, 0, 'HOW TO PLAY', () => this.showNotice(), {
      variant: 'secondary',
      width: 220,
      height: 44,
      fontSize: 13,
      onHover: (hovered) => this.setReadout(hovered ? 'ANALYST FIELD GUIDE' : DEFAULT_READOUT),
    });
    this.operationButton = createButton(this, 0, 0, 'OPERATION SERIES', () => this.startOperationSeries(), {
      variant: 'tactical',
      width: 220,
      height: 44,
      fontSize: 13,
      onHover: (hovered) => this.setReadout(hovered ? 'OPERATION SERIES // THREE LINKED MISSIONS · ONE SECTOR' : DEFAULT_READOUT),
    });
    this.dailyButton = createButton(this, 0, 0, 'DAILY DOSSIER', () => this.startDailyDossier(), {
      variant: 'tactical',
      width: 220,
      height: 44,
      fontSize: 13,
      onHover: (hovered) => this.setReadout(hovered ? this.dailyReadout() : DEFAULT_READOUT),
    });
    this.recordButton = createButton(this, 0, 0, 'ANALYST RECORD', () => this.scene.start('AnalystRecord'), {
      variant: 'secondary',
      width: 220,
      height: 44,
      fontSize: 13,
      onHover: (hovered) => this.setReadout(hovered ? 'ANALYST RECORD // LOCAL PERSONAL BESTS AND STREAKS' : DEFAULT_READOUT),
    });
    this.settingsButton = createButton(this, 0, 0, 'SETTINGS', () => this.openSettings(), {
      variant: 'secondary',
      width: 220,
      height: 44,
      fontSize: 13,
      onHover: (hovered) => this.setReadout(hovered ? 'SYSTEM CONFIGURATION' : DEFAULT_READOUT),
    });
    this.systemButtons = [
      this.trainingButton, this.guideButton, this.howToPlayButton,
      this.operationButton, this.dailyButton, this.recordButton, this.settingsButton,
    ];
    this.buttons = [this.randomCard, this.sectorButton, ...this.modeCards, ...this.systemButtons];
    this.refreshTrainingLabel();
    this.refreshDailyLabel();
  }

  /** What the console knows about this analyst's training, in one line. */
  trainingReadout() {
    const settings = getSettings();
    if (settings.tutorialCompleted) return 'ANALYST TRAINING // CERTIFICATION COMPLETE \u00b7 REPEAT ANY TIME';
    const step = resumeTrainingStep();
    if (step > 0) return `ANALYST TRAINING // RESUME AT STEP ${step + 1} OF ${TRAINING_STEP_COUNT}`;
    return 'ANALYST TRAINING // GUIDED INTRODUCTION TO THE CONSOLE';
  }

  refreshTrainingLabel() {
    // Training is offered, never imposed: a completed certification only marks
    // the control, it does not hide it or gate anything behind it.
    this.trainingButton?.setSelected(getSettings().tutorialCompleted);
  }

  certified() {
    return getSettings().tutorialCompleted === true;
  }

  startTraining() {
    this.scene.start('Training', { step: resumeTrainingStep() });
  }

  startOperationSeries() {
    const started = createOperationSeries({ sector: this.sector });
    recordOperationStarted({ kind: 'series' });
    this.scene.start('MissionBriefing', { mission: started.mission });
  }

  dailyReadout() {
    const dateKey = utcDateKey();
    const status = getDailyStatus(dateKey);
    if (status.completions > 0) return `DAILY DOSSIER // ${dateKey} UTC · COMPLETE · BEST ${status.bestScore} · REPLAY AVAILABLE`;
    if (status.attempts > 0) return `DAILY DOSSIER // ${dateKey} UTC · ATTEMPTED · REPLAY AVAILABLE`;
    return `DAILY DOSSIER // ${dateKey} UTC · NEW DOSSIER`;
  }

  refreshDailyLabel() {
    const status = getDailyStatus(utcDateKey());
    this.dailyButton?.setSelected(status.completions > 0);
  }

  startDailyDossier() {
    const dateKey = utcDateKey();
    const status = getDailyStatus(dateKey);
    const started = createDailyDossier({ dateKey, replay: status.attempts > 0 });
    recordOperationStarted({ kind: 'daily', dailyDate: dateKey });
    this.scene.start('MissionBriefing', { mission: started.mission });
  }

  readoutFor(button) {
    if (!button) return DEFAULT_READOUT;
    if (button === this.howToPlayButton) return 'ANALYST FIELD GUIDE';
    if (button === this.settingsButton) return 'SYSTEM CONFIGURATION';
    if (button === this.trainingButton) return this.trainingReadout();
    if (button === this.guideButton) return GUIDE_READOUT;
    if (button === this.operationButton) return 'OPERATION SERIES // THREE LINKED MISSIONS · ONE SECTOR';
    if (button === this.dailyButton) return this.dailyReadout();
    if (button === this.recordButton) return 'ANALYST RECORD // LOCAL PERSONAL BESTS AND STREAKS';
    if (button === this.sectorButton) return this.sectorReadout();
    const description = button.description?.text;
    return description ? `${button.text.text} // ${description}` : button.text.text;
  }

  setReadout(message) {
    if (this.settingsOpen || this.noticeOpen || this.orientationOpen) return;
    this.readout?.setText(message || DEFAULT_READOUT);
  }

  createNoticePanel() {
    this.noticeBackdrop = this.add.rectangle(0, 0, 10, 10, hexToNumber(UI_TOKENS.color.black), 0.72)
      .setDepth(68)
      .setVisible(false);
    this.noticeGraphics = this.add.graphics().setDepth(69).setVisible(false);
    this.noticeTitle = this.add.text(0, 0, 'ANALYST FIELD GUIDE', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '14px',
      color: UI_TOKENS.text.attention,
      letterSpacing: 2,
    }).setOrigin(0, 0.5).setDepth(70).setVisible(false);
    this.noticeBody = this.add.text(0, 0, FIELD_GUIDE.join('\n'), {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '12px',
      color: UI_TOKENS.text.body,
      align: 'left',
      lineSpacing: 5,
    }).setOrigin(0, 0).setDepth(70).setVisible(false);
    this.noticeHint = this.add.text(0, 0, 'TAP OR PRESS ESC TO DISMISS', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '9px',
      color: UI_TOKENS.text.faint,
    }).setOrigin(1, 0.5).setDepth(70).setVisible(false);

    this.noticeBackdrop.on('pointerdown', () => this.hideNotice());
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.orientationOpen) this.dismissOrientation();
      else if (this.noticeOpen) this.hideNotice();
      else if (this.settingsOpen) this.closeSettings();
    });
  }

  showNotice() {
    this.noticeOpen = true;
    this.focusGroup?.clearFocus();
    this.buttons.forEach((button) => button.setEnabled(false));
    this.noticeBackdrop.setVisible(true).setInteractive({ useHandCursor: false });
    this.noticeGraphics.setVisible(true);
    this.noticeTitle.setVisible(true);
    this.noticeBody.setVisible(true);
    this.noticeHint.setVisible(true);
    fadeIn(this, [this.noticeBackdrop, this.noticeGraphics, this.noticeTitle,
      this.noticeBody, this.noticeHint]);
    this.readout?.setText('ANALYST FIELD GUIDE // OPEN');
    // No timer: a field guide that closes itself mid-sentence is a page that
    // was taken away. It waits for the backdrop or ESC.
    this.layout(this.scale.gameSize);
  }

  hideNotice() {
    if (!this.noticeOpen) return;
    this.noticeOpen = false;
    this.buttons.forEach((button) => button.setEnabled(true));
    this.noticeBackdrop.disableInteractive().setVisible(false);
    this.noticeGraphics.setVisible(false);
    this.noticeTitle.setVisible(false);
    this.noticeBody.setVisible(false);
    this.noticeHint.setVisible(false);
    this.readout?.setText(DEFAULT_READOUT);
    this.layout(this.scale.gameSize);
  }

  /**
   * First-launch orientation.
   *
   * Two offers and a way past them. It never starts a mission, it is
   * dismissible by every route a panel can be — a button, ESC, or a tap
   * outside it — and dismissing it by any of those routes is what records
   * that it has been seen.
   */
  createOrientationPanel() {
    this.orientationBackdrop = this.add.rectangle(0, 0, 10, 10, hexToNumber(UI_TOKENS.color.black), 0.82)
      .setDepth(74)
      .setVisible(false);
    this.orientationGraphics = this.add.graphics().setDepth(75).setVisible(false);
    this.orientationTitle = this.add.text(0, 0, 'ANALYST ORIENTATION', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '17px',
      color: UI_TOKENS.text.attention,
      letterSpacing: 3,
    }).setOrigin(0, 0).setDepth(76).setVisible(false);
    this.orientationBody = this.add.text(0, 0, ORIENTATION_BODY.join('\n'), {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '12px',
      color: UI_TOKENS.text.body,
      lineSpacing: 5,
    }).setOrigin(0, 0).setDepth(76).setVisible(false);
    this.orientationHint = this.add.text(0, 0, 'SKIP OR PRESS ESC TO GO STRAIGHT TO THE CONSOLE', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '9px',
      color: UI_TOKENS.text.faint,
      letterSpacing: 1,
    }).setOrigin(0.5, 0.5).setDepth(76).setVisible(false);

    const orientationButton = (label, variant, onPress) => createButton(this, 0, 0, label, onPress, {
      variant,
      width: 300,
      height: 40,
      fontSize: 13,
      pressSound: 'card',
    });
    this.orientationTrainingButton = orientationButton('BEGIN TRAINING', 'primary',
      () => this.dismissOrientation(() => this.startTraining()));
    this.orientationGuideButton = orientationButton('IDENTIFICATION GUIDE', 'secondary',
      () => this.dismissOrientation(() => this.scene.start('IdentificationGuide')));
    this.orientationSkipButton = orientationButton('SKIP', 'secondary',
      () => this.dismissOrientation());
    this.orientationButtons = [this.orientationTrainingButton, this.orientationGuideButton, this.orientationSkipButton];
    this.orientationButtons.forEach((button) => button.setDepth(77).setVisible(false));

    this.orientationBackdrop.on('pointerdown', () => this.dismissOrientation());
  }

  showOrientation() {
    this.orientationOpen = true;
    this.hideNotice();
    this.buttons.forEach((button) => button.setEnabled(false));
    this.orientationBackdrop.setVisible(true).setInteractive({ useHandCursor: false });
    this.orientationGraphics.setVisible(true);
    this.orientationTitle.setVisible(true);
    this.orientationBody.setVisible(true);
    this.orientationHint.setVisible(true);
    this.orientationButtons.forEach((button) => button.setVisible(true));
    this.focusGroup?.refresh();
    this.readout?.setText('ANALYST ORIENTATION // FIRST LAUNCH');
    fadeIn(this, [this.orientationBackdrop, this.orientationGraphics, this.orientationTitle,
      this.orientationBody, this.orientationHint]);
    this.layout(this.scale.gameSize);
  }

  /**
   * Close it and remember that it was offered. `next` runs afterwards, so a
   * choice leaves for training or the manual with the panel already put away
   * and the console behind it live again.
   */
  dismissOrientation(next) {
    if (!this.orientationOpen) return;
    this.orientationOpen = false;
    updateSettings({ orientationSeen: true });
    this.orientationBackdrop.disableInteractive().setVisible(false);
    this.orientationGraphics.setVisible(false).clear();
    this.orientationTitle.setVisible(false);
    this.orientationBody.setVisible(false);
    this.orientationHint.setVisible(false);
    this.orientationButtons.forEach((button) => button.setVisible(false));
    this.buttons.forEach((button) => button.setEnabled(true));
    this.focusGroup?.refresh();
    this.readout?.setText(DEFAULT_READOUT);
    this.layout(this.scale.gameSize);
    next?.();
  }

  layoutOrientation(gameSize) {
    const { width, height } = gameSize;
    this.orientationBackdrop.setSize(width, height).setPosition(width / 2, height / 2);
    if (this.orientationBackdrop.input) this.orientationBackdrop.input.hitArea?.setTo(0, 0, width, height);
    this.orientationGraphics.clear();
    if (!this.orientationOpen) return;

    const compact = width < 620;
    const short = height < 520;
    const padding = compact ? 16 : 22;
    const panelWidth = Math.min(520, width - (compact ? 24 : 64));
    const innerWidth = panelWidth - padding * 2;
    const buttonHeight = short ? 34 : 40;
    const rowGap = short ? 6 : 8;

    this.orientationTitle.setFontSize(compact ? 14 : 17).setWordWrapWidth(innerWidth);
    this.orientationBody.setFontSize(compact ? 10 : 12).setWordWrapWidth(innerWidth);
    const showHint = height >= 420 && width >= 380;
    this.orientationHint.setFontSize(compact ? 8 : 9).setVisible(showHint);

    const hintBlock = showHint ? this.orientationHint.height + (short ? 8 : 12) : 0;
    const panelHeight = padding + this.orientationTitle.height + (short ? 8 : 12)
      + this.orientationBody.height + (short ? 12 : 18)
      + this.orientationButtons.length * buttonHeight + (this.orientationButtons.length - 1) * rowGap
      + hintBlock + padding;
    const left = Math.round(width / 2 - panelWidth / 2);
    const top = Math.round(Math.max(12, height / 2 - panelHeight / 2));

    this.orientationGraphics
      .fillStyle(hexToNumber(UI_TOKENS.color.panel), 0.99)
      .fillRect(left, top, panelWidth, panelHeight);
    this.orientationGraphics
      .lineStyle(2, hexToNumber(UI_TOKENS.color.amber), 0.75)
      .strokeRect(left, top, panelWidth, panelHeight);

    let cursor = top + padding;
    this.orientationTitle.setPosition(left + padding, cursor);
    cursor += this.orientationTitle.height + (short ? 8 : 12);
    this.orientationGraphics
      .lineStyle(1, hexToNumber(UI_TOKENS.surface.divider), 0.34)
      .lineBetween(left + padding, cursor - (short ? 4 : 6), left + panelWidth - padding, cursor - (short ? 4 : 6));
    this.orientationBody.setPosition(left + padding, cursor);
    cursor += this.orientationBody.height + (short ? 12 : 18);

    // Stacked, full width: every choice is the same size and the same easy
    // target, on a phone as much as on a desktop.
    this.orientationButtons.forEach((button, index) => {
      button.resize({ width: innerWidth, height: buttonHeight, fontSize: compact ? 12 : 13 })
        .setPosition(left + panelWidth / 2, cursor + buttonHeight / 2 + index * (buttonHeight + rowGap));
    });
    cursor += this.orientationButtons.length * buttonHeight + (this.orientationButtons.length - 1) * rowGap;
    if (showHint) this.orientationHint.setPosition(left + panelWidth / 2, cursor + (short ? 8 : 12) + this.orientationHint.height / 2 - 2);
  }

  createSettingsPanel() {
    this.settingsGraphics = this.add.graphics().setDepth(60).setVisible(false);
    this.settingsTitle = this.add.text(0, 0, 'SYSTEM CONFIGURATION', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '20px',
      color: GAME_CONFIG.palette.offWhite,
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(61).setVisible(false);
    this.settingsHint = this.add.text(0, 0, 'LOCAL DEVICE SETTINGS // SAVED AUTOMATICALLY', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '10px',
      color: GAME_CONFIG.palette.gray,
    }).setOrigin(0.5).setDepth(61).setVisible(false);

    // The three rows that change how feedback itself behaves are voiced by
    // their handlers, not by the button. A press cue fires before the handler
    // runs, so it always answered in the state the analyst had just left:
    // turning sound on was silent, and stepping the haptics buzzed at the old
    // strength and then again at the new one. `pressSound: false` removes that
    // first cue so each of these rows acknowledges exactly once, in the state
    // it has just been put into.
    this.masterSettingButton = createButton(this, 0, 0, '', () => this.stepMasterVolume(), { width: 300, height: 40, fontSize: 13, variant: 'secondary', pressSound: false });
    this.musicSettingButton = createButton(this, 0, 0, '', () => this.toggleSetting('musicEnabled'), { width: 300, height: 40, fontSize: 13, variant: 'secondary', pressSound: 'toggle' });
    this.sfxSettingButton = createButton(this, 0, 0, '', () => this.toggleFeedbackSetting('sfxEnabled'), { width: 300, height: 40, fontSize: 13, variant: 'secondary', pressSound: false });
    this.hapticsSettingButton = createButton(this, 0, 0, '', () => this.cycleHaptics(), { width: 300, height: 40, fontSize: 13, variant: 'secondary', pressSound: false });
    this.scanlineSettingButton = createButton(this, 0, 0, '', () => this.toggleSetting('scanlinesEnabled'), { width: 300, height: 40, fontSize: 13, variant: 'secondary', pressSound: 'toggle' });
    this.grainSettingButton = createButton(this, 0, 0, '', () => this.toggleSetting('imageGrainEnabled'), { width: 300, height: 40, fontSize: 13, variant: 'secondary', pressSound: 'toggle' });
    this.closeSettingsButton = createButton(this, 0, 0, 'RETURN TO CONSOLE', () => this.closeSettings(), { width: 300, height: 40, fontSize: 13, variant: 'primary' });
    this.settingsButtons = [this.masterSettingButton, this.musicSettingButton, this.sfxSettingButton, this.hapticsSettingButton, this.scanlineSettingButton, this.grainSettingButton, this.closeSettingsButton];
    this.settingsButtons.forEach((button) => {
      button.setDepth(62);
      button.setVisible(false);
    });
    this.refreshSettingsLabels();
  }

  /**
   * Step the haptic strength, then let the new level introduce itself.
   *
   * Exactly one pulse, at the strength just chosen. OFF pulses not at all —
   * `haptic()` reads the stored level, so the cue simply has no haptic
   * channel to speak on — while the row's sound is unaffected either way.
   */
  cycleHaptics() {
    cycleHapticsLevel();
    this.refreshSettingsLabels();
    feedback('toggle');
  }

  /** Step the master level, then acknowledge at the level just set. */
  stepMasterVolume() {
    cycleMasterVolume();
    this.refreshSettingsLabels();
    feedback('toggle');
  }

  /**
   * A feedback switch acknowledges itself after the switch, never before, so
   * SOUND EFFECTS // ON is the first thing the analyst hears when they turn it
   * on and OFF is silent because it is off.
   */
  toggleFeedbackSetting(key) {
    this.toggleSetting(key);
    feedback('toggle');
  }

  toggleSetting(key) {
    const settings = getSettings();
    updateSettings({ [key]: !settings[key] });
    this.refreshSettingsLabels();
  }

  refreshSettingsLabels() {
    const settings = getSettings();
    this.masterSettingButton?.setLabel(`MASTER LEVEL // ${Math.round(settings.masterVolume * 100)}%`);
    this.masterSettingButton?.setSelected(settings.masterVolume > 0);
    this.musicSettingButton?.setLabel(`MUSIC // ${settings.musicEnabled ? 'ON' : 'OFF'}`);
    this.musicSettingButton?.setSelected(settings.musicEnabled);
    this.sfxSettingButton?.setLabel(`SOUND EFFECTS // ${settings.sfxEnabled ? 'ON' : 'OFF'}`);
    this.sfxSettingButton?.setSelected(settings.sfxEnabled);
    // A device with no vibration motor is told so rather than being offered a
    // setting that could not do anything.
    const hapticsAvailable = hapticsSupported();
    this.hapticsSettingButton?.setLabel(hapticsAvailable
      ? `HAPTICS // ${settings.hapticsLevel.toUpperCase()}`
      : 'HAPTICS // UNAVAILABLE');
    this.hapticsSettingButton?.setSelected(hapticsAvailable && settings.hapticsEnabled);
    this.hapticsSettingButton?.setEnabled(hapticsAvailable);
    this.scanlineSettingButton?.setLabel(`CRT SCANLINES // ${settings.scanlinesEnabled ? 'ON' : 'OFF'}`);
    this.scanlineSettingButton?.setSelected(settings.scanlinesEnabled);
    this.grainSettingButton?.setLabel(`IMAGE GRAIN // ${settings.imageGrainEnabled ? 'ON' : 'OFF'}`);
    this.grainSettingButton?.setSelected(settings.imageGrainEnabled);
  }

  openSettings() {
    this.settingsOpen = true;
    this.hideNotice();
    this.buttons.forEach((button) => button.setVisible(false));
    this.settingsGraphics.setVisible(true);
    this.settingsTitle.setVisible(true);
    this.settingsHint.setVisible(true);
    this.settingsButtons.forEach((button) => button.setVisible(true));
    this.refreshSettingsLabels();
    this.focusGroup?.refresh();
    this.layout(this.scale.gameSize);
    // Only the panel chrome fades: the buttons manage their own per-state
    // alphas, so tweening them would flatten accent and icon tones.
    fadeIn(this, [this.settingsGraphics, this.settingsTitle, this.settingsHint]);
  }

  closeSettings() {
    this.settingsOpen = false;
    this.title.setVisible(true);
    this.buttons.forEach((button) => button.setVisible(true));
    this.settingsGraphics.setVisible(false);
    this.settingsTitle.setVisible(false);
    this.settingsHint.setVisible(false);
    this.settingsButtons.forEach((button) => button.setVisible(false));
    this.focusGroup?.refresh();
    this.readout?.setText(DEFAULT_READOUT);
    this.layout(this.scale.gameSize);
  }

  /** The sector to author a fixed mission in; null means "wherever the console defaults to". */
  authoredMapId() {
    return isAnySector(this.sector) ? null : this.sector;
  }

  cycleSector() {
    const options = listSectorOptions();
    const index = options.findIndex((option) => option.id === this.sector);
    this.sector = options[(index + 1) % options.length].id;
    updateSettings({ sector: this.sector });
    this.refreshSectorLabel();
    this.setReadout(this.sectorReadout());
  }

  refreshSectorLabel() {
    const any = isAnySector(this.sector);
    this.sectorButton?.setLabel(`SECTOR // ${sectorTitle(this.sector)}`);
    this.sectorButton?.setSelected(!any);
  }

  sectorReadout() {
    const option = listSectorOptions().find((entry) => entry.id === this.sector);
    return option?.environment ? `SECTOR // ${option.title} — ${option.environment}` : `SECTOR // ${sectorTitle(this.sector)}`;
  }

  launchGeneratedMission() {
    const options = getGeneratorOptions();
    // `this.sector` already folds in ?map= and the stored preference, and is
    // always either ANY or a registered id.
    const mission = createGeneratedMission({ seed: options.seed, mode: options.mode, map: this.sector });
    this.scene.start('MissionBriefing', { mission });
  }

  /** Height of the whole composition at a tier, used to pick and centre it. */
  composedHeight(tier, stackCards, framePad, innerWidth) {
    const headerHeight = tier.titleFont * 1.05 + (tier.showSubtitle ? tier.subtitleFont + 12 : 0);
    const bodyHeight = this.measureTier(tier, stackCards, innerWidth) + framePad * 2;
    const readoutHeight = tier.showReadout ? tier.readoutFont + 18 : 0;
    return { headerHeight, bodyHeight, readoutHeight, total: headerHeight + tier.headerGap + bodyHeight + readoutHeight };
  }

  /** Height the console body needs at a given tier, used to pick that tier. */
  measureTier(tier, stackCards, innerWidth) {
    const archiveHeight = stackCards
      ? tier.cardHeight * 3 + tier.sectionGap * 0.4 * 2
      : tier.cardHeight;
    const sectionBlock = (bodyHeight) => tier.sectionFont + tier.labelGap + bodyHeight;
    return tier.statusFont + tier.labelGap + 6
      + sectionBlock(primaryBlockHeight(tier)) + tier.sectionGap
      + sectionBlock(archiveHeight) + tier.sectionGap
      + sectionBlock(systemBlockHeight(tier, innerWidth, this.systemButtons.length));
  }

  layout(gameSize) {
    const { width, height } = gameSize;
    this.chrome.layout(gameSize);

    const outerMargin = width < 520 ? 18 : 34;
    const contentWidth = Math.min(940, width - outerMargin * 2);
    const contentLeft = width / 2 - contentWidth / 2;
    const contentRight = contentLeft + contentWidth;
    // Narrow consoles stack; so do tall portrait screens, where a single
    // column of full-width cards reads better than a squeezed three-up row.
    const portrait = height / Math.max(1, width) > 1.25;
    const stackCards = contentWidth < 660 || (portrait && contentWidth < 820);
    const framePadX = width < 520 ? 12 : 18;
    const innerLeft = contentLeft + framePadX;
    const innerRight = contentRight - framePadX;
    const innerWidth = innerRight - innerLeft;

    const topSafe = width < 540 ? 34 : 42;
    const bottomSafe = height < 420 ? 12 : 18;
    // This slot is outside the console composition, so the footer never sits
    // over a control even when a short screen forces the minimal density tier.
    const brandingSlot = height < 480 ? 28 : 38;

    // Pick the richest tier that fits, then centre the composition in the
    // space that is left so tall screens do not hang everything off the top.
    const available = height - topSafe - bottomSafe - brandingSlot;
    const tier = TIERS.find((candidate) => this.composedHeight(candidate, stackCards, framePadX, innerWidth).total <= available)
      ?? TIERS[TIERS.length - 1];
    const composed = this.composedHeight(tier, stackCards, framePadX, innerWidth);
    const startY = topSafe + Math.max(0, (available - composed.total) * 0.42);

    this.title.setFontSize(tier.titleFont).setPosition(width / 2, startY + tier.titleFont * 0.55);
    this.subtitle
      .setFontSize(tier.subtitleFont)
      .setPosition(width / 2, this.title.y + tier.titleFont * 0.6 + tier.subtitleFont)
      .setWordWrapWidth(Math.min(620, width - 40))
      .setVisible(tier.showSubtitle && !this.settingsOpen);

    const headerBottom = tier.showSubtitle ? this.subtitle.y + tier.subtitleFont : this.title.y + tier.titleFont * 0.6;
    this.headerBottom = headerBottom;
    const frameTop = headerBottom + tier.headerGap;

    // --- console body ---
    let cursor = frameTop + framePadX;
    const statusY = cursor + tier.statusFont / 2;
    this.layoutStatus(tier, innerLeft, innerRight, statusY, contentWidth);
    cursor = statusY + tier.statusFont / 2 + tier.labelGap;
    const statusDividerY = Math.round(cursor - tier.labelGap / 2);

    const placeSection = (label, bodyHeight) => {
      const labelY = cursor + tier.sectionFont / 2;
      label.setFontSize(tier.sectionFont).setPosition(innerLeft, labelY);
      cursor = labelY + tier.sectionFont / 2 + tier.labelGap;
      const bodyTop = cursor;
      cursor += bodyHeight + tier.sectionGap;
      return { labelY, bodyTop };
    };

    const primary = placeSection(this.primarySectionLabel, primaryBlockHeight(tier));
    const primaryWidth = stackCards ? innerWidth : Math.min(innerWidth, Math.max(420, innerWidth * 0.62));
    this.randomCard
      .resize({
        width: primaryWidth,
        height: tier.primaryHeight,
        fontSize: tier.primaryFont,
        descriptionFontSize: tier.descriptionFont,
        iconSize: tier.iconSize + 4,
        padding: stackCards ? 14 : 18,
        showDescription: tier.showDescriptions,
        showIcon: tier.showIcons,
      })
      .setPosition(innerLeft + primaryWidth / 2, primary.bodyTop + tier.primaryHeight / 2);
    this.sectorButton
      .resize({ width: primaryWidth, height: tier.sectorHeight, fontSize: tier.sectorFont })
      .setPosition(innerLeft + primaryWidth / 2,
        primary.bodyTop + tier.primaryHeight + sectorGap(tier) + tier.sectorHeight / 2);

    const archiveHeight = stackCards
      ? tier.cardHeight * 3 + tier.sectionGap * 0.4 * 2
      : tier.cardHeight;
    const archive = placeSection(this.archiveSectionLabel, archiveHeight);
    const columnGap = width < 520 ? 10 : 14;
    if (stackCards) {
      const rowGap = tier.sectionGap * 0.4;
      this.modeCards.forEach((card, index) => {
        card
          .resize({
            width: innerWidth,
            height: tier.cardHeight,
            fontSize: tier.cardFont,
            descriptionFontSize: tier.descriptionFont,
            iconSize: tier.iconSize,
            padding: 14,
            showDescription: tier.showDescriptions,
            showIcon: tier.showIcons,
          })
          .setPosition(innerLeft + innerWidth / 2, archive.bodyTop + tier.cardHeight / 2 + index * (tier.cardHeight + rowGap));
      });
    } else {
      const cardWidth = (innerWidth - columnGap * 2) / 3;
      this.modeCards.forEach((card, index) => {
        card
          .resize({
            width: cardWidth,
            height: tier.cardHeight,
            fontSize: tier.cardFont,
            descriptionFontSize: Math.max(8, tier.descriptionFont - 1),
            iconSize: tier.iconSize,
            padding: 14,
            showDescription: tier.showDescriptions,
            showIcon: tier.showIcons,
          })
          .setPosition(innerLeft + cardWidth / 2 + index * (cardWidth + columnGap), archive.bodyTop + tier.cardHeight / 2);
      });
    }
    const system = placeSection(this.systemSectionLabel, systemBlockHeight(tier, innerWidth, this.systemButtons.length));
    const systemCols = systemColumns(tier, innerWidth, this.systemButtons.length);
    const systemWidth = (innerWidth - SYSTEM_GAP * (systemCols - 1)) / systemCols;
    const systemRowGap = sectorGap(tier);
    this.systemButtons.forEach((button, index) => {
      const column = index % systemCols;
      const row = Math.floor(index / systemCols);
      button
        .resize({ width: systemWidth, height: tier.systemHeight, fontSize: tier.systemFont })
        .setPosition(
          innerLeft + systemWidth / 2 + column * (systemWidth + SYSTEM_GAP),
          system.bodyTop + tier.systemHeight / 2 + row * (tier.systemHeight + systemRowGap),
        );
    });

    const frameBottom = cursor - tier.sectionGap + framePadX;
    this.readout
      .setFontSize(tier.readoutFont)
      .setPosition(width / 2, frameBottom + tier.readoutFont + 6)
      .setWordWrapWidth(contentWidth)
      .setVisible(tier.showReadout && !this.settingsOpen);
    this.sectionLabels.forEach((label) => label.setVisible(!this.settingsOpen));
    // Hidden on the narrowest consoles, where the SYSTEM rule has no room to
    // spare, and never while a panel is over the console.
    const showCertified = this.certified() && !this.settingsOpen && innerWidth >= 360;
    this.certifiedMark
      .setFontSize(tier.sectionFont)
      .setPosition(innerRight, system.labelY)
      .setVisible(showCertified);

    this.drawConsoleFrame({
      left: contentLeft,
      right: contentRight,
      top: frameTop,
      bottom: frameBottom,
      innerLeft,
      innerRight,
      statusDividerY,
      primaryLabelY: primary.labelY,
      archiveLabelY: archive.labelY,
      systemLabelY: system.labelY,
      primaryTop: primary.bodyTop,
      primaryHeight: tier.primaryHeight,
      primaryWidth,
      tier,
    });

    const brandY = height - bottomSafe - brandingSlot / 2;
    const logoWidth = width < 380 ? 54 : 68;
    const logoHeight = logoWidth * (181 / 600);
    const linkFont = width < 380 ? 8 : 9;
    this.brandLogo.setDisplaySize(logoWidth, logoHeight).setPosition(width / 2 - 7, brandY);
    this.brandLink.setFontSize(linkFont).setPosition(width / 2 + 7, brandY);

    this.layoutSettings(gameSize);
    this.layoutNotice(gameSize);
    this.layoutOrientation(gameSize);
  }

  layoutStatus(tier, innerLeft, innerRight, y, contentWidth) {
    const short = contentWidth < 620;
    const visible = tier.showStatus && !this.settingsOpen;
    this.statusLink.setFontSize(tier.statusFont)
      .setText(short ? 'LINK: AVAILABLE' : 'SATELLITE LINK: AVAILABLE')
      .setPosition(innerLeft + 12, y)
      .setVisible(visible);
    this.linkIndicator.setPosition(innerLeft + 4, y).setVisible(visible);
    this.statusChannel.setFontSize(tier.statusFont)
      .setText(short ? 'CHANNEL: READY' : 'IMAGE CHANNEL: READY')
      .setPosition((innerLeft + innerRight) / 2, y)
      .setVisible(visible && contentWidth >= 430);
    this.statusStation.setFontSize(tier.statusFont)
      .setText(short ? 'STATION: 04' : 'ANALYST STATION: 04')
      .setPosition(innerRight, y)
      .setVisible(visible);
  }

  drawConsoleFrame(box) {
    const graphics = this.consoleGraphics;
    graphics.clear();
    if (this.settingsOpen) return;

    const { left, right, top, bottom, innerLeft, innerRight, tier } = box;
    const width = right - left;
    const height = bottom - top;
    const surface = UI_TOKENS.surface;

    graphics.fillStyle(hexToNumber(surface.panel), surface.panelAlpha).fillRect(left, top, width, height);
    graphics.lineStyle(1, hexToNumber(surface.panelBorder), surface.panelBorderAlpha).strokeRect(left, top, width, height);

    // Corner ticks read as equipment framing rather than a plain box.
    const tick = Math.min(26, Math.max(14, width * 0.03));
    graphics.lineStyle(2, hexToNumber(surface.panelAccent), surface.panelAccentAlpha);
    graphics.lineBetween(left, top + tick, left, top);
    graphics.lineBetween(left, top, left + tick, top);
    graphics.lineBetween(right - tick, bottom, right, bottom);
    graphics.lineBetween(right, bottom - tick, right, bottom);

    graphics.lineStyle(1, hexToNumber(surface.divider), surface.dividerAlpha)
      .lineBetween(innerLeft, box.statusDividerY, innerRight, box.statusDividerY);

    // Hairline rules trailing each section label.
    const rule = (label, y, end = innerRight) => {
      const start = innerLeft + label.width + 12;
      if (start >= end - 8) return;
      graphics.lineStyle(1, hexToNumber(surface.divider), 0.22).lineBetween(start, y, end, y);
    };
    rule(this.primarySectionLabel, box.primaryLabelY);
    rule(this.archiveSectionLabel, box.archiveLabelY);
    // The rule stops short of the certification mark rather than running under it.
    rule(this.systemSectionLabel, box.systemLabelY,
      this.certifiedMark.visible ? this.certifiedMark.x - this.certifiedMark.width - 12 : innerRight);

    // Priority band haloes the emphasised tasking card; a thin trace carries
    // the line out to the frame edge instead of leaving dead space.
    const bandTop = box.primaryTop - 6;
    const bandHeight = tier.primaryHeight + 12;
    const bandRight = innerLeft + box.primaryWidth + 8;
    graphics.fillStyle(hexToNumber(UI_TOKENS.color.amberDeep), 0.34)
      .fillRect(innerLeft - 8, bandTop, bandRight - innerLeft + 8, bandHeight);
    graphics.lineStyle(2, hexToNumber(UI_TOKENS.color.amber), 0.45)
      .lineBetween(innerLeft - 8, bandTop, innerLeft - 8, bandTop + bandHeight);
    if (innerRight - bandRight > 40) {
      const traceY = Math.round(box.primaryTop + tier.primaryHeight / 2);
      graphics.lineStyle(1, hexToNumber(UI_TOKENS.color.amberDim), 0.55)
        .lineBetween(bandRight + 10, traceY, innerRight - 10, traceY);
      graphics.lineStyle(1, hexToNumber(UI_TOKENS.color.amber), 0.6)
        .lineBetween(innerRight - 10, traceY - 5, innerRight - 10, traceY + 5);
    }
  }

  layoutNotice(gameSize) {
    const { width, height } = gameSize;
    this.noticeBackdrop.setSize(width, height).setPosition(width / 2, height / 2);
    if (this.noticeBackdrop.input) this.noticeBackdrop.input.hitArea?.setTo(0, 0, width, height);
    this.noticeGraphics.clear();
    if (!this.noticeOpen) return;

    const compact = width < 620;
    const panelWidth = Math.min(620, width - (compact ? 24 : 72));
    const chrome = compact ? 82 : 96;
    // The field guide has grown a line for every console feature, and a small
    // phone has nowhere to put the overflow, so the body steps down a size
    // until the page fits the panel rather than running off the bottom of it.
    const bodyRoom = height - 48 - chrome;
    for (let bodyFont = compact ? 10 : 12; bodyFont >= 7; bodyFont -= 1) {
      this.noticeBody.setFontSize(bodyFont).setWordWrapWidth(panelWidth - 44);
      if (this.noticeBody.height <= bodyRoom) break;
    }
    const panelHeight = Math.min(height - 48, this.noticeBody.height + chrome);
    const left = width / 2 - panelWidth / 2;
    const top = height / 2 - panelHeight / 2;

    this.noticeGraphics
      .fillStyle(hexToNumber(UI_TOKENS.color.panel), 0.99)
      .fillRect(left, top, panelWidth, panelHeight);
    this.noticeGraphics
      .lineStyle(2, hexToNumber(UI_TOKENS.surface.panelAccent), 0.7)
      .strokeRect(left, top, panelWidth, panelHeight);
    this.noticeGraphics
      .lineStyle(1, hexToNumber(UI_TOKENS.surface.divider), 0.34)
      .lineBetween(left + 20, top + 44, left + panelWidth - 20, top + 44);

    this.noticeTitle.setFontSize(compact ? 12 : 14).setPosition(left + 20, top + 23);
    this.noticeHint.setFontSize(compact ? 8 : 9).setPosition(left + panelWidth - 20, top + 23).setVisible(width >= 460);
    this.noticeBody.setPosition(left + 20, top + 60);
  }

  layoutSettings(gameSize) {
    const { width, height } = gameSize;
    const short = height < 560;
    const settingsPanelWidth = Math.min(520, width - 28);
    const settingsPanelCap = Math.min(450, Math.max(300, height - 42));

    // Size the panel to the rows it actually holds. Fixing the height left a
    // deep empty box under RETURN TO CONSOLE on every window tall enough.
    const rows = Math.max(1, this.settingsButtons.length);
    const headerBlock = short ? 84 : 98;
    const rowSpan = Math.max(178, settingsPanelCap - (short ? 116 : 132));
    const rowSpacing = Math.min(52, Math.max(35, rowSpan / Math.max(1, rows - 1)));
    const settingsPanelHeight = Math.min(settingsPanelCap,
      Math.ceil(headerBlock + (rows - 1) * rowSpacing + 20 + (short ? 18 : 26)));

    // Sit the panel under the header when it fits; otherwise centre it and
    // stand the header down so nothing is clipped behind the panel.
    const headerBottom = this.headerBottom ?? 0;
    const fitsBelowHeader = headerBottom + 14 + settingsPanelHeight <= height - 20;
    const settingsTop = fitsBelowHeader
      ? Math.max(21, headerBottom + 14)
      : Math.max(21, height / 2 - settingsPanelHeight / 2);

    this.settingsGraphics.clear();
    if (!this.settingsOpen) return;

    this.title.setVisible(fitsBelowHeader);

    this.settingsGraphics
      .fillStyle(hexToNumber(UI_TOKENS.color.panel), 0.985)
      .fillRect(width / 2 - settingsPanelWidth / 2, settingsTop, settingsPanelWidth, settingsPanelHeight);
    this.settingsGraphics
      .lineStyle(2, hexToNumber(UI_TOKENS.surface.panelAccent), 0.72)
      .strokeRect(width / 2 - settingsPanelWidth / 2, settingsTop, settingsPanelWidth, settingsPanelHeight);
    this.settingsGraphics
      .lineStyle(1, hexToNumber(UI_TOKENS.surface.divider), 0.4)
      .lineBetween(width / 2 - settingsPanelWidth / 2 + 18, settingsTop + 66, width / 2 + settingsPanelWidth / 2 - 18, settingsTop + 66);

    this.settingsTitle.setPosition(width / 2, settingsTop + 29).setFontSize(short ? 16 : 20);
    this.settingsHint.setPosition(width / 2, settingsTop + 50).setVisible(height >= 350);

    const settingsStartY = settingsTop + headerBlock;
    const buttonWidth = Math.min(300, settingsPanelWidth - 44);
    this.settingsButtons.forEach((button, index) => {
      button.resize({ width: buttonWidth });
      button.setPosition(width / 2, settingsStartY + index * rowSpacing);
    });
  }
}
