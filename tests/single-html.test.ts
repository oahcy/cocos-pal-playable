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
  await assert.rejects(store.url('absent.png'), /decode Blob.*absent.png.*Missing/);
  await assert.rejects(store.json('absent.json'), /Missing/);
});

test('load and preload await native resources without changing pack routing or request identity', async () => {
  const { installEmbeddedAssets } = await import('../runtime/embedded/engine');
  type Engine = import('../runtime/embedded/engine').EmbeddedEngine;
  type Pipe = Engine['assetManager']['preprocessPipe'];
  const pre: Pipe = (_task, done) => done();
  const makePipeline = () => ({ pipes: [pre], insert(pipe: Pipe, index: number) { this.pipes.splice(index, 0, pipe); } });
  let handlers!: Parameters<Engine['assetManager']['downloader']['register']>[0];
  const engine = { assetManager: { pipeline: makePipeline(), fetchPipeline: makePipeline(), preprocessPipe: pre,
    downloader: { bundleVers: {}, register(value: typeof handlers) { handlers = { ...handlers, ...value }; } } } } as Engine;
  const store = new EmbeddedStore(new JSZip());
  store.url = async url => 'blob:' + url;
  installEmbeddedAssets(engine, store);
  for (const pipeline of [engine.assetManager.pipeline, engine.assetManager.fetchPipeline]) {
    const task = { input: [
      { url: 'assets/p.png', ext: '.png', isNative: true },
      { url: 'assets/config.json', ext: '.json', isNative: false },
      { url: 'main', ext: 'bundle', isNative: false },
      { url: 'assets/packed.bin', ext: '.bin', isNative: false, info: { packs: ['pack'] } },
    ], output: [] } as Parameters<Pipe>[0];
    await new Promise<void>((resolve, reject) => pipeline.pipes[1](task, error => error ? reject(error) : resolve()));
    assert.equal(task.output, task.input);
    assert.deepEqual(task.output.map(item => item.url), ['blob:assets/p.png', 'assets/config.json', 'main', 'assets/packed.bin']);
  }
  assert.equal(typeof handlers.bundle, 'function'); assert.equal(typeof handlers['.json'], 'function');
  let release!: (url: string) => void;
  const slow = new Promise<string>(resolve => { release = resolve; });
  store.url = async url => { if (url === 'slow.png') return slow; throw new Error('Missing: ' + url); };
  const mixed = { input: [{ url: 'slow.png', ext: '.png', isNative: true }, { url: 'missing.png', ext: '.png', isNative: true }], output: [] };
  let completed = false;
  const result = new Promise<Error | undefined>(resolve => engine.assetManager.pipeline.pipes[1](mixed, error => { completed = true; resolve(error); }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(completed, false);
  release('blob:slow');
  assert.match((await result)!.message, /missing.png/);
  assert.equal(mixed.input[0].url, 'slow.png');

  const task = { input: [{ url: 'absent.png', ext: '.png', isNative: true }], output: [] };
  store.url = async url => { throw new Error('Missing: ' + url); };
  await assert.rejects(new Promise<void>((resolve, reject) => engine.assetManager.pipeline.pipes[1](task, error => error ? reject(error) : resolve())), /prepare assets.*absent.png/);
});

test('embedded files decode lazily, concurrent consumers share work, JSON mutation stays local', async t => {
  const source = new JSZip(); source.file('used.bin', new Uint8Array([1, 2, 3])); source.file('unused.bin', 'never read'); source.file('config.json', '{"list":[1,2]}');
  const zip = await JSZip.loadAsync(await source.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }));
  const reads: Record<string, number> = {};
  for (const file of Object.values(zip.files)) {
    const original = file.async.bind(file);
    file.async = ((...args: Parameters<typeof file.async>) => { reads[file.name] = (reads[file.name] || 0) + 1; return original(...args); }) as typeof file.async;
  }
  const store = new EmbeddedStore(zip);
  assert.deepEqual(reads, {});
  const [first, second] = await Promise.all([store.url('used.bin'), store.url('./used.bin?v=1')]);
  t.after(() => URL.revokeObjectURL(first));
  assert.equal(first, second); assert.equal(await store.url('used.bin'), first);
  assert.equal(reads['used.bin'], 1); assert.equal(reads['unused.bin'], undefined);
  assert.deepEqual(new Uint8Array(await (await fetch(first)).arrayBuffer()), new Uint8Array([1, 2, 3]));
  const [a, b] = await Promise.all([store.json<{ list: number[] }>('config.json'), store.json<{ list: number[] }>('config.json')]);
  a.list.pop(); assert.deepEqual(b.list, [1, 2]); assert.equal(reads['config.json'], 1);
  assert.throws(() => store.readyURL('unused.bin'), /resolve script.*unused.bin.*not prepared/);
  assert.equal(reads['unused.bin'], undefined);
});

