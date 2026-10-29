import { installEmbeddedAssets, type EmbeddedEngine } from '../../../runtime/embedded/engine';
import { EmbeddedStore, resourceError } from '../../../runtime/embedded/store';
type Done = (error: Error | null, data?: unknown) => void;
interface Item { url: string; type: string }
type Handler = (this: unknown, item: Item, done: Done) => unknown;
export interface Creator2Engine {
  assetManager?: Omit<EmbeddedEngine['assetManager'], 'preprocessPipe'> & { preprocessPipe?: EmbeddedEngine['assetManager']['preprocessPipe']; _preprocessPipe?: EmbeddedEngine['assetManager']['preprocessPipe'] };
  loader?: { downloader: { extMap: Record<string, Handler> }; addDownloadHandlers(handlers: Record<string, Handler>): void };
}
export function installCreator2Assets(engine: Creator2Engine, store: EmbeddedStore): void {
  if (engine.assetManager) {
    const manager = engine.assetManager;
    // 2.4 exposes the same pipeline protocol under a private preprocess field.
    installEmbeddedAssets({ assetManager: { ...manager, preprocessPipe: (manager.preprocessPipe || manager._preprocessPipe)! } }, store);
    return;
  }
  const loader = engine.loader;
  if (!loader?.downloader?.extMap || typeof loader.addDownloadHandlers !== 'function') throw new Error('Unsupported Creator 2.x resource loader');
  const handlers: Record<string, Handler> = {};
  for (const [type, original] of Object.entries(loader.downloader.extMap)) {
    // UUID/pack routing remains owned by Creator. Its JSON reads reach the wrapped text handler.
    if (type === 'uuid' || typeof original !== 'function') continue;
    handlers[type] = function (item, done) {
      void store.url(item.url).then(url => {
        item.url = url;
        const result = original.call(this, item, done);
        // The old Pipeline protocol completes synchronously on any defined return value.
        if (result !== undefined) done(null, result);
      }).catch(error => done(resourceError('load Creator 2 asset', item.url, error)));
      return undefined;
    };
  }
  loader.addDownloadHandlers(handlers);
}
