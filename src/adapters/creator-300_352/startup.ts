import { installEmbeddedAssets, type EmbeddedEngine } from '../../../runtime/embedded/engine';
import type { EmbeddedStore } from '../../../runtime/embedded/store';

interface LegacyEngine extends EmbeddedEngine {
  Game: { EVENT_SHOW: string; EVENT_RESUME: string };
  game: {
    isPaused(): boolean; pause(): void; resume(): void;
    on(event: string, callback: () => void): void;
    off(event: string, callback: () => void): void;
  };
}
export type CreateLegacyApplication = (options: {
  loadJsListFile(url: string): Promise<void>; fetchWasm(url: string): string;
}) => Promise<{ start(options: { findCanvas(): { frame: HTMLElement | null; container: HTMLElement | null; canvas: HTMLCanvasElement } }): Promise<void> }>;
declare const System: { import(id: string): Promise<LegacyEngine> };
declare global {
  interface Window {
    __startLegacyPlayable(factory: CreateLegacyApplication): Promise<void>;
    __legacyEmbeddedContext?: { store: EmbeddedStore; settings: Record<string, unknown> };
  }
}
export async function startCreator35(factory: CreateLegacyApplication, api: PlayableAPI, failure: Promise<never>, document: Document): Promise<void> {
  let offReady: PlayableUnsubscribe = () => {};
  try { await Promise.race([new Promise<void>(resolve => { offReady = api.onReady(resolve); }), failure]); }
  finally { offReady(); }
  const canvas = document.getElementById('GameCanvas');
  if (!(canvas instanceof HTMLCanvasElement) || !canvas.parentElement) throw new Error('Playable canvas is missing');
  const size = canvas.parentElement.getBoundingClientRect();
  canvas.width = size.width; canvas.height = size.height;
  const engine = await Promise.race([System.import('cc'), failure]);
  const embedded = window.__legacyEmbeddedContext;
  if (embedded) installEmbeddedAssets(engine, embedded.store);
  const loadJsListFile = (url: string): Promise<void> => {
    if (embedded) return embedded.store.script(url);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => { script.remove(); resolve(); };
      script.onerror = () => { script.remove(); reject(new Error('Cannot load ' + url)); };
      document.head.appendChild(script);
    });
  };
  const application = await Promise.race([factory({ loadJsListFile, fetchWasm: url => url }), failure]);
  while (!api.viewable) {
    let offVisible: PlayableUnsubscribe = () => {};
    try { await Promise.race([new Promise<void>(resolve => { offVisible = api.onResume(resolve); }), failure]); }
    finally { offVisible(); }
  }
  let started = false, pausedByAd = false;
  const syncVisibility = () => {
    if (!started) return;
    if (!api.viewable) {
      if (!engine.game.isPaused()) { pausedByAd = true; engine.game.pause(); }
    } else if (pausedByAd) { pausedByAd = false; engine.game.resume(); }
  };
  const afterShow = () => { Promise.resolve().then(syncVisibility); };
  const offPause = api.onPause(syncVisibility), offResume = api.onResume(syncVisibility);
  engine.game.on(engine.Game.EVENT_SHOW, afterShow);
  engine.game.on(engine.Game.EVENT_RESUME, syncVisibility);
  try {
    await Promise.race([application.start({ findCanvas: () => ({
      frame: document.getElementById('GameDiv'), container: document.getElementById('Cocos3dGameContainer'), canvas,
    }) }), failure]);
    started = true;
    syncVisibility();
  } catch (error) {
    offPause(); offResume();
    engine.game.off(engine.Game.EVENT_SHOW, afterShow);
    engine.game.off(engine.Game.EVENT_RESUME, syncVisibility);
    throw error;
  }
}
