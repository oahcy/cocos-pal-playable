import type { ChannelAdapter } from './adapter';

// Shared state and subscriptions; no advertising SDK calls belong here.
export function createPlayable(adapter: ChannelAdapter, document: Document): PlayableAPI {
  let ready = false, finished = false, interacted = false;
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
    callbacks.slice().forEach(fn => fn(...args));
  }
  function muted(): boolean { return document.hidden || !interacted || sdkMuted === true; }
  const api: PlayableAPI = {
    channel: adapter.channel,
    capabilities: Object.freeze({ ...adapter.capabilities }),
    get ready() { return ready; },
    onReady(fn) {
      if (ready) { if (typeof fn !== 'function') throw new TypeError('callback must be a function'); fn(); return () => {}; }
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
    onMuteChange(fn) { const off = subscribe(listeners.mute, fn); fn(muted()); return off; },
  };
  Object.freeze(api);
  adapter.init({
    ready() { if (ready) return; ready = true; emit(listeners.ready); listeners.ready.length = 0; },
    mute(value) {
      if (typeof value !== 'boolean') return;
      const before = muted(); sdkMuted = value;
      if (before !== muted()) emit(listeners.mute, muted());
    },
  });
  document.addEventListener('visibilitychange', () => {
    emit(document.hidden ? listeners.pause : listeners.resume); emit(listeners.mute, muted());
  });
  document.addEventListener('pointerdown', () => { interacted = true; emit(listeners.mute, muted()); }, { once: true });
  return api;
}
