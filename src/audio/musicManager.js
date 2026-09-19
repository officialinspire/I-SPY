import menuMusicUrl from '../../I-Spy-Main-Menu-Theme.mp3?url';
import gameplayMusicUrl from '../../I-Spy-Gameplay-Theme.mp3?url';
import { getSettings, subscribeSettings } from '../settings/userSettings.js';

export const MUSIC_STATES = Object.freeze({ MENU: 'MENU', GAMEPLAY: 'GAMEPLAY', SILENT: 'SILENT' });
export const MUSIC_FADE_MS = 850;
const MUSIC_GAIN = 0.58;

/** One application-wide owner for both looping music elements. */
class MusicManager {
  constructor() {
    this.state = MUSIC_STATES.SILENT;
    this.tracks = null;
    this.fadeFrame = null;
    this.fadeGeneration = 0;
    this.resumeArmed = false;
    subscribeSettings(() => this.reconcileSettings());
    globalThis.document?.addEventListener('visibilitychange', () => this.handleVisibility());
  }

  ensureTracks() {
    if (this.tracks || typeof Audio === 'undefined') return;
    const makeTrack = (url) => {
      const audio = new Audio(url);
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = 0;
      return audio;
    };
    this.tracks = {
      [MUSIC_STATES.MENU]: makeTrack(menuMusicUrl),
      [MUSIC_STATES.GAMEPLAY]: makeTrack(gameplayMusicUrl),
    };
  }

  /** Called synchronously by the Phase 16A start gesture. */
  unlock() {
    this.ensureTracks();
    if (!this.tracks) return;
    Object.values(this.tracks).forEach((track) => {
      track.muted = true;
      const attempt = track.play();
      if (attempt?.then) {
        attempt.then(() => {
          track.muted = false;
          // A very fast skip can request MENU before this unlock promise
          // settles. Never let the stale unlock completion pause that newer
          // request; the active fade now owns playback.
          if (this.state === MUSIC_STATES.SILENT) {
            track.pause();
            track.currentTime = 0;
          }
        }).catch(() => { track.muted = false; });
      } else {
        track.pause();
        track.muted = false;
      }
    });
  }

  request(nextState) {
    if (!Object.values(MUSIC_STATES).includes(nextState)) return;
    if (nextState === this.state) return;
    this.state = nextState;
    this.fadeToState(MUSIC_FADE_MS);
  }

  reconcileSettings() {
    this.fadeToState(240);
  }

  cancelFade() {
    this.fadeGeneration += 1;
    if (this.fadeFrame !== null) cancelAnimationFrame(this.fadeFrame);
    this.fadeFrame = null;
  }

  handleVisibility() {
    if (!this.tracks) return;
    if (globalThis.document?.hidden) {
      this.cancelFade();
      Object.values(this.tracks).forEach((track) => {
        track.volume = 0;
        track.pause();
      });
      return;
    }
    this.fadeToState(240);
  }

  armGestureResume() {
    if (this.resumeArmed || !globalThis.document) return;
    this.resumeArmed = true;
    const resume = () => {
      this.resumeArmed = false;
      document.removeEventListener('pointerdown', resume);
      document.removeEventListener('keydown', resume);
      this.fadeToState(240);
    };
    document.addEventListener('pointerdown', resume, { once: true });
    document.addEventListener('keydown', resume, { once: true });
  }

  fadeToState(duration) {
    this.ensureTracks();
    if (!this.tracks) return;
    if (globalThis.document?.hidden) {
      this.cancelFade();
      Object.values(this.tracks).forEach((track) => {
        track.volume = 0;
        track.pause();
      });
      return;
    }
    const settings = getSettings();
    const audibleState = settings.musicEnabled && settings.masterVolume > 0 ? this.state : MUSIC_STATES.SILENT;
    const targetGain = settings.masterVolume * MUSIC_GAIN;
    const targets = {
      [MUSIC_STATES.MENU]: audibleState === MUSIC_STATES.MENU ? targetGain : 0,
      [MUSIC_STATES.GAMEPLAY]: audibleState === MUSIC_STATES.GAMEPLAY ? targetGain : 0,
    };

    this.cancelFade();
    const generation = this.fadeGeneration;
    const starts = Object.fromEntries(Object.entries(this.tracks).map(([key, track]) => [key, track.volume]));

    Object.entries(this.tracks).forEach(([key, track]) => {
      if (targets[key] > 0 && track.paused) {
        try {
          const playback = track.play();
          playback?.catch?.(() => this.armGestureResume());
        } catch { this.armGestureResume(); }
      }
    });

    const startedAt = performance.now();
    const tick = (now) => {
      if (generation !== this.fadeGeneration) return;
      const progress = Math.min(1, (now - startedAt) / Math.max(1, duration));
      const eased = progress * (2 - progress);
      Object.entries(this.tracks).forEach(([key, track]) => {
        track.volume = Math.max(0, Math.min(1, starts[key] + (targets[key] - starts[key]) * eased));
      });
      if (progress < 1) {
        this.fadeFrame = requestAnimationFrame(tick);
        return;
      }
      this.fadeFrame = null;
      Object.entries(this.tracks).forEach(([key, track]) => {
        if (targets[key] === 0) track.pause();
      });
    };
    this.fadeFrame = requestAnimationFrame(tick);
  }
}

export const musicManager = new MusicManager();
