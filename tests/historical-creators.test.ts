import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import JSZip from 'jszip';
import { generatePlugin } from '../scripts/release/generate';
import { selectProfile } from '../scripts/release/profile';
import { verifyFiles, readFiles } from '../scripts/release/files';
import { applicationAdapter } from '../src/adapters/application-3x/application';
import { normalizeOptions } from '../src/options';
import { installCreator2Assets } from '../src/adapters/creator-2x/embedded';
import { EmbeddedStore } from '../runtime/embedded/store';
import { installStartup as installCreator2Startup } from '../src/adapters/creator-2x/runtime';

test('historical 3.x startup adapter handles both known protocols and rejects unknown factory code', () => {
  const legacy = "function load(){let settings = 'src/settings.json'; return settings;}";
  assert.match(applicationAdapter.prepareApplication(legacy), /__legacyEmbeddedContext/);
  const modern = 'export class Application { init() {} start() {} }';
  assert.equal(applicationAdapter.prepareApplication(modern), modern);
  assert.throws(() => applicationAdapter.prepareApplication('custom startup'), /Unsupported Creator/);
  const old: Record<string, unknown> = {};
  applicationAdapter.prepareSettings(old, normalizeOptions({ orientation: 'landscape' }));
  assert.equal(old.orientation, 'landscape');
  const current: Record<string, unknown> = { assets: {} };
  applicationAdapter.prepareSettings(current, normalizeOptions({ orientation: 'portrait' }));
  assert.deepEqual(current.screen, { orientation: 'portrait' });
});

test('Creator 2.3 resource bridge retains UUID pack routing and sends other bytes through original parsers', async t => {
  const zip = new JSZip(); zip.file('res/data.json', '{"answer":42}');
  const store = new EmbeddedStore(zip);
  const originalURL = URL.createObjectURL;
  let bytes: Blob | undefined;
  URL.createObjectURL = value => { bytes = value as Blob; return 'blob:payload'; };
  t.after(() => { URL.createObjectURL = originalURL; });
  const uuid = () => 'pack';
  let installed: Record<string, Function> = {};
  installCreator2Assets({ loader: {
    downloader: { extMap: { uuid, json(item, done) { assert.equal(item.url, 'blob:payload'); done(null, 'downloaded'); } } },
    addDownloadHandlers(handlers) { installed = handlers; },
  } }, store);
  assert.equal(installed.uuid, undefined);
  assert.equal(await new Promise(resolve => installed.json({ url: 'res/data.json', type: 'json' }, (error: Error, data: unknown) => resolve(error || data))), 'downloaded');
  assert.equal(await bytes!.text(), '{"answer":42}');
});

test('Creator 2 builds ZIP and single HTML from its own Web bootstrap with channel SDK isolation', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playable-2x-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const plugin = path.join(root, 'plugin');
  await generatePlugin(plugin, 'creator', '2.4.15');
  const release = verifyFiles(readFiles(plugin));
  assert.equal(release.editorIntegration, 'simple-build-target');
  const manifest = JSON.parse(fs.readFileSync(path.join(plugin, 'package.json'), 'utf8'));
  assert.equal(manifest['simple-build-target'], './dist/config.cjs');
  assert.equal(manifest.contributions, undefined);
  assert.ok(manifest.engines.creator.split(' || ').includes('2.4.0'));
  const config = require(path.join(plugin, 'dist/config.cjs'));
  assert.equal(config.extends, 'web-mobile');
  const build = path.join(root, 'web'); fs.mkdirSync(path.join(build, 'src'), { recursive: true });
  fs.writeFileSync(path.join(build, 'src/settings.js'), 'window._CCSettings={"jsList":[]};');
  fs.writeFileSync(path.join(build, 'cocos2d-js-min.js'), 'window.cc={};');
  fs.writeFileSync(path.join(build, 'main.js'), 'window.boot=function(){};');
  const target = globalThis as typeof globalThis & { Editor?: unknown };
  const previous = target.Editor; t.after(() => { target.Editor = previous; });
  target.Editor = { Profile: { load: () => ({ getSelfData: () => ({ channels: {
    tiktok: { enabled: true },
    applovin: { enabled: true, storeUrl: 'https://example.com/store' },
  } }) }) } };
  const hooks = require(path.join(plugin, 'dist/hooks.cjs'));
  const reports = await hooks.deliverCreator2({ dest: build });
  assert.equal(reports.length, 2);
  const archive = await JSZip.loadAsync(fs.readFileSync(path.join(build, 'playable-tiktok/tiktok.zip')), { checkCRC32: true });
  assert.ok(archive.file('cocos2d-js-min.js'));
  assert.match(await archive.file('index.js')!.async('string'), /__startCreator2/);
  assert.ok(!(await archive.file('index.html')!.async('string')).includes('mraid.js'));
  const html = fs.readFileSync(path.join(build, 'playable-applovin/applovin.html'), 'utf8');
  assert.match(html, /src="mraid.js"/);
  assert.match(html, /&quot;kind&quot;|"kind":"creator2"/);
  assert.ok(!html.includes('sf16-muse-va'));
  assert.equal(fs.readFileSync(path.join(build, 'main.js'), 'utf8'), 'window.boot=function(){};');
});

