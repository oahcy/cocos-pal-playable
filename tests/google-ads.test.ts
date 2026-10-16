import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import Ejs from 'ejs';
import JSZip from 'jszip';
import { getChannel, channelIds } from '../src/channel';
import { packageBuild } from '../src/package';
import { createGoogleAdsAdapter } from '../runtime/adapters/google-ads';
import { readOptions } from '../src/options';
import { randomBytes } from 'node:crypto';

const channel = getChannel('google-ads');
async function fixture(t: TestContext, orientation: 'auto' | 'portrait' | 'landscape' = 'auto') {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'google-playable-'));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const root = path.join(parent, 'web'); fs.mkdirSync(root);
  fs.mkdirSync(path.join(root, 'src'));
  for (const name of ['src/polyfills.js', 'src/system.js', 'index.js', 'style.css']) fs.writeFileSync(path.join(root, name), '');
  fs.writeFileSync(path.join(root, 'src/import-map.json'), '{}');
  fs.copyFileSync(path.join(__dirname, '../dist/google-ads-runtime.js'), path.join(root, 'playable-runtime.js'));
  const html = await Ejs.renderFile(path.join(__dirname, '../static/templates/index.ejs'), {
    title: 'Google test', sdkURL: channel.sdkURL, sdkPlacement: channel.sdkPlacement,
    headHTML: channel.headHTML!({ orientation }), polyfillsURL: './src/polyfills.js',
    systemURL: './src/system.js', importMapURL: './src/import-map.json',
  });
  fs.writeFileSync(path.join(root, 'index.html'), html);
  return root;
}

test('Google channel is selectable and ZIP preserves root paths for every orientation', async t => {
  assert.ok(channelIds.includes('google-ads'));
  assert.equal(readOptions({ packages: { playable: { channel: 'google-ads' } } }).channel, 'google-ads');
  for (const orientation of ['auto', 'portrait', 'landscape'] as const) {
    const root = await fixture(t, orientation);
    const report = await packageBuild(root, 'google-ads');
    assert.equal(path.basename(report.archive), 'google-ads.zip');
    assert.equal(report.channelDefaultFormat, true);
    const zip = await JSZip.loadAsync(fs.readFileSync(report.archive));
    const html = await zip.file('index.html')!.async('string');
    assert.match(html, new RegExp('content="' + (orientation === 'auto' ? 'portrait,landscape' : orientation) + '"'));
    assert.ok(html.indexOf(channel.sdkURL) < html.indexOf('</head>'));
    assert.equal(zip.file('config.json'), null);
  }
});

test('Google refuses malformed HTML, missing orientation and wrong SDK placement', async t => {
  const root = await fixture(t); const file = path.join(root, 'index.html'); const html = fs.readFileSync(file, 'utf8');
  for (const [broken, error] of [
    [html.replace('<!DOCTYPE html>', ''), /DOCTYPE/],
    [html.replace('<meta name="ad.orientation" content="portrait,landscape">', ''), /orientation/],
    [html.replace(channel.sdkURL, 'https://example.com/sdk.js'), /Exit API/],
    [html.replace('<script src="' + channel.sdkURL + '"></script>', '').replace('</head>', '</head><script src="' + channel.sdkURL + '"></script>'), /Exit API/],
  ] as const) {
    fs.writeFileSync(file, broken); await assert.rejects(packageBuild(root, 'google-ads'), error);
  }
});

test('Google rejects file count overflow and arbitrary external assets', async t => {
  const root = await fixture(t);
  fs.appendFileSync(path.join(root, 'index.html'), '<img src="https://example.com/image.png">');
  await assert.rejects(packageBuild(root, 'google-ads'), /External/);
  const valid = await fixture(t); fs.mkdirSync(path.join(valid, 'assets'));
  for (let i = 0; i < 512; i++) fs.writeFileSync(path.join(valid, 'assets', i + '.txt'), 'x');
  await assert.rejects(packageBuild(valid, 'google-ads'), /512 files/);
  assert.equal(fs.existsSync(path.join(valid + '-delivery', 'google-ads.zip')), false);
  await assert.rejects(packageBuild(valid, 'google-ads', { outputFormat: 'single-html' }), /does not support/);
});

