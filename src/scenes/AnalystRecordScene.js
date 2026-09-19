import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import { createButton } from '../ui/createButton.js';
import { createTerminalChrome } from '../ui/presentation.js';
import { createFocusGroup } from '../ui/focusGroup.js';
import { UI_TOKENS, hexToNumber } from '../ui/designTokens.js';
import { getAnalystRecord, resetAnalystRecord } from '../game/analystRecord.js';
import { sectorTitle } from '../world/mapRegistry.js';
import { musicManager, MUSIC_STATES } from '../audio/musicManager.js';

function timeLabel(value) {
  return value === null || value === undefined ? '--' : `${Math.round(Number(value))}s`;
}

export default class AnalystRecordScene extends Phaser.Scene {
  constructor() { super('AnalystRecord'); }

  create() {
    musicManager.request(MUSIC_STATES.MENU);
    this.cameras.main.setBackgroundColor(GAME_CONFIG.palette.black);
    this.chrome = createTerminalChrome(this, {
      station: 'INTELLIGENCE DIRECTORATE // ANALYST RECORD',
      classification: GAME_CONFIG.presentation.classification,
    });
    this.panelGraphics = this.add.graphics();

    this.title = this.add.text(0, 0, 'ANALYST RECORD', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '28px',
      color: UI_TOKENS.text.positiveBright,
      letterSpacing: 3,
    }).setOrigin(0, 0.5);

    this.subtitle = this.add.text(0, 0, 'LOCAL DEVICE RECORD // NO ACCOUNT OR LOGIN', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '10px',
      color: UI_TOKENS.text.faint,
      letterSpacing: 1,
    }).setOrigin(0, 0.5);

    this.body = this.add.text(0, 0, '', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '13px',
      color: UI_TOKENS.text.body,
      lineSpacing: 5,
      align: 'left',
    }).setOrigin(0, 0);

    this.resetButton = createButton(this, 0, 0, 'RESET RECORD', () => {
      resetAnalystRecord();
      this.refresh();
    }, { width: 210, fontSize: 14, variant: 'danger' });
    this.backButton = createButton(this, 0, 0, 'RETURN TO CONSOLE', () => this.scene.start('MainMenu'), {
      width: 230, fontSize: 14, variant: 'primary',
    });
    this.focusGroup = createFocusGroup(this, [this.resetButton, this.backButton]);

    this.refresh();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
    this.layout(this.scale.gameSize);
  }

  refresh() {
    const record = getAnalystRecord();
    const mission = record.missions;
    const lines = [
      `MISSIONS // ${mission.played} PLAYED · ${mission.wins} WINS · ${mission.failures} FAILURES`,
      `STREAK  // CURRENT ${mission.currentStreak} · BEST ${mission.bestStreak}`,
      `CLEAN   // FLAWLESS ${mission.flawless} · DIRECTIVES ${mission.directives}`,
      `GRADES  // S ${record.grades.S} · A ${record.grades.A} · B ${record.grades.B} · C ${record.grades.C}`,
      '',
      'MODE PERSONAL BESTS',
      ...['LOCATE', 'COUNT', 'CHANGE'].map((mode) => {
        const item = record.byMode[mode];
        return `${mode.padEnd(6)} // SCORE ${String(item.bestScore).padStart(5, '0')} · FASTEST ${timeLabel(item.fastestTime)} · WINS ${item.wins}/${item.played}`;
      }),
      '',
      'SECTOR PERSONAL BESTS',
    ];

    const sectors = Object.entries(record.bySector)
      .sort((a, b) => (b[1].bestScore ?? 0) - (a[1].bestScore ?? 0));
    if (!sectors.length) lines.push('NO SECTOR RECORDS YET.');
    else sectors.slice(0, 6).forEach(([id, item]) => {
      lines.push(`${sectorTitle(id)} // SCORE ${item.bestScore} · FASTEST ${timeLabel(item.fastestTime)}`);
    });

    lines.push(
      '',
      'OPERATION SERIES',
      `STARTED ${record.operations.started} · COMPLETE ${record.operations.completed} · FAILED ${record.operations.failed}`,
      `BEST SCORE ${record.operations.bestScore} · BEST DIRECTIVES ${record.operations.bestDirectives} · CLEAN SWEEPS ${record.operations.cleanSweeps}`,
      '',
      `DAILY DOSSIERS ON FILE // ${Object.keys(record.daily).length}`,
    );
    this.body.setText(lines.join('\n'));
    this.layout(this.scale.gameSize);
  }

  layout(gameSize) {
    const { width, height } = gameSize;
    this.chrome.layout(gameSize);
    const compact = width < 620;
    const short = height < 620;
    const margin = compact ? 16 : 34;
    const panelWidth = Math.min(900, width - margin * 2);
    const panelLeft = width / 2 - panelWidth / 2;
    const top = Math.max(48, compact ? 54 : 70);
    const controls = compact ? 126 : 76;
    const panelBottom = Math.max(top + 260, height - controls - 20);
    const panelHeight = panelBottom - top;
    const pad = compact ? 16 : 26;

    this.panelGraphics.clear()
      .fillStyle(hexToNumber(UI_TOKENS.surface.panel), UI_TOKENS.surface.panelAlpha)
      .fillRect(panelLeft, top, panelWidth, panelHeight)
      .lineStyle(1, hexToNumber(UI_TOKENS.surface.panelBorder), UI_TOKENS.surface.panelBorderAlpha)
      .strokeRect(panelLeft, top, panelWidth, panelHeight)
      .lineStyle(2, hexToNumber(UI_TOKENS.color.phosphor), 0.6)
      .lineBetween(panelLeft, top + 48, panelLeft + panelWidth, top + 48);

    this.title.setFontSize(compact ? 20 : 28).setPosition(panelLeft + pad, top + 26);
    this.subtitle.setFontSize(compact ? 8 : 10).setPosition(panelLeft + pad, top + 54);
    this.body
      .setFontSize(short ? (compact ? 8 : 10) : (compact ? 9 : 12))
      .setLineSpacing(short ? 2 : 5)
      .setWordWrapWidth(panelWidth - pad * 2)
      .setPosition(panelLeft + pad, top + 78);

    if (compact) {
      this.resetButton.setPosition(width / 2, height - 100);
      this.backButton.setPosition(width / 2, height - 48);
    } else {
      this.resetButton.setPosition(width / 2 - 125, height - 46);
      this.backButton.setPosition(width / 2 + 125, height - 46);
    }
  }
}
