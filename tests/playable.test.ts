import { test, type TestContext } from 'node:test';
import * as hooks from '../src/adapters/cli/hooks';
import type { BuildOptions } from '../src/adapters/cli/builder-types';
type TestWindow = { playable?: PlayableAPI; playableSDK?: {isReady(): boolean; isViewable(): boolean; sendEvent(): void; addEventListener(): void}; openAppStore?: () => void };
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { randomBytes } from 'node:crypto';
import JSZip from 'jszip';
import { packageBuild } from '../src/package';
import { getChannel } from '../src/channel';
import { readOptions } from '../src/adapters/cli/options';
const SDK_URL = getChannel('tiktok').sdkURL;
function fixture(t: TestContext) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'playable-test-'));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const root = path.join(parent, 'build'); fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, 'index.html'), '<script src="' + SDK_URL + '"></script><script src="./playable-runtime.js"></script>');
  fs.writeFileSync(path.join(root, 'playable-runtime.js'), '');
  fs.writeFileSync(path.join(root, 'config.json'), '{"Playable_orientation":0}');
  return root;
}
test('ZIP has root entries, excludes unrelated files, and carries a verification report', async t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'secret.txt'), 'excluded');
  const report = await packageBuild(root);
  const zip = await JSZip.loadAsync(fs.readFileSync(report.archive));
  assert.deepEqual(Object.keys(zip.files).sort(), ['config.json', 'index.html', 'playable-runtime.js']);
  assert.equal(report.status, 'packaged');
  assert.equal(report.verification, 'local-static-only');
  assert.equal((await zip.file('config.json')!.async('string')), '{"Playable_orientation":0}');
});
test('rejects external assets and invalidates the prior ZIP', async t => {
  const root = fixture(t); const first = await packageBuild(root);
  fs.appendFileSync(path.join(root, 'index.html'), '<img src="https://example.com/a.png">');
  await assert.rejects(packageBuild(root), /External/);
  assert.equal(fs.existsSync(first.archive), false);
});
test('rejects missing references, orientation errors and unowned delivery directory', async t => {
  const root = fixture(t);
  fs.appendFileSync(path.join(root, 'index.html'), '<img src="./missing.png">');
  await assert.rejects(packageBuild(root), /Missing or escaping/);
  fs.writeFileSync(path.join(root, 'config.json'), '{"Playable_orientation":5}');
  await assert.rejects(packageBuild(root), /orientation/);
  fs.unlinkSync(path.join(root + '-delivery', '.playable-owner.json'));
  await assert.rejects(packageBuild(root), /not owned/);
});
test('rejects remote settings and MRAID', async t => {
  const root = fixture(t); fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src/settings.json'), '{"assets":{"remoteBundles":["main"]}}');
  await assert.rejects(packageBuild(root), /External asset/);
  fs.writeFileSync(path.join(root, 'src/settings.json'), '{}');
  fs.writeFileSync(path.join(root, 'src/bad.js'), 'mraid.open("x")');
  await assert.rejects(packageBuild(root), /MRAID/);
});
test('runtime delegates explicit store clicks and never redirects on finish', () => {
  let calls = 0;
  const document = { hidden: false, addEventListener() {} };
  const window: TestWindow = { playableSDK: { isReady: () => true, isViewable: () => true, sendEvent() {}, addEventListener() {} }, openAppStore() { calls++; } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/playable-runtime.js'), 'utf8'), { window, document });
  window.playable!.finish(); window.playable!.finish();
  assert.equal(calls, 0);
  window.playable!.openStore(); assert.equal(calls, 1);
  delete window.openAppStore;
  assert.throws(() => window.playable!.openStore(), /SDK is unavailable/);
});
test('unsupported channels and invalid orientations fail explicitly', () => {
  assert.throws(() => readOptions({ packages: { playable: { channel: 'applovin' } } }), /Unsupported/);
  assert.throws(() => readOptions({ packages: { playable: { orientation: 'bad' } } }), /orientation/);
});

test('retains oversized archives and reports a non-blocking size error', async t => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, 'assets'));
  fs.writeFileSync(path.join(root, 'assets/random.bin'), randomBytes(5000100));
  const logged = t.mock.method(console, 'error', () => {});
  const report = await packageBuild(root);
  assert.equal(report.status, 'packaged');
  assert.equal(report.sizeLimitExceeded, true);
  assert.match(report.sizeLimitError!, /must be smaller/);
  assert.equal(logged.mock.callCount(), 1);
  assert.ok(fs.existsSync(report.archive));
  assert.equal(fs.statSync(report.archive).size, report.bytes);
  assert.equal(JSON.parse(fs.readFileSync(root + '-delivery/report.json', 'utf8')).sizeLimitExceeded, true);
});
test('runtime starts muted, reacts to visibility, and supports unsubscribe', async () => {
  const events: Record<string, () => void> = {};
  const document = { hidden: false, addEventListener(name: string, fn: () => void) { events[name] = fn; } };
  const window: TestWindow = { playableSDK: { isReady: () => true, isViewable: () => true, sendEvent() {}, addEventListener() {} } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/playable-runtime.js'), 'utf8'), { window, document });
  await Promise.resolve();
  const states: boolean[] = [];
  const off = window.playable!.onMuteChange(value => states.push(value));
  assert.deepEqual(states, [true]);
  events.pointerdown();
  document.hidden = true; events.visibilitychange();
  off(); document.hidden = false; events.visibilitychange();
  assert.deepEqual(states, [true, false, true]);
});

test('build hook accepts CLI source-map defaults and normalizes before compilation', () => {

  for (const sourceMaps of [undefined, true, 'inline', false, 'true', 'false']) {
    const options: BuildOptions = { sourceMaps, debug: true, packages: { playable: { channel: 'tiktok' } } };
    hooks.onBeforeInit(options);
    assert.equal(options.sourceMaps, false);
    assert.equal(options.debug, true);
  }
  assert.throws(() => hooks.onBeforeInit({ server: 'https://example.com' }), /external asset server/);
});


test('channel validation rejects missing SDK and incorrect SDK ordering', async t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'index.html'), '<script src="./playable-runtime.js"></script>');
  await assert.rejects(packageBuild(root, 'tiktok'), /Missing official TikTok SDK/);
  fs.appendFileSync(path.join(root, 'index.html'), '<script src="' + SDK_URL + '"></script>');
  await assert.rejects(packageBuild(root, 'tiktok'), /SDK must load before runtime/);
});

