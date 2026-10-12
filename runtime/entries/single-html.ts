import JSZip from 'jszip';
import { EmbeddedStore, VIRTUAL_ROOT } from '../embedded/store';
import { installEmbeddedAssets, type EmbeddedEngine } from '../embedded/engine';
import type {} from '../index';
import { showStartupError } from '../startup';
interface Manifest { polyfills?: string; system: string; importMap: { imports: Record<string, string> }; settings: string; entry: string; }
interface SystemLoader { createScript(url: string): HTMLScriptElement; import(id: string): Promise<unknown>; }
declare const System: SystemLoader;
async function boot(): Promise<void> {
  const manifest = JSON.parse(document.getElementById('embedded-manifest')!.textContent!) as Manifest;
  const zipElement = document.getElementById('embedded-archive')!;
  const store = new EmbeddedStore(await JSZip.loadAsync(zipElement.textContent!, { base64: true }));
  zipElement.remove();
  await store.prepare();
  if (manifest.polyfills) await store.script(manifest.polyfills);
  await store.script(manifest.system);
  const loaderPrototype = Object.getPrototypeOf(System) as SystemLoader;
  const createScript = loaderPrototype.createScript;
  if (typeof createScript !== 'function') throw new Error('Unsupported SystemJS loader: createScript is missing');
  loaderPrototype.createScript = function (url) { return createScript.call(this, store.url(url)); };
  const map = document.createElement('script');
  map.type = 'systemjs-importmap'; map.textContent = JSON.stringify(manifest.importMap); document.head.appendChild(map);
  // The page installs the same channel runtime used by the ZIP build.
  if (typeof window.__startPlayable !== 'function') throw new Error('Channel runtime is missing');
  const start = window.__startPlayable;
  const settings = await store.json<{ plugins?: { jsList?: string[] }; rendering?: { effectSettingsPath?: string } }>(manifest.settings);
  const scripts = settings.plugins?.jsList || [];
  if (settings.plugins) settings.plugins.jsList = [];
  if (settings.rendering?.effectSettingsPath) settings.rendering.effectSettingsPath = store.url(settings.rendering.effectSettingsPath);
  const settingsURL = URL.createObjectURL(new Blob([JSON.stringify(settings)], { type: 'application/json' }));
  window.__startPlayable = (application, loadEngine) => {
    if (!('settingsPath' in application)) throw new Error('Unsupported Application: settingsPath is missing');
    application.settingsPath = settingsURL;
    return start(application, async () => {
      const engine = await loadEngine() as EmbeddedEngine & { game: { onPreProjectInitDelegate: { add(callback: () => Promise<void>): void } } };
      installEmbeddedAssets(engine, store);
      engine.game.onPreProjectInitDelegate.add(async () => { for (const file of scripts) await store.script('src/' + file); });
      return engine;
    });
  };
  await System.import(VIRTUAL_ROOT + manifest.entry);
}
void boot().catch(error => showStartupError(document, error));
