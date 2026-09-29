import type { ChannelAdapter } from './adapter';

// Shared state and subscriptions; no advertising SDK calls belong here.
export function createPlayable(adapter: ChannelAdapter, document: Document, onError: (error: Error) => void = console.error): PlayableAPI {
  let ready = false, finished = false, interacted = false;
  let hidden = document.hidden;
  let sdkViewable = !adapter.capabilities.containerLifecycle;
  let sdkMuted: boolean | null = null;
  const listeners = {
    ready: [] as Array<() => void>,
    pause: [] as Array<() => void>,
    resume: [] as Array<() => void>,
    mute: [] as Array<(muted: boolean) => void>,
  };
  function subscribe<T>(callbacks: T[], callback: T): PlayableUnsubscribe {
    if (typeof callback !== 'function') throw new TypeError('callback must be a function');
    callbacks.push(callback);
    return () => { const i = callbacks.indexOf(callback); if (i >= 0) callbacks.splice(i, 1); };
  }
  function emit<T extends unknown[]>(callbacks: Array<(...args: T) => void>, ...args: T): void {
    callbacks.slice().forEach(fn => {
      try { fn(...args); } catch (error) { console.error('[Playable] Subscriber failed', error); }
    });
  }
  function viewable(): boolean { return !hidden && sdkViewable; }
  function updateState(change: () => void): void {
    const wasViewable = viewable(), wasMuted = muted();
    change();
    if (wasViewable !== viewable()) emit(viewable() ? listeners.resume : listeners.pause);
    if (wasMuted !== muted()) emit(listeners.mute, muted());
  }
  function muted(): boolean { return !viewable() || !interacted || sdkMuted === true; }
  const api: PlayableAPI = {
    channel: adapter.channel,
    capabilities: Object.freeze({ ...adapter.capabilities }),
    get ready() { return ready; },
    get viewable() { return viewable(); },
    onReady(fn) {
      if (ready) { if (typeof fn !== 'function') throw new TypeError('callback must be a function'); emit([fn]); return () => {}; }
      return subscribe(listeners.ready, fn);
    },
    openStore() { adapter.openStore(); },
    finish() {
      if (finished) return;
      if (adapter.capabilities.finishNotification) {
        if (!adapter.finish) throw new Error('Adapter declares finishNotification without finish()');
        adapter.finish();
      }
      finished = true;
    },
    onPause(fn) { return subscribe(listeners.pause, fn); },
    onResume(fn) { return subscribe(listeners.resume, fn); },
    onMuteChange(fn) { const off = subscribe(listeners.mute, fn); emit([fn], muted()); return off; },
  };
  Object.freeze(api);
  adapter.init({
    error: onError,
    ready() { if (ready) return; ready = true; emit(listeners.ready); listeners.ready.length = 0; },
    mute(value) {
      if (typeof value !== 'boolean') return;
      updateState(() => { sdkMuted = value; });
    },
    viewable(value) {
      if (typeof value === 'boolean') updateState(() => { sdkViewable = value; });
    },
  });
  document.addEventListener('visibilitychange', () => {
    updateState(() => { hidden = document.hidden; });
  });
  document.addEventListener('pointerdown', () => updateState(() => { interacted = true; }), { once: true });
  return api;
}