test('JSON errors name the resource and decode stage', async () => {
  const zip = new JSZip(); zip.file('broken.json', '{');
  await assert.rejects(new EmbeddedStore(zip).json('broken.json'), /read JSON.*broken.json/);
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


test('Base122 preserves every byte and partial groups in HTML-safe UTF-8', async () => {
  const { encodeBase122, decodeBase122 } = await import('../runtime/embedded/base122');
  const { randomBytes } = await import('node:crypto');
  for (const bytes of [Buffer.alloc(0), Buffer.from(Array.from({length: 256}, (_, i) => i)), ...Array.from({length: 32}, (_, i) => randomBytes(i)), randomBytes(65536)]) {
    const encoded = encodeBase122(bytes);
    assert.equal(/[\x00\r\n"&\\<]/.test(encoded), false);
    assert.deepEqual(Buffer.from(decodeBase122(Buffer.from(encoded, 'utf8').toString('utf8'))), bytes);
  }
  const binary = randomBytes(4096);
  const html = (await encodeSingleHTML([...entries(), {name: 'assets/raw.bin', data: binary}], '', 'https://example.invalid/sdk.js', undefined, 'base122')).toString();
  assert.ok(html.includes('data-encoding="base122"'));
  const payload = html.match(/id="embedded-archive"[^>]*>([^<]+)/)![1];
  const zip = await JSZip.loadAsync(decodeBase122(payload));
  assert.deepEqual(await zip.file('assets/raw.bin')!.async('nodebuffer'), binary);
  const { readOptions } = await import('../src/options');
  assert.equal(readOptions({}).embeddedEncoding, 'base64');
  assert.equal(readOptions({packages: {playable: {embeddedEncoding: 'base122'}}}).embeddedEncoding, 'base122');
  assert.throws(() => readOptions({packages: {playable: {embeddedEncoding: 'bad' as never}}}), /Unsupported embeddedEncoding/);
});


test('shared archive codec preserves bytes, defaults and rejects unknown encodings', async () => {
  const { encodeArchive, decodeArchive, embeddedEncodings } = await import('../runtime/embedded/embedded-codec');
  const { randomBytes } = await import('node:crypto');
  for (const bytes of [Buffer.alloc(0), Buffer.from([0, 13, 10, 255]), randomBytes(100003)]) {
    assert.equal(encodeArchive(bytes), bytes.toString('base64'));
    assert.deepEqual(Buffer.from(decodeArchive(encodeArchive(bytes))), bytes);
    for (const encoding of embeddedEncodings) {
      const html = (await encodeSingleHTML([...entries(), { name: 'assets/raw.bin', data: bytes }], '', 'https://example.invalid/sdk.js', undefined, encoding)).toString();
      const payload = html.match(/id="embedded-archive"[^>]*>([^<]+)/)![1];
      const zip = await JSZip.loadAsync(decodeArchive(payload, encoding));
      assert.deepEqual(await zip.file('assets/raw.bin')!.async('nodebuffer'), bytes);
    }
  }
  for (const encoding of ['bad', 'toString', '__proto__', null]) {
    assert.throws(() => decodeArchive('', encoding), /Unsupported embeddedEncoding/);
  }
});
