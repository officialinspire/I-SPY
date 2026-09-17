import { feedback } from '../audio/feedback.js';

const NEXT_KEYS = new Set(['ArrowDown', 'ArrowRight']);
const PREVIOUS_KEYS = new Set(['ArrowUp', 'ArrowLeft']);
const ACTIVATE_KEYS = new Set(['Enter', ' ', 'Spacebar']);

/**
 * Keyboard focus ring for a set of shared buttons.
 *
 * Tab / Shift+Tab and the arrow keys walk the visible, enabled buttons in the
 * order they were registered; Enter or Space activates the focused button;
 * Escape drops focus. Pointer input clears the focus treatment so the ring
 * only ever shows for keyboard users.
 */
export function createFocusGroup(scene, buttons = []) {
  let members = [...buttons];
  let focusedIndex = -1;

  const focusable = () => members.filter((button) => button?.isFocusable?.());

  const clearFocus = () => {
    members.forEach((button) => button?.setFocused?.(false));
    focusedIndex = -1;
  };

  const focusAt = (index, silent = false) => {
    const candidates = focusable();
    if (!candidates.length) return;
    const wrapped = ((index % candidates.length) + candidates.length) % candidates.length;
    const target = candidates[wrapped];
    members.forEach((button) => button?.setFocused?.(button === target));
    focusedIndex = members.indexOf(target);
    if (!silent) feedback('focus');
  };

  const currentCandidateIndex = () => {
    const candidates = focusable();
    const current = members[focusedIndex];
    const index = candidates.indexOf(current);
    return { candidates, index };
  };

  const move = (delta) => {
    const { candidates, index } = currentCandidateIndex();
    if (!candidates.length) return;
    if (index === -1) {
      focusAt(delta >= 0 ? 0 : candidates.length - 1);
      return;
    }
    focusAt(index + delta);
  };

  const onKeyDown = (event) => {
    const key = event.key;
    if (key === 'Tab') {
      event.preventDefault?.();
      move(event.shiftKey ? -1 : 1);
      return;
    }
    if (focusedIndex === -1) return;
    if (NEXT_KEYS.has(key)) {
      event.preventDefault?.();
      move(1);
      return;
    }
    if (PREVIOUS_KEYS.has(key)) {
      event.preventDefault?.();
      move(-1);
      return;
    }
    if (ACTIVATE_KEYS.has(key)) {
      event.preventDefault?.();
      const target = members[focusedIndex];
      if (target?.isFocusable?.()) target.activateFromKeyboard();
      return;
    }
    if (key === 'Escape') clearFocus();
  };

  const onPointerDown = () => clearFocus();

  scene.input.keyboard?.on('keydown', onKeyDown);
  scene.input.on('pointerdown', onPointerDown);

  const group = {
    setMembers(nextButtons = []) {
      clearFocus();
      members = [...nextButtons];
      return group;
    },
    refresh() {
      if (focusedIndex !== -1 && !members[focusedIndex]?.isFocusable?.()) clearFocus();
      return group;
    },
    clearFocus,
    destroy() {
      clearFocus();
      scene.input.keyboard?.off('keydown', onKeyDown);
      scene.input.off('pointerdown', onPointerDown);
    },
  };

  scene.events.once('shutdown', () => group.destroy());
  return group;
}
