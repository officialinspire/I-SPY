import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import { createButton } from '../ui/createButton.js';
import { oncePerKeyEvent } from '../ui/keyboardEvents.js';
import { createTerminalChrome } from '../ui/presentation.js';
import { createFocusGroup } from '../ui/focusGroup.js';
import { UI_TOKENS, hexToNumber, hitGap } from '../ui/designTokens.js';
import { findSprite } from '../assets/spriteManifest.js';
import { GUIDE_CATEGORIES } from '../game/identificationGuide.js';
import { musicManager, MUSIC_STATES } from '../audio/musicManager.js';

/**
 * IDENTIFICATION GUIDE — the recognition manual.
 *
 * Category tabs, a grid of the production sprite frames themselves, and a
 * detail panel with an enlarged preview and a recognition note. The grid is
 * sized to the space it is given rather than to a fixed cell, and scrolls only
 * when a comfortable cell will not fit; the detail panel keeps its place
 * instead of opening as a modal, so a phone shows both at once.
 *
 * Nothing here knows about missions, so nothing here can spoil one.
 */

const CELL_MIN = 56;
const CELL_MAX = 132;
const CELL_GAP = 8;
const CAPTION_AT = 96;
/** Matches the letterSpacing the title is drawn with. */
const TITLE_LETTER_SPACING = 4;
/** Movement past which a press on the grid is a scroll rather than a tap. */
const DRAG_SLOP = 6;

export default class IdentificationGuideScene extends Phaser.Scene {
  constructor() { super('IdentificationGuide'); }

