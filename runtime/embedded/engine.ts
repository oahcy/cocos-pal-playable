import { EmbeddedStore, resourceError } from './store';
import type { PlayableEngine } from '../startup';
type Done = (error: Error | null, data?: unknown) => void;
interface RequestItem { url: string; ext: string; isNative: boolean; info?: { packs?: unknown }; }
interface ResourceTask { input: RequestItem[]; output: RequestItem[] }
type Pipe = (task: ResourceTask, done: (error?: Error) => void) => void;
interface ResourcePipeline { pipes: Pipe[]; insert(pipe: Pipe, index: number): void }
export interface EmbeddedEngine extends PlayableEngine {
  assetManager: {
    pipeline: ResourcePipeline; fetchPipeline: ResourcePipeline; preprocessPipe: Pipe;
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
        const face = await new FontFace(family, 'url("' + (await store.url(url)) + '")').load();
        document.fonts.add(face);
        return family;
      });
      fonts.set(url, pending);
    }
    pending.then(family => done(null, family), error => done(resourceError('load font', url, error)));
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
  // Both load and preload transform URLs synchronously. Decode AFTER preprocess,
  // before the engine downloads/parses them. Keep UUIDs, types and cache keys intact.
  const prepare: Pipe = (task, done) => {
    task.output = task.input;
    void Promise.allSettled(task.input.map(async item => {
      if (fontExtensions.has(item.ext) || item.ext === 'bundle' || item.ext === '.json' || (!item.isNative && item.info?.packs)) return;
      return { item, url: await store.url(item.url) };
    })).then(results => {
      const failed = results.find(result => result.status === 'rejected');
      if (failed?.status === 'rejected') { done(resourceError('prepare assets', 'load/preload', failed.reason)); return; }
      // Finish all reads before releasing a failed task; Cocos may recycle its items.
      for (const result of results) if (result.status === 'fulfilled' && result.value) result.value.item.url = result.value.url;
      done();
    });
  };
  const pipelines = [engine.assetManager.pipeline, engine.assetManager.fetchPipeline];
  const positions = pipelines.map(pipeline => pipeline.pipes.indexOf(engine.assetManager.preprocessPipe));
  if (positions.some(index => index < 0)) throw new Error('[Playable embedded] Unsupported asset pipeline: preprocessPipe is missing');
  pipelines.forEach((pipeline, index) => pipeline.insert(prepare, positions[index] + 1));
}
