import { prepareEmbedded } from '@playable/host-runtime';
import JSZip from 'jszip';
import { decodeArchive } from '../embedded/embedded-codec';
import { EmbeddedStore, VIRTUAL_ROOT, resourceError } from '../embedded/store';
import { installEmbeddedFetch } from '../embedded/fetch';
import type {} from '../index';
import { showStartupError } from '../errors';
interface Manifest { kind?: 'creator2'; polyfills?: string; system: string; importMap: { imports: Record<string, string> }; settings: string; entry: string; }
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
  if (manifest.kind === 'creator2') {
    await prepareEmbedded({ store, settingsPath: '' });
    await store.script(manifest.entry);
    return;
  }
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
  await prepareEmbedded({ store, settingsPath: manifest.settings });
  console.info('[Playable embedded] Starting engine.');
  await System.import(VIRTUAL_ROOT + manifest.entry);
}
void boot().catch(error => showStartupError(document, error));