test('Google adapter preserves receiver and exposes only supported SDK capabilities', () => {
  let calls = 0, ready = false;
  const ExitApi = { exit() { assert.equal(this, ExitApi); calls++; } };
  const adapter = createGoogleAdsAdapter({ ExitApi });
  adapter.init({ ready() { ready = true; }, mute() {}, viewable() {}, error() {} });
  assert.equal(ready, true); assert.equal(calls, 0);
  assert.deepEqual(adapter.capabilities, { openStore: true, finishNotification: false, containerLifecycle: false });
  adapter.openStore(); assert.equal(calls, 1);
  assert.throws(() => createGoogleAdsAdapter({}).init({} as never), /unavailable/);
});

test('Google runtime starts muted, uses page visibility and never exits on finish', () => {
  const events: Record<string, () => void> = {}; let exits = 0;
  const document = { hidden: false, addEventListener(name: string, fn: () => void) { events[name] = fn; } };
  const window: { ExitApi: { exit(): void }; playable?: PlayableAPI } = { ExitApi: { exit() { exits++; } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/google-ads-runtime.js'), 'utf8'), { window, document, ExitApi: window.ExitApi });
  const api = window.playable!; assert.equal(api.ready, true); assert.equal(api.channel, 'google-ads');
  const mute: boolean[] = []; api.onMuteChange(value => mute.push(value));
  events.pointerdown(); document.hidden = true; events.visibilitychange();
  assert.deepEqual(mute, [true, false, true]);
  api.finish(); api.finish(); assert.equal(exits, 0);
  api.openStore(); assert.equal(exits, 1);
});

test('Google rejects compressed size overflow and flags font provenance, allows Google Fonts', async t => {
  const root = await fixture(t); fs.mkdirSync(path.join(root, 'assets'));
  const asset = path.join(root, 'assets/data.bin');
  fs.writeFileSync(asset, randomBytes(5000100));
  await assert.rejects(packageBuild(root, 'google-ads'), /must be smaller/);
  fs.unlinkSync(asset);
  const font = path.join(root, 'assets/test.woff2'); fs.writeFileSync(font, 'font');
  const fontReport = await packageBuild(root, 'google-ads');
  assert.ok(fontReport.pending.some(item => item.includes('font provenance') && item.includes('test.woff2')));
  fs.unlinkSync(font);
  const html = path.join(root, 'index.html');
  fs.writeFileSync(html, fs.readFileSync(html, 'utf8').replace('</head>', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto"></head>'));
  assert.equal((await packageBuild(root, 'google-ads')).status, 'packaged');
});

test('compiled CLI hooks select Google runtime and generate a valid deliverable', async t => {
  const root = await fixture(t, 'landscape');
  const hooks = require('../dist/hooks.cjs');
  const options = { name: 'Google hook integration', packages: { playable: { channel: 'google-ads', orientation: 'landscape' } },
    md5CacheOptions: { includes: [], excludes: [], replaceOnly: [] } };
  const result = { paths: { dir: root, applicationJS: path.join(root, 'application.js'),
    polyfillsJs: path.join(root, 'src/polyfills.js'), systemJs: path.join(root, 'src/system.js'),
    importMap: path.join(root, 'src/import-map.json'), settings: path.join(root, 'src/settings.json') },
    settings: { plugins: { jsList: [] }, assets: {} } };
  fs.writeFileSync(result.paths.applicationJS, '');
  const context = { utils: { async transformCode(code: string) { return code; } }, buildExitRes: { custom: {} as Record<string, any> } };
  await hooks.onBeforeCopyBuildTemplate.call(context, options, result);
  assert.equal(fs.readFileSync(path.join(root, 'playable-runtime.js'), 'utf8'), fs.readFileSync(path.join(__dirname, '../dist/google-ads-runtime.js'), 'utf8'));
  await hooks.onAfterBuild.call(context, options, result);
  const report = context.buildExitRes.custom.playable;
  assert.equal(report.channel, 'google-ads'); assert.equal(report.status, 'packaged');
  const zip = await JSZip.loadAsync(fs.readFileSync(report.archive));
  assert.match(await zip.file('index.html')!.async('string'), /ad.orientation" content="landscape/);
});


test("shipped Google runtime retains the official ExitApi.exit() call", () => {
  const code = fs.readFileSync(path.join(__dirname, "../dist/google-ads-runtime.js"), "utf8");
  assert.match(code, /\bExitApi\.exit\(\)/);
});
