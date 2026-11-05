import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { applicationAdapter as creator35Delivery } from '../src/adapters/creator-300_352/application';
import { normalizeOptions } from '../src/options';
import { generatePlugin } from '../scripts/release/generate';
import { selectProfile } from '../scripts/release/profile';
import { onAfterInit, onBeforeInit } from '../src/adapters/creator-300_352/hooks';
import { configs as legacyConfig } from '../src/adapters/creator-300_352/config';
import { configs as currentConfig } from '../src/adapters/creator-platform/config';

test('3.5 settings bypass applies only to embedded delivery, preserves host fallback', async () => {
  const source = "function load(){var settings = 'src/settings.json'; return settings;}";
  const modified = creator35Delivery.prepareApplication(source);
  const context = vm.createContext({ window: {} });
  vm.runInContext(modified, context);
  assert.equal(vm.runInContext('load()', context), 'src/settings.json');
  const settings = { orientation: 'portrait', jsList: ['plugin.js'] };
  context.window.__legacyEmbeddedContext = { settings };
  await vm.runInContext('load()', context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window._CCSettings)), settings);
  assert.notEqual(context.window._CCSettings, settings);
  assert.throws(() => creator35Delivery.prepareApplication('unknown template'), /Unsupported Creator/);
  assert.throws(() => creator35Delivery.prepareApplication(source + source), /Unsupported Creator/);
  const config: Record<string, unknown> = { debug: true, remoteBundles: [] };
  creator35Delivery.prepareSettings(config, normalizeOptions({ orientation: 'landscape' }));
  assert.equal(config.orientation, 'landscape');
  assert.equal(config.debug, false);
  assert.throws(() => creator35Delivery.prepareSettings({ remoteBundles: ['remote'] }, normalizeOptions({})), /Remote bundles/);
});

test('3.5 host Web hook supplies initialization before playable presets', async t => {
  const root = globalThis as typeof globalThis & { Editor?: unknown };
  const previous = root.Editor;
  t.after(() => { root.Editor = previous; });
  let calls = 0;
  root.Editor = { App: { path: '/host' }, Module: { requireFile: () => ({ onAfterInit(options: Parameters<typeof onAfterInit>[0]) {
    calls++;
    assert.equal(options.packages['web-mobile']?.orientation, 'auto');
    options.buildEngineParam.platform = 'host';
  } }) } };
  const options = { platform: 'playable', packages: {}, appTemplateData: { showFPS: true }, buildEngineParam: {}, buildScriptParam: {} };
  await onAfterInit(options, { paths: {} } as Parameters<typeof onAfterInit>[1], {});
  assert.equal(calls, 1);
  assert.equal(options.platform, 'playable');
  assert.deepEqual(options.buildEngineParam, { platform: 'HTML5', ammoJsWasm: false, split: false, assetURLFormat: 'runtime-resolved' });
});

test('3.5 release retains playable identity and ships the matching startup protocol', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playable-352-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.equal(selectProfile('creator', '3.5.2').adapter, 'creator-300_352');
  const plugin = path.join(root, 'plugin');
  await generatePlugin(plugin, 'creator', '3.5.2');
  const manifest = JSON.parse(fs.readFileSync(path.join(plugin, 'package.json'), 'utf8'));
  assert.equal(manifest.name, 'playable');
  assert.ok(manifest.editor.split(' || ').includes('3.5.2'));
  assert.deepEqual(manifest.engines, { creator: manifest.editor });
  assert.equal(manifest.package_version, 2);
  const config = require(path.join(plugin, 'dist/config.cjs'));
  assert.deepEqual(Object.keys(config.configs), ['playable']);
  const runtime = fs.readFileSync(path.join(plugin, 'dist/playable-runtime.js'), 'utf8');
  assert.ok(runtime.includes('__startLegacyPlayable'));
  assert.ok(!runtime.includes('onPostProjectInitDelegate'));
  const embedded = fs.readFileSync(path.join(plugin, 'dist/single-html-runtime.js'), 'utf8');
  assert.ok(embedded.includes('__legacyEmbeddedContext'));
  assert.ok(!embedded.includes('settingsPath is missing'));
});

