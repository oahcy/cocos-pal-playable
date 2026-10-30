import type { StartupContext, EmbeddedContext } from '../../../runtime/host';
import type { EmbeddedStore } from '../../../runtime/embedded/store';
import { installCreator2Assets, type Creator2Engine } from './embedded';
export interface Creator2Manifest { scripts: string[]; engine: string; main: string }
interface Game {
  EVENT_SHOW: string;
  isPaused(): boolean; pause(): void; resume(): void;
  on(event: string, callback: () => void): void;
  run(options: unknown, callback: () => void): unknown;
}
declare global {
  interface Window {
    cc?: Creator2Engine & { game: Game };
    __playableCreator2Store?: EmbeddedStore;
    boot?: () => void;
    _CCSettings?: { jsList?: string[] };
    __startCreator2(manifest: Creator2Manifest): Promise<void>;
  }
}
// Channel runtime and single-HTML loader are separate bundles. Share their store on the page.
export function prepareEmbedded(context: EmbeddedContext): Promise<void> {
  window.__playableCreator2Store = context.store;
  return Promise.resolve();
}
export function installStartup(context: StartupContext): void {
  window.__startCreator2 = async manifest => {
    const embedded = window.__playableCreator2Store;
    try {
      await Promise.race([new Promise<void>(resolve => { context.api.onReady(resolve); }), context.failure]);
      const loadScript = async (name: string) => {
        if (embedded) await embedded.script(name);
        else await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = './' + name; script.onload = () => { script.remove(); resolve(); };
          script.onerror = () => { script.remove(); reject(new Error('Cannot load Creator 2 script: ' + name)); };
          document.head.appendChild(script);
        });
      };
      for (const name of manifest.scripts) {
        if (name === manifest.main) {
          // game.run loads jsList outside the asset pipeline in 2.4. Load those
          // plugins explicitly after engine/physics, before project startup.
          const settings = window._CCSettings;
          const plugins = settings?.jsList || [];
          if (settings) settings.jsList = [];
          for (const file of plugins) await loadScript('src/' + file);
        }
        await loadScript(name);
        if (name === manifest.engine && embedded) {
          if (!window.cc) throw new Error('Creator 2 engine did not initialize');
          installCreator2Assets(window.cc, embedded);
        }
      }
      const cc = window.cc;
      if (!cc || typeof window.boot !== 'function') throw new Error('Creator 2 Web bootstrap is unavailable');
      while (!context.api.viewable) {
        let off = () => {};
        try { await Promise.race([new Promise<void>(resolve => { off = context.api.onResume(resolve); }), context.failure]); }
        finally { off(); }
      }
      let started = false, pausedByAd = false;
      const sync = () => {
        if (!started) return;
        if (!context.api.viewable && !cc.game.isPaused()) { pausedByAd = true; cc.game.pause(); }
        else if (context.api.viewable && pausedByAd) { pausedByAd = false; cc.game.resume(); }
      };
      context.api.onPause(sync); context.api.onResume(sync);
      cc.game.on(cc.game.EVENT_SHOW, () => Promise.resolve().then(sync));
      const run = cc.game.run;
      // Scope the launch observer to this ad page; restore the original before invoking it.
      cc.game.run = function (options, callback) {
        cc.game.run = run;
        return run.call(this, options, () => { callback(); started = true; sync(); });
      };
      window.boot();
    } catch (error) { context.reportError(error); }
  };
}
