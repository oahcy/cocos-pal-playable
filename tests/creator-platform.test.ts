import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { generatePlugin } from '../scripts/release/generate';
import { configs } from '../src/adapters/creator-platform/config';
import * as hooks from '../src/adapters/creator-platform/hooks';
import JSZip from 'jszip';
import ts from 'typescript';
import { getChannel } from '../src/channel';
import { readChannelSelections, selectedChannels } from '../src/adapters/creator-shared/selection';

test('independent platform sets browser compilation without changing its platform identity', () => {
  assert.deepEqual(Object.keys(configs), ['playable']);
  assert.equal(configs.playable.platformType, 'HTML5');
  assert.equal('enabled' in configs.playable.options, false);
  const options = {
    platform: 'playable', sourceMaps: true, packages: { playable: { orientation: 'portrait' } },
    appTemplateData: { showFPS: true }, buildEngineParam: {},
    buildScriptParam: { flags: {} }, includeModules: ['gfx-webgl', 'gfx-webgpu'],
  };
  hooks.onBeforeInit(options);
  assert.equal(options.sourceMaps, false);
  const result = { staticsInfo: { orientation: 'landscape' }, settings: { screen: { orientation: 'auto' }, assets: {} }, paths: {} } as Parameters<typeof hooks.onAfterInit>[1];
  hooks.onAfterInit(options, result);
  hooks.onAfterBundleInit(options);
  hooks.onBeforeCompressSettings(options, result);
  assert.equal(options.platform, 'playable');
  assert.equal(options.appTemplateData.showFPS, false);
  assert.deepEqual(options.buildEngineParam, { platform: 'HTML5', split: false, assetURLFormat: 'runtime-resolved' });
  assert.deepEqual(options.buildScriptParam, { platform: 'HTML5', flags: { WEBGPU: false }, system: { preset: 'web' } });
  assert.deepEqual(options.includeModules, ['gfx-webgl']);
  assert.equal(result.settings.screen.orientation, 'auto');
  assert.equal(result.staticsInfo?.orientation, 'landscape');
  result.settings.assets.remoteBundles = ['remote'];
  assert.throws(() => hooks.onBeforeCompressSettings(options, result), /Remote bundles/);
  assert.throws(() => hooks.onBeforeInit({ platform: 'web-mobile' }), /platform=playable/);
  const saved = { platform: 'playable', debug: true, sourceMaps: true, md5Cache: true, server: 'https://old.invalid', mainBundleIsRemote: true };
  hooks.onBeforeInit(saved);
  assert.deepEqual(saved, { platform: 'playable', debug: false, sourceMaps: false, md5Cache: false, server: '', mainBundleIsRemote: false });
});

test('generated Creator platform is self-contained and resolves browser loader from its host', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playable-platform-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const plugin = path.join(root, 'plugin');
  await generatePlugin(plugin, 'creator', '3.8.9');
  const config = require(path.join(plugin, 'dist/config.cjs'));
  const manifest = JSON.parse(fs.readFileSync(path.join(plugin, 'package.json'), 'utf8'));
  assert.equal(manifest.editor, '3.8.5 || 3.8.6 || 3.8.7 || 3.8.8 || 3.8.9');
  assert.deepEqual(Object.keys(config.configs), ['playable']);
  assert.equal(config.configs.playable.panel, './panel.cjs');
  assert.equal(typeof require(path.join(plugin, 'dist/panel.cjs')).ready, 'function');
  const host = path.join(root, 'host');
  const moduleDir = path.join(host, 'node_modules/@cocos/module-system');
  fs.mkdirSync(moduleDir, { recursive: true });
  // Simulate the host API, proving this path uses the browser preset and actual build output.
  fs.writeFileSync(path.join(moduleDir, 'index.js'), 'exports.build = async options => { require("fs").writeFileSync(options.out, JSON.stringify(options)); };');
  const globals = globalThis as unknown as { Editor?: unknown };
  const previous = globals.Editor;
  globals.Editor = { App: { path: host } };
  t.after(() => { if (previous === undefined) delete globals.Editor; else globals.Editor = previous; });
  const systemJs = path.join(root, 'system.js');
  const generated = require(path.join(plugin, 'dist/hooks.cjs')) as typeof hooks;
  await generated.onBeforeCopyBuildTemplate({ platform: 'playable', debug: false } as Parameters<typeof hooks.onBeforeCopyBuildTemplate>[0],
    { paths: { systemJs } } as Parameters<typeof hooks.onBeforeCopyBuildTemplate>[1]);
  assert.deepEqual(JSON.parse(fs.readFileSync(systemJs, 'utf8')), { out: systemJs, sourceMap: false, minify: true, platform: 'web-mobile', hmr: false });
});