test('all supported historical versions map to concrete host, startup and artifact adapters', () => {
  for (const version of ['2.3.2', '2.3.4', '2.4.0', '2.4.15', '3.0.0', '3.5.1', '3.6.0', '3.6.3', '3.7.4', '3.8.0', '3.8.2']) {
    const profile = selectProfile('creator', version);
    assert.ok(profile.artifactDirectory?.startsWith('playable_'));
    assert.ok(profile.editor?.split(' || ').includes(version));
  }
  assert.throws(() => selectProfile('creator', '2.3.1'), /not adapted/);
  assert.throws(() => selectProfile('creator', '3.9.0'), /not adapted/);
});


test('Creator 2.4 private preprocess field bridges both load and preload without modifying the host field', () => {
  const preprocess = () => {};
  const inserted: number[] = [];
  const pipeline = () => ({ pipes: [preprocess], insert(_pipe: unknown, index: number) { inserted.push(index); } });
  const manager = {
    pipeline: pipeline(), fetchPipeline: pipeline(), _preprocessPipe: preprocess,
    downloader: { bundleVers: {}, register(_handlers: unknown) {} },
  };
  installCreator2Assets({ assetManager: manager }, new EmbeddedStore(new JSZip()));
  assert.deepEqual(inserted, [1, 1]);
  assert.equal('preprocessPipe' in manager, false);
});


test('Creator 2 startup loads plugins before boot and coordinates visibility without retaining run overrides', async t => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else Reflect.deleteProperty(globalThis, 'document');
  });
  const scripts: string[] = [], errors: unknown[] = [];
  let paused = false, viewable = true;
  let onPause = () => {}, onResume = () => {};
  const run = (_options: unknown, callback: () => void) => { callback(); };
  const game = { run, on() {}, pause() { paused = true; }, resume() { paused = false; }, isPaused: () => paused };
  const windowMock: Record<string, any> = {};
  const documentMock = {
    createElement() { return { src: '', remove() {}, onload() {} }; },
    head: { appendChild(script: { src: string; onload(): void }) {
      scripts.push(script.src);
      if (script.src === './src/settings.js') windowMock._CCSettings = { jsList: ['plugin.js'] };
      if (script.src === './cocos2d-js-min.js') windowMock.cc = { game, Game: { EVENT_SHOW: 'show' } };
      if (script.src === './main.js') windowMock.boot = () => game.run({}, () => {});
      script.onload();
    } },
  };
  Object.defineProperty(globalThis, 'window', { value: windowMock, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: documentMock, configurable: true });
  const api = {
    get viewable() { return viewable; },
    onReady(callback: () => void) { callback(); return () => {}; },
    onPause(callback: () => void) { onPause = callback; return () => {}; },
    onResume(callback: () => void) { onResume = callback; return () => {}; },
  } as PlayableAPI;
  installCreator2Startup({ api, document: documentMock as unknown as Document, failure: new Promise<never>(() => {}), reportError: error => errors.push(error) });
  await windowMock.__startCreator2({ scripts: ['src/settings.js', 'cocos2d-js-min.js', 'main.js'], engine: 'cocos2d-js-min.js', main: 'main.js' });
  assert.deepEqual(errors, []);
  assert.deepEqual(scripts, ['./src/settings.js', './cocos2d-js-min.js', './src/plugin.js', './main.js']);
  assert.deepEqual(windowMock._CCSettings.jsList, []);
  assert.equal(game.run, run);
  viewable = false; onPause(); assert.equal(paused, true);
  viewable = true; onResume(); assert.equal(paused, false);
});
