import JSZip from 'jszip';
import { decodeArchive } from '../embedded/embedded-codec';
import { EmbeddedStore, VIRTUAL_ROOT, resourceError } from '../embedded/store';
import { installEmbeddedFetch } from '../embedded/fetch';
import { installEmbeddedAssets, type EmbeddedEngine } from '../embedded/engine';
import type {} from '../index';
import { showStartupError } from '../startup';
interface Manifest { polyfills?: string; system: string; importMap: { imports: Record<string, string> }; settings: string; entry: string; }
interface SystemLoader { instantiate(url: string, parent?: string): Promise<unknown>; createScript(url: string): HTMLScriptElement; import(id: string): Promise<unknown>; }
declare const System: SystemLoader;
async function boot(): Promise<void> {
  const manifest = JSON.parse(document.getElementById('embedded-manifest')!.textContent!) as Manifest;
  const zip = await Promise.resolve().then(() => {
    const element = document.getElementById('embedded-archive')!;
    try {
      console.info('[Playable embedded] Decoding archive.');
      const bytes = decodeArchive(element.textContent!, element.dataset.encoding);
      console.info(`[Playable embedded] Opening ZIP (${bytes.byteLength} bytes).`);
      return JSZip.loadAsync(bytes);
    } finally {
      // Removing the element alone keeps its large text alive while it is referenced.
      // Clear it before ZIP parsing or engine startup can allocate more resources.
      element.textContent = '';
      element.remove();
    }
  }).catch(error => { throw resourceError('open archive', 'embedded-archive', error); });
  console.info('[Playable embedded] Archive ready.');
  const store = new EmbeddedStore(zip);
  installEmbeddedFetch(window, store, error => showStartupError(document, error));
  if (manifest.polyfills) await store.script(manifest.polyfills);
  await store.script(manifest.system);
  const loaderPrototype = Object.getPrototypeOf(System) as SystemLoader;
  const createScript = loaderPrototype.createScript;
  if (typeof createScript !== 'function') throw new Error('Unsupported SystemJS loader: createScript is missing');
  loaderPrototype.createScript = function (url) { return createScript.call(this, store.readyURL(url)); };
  const instantiate = System.instantiate;
  System.instantiate = async function (url, parent) {
    try {
      // Named System.register modules stay with SystemJS; only package URLs need bytes.
      if (url.startsWith(VIRTUAL_ROOT)) await store.url(url);
      return await instantiate.call(this, url, parent);
    } catch (error) { throw resourceError('instantiate module', url + (parent ? ' from ' + parent : ''), error); }
  };
  const map = document.createElement('script');
  map.type = 'systemjs-importmap';
  map.textContent = JSON.stringify(manifest.importMap);
  document.head.appendChild(map);
  // The page installs the same channel runtime used by the ZIP build.
  if (typeof window.__startPlayable !== 'function') throw new Error('Channel runtime is missing');
  const start = window.__startPlayable;
  const settings = await store.json<{ plugins?: { jsList?: string[] }; rendering?: { effectSettingsPath?: string } }>(manifest.settings);
  const scripts = settings.plugins?.jsList || [];
  // Load plugin scripts ourselves from the archive at the same engine startup stage.
  if (settings.plugins) settings.plugins.jsList = [];
  if (settings.rendering?.effectSettingsPath) {
    settings.rendering.effectSettingsPath = await store.url(settings.rendering.effectSettingsPath);
  }
  const settingsBlob = new Blob([JSON.stringify(settings)], { type: 'application/json' });
  const settingsURL = URL.createObjectURL(settingsBlob);
  window.__startPlayable = (application, loadEngine) => {
    if (!('settingsPath' in application)) throw new Error('Unsupported Application: settingsPath is missing');
    application.settingsPath = settingsURL;
    return start(application, async () => {
      const engine = await loadEngine() as EmbeddedEngine & { game: { onPreProjectInitDelegate: { add(callback: () => Promise<void>): void } } };
      installEmbeddedAssets(engine, store);
      engine.game.onPreProjectInitDelegate.add(async () => {
        for (const file of scripts) {
          await store.script('src/' + file);
        }
      });
      return engine;
    });
  };
  console.info('[Playable embedded] Starting engine.');
  await System.import(VIRTUAL_ROOT + manifest.entry);
}
void boot().catch(error => showStartupError(document, error));
