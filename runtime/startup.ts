// Only the Cocos APIs used by the bootstrap; no channel SDK belongs here.
export interface PlayableEngine {
  Game: { EVENT_SHOW: string; EVENT_RESUME: string };
  game: {
    isPaused(): boolean; pause(): void; resume(): void;
    on(event: string, callback: () => void): void;
    off(event: string, callback: () => void): void;
    onPostProjectInitDelegate: { add(callback: () => Promise<void>): void; remove(callback: () => Promise<void>): void };
  };
  settings: { querySettings(category: string, key: string): unknown };
  director: { preloadScene(scene: string, callback: (error?: Error | null) => void): void };
}
export interface PlayableApplication {
  init(engine: PlayableEngine): void | Promise<void>;
  start(): void | Promise<void>;
}
export async function startPlayable(application: PlayableApplication, loadEngine: () => Promise<PlayableEngine>,
  api: PlayableAPI, failure: Promise<never>, document: Document): Promise<void> {
  const canvas = document.getElementById('GameCanvas');
  if (!(canvas instanceof HTMLCanvasElement) || !canvas.parentElement) throw new Error('Playable canvas is missing');
  const size = canvas.parentElement.getBoundingClientRect();
  canvas.width = size.width; canvas.height = size.height;
  const engine = await Promise.race([loadEngine(), failure]);
  let started = false, pausedByAd = false;
  const syncVisibility = () => {
    if (!started) return;
    if (!api.viewable) {
      if (!engine.game.isPaused()) { pausedByAd = true; engine.game.pause(); }
    } else if (pausedByAd) {
      pausedByAd = false; engine.game.resume();
    }
  };
  const afterShow = () => { Promise.resolve().then(syncVisibility); };
  const offPause = api.onPause(syncVisibility), offResume = api.onResume(syncVisibility);
  engine.game.on(engine.Game.EVENT_SHOW, afterShow);
  engine.game.on(engine.Game.EVENT_RESUME, syncVisibility);
  const prepare = async () => {
    const scene = engine.settings.querySettings('launch', 'launchScene');
    if (typeof scene === 'string' && scene) {
      await Promise.race([new Promise<void>((resolve, reject) => {
        engine.director.preloadScene(scene, error => error ? reject(error) : resolve());
      }), failure]);
    }
    let offReady: PlayableUnsubscribe = () => {};
    try { await Promise.race([new Promise<void>(resolve => { offReady = api.onReady(resolve); }), failure]); }
    finally { offReady(); }
    while (!api.viewable) {
      let offVisible: PlayableUnsubscribe = () => {};
      try { await Promise.race([new Promise<void>(resolve => { offVisible = api.onResume(resolve); }), failure]); }
      finally { offVisible(); }
    }
  };
  engine.game.onPostProjectInitDelegate.add(prepare);
  try {
    await application.init(engine);
    await Promise.race([Promise.resolve(application.start()), failure]);
    started = true;
    syncVisibility();
  } catch (error) {
    offPause(); offResume();
    engine.game.off(engine.Game.EVENT_SHOW, afterShow);
    engine.game.off(engine.Game.EVENT_RESUME, syncVisibility);
    throw error;
  } finally { engine.game.onPostProjectInitDelegate.remove(prepare); }
}
export function showStartupError(document: Document, error: unknown): void {
  console.error('[Playable] Startup failed', error);
  if (document.getElementById('playable-startup-error')) return;
  const message = document.createElement('div');
  message.id = 'playable-startup-error';
  message.setAttribute('role', 'alert');
  message.textContent = 'Unable to start this playable. Please reload and try again.';
  message.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;padding:24px;background:#171717;color:white;font:16px sans-serif;z-index:9999';
  document.body.appendChild(message);
}
