import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { encodeSingleHTML } from '../src/packaging/single-html';
import { EmbeddedStore, resourceName } from '../runtime/embedded/store';
import type { Entry } from '../src/types';
const entries = (): Entry[] => Object.entries({
  'index.html': '<script src="https://example.invalid/sdk.js"></script>',
  'playable-runtime.js': 'channelSDK()', 'config.json': '{}',
  'src/system.bundle.js': 'system', 'src/settings.json': '{}',
  'src/import-map.json': '{"imports":{"cc":"../cocos-js/cc.js"}}',
  'cocos-js/cc.js': 'engine', 'index.js': 'entry', 'style.css': 'body{color:red}',
  'assets/main/config.json': '{}', 'assets/main/index.js': 'bundle',
}).map(([name, value]) => ({ name, data: Buffer.from(value) }));
test('single HTML contains exact binary assets and preserves the channel SDK and runtime', async () => {
  const binary = Buffer.from([0, 128, 255, 13, 10]);
  const input = [...entries(), { name: 'assets/raw.bin', data: binary }];
  const html = (await encodeSingleHTML(input, 'console.log("</script>")', 'https://example.invalid/sdk.js')).toString();
  assert.equal(/<script[^>]+src=/.test(html), true);
  assert.ok(html.indexOf('src="https://example.invalid/sdk.js"') < html.indexOf('channelSDK()'));
  assert.ok(html.indexOf('channelSDK()') < html.indexOf('console.log'));
  assert.equal(html.includes('offline-preview'), false);
  assert.equal(html.includes('https://example.invalid/sdk.js'), true);
  assert.ok(html.includes('console.log("<\\/script>")'));
  const payload = html.match(/id="embedded-archive"[^>]*>([^<]+)/)![1];
  const zip = await JSZip.loadAsync(payload, { base64: true });
  assert.deepEqual(await zip.file('assets/raw.bin')!.async('nodebuffer'), binary);
  assert.equal(zip.file('playable-runtime.js'), null);
  const manifest = JSON.parse(html.match(/id="embedded-manifest"[^>]*>([^<]+)/)![1]);
  assert.equal(manifest.importMap.imports.cc, 'https://playable.invalid/cocos-js/cc.js');
});
test('prototype rejects unsupported native formats and CSS imports', async () => {
  await assert.rejects(encodeSingleHTML([...entries(), { name: 'assets/physics.wasm', data: Buffer.alloc(0) }], '', 'https://example.invalid/sdk.js'), /does not yet support/);
  const input = entries(); input.find(e => e.name === 'style.css')!.data = Buffer.from('@import "other.css"');
  await assert.rejects(encodeSingleHTML(input, '', 'https://example.invalid/sdk.js'), /CSS @import/);
});
test('embedded lookup normalizes local queries and fails on missing or external files', async () => {
  assert.equal(resourceName('./assets/a%20b.png?v=123'), 'assets/a b.png');
  assert.throws(() => resourceName('https://example.com/a.png'), /External/);
  const zip = new JSZip(); zip.file('assets/test.json', '{"value":42}');
  const store = new EmbeddedStore(zip);
  assert.deepEqual(await store.json('assets/test.json?version=1'), { value: 42 });
  assert.throws(() => store.url('absent.png'), /Missing/);
  await assert.rejects(store.json('absent.json'), /Missing/);
});