  /**
   * `returnTo` is the scene key of a live mission this manual was opened
   * over. Checking what a shape is supposed to look like is part of the
   * analysis, so the manual is reachable from a held tasking as well as from
   * the console — and when it came from a tasking it goes back to it, rather
   * than throwing the mission away by starting the menu.
   */
  create(data = {}) {
    this.returnTo = data.returnTo ?? null;
    // Overlaying a held mission keeps the mission's own score playing: the
    // manual is a moment inside the tasking, not a trip back to the console.
    if (!this.returnTo) musicManager.request(MUSIC_STATES.MENU);
    this.cameras.main.setBackgroundColor(GAME_CONFIG.palette.black);
    this.chrome = createTerminalChrome(this, {
      station: 'INTELLIGENCE DIRECTORATE // RECOGNITION MANUAL',
      classification: GAME_CONFIG.presentation.classification,
    });
    this.panelGraphics = this.add.graphics().setDepth(1);
    this.categoryIndex = 0;
    this.entryIndex = 0;
    this.gridScroll = 0;
    this.gridBox = { left: 0, top: 0, width: 1, height: 1 };

    this.createHeader();
    this.createTabs();
    this.createGrid();
    this.createDetail();
    this.createFooter();

    this.focusGroup = createFocusGroup(this, this.focusMembers(), {
      onFocus: (button) => {
        const cell = this.cells.find((entry) => entry.button === button);
        if (!cell) return;
        // Keyboard reaches every entry, including the rows below the fold, so
        // the grid follows the focus ring instead of leaving it off screen.
        this.scrollCellIntoView(cell);
        this.showEntry(cell.categoryIndex, cell.entryIndex, false);
      },
    });

    this.bindInput();
    this.selectCategory(0, true);

    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.cleanup());
    this.layout(this.scale.gameSize);
  }

  // --- construction --------------------------------------------------------

  createHeader() {
    this.title = this.add.text(0, 0, 'IDENTIFICATION GUIDE', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '24px',
      color: GAME_CONFIG.palette.white,
      letterSpacing: 4,
    }).setOrigin(0, 0.5).setDepth(3);
    this.summary = this.add.text(0, 0, '', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '10px',
      color: UI_TOKENS.text.faint,
      letterSpacing: 1,
    }).setOrigin(0, 0.5).setDepth(3);
    this.counter = this.add.text(0, 0, '', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '10px',
      color: UI_TOKENS.text.muted,
      letterSpacing: 1,
    }).setOrigin(1, 0.5).setDepth(3);
  }

  createTabs() {
    this.tabs = GUIDE_CATEGORIES.map((category, index) => createButton(this, 0, 0, category.title, () => this.selectCategory(index), {
      variant: 'secondary',
      pressSound: 'toggle',
      accent: false,
      width: 160,
      height: 34,
      fontSize: 11,
    }));
    this.tabs.forEach((tab) => tab.setDepth(4));
  }

  /**
   * One cell per entry, built once and shown a category at a time. The cells
   * live in a container so the grid can be masked and scrolled as one thing.
   */
  createGrid() {
    this.gridContainer = this.add.container(0, 0).setDepth(6);
    this.cells = [];
    GUIDE_CATEGORIES.forEach((category, categoryIndex) => {
      category.entries.forEach((item, entryIndex) => {
        const definition = findSprite(item.sprite);
        const button = createButton(this, 0, 0, '', () => this.showEntry(categoryIndex, entryIndex), {
          variant: 'tactical',
          accent: false,
          width: 96,
          height: 96,
          fontSize: 8,
          // The grid is masked, so a cell's hit area can reach outside the box
          // it is drawn in; and a drag across the grid is a scroll, not a tap.
          pointerGuard: (pointer) => this.withinGrid(pointer) && !this.gridDragged,
        });
        const image = definition
          ? this.add.image(0, 0, definition.sheet.key, item.sprite)
          : this.add.rectangle(0, 0, 32, 32, hexToNumber(UI_TOKENS.color.steelDim));
        const caption = this.add.text(0, 0, item.name, {
          fontFamily: GAME_CONFIG.typography.family,
          fontSize: '8px',
          color: UI_TOKENS.text.muted,
          align: 'center',
          letterSpacing: 1,
        }).setOrigin(0.5, 0.5);
        // Inside a container, draw order is insertion order: the button's own
        // objects first, then the frame and its caption on top of them.
        this.gridContainer.add([...button.getObjects(), image, caption]);
        this.cells.push({ categoryIndex, entryIndex, item, button, image, caption });
      });
    });

    this.gridMask = this.add.graphics().setVisible(false);
    this.gridContainer.setMask(this.gridMask.createGeometryMask());
  }

  createDetail() {
    // Seeded with the manual's first frame so the preview always has a real
    // texture; showEntry swaps it for whichever entry is open.
    const first = findSprite(GUIDE_CATEGORIES[0].entries[0].sprite);
    this.detailSprite = this.add.image(0, 0, first.sheet.key, GUIDE_CATEGORIES[0].entries[0].sprite)
      .setDepth(8);
    this.detailName = this.add.text(0, 0, '', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '17px',
      color: UI_TOKENS.text.attention,
      letterSpacing: 2,
    }).setOrigin(0, 0).setDepth(8);
    this.detailCategory = this.add.text(0, 0, '', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '9px',
      color: UI_TOKENS.text.faint,
      letterSpacing: 2,
    }).setOrigin(0, 0).setDepth(8);
    this.detailNote = this.add.text(0, 0, '', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '12px',
      color: UI_TOKENS.text.body,
      lineSpacing: 5,
    }).setOrigin(0, 0).setDepth(8);
  }

  createFooter() {
    this.hint = this.add.text(0, 0, 'TAB OR ARROWS TO WALK  ·  ENTER TO OPEN  ·  ESC TO RETURN', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '9px',
      color: UI_TOKENS.text.faint,
      letterSpacing: 1,
    }).setOrigin(1, 0.5).setDepth(3);
    this.backButton = createButton(this, 0, 0, this.returnTo ? 'RETURN TO MISSION' : 'RETURN TO CONSOLE', () => this.leave(), {
      variant: 'secondary',
      width: 220,
      height: 40,
      fontSize: 13,
    });
    this.backButton.setDepth(4);
  }

  /**
   * Hand control back to whoever opened the manual.
   *
   * The mission scene is looked up before this one stops, because stopping
   * is what releases this scene's plugins.
   */
  leave() {
    if (!this.returnTo) {
      this.scene.start('MainMenu');
      return;
    }
    const caller = this.scene.get(this.returnTo);
    this.scene.stop();
    caller?.closeIdentificationGuide?.();
  }

  bindInput() {
    this.input.keyboard?.on('keydown-ESC', oncePerKeyEvent('guide-esc', () => this.leave()));
    // The wheel belongs to whatever the pointer is over: rolling it while
    // reading the detail panel must not scroll the grid behind the cursor.
    this.input.on('wheel', (pointer, objects, deltaX, deltaY) => {
      if (!this.gridScrollable || !this.withinGrid(pointer)) return;
      this.scrollGridBy(deltaY);
    });
    this.input.on('pointerdown', (pointer) => {
      this.gridDragged = false;
      this.gridDrag = this.gridScrollable && this.withinGrid(pointer)
        ? { y: pointer.y, startY: pointer.y }
        : null;
    });
    this.input.on('pointermove', (pointer) => {
      if (!this.gridDrag || !pointer.isDown) return;
      // Past the threshold this gesture is a scroll for good, so the cell it
      // started on does not open when the finger lifts.
      if (Math.abs(pointer.y - this.gridDrag.startY) >= DRAG_SLOP) this.gridDragged = true;
      this.scrollGridBy(this.gridDrag.y - pointer.y);
      this.gridDrag.y = pointer.y;
    });
    // The flag is cleared a beat after release: the button's own pointerup
    // runs first and has to still see that this was a drag.
    this.input.on('pointerup', () => {
      this.gridDrag = null;
      if (this.gridDragged) this.time.delayedCall(0, () => { this.gridDragged = false; });
    });
  }

  // --- state ---------------------------------------------------------------

  activeCategory() { return GUIDE_CATEGORIES[this.categoryIndex]; }

  activeCells() { return this.cells.filter((cell) => cell.categoryIndex === this.categoryIndex); }

  focusMembers() {
    return [...this.tabs, ...this.activeCells().map((cell) => cell.button), this.backButton];
  }

  selectCategory(index, silent = false) {
    this.categoryIndex = ((index % GUIDE_CATEGORIES.length) + GUIDE_CATEGORIES.length) % GUIDE_CATEGORIES.length;
    this.gridScroll = 0;
    this.tabs.forEach((tab, tabIndex) => tab.setSelected(tabIndex === this.categoryIndex));
    // `silent` doubles as showEntry's layoutAfter, so an ordinary switch lays
    // out here rather than there. Either way the pass is measured against this
    // category's own header text now, which is what it was getting wrong.
    this.showEntry(this.categoryIndex, 0, silent);
    this.focusGroup?.setMembers(this.focusMembers());
    this.layout(this.scale.gameSize);
  }

  showEntry(categoryIndex, entryIndex, layoutAfter = true) {
    this.categoryIndex = categoryIndex;
    this.entryIndex = entryIndex;
    const category = GUIDE_CATEGORIES[categoryIndex];
    const item = category?.entries[entryIndex];
    if (!item) return;

    this.cells.forEach((cell) => cell.button.setSelected(
      cell.categoryIndex === categoryIndex && cell.entryIndex === entryIndex,
    ));

    const definition = findSprite(item.sprite);
    if (definition) this.detailSprite.setTexture(definition.sheet.key, item.sprite).setVisible(true);
    else this.detailSprite.setVisible(false);
    this.detailName.setText(item.name);
    this.detailCategory.setText(category.title);
    this.detailNote.setText(item.note);
    if (layoutAfter) this.layout(this.scale.gameSize);
  }

  withinGrid(pointer) {
    const box = this.gridBox;
    return pointer.x >= box.left && pointer.x <= box.left + box.width
      && pointer.y >= box.top && pointer.y <= box.top + box.height;
  }

  scrollGridBy(delta) {
    const next = Phaser.Math.Clamp(this.gridScroll + delta, 0, this.gridScrollMax ?? 0);
    if (next === this.gridScroll) return;
    this.gridScroll = next;
    this.positionCells();
    this.drawFrames(this.gridBox, this.detailBox);
  }

  // --- layout --------------------------------------------------------------

  /**
   * Choose the column count that gives the largest cell in the space
   * available, so the grid answers to the viewport instead of to a fixed
   * breakpoint. A category that cannot fit comfortably scrolls instead of
   * shrinking past the point of being readable.
   */
  fitGrid(count, boxWidth, boxHeight) {
    let best = 0;
    for (let columns = 1; columns <= Math.min(8, count); columns += 1) {
      const rows = Math.ceil(count / columns);
      best = Math.max(best, Math.min(
        (boxWidth - (columns - 1) * CELL_GAP) / columns,
        (boxHeight - (rows - 1) * CELL_GAP) / rows,
      ));
    }
    // A cell has a comfortable size and a sensible maximum. Once either bound
    // binds, the column count comes from how many cells that size fits across
    // the box — which is also what makes the grid taller than its box when the
    // floor binds, and that is exactly when scrolling earns its place.
    const size = Math.floor(Phaser.Math.Clamp(best, CELL_MIN, CELL_MAX));
    const columns = Math.max(1, Math.min(count, Math.floor((boxWidth + CELL_GAP) / (size + CELL_GAP))));
    return { columns, size, rows: Math.ceil(count / columns) };
  }

  layout(gameSize) {
    const { width, height } = gameSize;
    this.chrome.layout(gameSize);
    // Written before a single measurement is taken. The summary's height is
    // what the tabs below it are positioned from, so setting it at the end of
    // the pass laid this category out against the last category's text.
    const activeCategory = this.activeCategory();
    this.summary.setText(activeCategory.summary);
    this.counter.setText(`${activeCategory.title} · ${activeCategory.entries.length} ENTRIES`);
    const margin = width < 540 ? 10 : 16;
    const inset = width < 520 ? 14 : 26;
    const left = margin + inset;
    const right = width - margin - inset;
    const contentWidth = right - left;
    const compact = width < 600;
    const short = height < 520;

    // --- header ---
    // The title carries wide letter spacing, so its width grows faster than
    // its font size; on a narrow window it is fitted to the content rather
    // than left to run past the edge.
    const titleChars = this.title.text.length;
    const titleFont = Math.floor(Math.min(
      compact ? 17 : (short ? 20 : 24),
      Math.max(11, ((contentWidth - 6) / titleChars - TITLE_LETTER_SPACING) / 0.62),
    ));
    let cursor = margin + (short ? 26 : 32);
    this.title.setFontSize(titleFont).setPosition(left, cursor + titleFont / 2);
    this.counter.setFontSize(compact ? 9 : 10)
      .setPosition(right, cursor + titleFont / 2)
      .setVisible(width >= 460);
    cursor += titleFont + (short ? 4 : 8);
    const showSummary = !short && height >= 460;
    this.summary.setFontSize(compact ? 9 : 10)
      .setWordWrapWidth(contentWidth)
      .setPosition(left, cursor + 6)
      .setVisible(showSummary);
    if (showSummary) cursor += this.summary.height + 10;

    // --- tabs ---
    const tabHeight = compact ? 30 : 34;
    const tabGap = compact ? 5 : 8;
    const singleRowWidth = (contentWidth - tabGap * (this.tabs.length - 1)) / this.tabs.length;
    const useShortTitles = singleRowWidth < 150;
    const longest = Math.max(...GUIDE_CATEGORIES.map(
      (category) => (useShortTitles ? category.shortTitle : category.title).length,
    ));
    const fontFor = (width) => Math.floor((width - 16) / (longest * 0.62));
    // Five tabs across is the shape; when that would squeeze the longest label
    // below a readable size, they fold to two rows instead of being clipped.
    const tabRows = fontFor(singleRowWidth) < 8 ? 2 : 1;
    const perRow = Math.ceil(this.tabs.length / tabRows);
    const tabWidth = (contentWidth - tabGap * (perRow - 1)) / perRow;
    const tabFont = Phaser.Math.Clamp(fontFor(tabWidth), 7, 11);
    this.tabs.forEach((tab, index) => {
      const row = Math.floor(index / perRow);
      const column = index % perRow;
      const countInRow = Math.min(perRow, this.tabs.length - row * perRow);
      const rowWidth = countInRow * tabWidth + (countInRow - 1) * tabGap;
      const rowLeft = left + (contentWidth - rowWidth) / 2;
      tab.setLabel(useShortTitles ? GUIDE_CATEGORIES[index].shortTitle : GUIDE_CATEGORIES[index].title);
      // The tabs sit a few pixels apart and are shorter than the minimum
      // touch target, so their padding has to stop inside that gap: on a
      // 360px phone they were overlapping by 9px and a press near the seam
      // opened the category next door.
      tab.resize({
        width: tabWidth,
        height: tabHeight,
        fontSize: tabFont,
        hitPaddingX: hitGap(tabGap),
        hitPaddingY: hitGap(tabGap),
      })
        .setPosition(rowLeft + tabWidth / 2 + column * (tabWidth + tabGap),
          cursor + tabHeight / 2 + row * (tabHeight + tabGap));
    });
    cursor += tabRows * tabHeight + (tabRows - 1) * tabGap + (compact ? 10 : 14);

    // --- footer, measured from the bottom so the body gets what is left ---
    const footerHeight = compact ? 36 : 40;
    const footerY = height - margin - (short ? 14 : 20) - footerHeight / 2;
    const backWidth = Math.min(220, contentWidth);
    this.backButton.resize({ width: backWidth, height: footerHeight, fontSize: compact ? 11 : 13 })
      .setPosition(left + backWidth / 2, footerY);
    this.hint.setFontSize(compact ? 8 : 9)
      .setPosition(right, footerY)
      .setVisible(width >= 700);

    const bodyTop = cursor;
    const bodyBottom = footerY - footerHeight / 2 - (compact ? 10 : 14);
    const available = Math.max(120, bodyBottom - bodyTop);

    // Two columns when the width can carry a readable note beside the grid and
    // the window is not portrait — a tall tablet has height to spend and would
    // otherwise float the pair in the middle of an empty screen. A short
    // landscape window needs the two columns sooner, because stacking there
    // leaves neither half usable.
    const twoColumn = (width >= 780 && height < width * 1.1) || (short && width >= 640);
    const gap = compact ? 10 : 16;
    // Side by side, a tall window would otherwise give the manual two
    // cavernous panels, so the pair takes the room it needs and sits in the
    // middle of the rest. Stacked, every pixel of height is wanted: it is what
    // buys a grid cell big enough to carry its own name.
    const bodyHeight = twoColumn ? Math.min(available, 480) : available;
    const bodyOffset = Math.round((available - bodyHeight) / 2);
    const gridBox = twoColumn
      ? { left, top: bodyTop + bodyOffset, width: Math.round(contentWidth * 0.56), height: bodyHeight }
      : { left, top: bodyTop + bodyOffset, width: contentWidth, height: 0 };
    const detailBox = twoColumn
      ? { left: left + gridBox.width + gap, top: bodyTop + bodyOffset, width: contentWidth - gridBox.width - gap, height: bodyHeight }
      : { left, top: 0, width: contentWidth, height: 0 };

    if (!twoColumn) {
      // The detail panel takes about two fifths, but never so much that the
      // grid is left as a sliver: on a cramped window the grid keeps a row.
      const detailMax = Math.max(96, Math.min(252, bodyHeight - 100));
      const detailHeight = Math.min(detailMax, Math.max(112, Math.round(bodyHeight * 0.4)));
      gridBox.height = bodyHeight - detailHeight - gap;
      detailBox.top = gridBox.top + gridBox.height + gap;
      detailBox.height = detailHeight;
    }
    this.gridBox = gridBox;
    this.detailBox = detailBox;

    this.layoutGrid(gridBox);
    this.layoutDetail(detailBox, compact);
    this.drawFrames(gridBox, detailBox);
  }

  layoutGrid(box) {
    const cells = this.activeCells();
    const fit = this.fitGrid(cells.length, box.width, box.height);
    this.gridFit = fit;
    const contentHeight = fit.rows * fit.size + (fit.rows - 1) * CELL_GAP;
    this.gridScrollMax = Math.max(0, contentHeight - box.height);
    this.gridScrollable = this.gridScrollMax > 0;
    this.gridScroll = Phaser.Math.Clamp(this.gridScroll, 0, this.gridScrollMax);

    // The mask is the box; the container carries the scroll.
    this.gridMask.clear();
    this.gridMask.fillStyle(0xffffff, 1).fillRect(box.left, box.top, box.width, box.height);
    this.positionCells();
  }

  positionCells() {
    const box = this.gridBox;
    const fit = this.gridFit;
    if (!fit) return;
    const cells = this.activeCells();
    // Every cell in the manual lives in the same container, so the ones that
    // belong to other categories are put away here rather than only having
    // their button hidden — a sprite and a caption left behind would keep
    // drawing under the category on show.
    this.cells.forEach((cell) => {
      if (cell.categoryIndex === this.categoryIndex) return;
      cell.button.setVisible(false);
      cell.image.setVisible(false);
      cell.caption.setVisible(false);
    });
    const rowWidth = fit.columns * fit.size + (fit.columns - 1) * CELL_GAP;
    const contentHeight = fit.rows * fit.size + (fit.rows - 1) * CELL_GAP;
    const originX = box.left + Math.max(0, (box.width - rowWidth) / 2);
    // A grid that fits sits centred in its box; one that scrolls starts at the
    // top and is moved by the scroll offset instead.
    const originY = box.top + (this.gridScrollable ? -this.gridScroll : Math.max(0, (box.height - contentHeight) / 2));
    const showCaption = fit.size >= CAPTION_AT;

    cells.forEach((cell, index) => {
      const column = index % fit.columns;
      const row = Math.floor(index / fit.columns);
      const x = originX + column * (fit.size + CELL_GAP) + fit.size / 2;
      const y = originY + row * (fit.size + CELL_GAP) + fit.size / 2;
      // The caption is measured rather than assumed: a two-line name needs
      // twice the room of a one-line one and must not run past the cell.
      cell.caption.setFontSize(fit.size >= 112 ? 9 : 8).setWordWrapWidth(fit.size - 10);
      const captionSpace = showCaption ? cell.caption.height + 8 : 0;
      const spriteSize = Math.max(20, fit.size - captionSpace - 16);
      cell.button.resize({ width: fit.size, height: fit.size }).setPosition(x, y);
      cell.image.setDisplaySize(spriteSize, spriteSize)
        .setPosition(x, y - captionSpace / 2);
      cell.caption.setOrigin(0.5, 1)
        .setPosition(x, y + fit.size / 2 - 6)
        .setVisible(showCaption);
      // Cells scrolled past the fold stay visible and focusable — the mask
      // keeps them off the screen, and the cells' pointer guard keeps a click
      // that lands outside the box from reaching a hit area that pokes out of
      // it. Hiding them instead is what used to put them beyond the keyboard.
      cell.button.setVisible(true);
      cell.image.setVisible(true);
      cell.caption.setVisible(showCaption);
    });
  }

  /** Scroll so a whole cell sits inside the grid box, if it does not already. */
  scrollCellIntoView(cell) {
    const fit = this.gridFit;
    if (!fit || !this.gridScrollable || cell.categoryIndex !== this.categoryIndex) return;
    const index = this.activeCells().indexOf(cell);
    if (index < 0) return;
    const row = Math.floor(index / fit.columns);
    const top = row * (fit.size + CELL_GAP);
    const bottom = top + fit.size;
    if (top < this.gridScroll) this.scrollGridBy(top - this.gridScroll);
    else if (bottom > this.gridScroll + this.gridBox.height) {
      this.scrollGridBy(bottom - this.gridBox.height - this.gridScroll);
    }
  }

  layoutDetail(box, compact) {
    const padding = compact ? 12 : 16;
    const innerWidth = box.width - padding * 2;
    const innerHeight = box.height - padding * 2;
    const gapX = compact ? 12 : 18;

    // With height to spare the note sits under the whole block, which reads
    // like a catalogue entry. In a short window it moves beside the preview,
    // and the preview shrinks until the text column is worth reading.
    const stacked = innerHeight >= 196;
    let preview = Phaser.Math.Clamp(Math.min(innerWidth * 0.4, innerHeight), 44, compact ? 108 : 168);
    if (!stacked) preview = Math.min(preview, Math.max(44, innerWidth - 190 - gapX));
    preview = Math.round(preview);

    const previewX = box.left + padding + preview / 2;
    const previewY = box.top + padding + preview / 2;
    this.detailSprite.setDisplaySize(preview, preview).setPosition(previewX, previewY);

    const textLeft = box.left + padding + preview + gapX;
    const textWidth = Math.max(80, box.left + box.width - padding - textLeft);
    this.detailName.setFontSize(compact ? 13 : 17)
      .setWordWrapWidth(textWidth)
      .setPosition(textLeft, box.top + padding);
    this.detailCategory.setFontSize(compact ? 8 : 9)
      .setWordWrapWidth(textWidth)
      .setPosition(textLeft, this.detailName.y + this.detailName.height + 6);

    const noteLeft = stacked ? box.left + padding : textLeft;
    const noteWidth = stacked ? innerWidth : textWidth;
    const noteTop = stacked
      ? Math.max(this.detailCategory.y + this.detailCategory.height + 12, previewY + preview / 2 + 12)
      : this.detailCategory.y + this.detailCategory.height + 10;

    // Whatever is left, the note is printed inside the panel: step it down a
    // size until it stops running past the bottom edge.
    const bottom = box.top + box.height - padding;
    for (let size = compact ? 11 : 12; size >= 8; size -= 1) {
      this.detailNote.setFontSize(size).setWordWrapWidth(noteWidth).setPosition(noteLeft, noteTop);
      if (noteTop + this.detailNote.height <= bottom) break;
    }
  }

  drawFrames(gridBox, detailBox) {
    const graphics = this.panelGraphics;
    const surface = UI_TOKENS.surface;
    graphics.clear();
    [gridBox, detailBox].forEach((box) => {
      graphics.fillStyle(hexToNumber(surface.panel), surface.panelAlpha)
        .fillRect(box.left, box.top, box.width, box.height);
      graphics.lineStyle(1, hexToNumber(surface.panelBorder), surface.panelBorderAlpha)
        .strokeRect(box.left, box.top, box.width, box.height);
    });
    // The detail panel is the one being read, so it carries the accent edge.
    graphics.lineStyle(2, hexToNumber(UI_TOKENS.color.amber), 0.55)
      .lineBetween(detailBox.left, detailBox.top, detailBox.left, detailBox.top + detailBox.height);

    if (!this.gridScrollable) return;
    // A plain scroll indicator: the proportion of the list currently in view.
    const trackX = gridBox.left + gridBox.width - 4;
    const travel = gridBox.height;
    const thumb = Math.max(24, travel * (gridBox.height / (gridBox.height + this.gridScrollMax)));
    const offset = (travel - thumb) * (this.gridScroll / Math.max(1, this.gridScrollMax));
    graphics.fillStyle(hexToNumber(UI_TOKENS.color.steelDim), 0.5)
      .fillRect(trackX - 1, gridBox.top, 3, travel);
    graphics.fillStyle(hexToNumber(UI_TOKENS.color.phosphor), 0.75)
      .fillRect(trackX - 1, gridBox.top + offset, 3, thumb);
  }

  cleanup() {
    this.scale.off('resize', this.layout, this);
    this.input.removeAllListeners();
    this.input.keyboard?.removeAllListeners();
  }
}
