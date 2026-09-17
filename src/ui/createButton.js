import { GAME_CONFIG } from '../runtime-config.js';

export function createButton(scene, x, y, label, onPress, options = {}) {
  const width = options.width ?? 270;
  const height = options.height ?? 48;
  const fontSize = options.fontSize ?? 20;

  const background = scene.add
    .rectangle(x, y, width, height, GAME_CONFIG.palette.nearBlack)
    .setStrokeStyle(2, GAME_CONFIG.palette.offWhite)
    .setInteractive({ useHandCursor: true });

  const text = scene.add
    .text(x, y, label, {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: `${fontSize}px`,
      color: GAME_CONFIG.palette.offWhite,
      align: 'center',
    })
    .setOrigin(0.5);

  const setHover = (hovered) => {
    background.setFillStyle(hovered ? GAME_CONFIG.palette.offWhite : GAME_CONFIG.palette.nearBlack);
    text.setColor(hovered ? GAME_CONFIG.palette.black : GAME_CONFIG.palette.offWhite);
  };

  background.on('pointerover', () => setHover(true));
  background.on('pointerout', () => setHover(false));
  background.on('pointerdown', () => background.setScale(0.98));
  background.on('pointerup', () => {
    background.setScale(1);
    onPress?.();
  });

  return {
    background,
    text,
    width,
    height,
    setPosition(nx, ny) { background.setPosition(nx, ny); text.setPosition(nx, ny); },
    setVisible(visible) { background.setVisible(visible); text.setVisible(visible); if (visible) background.setInteractive({ useHandCursor: true }); else background.disableInteractive(); },
    setLabel(nextLabel) { text.setText(nextLabel); },
  };
}
