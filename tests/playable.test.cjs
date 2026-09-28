'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const JSZip = require('jszip');
const { packageBuild } = require('../src/package.cjs');
const { getChannel, readOptions } = require('../src/channel.cjs');
const SDK_URL = getChannel('tiktok').sdkURL;
function fixture(t) {
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
  assert.equal((await zip.file('config.json').async('string')), '{"Playable_orientation":0}');
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
  const window = { openAppStore() { calls++; } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../runtime/playable.js'), 'utf8'), { window, document });
  window.playable.finish(); window.playable.finish();
  assert.equal(calls, 0);
  window.playable.openStore(); assert.equal(calls, 1);
  delete window.openAppStore;
  assert.throws(() => window.playable.openStore(), /SDK is unavailable/);
});
test('unsupported channels and invalid orientations fail explicitly', () => {
  assert.throws(() => readOptions({ packages: { playable: { channel: 'applovin' } } }), /Unsupported/);
  assert.throws(() => readOptions({ packages: { playable: { orientation: 'bad' } } }), /orientation/);
});

test('rejects oversized compressed archives', async t => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, 'assets'));
  fs.writeFileSync(path.join(root, 'assets/random.bin'), require('node:crypto').randomBytes(5000100));
  await assert.rejects(packageBuild(root), /must be smaller/);
  assert.equal(fs.existsSync(path.join(root + '-delivery', 'tiktok.zip')), false);
});
test('runtime starts muted, reacts to visibility, and supports unsubscribe', () => {
  const events = {};
  const document = { hidden: false, addEventListener(name, fn) { events[name] = fn; } };
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../runtime/playable.js'), 'utf8'), { window, document });
  const states = [];
  const off = window.playable.onMuteChange(value => states.push(value));
  assert.deepEqual(states, [true]);
  events.pointerdown();
  document.hidden = true; events.visibilitychange();
  off(); document.hidden = false; events.visibilitychange();
  assert.deepEqual(states, [true, false, true]);
});

test('build hook accepts CLI source-map defaults and normalizes before compilation', () => {
  const hooks = require('../src/hooks.cjs');
  for (const sourceMaps of [undefined, true, 'inline', false, 'true', 'false']) {
    const options = { sourceMaps, debug: true, packages: { playable: { channel: 'tiktok' } } };
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