test('channel selection preserves old tasks, rejects empty selection and validates enabled channels only', () => {
  assert.equal(selectedChannels({ channel: 'google-ads', imageQuality: 65 })[0].imageQuality, 65);
  assert.throws(() => selectedChannels({ channels: {} }), /at least one/);
  assert.throws(() => selectedChannels({ channels: { tiktok: { enabled: false } } }), /at least one/);
  assert.throws(() => selectedChannels({ channels: { unknown: { enabled: true } } }), /Unsupported playable channel/);
  assert.throws(() => selectedChannels({ channels: { 'google-ads': { enabled: true, outputFormat: 'single-html' } } }), /does not support/);
  const selected = selectedChannels({ channels: {
    tiktok: { enabled: true, outputFormat: 'single-html', imageQuality: 60 },
    'google-ads': { enabled: false, outputFormat: 'single-html', imageQuality: -1 },
  } });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].channel, 'tiktok');
  assert.equal(selected[0].imageQuality, 60);
  assert.throws(() => hooks.onBeforeInit({ platform: 'playable', packages: { playable: { channels: {} } } }), /at least one/);
});

test('one Creator build produces isolated channel packages without changing shared Web files', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playable-multi-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src'));
  const sources = {
    'application.js': 'System.register([],function(){return {execute:function(){}}});',
    'src/system.js': '', 'src/import-map.json': '{"imports":{}}',
    'src/settings.json': '{"assets":{},"screen":{"orientation":"auto"},"profiling":{"showFPS":true}}',
    'index.html': '<html>Original shared build</html>',
  };
  for (const [name, data] of Object.entries(sources)) fs.writeFileSync(path.join(root, name), data);
  const globals = globalThis as unknown as { Build?: unknown };
  const previous = globals.Build;
  let failCompile = false;
  globals.Build = { Utils: { async transformCode(source: string) {
    if (failCompile) throw new Error('Fixture bootstrap compilation failed');
    return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.System } }).outputText;
  } } };
  t.after(() => { if (previous === undefined) delete globals.Build; else globals.Build = previous; });
  const result = { paths: {
    dir: root, applicationJS: path.join(root, 'application.js'), systemJs: path.join(root, 'src/system.js'),
    importMap: path.join(root, 'src/import-map.json'), settings: path.join(root, 'src/settings.json'),
  } };
  const options = { platform: 'playable', packages: { playable: { channels: {
    tiktok: { enabled: true, orientation: 'portrait' },
    'google-ads': { enabled: true, orientation: 'landscape' },
  } } } };
  const reports = await hooks.onAfterBuild(options, result);
  assert.equal(reports.length, 2);
  for (const report of reports) {
    assert.equal(path.dirname(report.archive), path.join(root, 'playable-' + report.channel));
    const zip = await JSZip.loadAsync(fs.readFileSync(report.archive), { checkCRC32: true });
    const html = await zip.file('index.html')!.async('string');
    assert.ok(html.includes(getChannel(report.channel).sdkURL));
    const other = report.channel === 'tiktok' ? 'google-ads' : 'tiktok';
    assert.ok(!html.includes(getChannel(other).sdkURL));
    const settings = JSON.parse(await zip.file('src/settings.json')!.async('string'));
    assert.equal(settings.screen.orientation, report.channel === 'tiktok' ? 'portrait' : 'landscape');
    assert.equal(settings.profiling.showFPS, false);
    assert.equal(!!zip.file('config.json'), report.channel === 'tiktok');
    assert.ok(!Object.keys(zip.files).some(name => name.startsWith('playable-tiktok/') || name.startsWith('playable-google-ads/')));
  }
  for (const [name, data] of Object.entries(sources)) assert.equal(fs.readFileSync(path.join(root, name), 'utf8'), data);
  const googleBytes = fs.readFileSync(reports[1].archive);
  options.packages.playable.channels['google-ads'].enabled = false;
  const repeated = await hooks.onAfterBuild(options, result);
  assert.equal(repeated.length, 1);
  assert.deepEqual(fs.readFileSync(reports[1].archive), googleBytes);

  // Preparation failures must invalidate the selected channel just like encoding failures.
  failCompile = true;
  await assert.rejects(hooks.onAfterBuild(options, result), /bootstrap compilation failed/);
  assert.equal(fs.existsSync(reports[0].archive), false);
  const failed = JSON.parse(fs.readFileSync(path.join(root, 'playable-tiktok/report.json'), 'utf8'));
  assert.equal(failed.status, 'failed');
  assert.match(failed.error, /bootstrap compilation failed/);
  assert.deepEqual(fs.readFileSync(reports[1].archive), googleBytes);
  failCompile = false;

  // File-count overflow is reported without blocking either selected channel.
  fs.mkdirSync(path.join(root, 'assets'));
  for (let i = 0; i < 513; i++) fs.writeFileSync(path.join(root, 'assets', i + '.txt'), 'x');
  const oversized = await hooks.onAfterBuild({ platform: 'playable', packages: { playable: { channels: {
    'google-ads': { enabled: true }, tiktok: { enabled: true },
  } } } }, result);
  assert.equal(oversized.length, 2);
  assert.equal(oversized[0].fileCountLimitExceeded, true);
  assert.equal(oversized[1].fileCountLimitExceeded, undefined);
  const finalReport = JSON.parse(fs.readFileSync(path.join(root, 'playable-tiktok/report.json'), 'utf8'));
  assert.equal(finalReport.status, 'packaged');
  assert.equal(fs.existsSync(reports[1].archive), true);
});