test('generated legacy Web hooks rebuild the loader only on hosts with module-system', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playable-systemjs-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const globals = globalThis as unknown as { Editor?: unknown; Build?: unknown };
  const previous = { Editor: globals.Editor, Build: globals.Build };
  t.after(() => { Object.assign(globals, previous); });
  globals.Build = { Utils: { transformCode() { throw new Error('Reached channel delivery'); } } };

  for (const [version, rebuild] of [['3.5.2', false], ['3.6.3', false], ['3.7.0', true], ['3.8.2', true]] as const) {
    const host = path.join(root, version);
    const plugin = path.join(host, 'playable');
    const systemJs = path.join(host, 'system.bundle.js');
    const output = path.join(host, 'build');
    fs.mkdirSync(output, { recursive: true });
    if (rebuild) {
      const moduleSystem = path.join(host, 'node_modules/@cocos/module-system');
      fs.mkdirSync(moduleSystem, { recursive: true });
      fs.writeFileSync(path.join(moduleSystem, 'index.js'), [
        'const fs = require("fs");',
        'exports.build = async ({ out, platform }) => {',
        '  if (fs.readFileSync(out, "utf8") !== "host web hook") throw Error("Host hook did not run first");',
        '  fs.writeFileSync(out, platform);',
        '};',
      ].join('\n'));
    }

    globals.Editor = { App: { path: host }, Module: { requireFile: () => ({
      onAfterBuild() { fs.writeFileSync(systemJs, 'host web hook'); },
    }) } };
    await generatePlugin(plugin, 'creator', version);
    const { onAfterBuild } = require(path.join(plugin, 'dist/hooks.cjs'));
    const result = { paths: { dir: output, systemJs, applicationJS: path.join(output, 'application.js') } };
    // Stop at the bootstrap compiler, after the loader stage has completed.
    await assert.rejects(onAfterBuild({ platform: 'playable', packages: {} }, result, {}), /Reached channel delivery/);
    assert.equal(fs.readFileSync(systemJs, 'utf8'), rebuild ? 'web-mobile' : 'host web hook');
  }
});

test('platform families follow OpenPaaS boundaries without enabling unadapted versions', () => {
  const compatibility = JSON.parse(fs.readFileSync(path.join(__dirname, '../compatibility.json'), 'utf8'));
  assert.deepEqual(compatibility.creatorPlatformGroups.map((group: { name: string }) => group.name),
    ['232_234', '240_2415', '300_352', '360_363', '370_374', '380_382', '383_384', '385_386', '387', '388', '389']);
  for (const version of ['3.0.0', '3.5.1', '3.6.0', '3.7.4', '3.8.0', '3.8.2']) {
    assert.ok(selectProfile('creator', version).editor?.split(' || ').includes(version));
  }
  assert.equal(selectProfile('creator', '3.5.2').adapter, 'creator-300_352');
  assert.equal(selectProfile('creator', '3.6.3').adapter, 'creator-360_363');
  assert.equal(selectProfile('creator', '3.7.0').adapter, 'creator-370_382');
  assert.equal(selectProfile('creator', '3.8.2').adapter, 'creator-370_382');
  assert.equal(selectProfile('creator', '3.8.3').id,
    selectProfile('creator', '3.8.4').id);

  // Profiles may be shared, but verification records belong to each version range.
  const compare = new Intl.Collator('en', { numeric: true }).compare;
  const groups: Array<{ name: string; from: string; to: string; profile: string; verifiedVersions: string[] }> =
    compatibility.creatorPlatformGroups;
  for (const group of groups) {
    for (const version of group.verifiedVersions) {
      assert.equal(compatibility.creatorVersions[version], group.profile, group.name + ': unknown or mismatched version ' + version);
      assert.ok(compare(version, group.from) >= 0, group.name + ': verified version below range ' + version);
      assert.ok(compare(version, group.to) <= 0, group.name + ': verified version above range ' + version);
    }
  }
});


test('standalone platforms hide unsupported controls and ignore stale hidden Profile values', () => {
  for (const key of ['debug', 'sourceMaps', 'md5Cache', 'server', 'mainBundleIsRemote'] as const) {
    assert.equal(legacyConfig.playable.commonOptions[key], false);
    assert.equal(currentConfig.playable.commonOptions[key].hidden, true);
  }
  const options = { platform: 'playable', debug: true, sourceMaps: true, md5Cache: true, server: 'https://old.invalid', mainBundleIsRemote: true };
  onBeforeInit(options);
  assert.deepEqual(options, { platform: 'playable', debug: false, sourceMaps: false, md5Cache: false, server: '', mainBundleIsRemote: false });
});
