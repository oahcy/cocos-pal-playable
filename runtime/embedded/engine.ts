import { EmbeddedStore } from './store';
import type { PlayableEngine } from '../startup';
type Done = (error: Error | null, data?: unknown) => void;
interface RequestItem { url: string; ext: string; isNative: boolean; info?: { packs?: unknown }; }
export interface EmbeddedEngine extends PlayableEngine {
  assetManager: {
    transformPipeline: { append(pipe: (task: { input: RequestItem[]; output: RequestItem[] }) => Error | void): void };
    downloader: { bundleVers: Record<string, string>; register(handlers: Record<string, (url: string, options: { version?: string }, done: Done) => void>): void };
  };
}
export function installEmbeddedAssets(engine: EmbeddedEngine, store: EmbeddedStore): void {
  const downloader = engine.assetManager.downloader;
  const fontExtensions = new Set(['.ttf', '.woff', '.woff2', '.otf', '.ttc', '.eot', '.font', '.svg']);
  const fonts = new Map<string, Promise<string>>();
  const loadFont = (url: string, _options: { version?: string }, done: Done) => {
    let pending = fonts.get(url);
    if (!pending) {
      const family = 'PlayableFont' + fonts.size;
      pending = Promise.resolve().then(async () => {
        const face = await new FontFace(family, 'url("' + store.url(url) + '")').load();
        document.fonts.add(face);
        return family;
      });
      fonts.set(url, pending);
    }
    pending.then(family => done(null, family), error => done(error));
  };
  downloader.register(Object.fromEntries([...fontExtensions].map(ext => [ext, loadFont])));
  // Packed JSON requests bypass transformPipeline, so handle them explicitly.
  downloader.register({
    '.json': (url, _options, done) => { store.json(url).then(data => done(null, data), error => done(error)); },
    bundle: (nameOrURL, options, done) => {
      const name = nameOrURL.replace(/\/$/, '').split('/').pop()!;
      const base = nameOrURL.includes('/') ? nameOrURL : 'assets/' + name;
      const version = options.version || downloader.bundleVers[name];
      const suffix = version ? '.' + version : '';
      Promise.all([store.json<Record<string, unknown>>(base + '/config' + suffix + '.json'), store.script(base + '/index' + suffix + '.js')])
        .then(([config]) => done(null, { ...config, base: base + '/' }), error => done(error));
    },
  });
  // Keep Cocos' existing decoders for images, audio and binary data.
  // Only their URL changes; type, UUID, dependency and cache identity stay intact.
  engine.assetManager.transformPipeline.append(task => {
    task.output = task.input;
    try {
      for (const item of task.input) {
        if (fontExtensions.has(item.ext) || item.ext === 'bundle' || item.ext === '.json' || (!item.isNative && item.info?.packs)) continue;
        item.url = store.url(item.url);
      }
    } catch (error) { return error instanceof Error ? error : new Error(String(error)); }
  });
}
