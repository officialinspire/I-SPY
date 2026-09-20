/**
 * Runs a key handler at most once per physical key press.
 *
 * Phaser pushes every DOM key event onto one queue and processes the whole
 * queue on each new event, clearing it only at the next game step. Its own
 * guard against re-delivery compares an event against the previous one it
 * processed, which catches a queue of two and nothing longer. So whenever
 * more than two key events land inside a single frame — typing quickly,
 * holding a key down against the system's repeat rate, or any frame that
 * runs long on a modest device — the earlier ones are delivered again.
 *
 * A handler that only reads is unharmed. A handler that changes something is
 * not: one press of a COUNT stepper jumped the tally by three or five, a
 * typed digit landed more than once, and ESC toggled the hold an even number
 * of times and appeared to do nothing at all.
 *
 * Stamping the event object lets each handler see each press exactly once.
 * Handlers take their own id because several of them legitimately receive
 * the same event — recon listens for ESC and for every key — and one flag
 * between them would let the first handler swallow the press.
 */
export function oncePerKeyEvent(id, handler) {
  const stamp = `__iSpyKeyHandled_${id}`;
  return (event, ...rest) => {
    if (!event || typeof event !== 'object') return handler(event, ...rest);
    if (event[stamp]) return undefined;
    try {
      Object.defineProperty(event, stamp, { value: true, enumerable: false, configurable: true });
    } catch {
      // A frozen event cannot be stamped. Handling it twice is better than
      // not handling it at all.
    }
    return handler(event, ...rest);
  };
}
