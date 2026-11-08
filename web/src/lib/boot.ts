/**
 * Coordinates the startup splash. Components that must finish loading before the
 * page is usable call `holdBoot()` and invoke the returned release function when
 * ready. The splash hides once the app has hydrated and no holds remain.
 * After the first boot, holds are no-ops (client navigations don't show the splash).
 */
let holds = 0;
let booted = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((fn) => fn());

export function holdBoot(): () => void {
  if (booted) return () => {};
  holds++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds--;
    notify();
  };
}

export function bootPending(): boolean {
  return holds > 0;
}

export function markBooted() {
  booted = true;
}

export function onBootChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
