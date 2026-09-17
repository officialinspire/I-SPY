import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import { createButton } from '../ui/createButton.js';
import { createTerminalChrome, prefersReducedMotion } from '../ui/presentation.js';
import { createLocateMission } from '../game/locateMission.js';
import { createCountMission } from '../game/countMission.js';
import { createChangeDetectionMission } from '../game/changeDetectionMission.js';
import { createGeneratedMission, getGeneratorOptions } from '../game/missionGenerator.js';
import { cycleMasterVolume, getSettings, updateSettings } from '../settings/userSettings.js';
import { feedback } from '../audio/feedback.js';

export default class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenu'); }

  create() {
    this.cameras.main.setBackgroundColor(GAME_CONFIG.palette.black);
    this.reducedMotion = prefersReducedMotion();
    this.settingsOpen = false;
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
      createButton(this, 0, 0, 'SETTINGS', () => this.openSettings()),
    ];

    this.notice = this.add.text(0, 0, '', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '13px',
      color: GAME_CONFIG.palette.offWhite,
      align: 'center',
      backgroundColor: GAME_CONFIG.palette.nearBlack,
      padding: { x: 18, y: 14 },
    }).setOrigin(0.5).setDepth(40).setVisible(false);

    this.createSettingsPanel();

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

    this.masterSettingButton = createButton(this, 0, 0, '', () => {
      cycleMasterVolume();
      this.refreshSettingsLabels();
      feedback('confirm', 10);
    }, { width: 300, height: 40, fontSize: 13 });
    this.sfxSettingButton = createButton(this, 0, 0, '', () => this.toggleSetting('sfxEnabled'), { width: 300, height: 40, fontSize: 13 });
    this.hapticsSettingButton = createButton(this, 0, 0, '', () => this.toggleSetting('hapticsEnabled'), { width: 300, height: 40, fontSize: 13 });
    this.scanlineSettingButton = createButton(this, 0, 0, '', () => this.toggleSetting('scanlinesEnabled'), { width: 300, height: 40, fontSize: 13 });
    this.grainSettingButton = createButton(this, 0, 0, '', () => this.toggleSetting('imageGrainEnabled'), { width: 300, height: 40, fontSize: 13 });
    this.closeSettingsButton = createButton(this, 0, 0, 'RETURN TO CONSOLE', () => this.closeSettings(), { width: 300, height: 40, fontSize: 13 });
    this.settingsButtons = [this.masterSettingButton, this.sfxSettingButton, this.hapticsSettingButton, this.scanlineSettingButton, this.grainSettingButton, this.closeSettingsButton];
    this.settingsButtons.forEach((button) => {
      button.background.setDepth(62);
      button.text.setDepth(63);
      button.setVisible(false);
    });
    this.refreshSettingsLabels();
  }

  toggleSetting(key) {
    const settings = getSettings();
    updateSettings({ [key]: !settings[key] });
    this.refreshSettingsLabels();
    feedback('confirm', 10);
  }

  refreshSettingsLabels() {
    const settings = getSettings();
    this.masterSettingButton?.setLabel(`MASTER LEVEL // ${Math.round(settings.masterVolume * 100)}%`);
    this.sfxSettingButton?.setLabel(`SOUND EFFECTS // ${settings.sfxEnabled ? 'ON' : 'OFF'}`);
    this.hapticsSettingButton?.setLabel(`HAPTICS // ${settings.hapticsEnabled ? 'ON' : 'OFF'}`);
    this.scanlineSettingButton?.setLabel(`CRT SCANLINES // ${settings.scanlinesEnabled ? 'ON' : 'OFF'}`);
    this.grainSettingButton?.setLabel(`IMAGE GRAIN // ${settings.imageGrainEnabled ? 'ON' : 'OFF'}`);
  }

  openSettings() {
    this.settingsOpen = true;
    this.notice.setVisible(false);
    this.buttons.forEach((button) => button.setVisible(false));
    this.settingsGraphics.setVisible(true);
    this.settingsTitle.setVisible(true);
    this.settingsHint.setVisible(true);
    this.settingsButtons.forEach((button) => button.setVisible(true));
    this.refreshSettingsLabels();
    this.layout(this.scale.gameSize);
  }

  closeSettings() {
    this.settingsOpen = false;
    this.buttons.forEach((button) => button.setVisible(true));
    this.settingsGraphics.setVisible(false);
    this.settingsTitle.setVisible(false);
    this.settingsHint.setVisible(false);
    this.settingsButtons.forEach((button) => button.setVisible(false));
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
    if (!this.settingsOpen) {
      this.panelGraphics.fillStyle(0x171717, 0.42).fillRect(width / 2 - panelWidth / 2, panelTop, panelWidth, panelBottom - panelTop);
      this.panelGraphics.lineStyle(1, 0xbdbdbd, 0.32).strokeRect(width / 2 - panelWidth / 2, panelTop, panelWidth, panelBottom - panelTop);
      this.panelGraphics.lineStyle(2, 0xf6f6ee, 0.58);
      this.panelGraphics.lineBetween(width / 2 - panelWidth / 2, panelTop, width / 2 - panelWidth / 2 + 18, panelTop);
      this.panelGraphics.lineBetween(width / 2 + panelWidth / 2 - 18, panelBottom, width / 2 + panelWidth / 2, panelBottom);
    }

    const settingsPanelWidth = Math.min(420, width - 36);
    const settingsPanelHeight = Math.min(410, height - 90);
    const settingsTop = Math.max(62, height / 2 - settingsPanelHeight / 2);
    this.settingsGraphics.clear();
    if (this.settingsOpen) {
      this.settingsGraphics.fillStyle(0x171717, 0.97).fillRect(width / 2 - settingsPanelWidth / 2, settingsTop, settingsPanelWidth, settingsPanelHeight);
      this.settingsGraphics.lineStyle(2, 0xf6f6ee, 0.74).strokeRect(width / 2 - settingsPanelWidth / 2, settingsTop, settingsPanelWidth, settingsPanelHeight);
      this.settingsTitle.setPosition(width / 2, settingsTop + 35);
      this.settingsHint.setPosition(width / 2, settingsTop + 62);
      const settingsStartY = settingsTop + 105;
      const settingsSpacing = Math.min(50, Math.max(43, (settingsPanelHeight - 130) / this.settingsButtons.length));
      this.settingsButtons.forEach((button, index) => button.setPosition(width / 2, settingsStartY + index * settingsSpacing));
    }

    this.status.setPosition(width / 2, height - 37).setVisible(height >= 420 && !this.settingsOpen);
    this.linkIndicator?.setPosition(Math.max(34, width / 2 - 242), height - 37).setVisible(width >= 620 && height >= 420 && !this.settingsOpen);
    this.notice.setPosition(width / 2, height / 2).setWordWrapWidth(Math.min(640, width - 44));
  }
}