test('shared orientation does not depend on channel order', () => {
  const channels = {
    tiktok: { enabled: true, orientation: 'portrait' },
    'google-ads': { enabled: true, orientation: 'landscape' },
  };
  for (const entries of [Object.entries(channels), Object.entries(channels).reverse()]) {
    const options = {
      platform: 'playable', packages: { playable: { channels: Object.fromEntries(entries) } },
      appTemplateData: { showFPS: true }, buildEngineParam: {},
      buildScriptParam: { flags: {} }, includeModules: [],
    };
    const result = {
      staticsInfo: { orientation: 'auto' }, settings: { screen: { orientation: 'auto' }, assets: {} }, paths: {},
    } as Parameters<typeof hooks.onAfterInit>[1];
    hooks.onBeforeInit(options);
    hooks.onAfterInit(options, result);
    hooks.onBeforeCompressSettings(options, result);
    assert.equal(result.staticsInfo?.orientation, 'auto');
    assert.equal(result.settings.screen.orientation, 'auto');
  }
});

test('invalid legacy values remain editable while build validation stays strict', () => {
  const legacy = { channel: 'tiktok', imageCompression: 'lossy' as const, imageQuality: 0 };
  const editable = readChannelSelections(legacy);
  assert.equal(editable.tiktok.imageQuality, 0);
  assert.equal(editable.tiktok.enabled, true);
  assert.throws(() => selectedChannels(legacy), /imageQuality/);
  editable.tiktok.imageQuality = 60;
  assert.equal(selectedChannels({ channels: editable })[0].imageQuality, 60);
});
