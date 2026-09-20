/**
 * Register the generated production service worker without coupling PWA
 * lifecycle to Phaser. Development remains network-only; Vite's production
 * preview and GitHub Pages both expose the generated service-worker.js.
 */
export function registerOfflineSupport() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (!window.isSecureContext) return;

  window.addEventListener('load', () => {
    const serviceWorkerUrl = new URL('./service-worker.js', window.location.href);
    navigator.serviceWorker.register(serviceWorkerUrl, {
      scope: './',
      updateViaCache: 'none',
    }).then((registration) => {
      // Ask for an update opportunistically. Failure is non-fatal: an existing
      // installed worker and its cache remain usable while offline.
      registration.update().catch(() => {});
    }).catch((error) => {
      console.warn('[I SPY] Offline support unavailable:', error);
    });
  }, { once: true });
}
