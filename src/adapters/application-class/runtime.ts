// Shared by CLI and Creator versions using the Application class protocol.
import type { StartupContext, EmbeddedContext } from '../../../runtime/host';
import { installEmbeddedAssets, type EmbeddedEngine } from '../../../runtime/embedded/engine';
import { startPlayable, type PlayableApplication, type PlayableEngine } from './startup';

declare global {
  interface Window {
    __startPlayable(application: PlayableApplication, loadEngine: () => Promise<PlayableEngine>): Promise<void>;
  }
}
export function installStartup(context: StartupContext): void {
  window.__startPlayable = async (application, loadEngine) => {
    try { await startPlayable(application, loadEngine, context.api, context.failure, context.document); }
    catch (error) { context.reportError(error); }
  };
}
export async function prepareEmbedded({ store, settingsPath }: EmbeddedContext): Promise<void> {
  if (typeof window.__startPlayable !== 'function') throw new Error('Channel runtime is missing');
  const start = window.__startPlayable;
  const settings = await store.json<{ plugins?: { jsList?: string[] }; rendering?: { effectSettingsPath?: string } }>(settingsPath);
  const scripts = settings.plugins?.jsList || [];
  // Plugin scripts must run after engine initialization but before project initialization.
  if (settings.plugins) settings.plugins.jsList = [];
  if (settings.rendering?.effectSettingsPath) settings.rendering.effectSettingsPath = await store.url(settings.rendering.effectSettingsPath);
  const settingsURL = URL.createObjectURL(new Blob([JSON.stringify(settings)], { type: 'application/json' }));
  window.__startPlayable = (application, loadEngine) => {
    if (!('settingsPath' in application)) throw new Error('Unsupported Application: settingsPath is missing');
    application.settingsPath = settingsURL;
    return start(application, async () => {
      const engine = await loadEngine() as PlayableEngine & EmbeddedEngine & {
        game: { onPreProjectInitDelegate: { add(callback: () => Promise<void>): void } };
      };
      installEmbeddedAssets(engine, store);
      engine.game.onPreProjectInitDelegate.add(async () => {
        for (const file of scripts) await store.script('src/' + file);
      });
      return engine;
    });
  };
}
