import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sharp = require('sharp-creator2') as typeof import('sharp');
import path from 'node:path';
import os from 'node:os';
import JSZip from 'jszip';
import { readCreator2Settings } from '../src/adapters/creator-2x/settings';
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
  const bundled = JSON.parse(fs.readFileSync(path.join(plugin, 'node_modules/sharp-creator2/package.json'), 'utf8'));
  assert.deepEqual(bundled.binary.napi_versions, [3]);
  const build = path.join(root, 'web'); fs.mkdirSync(path.join(build, 'src'), { recursive: true });
  fs.writeFileSync(path.join(build, 'src/settings.js'), 'window._CCSettings={platform:"playable",hasResourcesBundle:false,jsList:[]};');
  fs.writeFileSync(path.join(build, 'cocos2d-js-min.js'), 'window.cc={};');
  fs.writeFileSync(path.join(build, 'main.js'), 'window.boot=function(){};');
  fs.mkdirSync(path.join(build, 'assets/native'), { recursive: true });
  const pixels = Buffer.alloc(64 * 64 * 4);
  let seed = 1234;
  for (let i = 0; i < pixels.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      pixels[i + channel] = seed >>> 24;
    }
    pixels[i + 3] = 200;
  }
  const texture = await sharp(pixels, { raw: { width: 64, height: 64, channels: 4 } }).png({ compressionLevel: 0 }).toBuffer();
  fs.writeFileSync(path.join(build, 'assets/native/texture.png'), texture);
  const target = globalThis as typeof globalThis & { Editor?: unknown };
  const previous = target.Editor; t.after(() => { target.Editor = previous; });
  target.Editor = { Profile: { load: () => ({ getSelfData: () => ({ channels: {
    tiktok: { enabled: true, imageCompression: 'webp', imageQuality: 80 },
    applovin: { enabled: true, imageCompression: 'webp', imageQuality: 80, storeUrl: 'https://example.com/store' },
  } }) }) } };
  // Windows locks loaded native binaries; reuse the test process backend so the temporary plugin can be removed.
  const bundledSharpPath = require.resolve(path.join(plugin, 'node_modules/sharp-creator2'));
  require.cache[bundledSharpPath] = require.cache[require.resolve('sharp-creator2')];
  t.after(() => { delete require.cache[bundledSharpPath]; });
  const hooks = require(path.join(plugin, 'dist/hooks.cjs'));
  const reports = await hooks.deliverCreator2({ dest: build });
  assert.equal(reports.length, 2);
  const archive = await JSZip.loadAsync(fs.readFileSync(path.join(build, 'playable-tiktok/tiktok.zip')), { checkCRC32: true });
  assert.ok(archive.file('cocos2d-js-min.js'));
  const packedImage = await archive.file('assets/native/texture.png')!.async('nodebuffer');
  assert.equal((await sharp(packedImage).metadata()).format, 'webp');
  assert.equal(reports[0].images.mode, 'webp');
  assert.match(await archive.file('index.js')!.async('string'), /__startCreator2/);
  assert.ok(!(await archive.file('index.html')!.async('string')).includes('mraid.js'));
  const html = fs.readFileSync(path.join(build, 'playable-applovin/applovin.html'), 'utf8');
  assert.match(html, /src="mraid.js"/);
  for (const page of [html, await archive.file('index.html')!.async('string')]) {
    assert.match(page, /id="splash"/);
    assert.match(page, /class="progress-bar">\s*<span/);
  }
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
  const game = { EVENT_SHOW: 'show', run, on(event: string) { assert.equal(event, 'show'); }, pause() { paused = true; }, resume() { paused = false; }, isPaused: () => paused };
  const windowMock: Record<string, any> = {};
  const documentMock = {
    createElement() { return { src: '', remove() {}, onload() {} }; },
    head: { appendChild(script: { src: string; onload(): void }) {
      scripts.push(script.src);
      if (script.src === './src/settings.js') windowMock._CCSettings = { jsList: ['plugin.js'] };
      if (script.src === './cocos2d-js-min.js') windowMock.cc = { game };
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


test('Creator 2 release settings are parsed as data without executing JavaScript', () => {
  assert.deepEqual(readCreator2Settings('window._CCSettings={platform:"playable",groupList:["default"],hasResourcesBundle:false,jsList:[]};'),
    {platform:'playable',groupList:['default'],hasResourcesBundle:false,jsList:[]});
  assert.deepEqual(readCreator2Settings('window._CCSettings={"jsList":[]};'),{jsList:[]});
  assert.throws(()=>readCreator2Settings('window._CCSettings=[];'),/data object/);
  assert.throws(()=>readCreator2Settings('window._CCSettings={x:(()=>{throw new Error("must not execute")})()};'));
  assert.throws(()=>readCreator2Settings('window._CCSettings={}; process.exit(1);'));
});

test('Creator 2 independently bundled HTML loader and channel runtime share the embedded store', async () => {
  const { buildSync } = await import('esbuild');
  const { runInNewContext } = await import('node:vm');
  const sandbox: any = { window: {}, console, Promise, URL, Blob, Uint8Array };
  for (const name of ['HtmlLoader', 'ChannelRuntime']) {
    const output = buildSync({ entryPoints: [path.resolve('src/adapters/creator-2x/runtime.ts')], bundle: true,
      platform: 'browser', format: 'iife', globalName: name, write: false });
    runInNewContext(output.outputFiles[0].text, sandbox);
  }
  const loaded: string[] = [], errors: unknown[] = [];
  let booted = false;
  const game = { EVENT_SHOW: 'game_on_show', on() {}, isPaused: () => false, pause() {}, resume() {},
    run(_options: unknown, callback: () => void) { callback(); } };
  const store = { async script(name: string) {
    loaded.push(name);
    if (name === 'engine.js') sandbox.window.cc = { game, loader: { downloader: { extMap: {} }, addDownloadHandlers() {} } };
    if (name === 'main.js') sandbox.window.boot = () => { booted = true; game.run({}, () => {}); };
  } };
  sandbox.ChannelRuntime.installStartup({ api: { viewable: true, onReady(fn: () => void) { fn(); }, onPause() {}, onResume() {} },
    failure: new Promise(() => {}), reportError: (error: unknown) => errors.push(error) });
  await sandbox.HtmlLoader.prepareEmbedded({ store });
  await sandbox.window.__startCreator2({ scripts: ['src/settings.js', 'engine.js', 'main.js'], engine: 'engine.js', main: 'main.js' });
  assert.deepEqual(errors, []);
  assert.deepEqual(loaded, ['src/settings.js', 'engine.js', 'main.js']);
  assert.equal(booted, true);
});