// Verify resource remapping preserves Cocos request/cache identity and pack routing.
test('asset pipeline maps native URLs but leaves bundles and JSON to registered handlers', async () => {
  const { installEmbeddedAssets } = await import('../runtime/embedded/engine');
  type Engine = import('../runtime/embedded/engine').EmbeddedEngine;
  type Pipe = Parameters<Engine['assetManager']['transformPipeline']['append']>[0];
  let pipe!: Pipe;
  let handlers!: Parameters<Engine['assetManager']['downloader']['register']>[0];
  const engine = { assetManager: { transformPipeline: { append(value: Pipe) { pipe = value; } },
    downloader: { bundleVers: {}, register(value: typeof handlers) { handlers = value; } } } } as Engine;
  const store = new EmbeddedStore(new JSZip());
  store.url = url => 'blob:' + url;
  installEmbeddedAssets(engine, store);
  const task = { input: [
    { url: 'assets/p.png', ext: '.png', isNative: true },
    { url: 'assets/config.json', ext: '.json', isNative: false },
    { url: 'main', ext: 'bundle', isNative: false },
    { url: 'assets/packed.bin', ext: '.bin', isNative: false, info: { packs: ['pack'] } },
  ], output: [] } as Parameters<Pipe>[0];
  assert.equal(pipe(task), undefined);
  assert.equal(task.output, task.input);
  assert.deepEqual(task.output.map(item => item.url), ['blob:assets/p.png', 'assets/config.json', 'main', 'assets/packed.bin']);
  assert.equal(typeof handlers.bundle, 'function');
  assert.equal(typeof handlers['.json'], 'function');
});


test('compiled build hook shares ZIP packaging, preserves SDK, and isolates format reports', async t => {
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
  const { packageBuild } = await import('../src/package');
  const { getChannel } = await import('../src/channel');
  const { readOptions } = await import('../src/options');
  const { onAfterBuild } = require('../dist/hooks.cjs') as typeof import('../src/hooks');
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'playable-formats-'));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const root = path.join(parent, 'build');
  for (const file of entries()) {
    const target = path.join(root, file.name); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, file.data);
  }
  const channel = getChannel('tiktok');
  fs.writeFileSync(path.join(root, 'index.html'), '<script src="' + channel.sdkURL + '"></script><script src="./playable-runtime.js"></script>');
  fs.writeFileSync(path.join(root, 'config.json'), '{"Playable_orientation":0}');
  const zip = await packageBuild(root);
  const previousZip = fs.readFileSync(zip.archive);
  const context: import('../src/builder-types').BuildContext = { utils: { async transformCode() { return ''; } }, buildExitRes: {} };
  const result = { paths: { dir: root, applicationJS: path.join(root, 'application.js'), indexJs: path.join(root, 'index.js'), indexHTML: path.join(root, 'index.html'), systemJs: path.join(root, 'src/system.bundle.js'), importMap: path.join(root, 'src/import-map.json'), settings: path.join(root, 'src/settings.json') }, settings: { plugins: { jsList: [] }, assets: {}, screen: { orientation: 'auto' } } } as import('../src/builder-types').BuildResult;
  await onAfterBuild.call(context, { packages: { playable: { outputFormat: 'single-html' } } }, result);
  const report = context.buildExitRes.custom!.playable as import('../src/types').PackageReport;
  assert.equal(report.status, 'packaged'); assert.equal(report.packageFormat, 'single-html');
  assert.equal(report.channelDefaultFormat, false);
  assert.deepEqual(fs.readFileSync(zip.archive), previousZip);
  assert.equal(JSON.parse(fs.readFileSync(root + '-delivery/report.json', 'utf8')).packageFormat, 'directory-zip');
  const html = fs.readFileSync(report.archive, 'utf8');
  assert.ok(html.includes('src="' + channel.sdkURL + '"'));
  assert.ok(html.includes('<script>channelSDK()</script>'));
  assert.equal(html.includes('offline-preview'), false);
  assert.throws(() => readOptions({ packages: { playable: { outputFormat: 'bad' as never } } }), /Unsupported outputFormat/);
  await assert.rejects(packageBuild(root, 'tiktok', { outputFormat: 'bad' as never }), /Unsupported outputFormat/);
  assert.ok(fs.existsSync(report.archive));
  fs.writeFileSync(path.join(root, 'assets/unsupported.wasm'), '');
  await assert.rejects(packageBuild(root, 'tiktok', { outputFormat: 'single-html' }), /does not yet support/);
  assert.equal(fs.existsSync(report.archive), false);
  assert.equal(JSON.parse(fs.readFileSync(root + '-delivery/single-html.report.json', 'utf8')).status, 'failed');
  assert.deepEqual(fs.readFileSync(zip.archive), previousZip);
});
