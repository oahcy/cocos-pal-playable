import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ts from 'typescript';
import JSZip from 'jszip';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { generatePlugin } from '../scripts/release/generate';
import { verifyFiles, readFiles } from '../scripts/release/files';
import { onBeforeBuild, onAfterBuild } from '../src/adapters/creator-383/hooks';

test('Creator disabled option leaves ordinary Web builds alone', async () => {
  onBeforeBuild({ platform: 'web-mobile', sourceMaps: true, server: 'https://example.com' });
  assert.equal(await onAfterBuild({ platform: 'web-mobile' }, undefined as never), undefined);
  const options = { platform: 'web-mobile', packages: { playable: { enabled: true } } };
  assert.throws(() => onBeforeBuild({ ...options, sourceMaps: true }), /Source Maps/);
  assert.throws(() => onBeforeBuild({ ...options, md5Cache: true }), /MD5 Cache/);
  assert.throws(() => onBeforeBuild({ ...options, platform: 'wechatgame' }), /web-mobile/);
});

test('standalone Creator extension maps final paths and packages ZIP and HTML through shared core', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playable-creator-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const plugin = path.join(root, 'plugin');
  await generatePlugin(plugin, 'creator', '3.8.3');
  assert.equal(verifyFiles(readFiles(plugin)).profile, 'creator-383');
  const manifest = JSON.parse(fs.readFileSync(path.join(plugin, 'package.json'), 'utf8'));
  assert.equal(manifest.name, 'playable');
  assert.equal(fs.existsSync(path.join(plugin, 'node_modules/sharp')), false);
  assert.equal(manifest.package_version, 2);
  assert.equal(manifest.contributes, undefined);
  // Reproduce the legacy host's rejection of node:-prefixed imports.
  for (const name of ['config', 'hooks']) {
    const filename = path.join(plugin, 'dist', name + '.cjs');
    const nativeRequire = createRequire(filename);
    const mod = { exports: {} };
    vm.runInNewContext('Object.hasOwn = undefined;\n' + fs.readFileSync(filename, 'utf8'), {
      module: mod, exports: mod.exports, __filename: filename, __dirname: path.dirname(filename),
      console, process, Buffer, setTimeout, clearTimeout, setImmediate, clearImmediate,
      require(id: string) {
        assert.ok(!id.startsWith('node:'), 'Legacy Creator cannot load ' + id);
        return nativeRequire(id);
      },
    }, { filename });
    if (name === 'hooks') {
      const legacy = mod.exports as typeof import('../src/adapters/creator-383/hooks');
      legacy.onBeforeBuild({ platform: 'web-mobile', packages: { playable: { enabled: true, channel: 'tiktok' } } });
      assert.throws(() => legacy.onBeforeBuild({ platform: 'web-mobile', packages: { playable: { enabled: true, channel: 'constructor' } } }), /Unsupported playable channel/);
    }
  }
  const config = require(path.join(plugin, manifest.contributions.builder));
  assert.deepEqual(Object.keys(config.configs), ['web-mobile']);
  assert.equal(config.configs['web-mobile'].options.enabled.default, false);
  const hooks = require(path.join(plugin, 'dist/hooks.cjs')) as typeof import('../src/adapters/creator-383/hooks');
  const globals = globalThis as unknown as { Build?: unknown };
  const oldBuild = globals.Build;
  const editorGlobals = globalThis as unknown as { Editor?: unknown };
  const oldEditor = editorGlobals.Editor;
  editorGlobals.Editor = { App: { path: path.resolve(__dirname, '..') } };
  t.after(() => { if (oldEditor === undefined) delete editorGlobals.Editor; else editorGlobals.Editor = oldEditor; });
  t.after(() => { if (oldBuild === undefined) delete globals.Build; else globals.Build = oldBuild; });
  globals.Build = { Utils: { async transformCode(source: string, options: { importMapFormat: string }) {
    assert.equal(options.importMapFormat, 'systemjs');
    assert.ok(source.includes('application.js'));
    return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.System } }).outputText;
  } } };
  const output = path.join(root, 'web');
  fs.mkdirSync(path.join(output, 'src'), { recursive: true });
  for (const [file, data] of Object.entries({
    'src/system.bundle.js': '// fixture', 'src/import-map.json': '{"imports":{}}',
    'src/settings.json': '{"assets":{},"screen":{},"profiling":{"showFPS":true}}',
    'application.js': 'System.register([],function(){return {execute:function(){}}});',
  })) fs.writeFileSync(path.join(output, file), data);
  class Paths {
    get dir() { return output; }
    get applicationJS() { return path.join(output, 'application.js'); }
    get systemJs() { return path.join(output, 'src/system.bundle.js'); }
    get importMap() { return path.join(output, 'src/import-map.json'); }
    get settings() { return path.join(output, 'src/settings.json'); }
  }
  const result = { paths: new Paths() };
  const options = { platform: 'web-mobile', packages: { playable: { enabled: true, orientation: 'portrait' } } };
  // Compression must resolve from the supplied host root; the plugin contains no sharp.
  const sharp = require('sharp') as typeof import('sharp');
  fs.mkdirSync(path.join(output, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(output, 'assets/test.png'), await sharp({ create: { width: 16, height: 16, channels: 4, background: '#abcdef' } }).png().toBuffer());
  const report = (await hooks.onAfterBuild({ ...options, packages: { playable: { ...options.packages.playable, imageCompression: 'lossy', imageQuality: 60 } } }, result))!;
  assert.equal(report.images?.mode, 'lossy');
  assert.equal(report.images?.files.length, 1);
  const zip = await JSZip.loadAsync(fs.readFileSync(report.archive), { checkCRC32: true });
  assert.ok(zip.file('playable-runtime.js'));
  assert.ok((await zip.file('index.js')!.async('string')).includes('System.register'));
  assert.deepEqual(JSON.parse(await zip.file('config.json')!.async('string')), { Playable_orientation: 1 });
  const html = (await hooks.onAfterBuild({ ...options, packages: { playable: { ...options.packages.playable, outputFormat: 'single-html', embeddedEncoding: 'base122' } } }, result))!;
  assert.equal(html.packageFormat, 'single-html');
  assert.equal(html.embeddedEncoding, 'base122');
  assert.ok(fs.readFileSync(html.archive, 'utf8').includes('playable-sdk.js'));
  fs.writeFileSync(result.paths.settings, '{"assets":{"remoteBundles":["remote"]}}');
  await assert.rejects(hooks.onAfterBuild(options, result), /Remote bundles/);
});
