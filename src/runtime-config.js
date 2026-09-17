export const GAME_CONFIG = Object.freeze({
  title: 'I SPY',
  subtitle: 'SATELLITE RECONNAISSANCE DIVISION',
  version: '0.1.0',
  palette: {
    black: '#0b0b0b',
    nearBlack: '#171717',
    charcoal: '#333333',
    gray: '#757575',
    lightGray: '#bdbdbd',
    offWhite: '#e8e8df',
    white: '#f6f6ee',
  },
  typography: {
    family: '"Courier New", Courier, monospace',
  },
  recon: {
    worldWidth: 2400,
    worldHeight: 1800,
    minZoom: 0.45,
    maxZoom: 2.4,
    zoomStep: 0.12,
    dragThreshold: 4,
    hudHeight: 78,
  },
});