test('unsupported channel cannot invalidate an existing delivery', async t => {
  const root = fixture(t);
  const report = await packageBuild(root, 'tiktok');
  const before = fs.readFileSync(report.archive);
  await assert.rejects(packageBuild(root, 'applovin'), /Unsupported playable channel/);
  assert.deepEqual(fs.readFileSync(report.archive), before);
});

test('packages encoded plugin paths, versioned local bundles and font bytes intact', async t => {
  const root = fixture(t);
  const files: Record<string, string | Buffer> = {
    'src/settings.json': JSON.stringify({ plugins: { jsList: ['plugins/hello%20world.js'] }, assets: {
      projectBundles: ['main'], bundleVers: { main: 'abc' }, preloadBundles: [{ bundle: 'main' }],
    } }),
    'src/plugins/hello world.js': 'globalThis.pluginLoaded = true;',
    'assets/main/config.abc.json': '{}',
    'assets/main/index.abc.js': 'globalThis.bundleLoaded = true;',
    'assets/main/native/font.ttf': Buffer.from([0, 1, 0, 0, 255, 128]),
    'style.css': '@font-face {font-family:test;src:url("assets/main/native/font.ttf");}',
  };
  for (const [name, data] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), data);
  }
  const report = await packageBuild(root);
  const zip = await JSZip.loadAsync(fs.readFileSync(report.archive));
  for (const [name, data] of Object.entries(files)) {
    assert.deepEqual(await zip.file(name)!.async('nodebuffer'), Buffer.from(data));
  }
  fs.unlinkSync(path.join(root, 'src/plugins/hello world.js'));
  await assert.rejects(packageBuild(root), /plugins.jsList.*hello%20world/);
  assert.equal(fs.existsSync(report.archive), false);
  fs.writeFileSync(path.join(root, 'src/plugins/hello world.js'), '');
  fs.unlinkSync(path.join(root, 'assets/main/index.abc.js'));
  await assert.rejects(packageBuild(root), /bundle main.*index.abc.js/);
  fs.writeFileSync(path.join(root, 'assets/main/index.abc.js'), '');
  fs.unlinkSync(path.join(root, 'assets/main/native/font.ttf'));
  await assert.rejects(packageBuild(root), /Missing or escaping.*font.ttf/);
});

test('rejects plugin paths escaping the package and honors preload bundle version', async t => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, 'src'));
  const settingsPath = path.join(root, 'src/settings.json');
  for (const script of ['../../outside.js', 'https://example.com/a.js', 'data:text/javascript,0']) {
    fs.writeFileSync(settingsPath, JSON.stringify({ plugins: { jsList: [script] } }));
    await assert.rejects(packageBuild(root), /reference/);
  }
  fs.writeFileSync(settingsPath, JSON.stringify({ assets: {
    bundleVers: { main: 'old' }, preloadBundles: [{ bundle: 'main', version: 'new' }],
  } }));
  fs.mkdirSync(path.join(root, 'assets/main'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets/main/config.new.json'), '{}');
  fs.writeFileSync(path.join(root, 'assets/main/index.new.js'), '');
  await packageBuild(root);
  fs.unlinkSync(path.join(root, 'assets/main/config.new.json'));
  await assert.rejects(packageBuild(root), /bundle main.*config.new.json/);
});
