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
test('single HTML embeds CCONB, video and WASM resources and keeps CSS imports explicit', async () => {
  const cconb = Buffer.from([0x43, 0x43, 0x4f, 0x4e, 0, 0, 0, 0]);
  const html = (await encodeSingleHTML([...entries(), { name: 'assets/main/import/pack.cconb', data: cconb }], '', 'https://example.invalid/sdk.js')).toString();
  const payload = html.match(/id="embedded-archive"[^>]*>([^<]+)/)![1];
  const zip = await JSZip.loadAsync(payload, { base64: true });
  assert.deepEqual(await zip.file('assets/main/import/pack.cconb')!.async('nodebuffer'), cconb);
  const media = ['assets/video.mp4', 'assets/video.webm', 'assets/physics.wasm'].map(name => ({ name, data: Buffer.from([0, 1, 2, 255]) }));
  const mediaHTML = (await encodeSingleHTML([...entries(), ...media], '', 'https://example.invalid/sdk.js')).toString();
  const mediaPayload = mediaHTML.match(/id="embedded-archive"[^>]*>([^<]+)/)![1];
  const mediaZip = await JSZip.loadAsync(mediaPayload, { base64: true });
  for (const item of media) assert.deepEqual(await mediaZip.file(item.name)!.async('nodebuffer'), item.data);
  const input = entries(); input.find(e => e.name === 'style.css')!.data = Buffer.from('@import "other.css"');
  await assert.rejects(encodeSingleHTML(input, '', 'https://example.invalid/sdk.js'), /CSS @import/);
});
test('embedded lookup normalizes local queries and fails on missing or external files', async () => {
  assert.equal(resourceName('./assets/a%20b.png?v=123'), 'assets/a b.png');
  assert.throws(() => resourceName('https://example.com/a.png'), /External/);
  const zip = new JSZip(); zip.file('assets/test.json', '{"value":42}'); zip.file('assets/demo.mp4', new Uint8Array([0, 1, 2, 255]));
  const store = new EmbeddedStore(zip);
  assert.deepEqual(await store.json('assets/test.json?version=1'), { value: 42 });
  const videoUrl = await store.url('assets/demo.mp4');
  const videoResponse = await fetch(videoUrl);
  assert.equal(videoResponse.headers.get('content-type'), 'video/mp4');
  assert.deepEqual(new Uint8Array(await videoResponse.arrayBuffer()), new Uint8Array([0, 1, 2, 255]));
  URL.revokeObjectURL(videoUrl);
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
  const engine = { cclegacy: { internal: { decodeCCONBinary: (bytes: Uint8Array) => ({ decoded: [...bytes] }) } }, assetManager: { pipeline: makePipeline(), fetchPipeline: makePipeline(), preprocessPipe: pre,
    downloader: { bundleVers: {}, register(value: typeof handlers) { handlers = { ...handlers, ...value }; } } } } as unknown as Engine;
  const archive = new JSZip(); archive.file('assets/packed.cconb', new Uint8Array([0x43, 0x43, 0x4f, 0x4e]));
  const store = new EmbeddedStore(archive);
  store.url = async url => 'blob:' + url;
  installEmbeddedAssets(engine, store);
  for (const pipeline of [engine.assetManager.pipeline, engine.assetManager.fetchPipeline]) {
    const task = { input: [
      { url: 'assets/p.png', ext: '.png', isNative: true },
      { url: 'assets/clip.mp4', ext: '.mp4', isNative: true },
      { url: 'assets/config.json', ext: '.json', isNative: false },
      { url: 'main', ext: 'bundle', isNative: false },
      { url: 'assets/packed.cconb', ext: '.cconb', isNative: false },
      { url: 'assets/packed.bin', ext: '.bin', isNative: false, info: { packs: ['pack'] } },
    ], output: [] } as Parameters<Pipe>[0];
    await new Promise<void>((resolve, reject) => pipeline.pipes[1](task, error => error ? reject(error) : resolve()));
    assert.equal(task.output, task.input);
    assert.deepEqual(task.output.map(item => item.url), ['blob:assets/p.png', 'blob:assets/clip.mp4', 'assets/config.json', 'main', 'assets/packed.cconb', 'assets/packed.bin']);
  }
  assert.equal(typeof handlers.bundle, 'function'); assert.equal(typeof handlers['.json'], 'function');
  const decodedPack = await new Promise<unknown>((resolve, reject) => handlers['.cconb']('assets/packed.cconb', {}, (error, data) => error ? reject(error) : resolve(data)));
  assert.deepEqual(decodedPack, { decoded: [0x43, 0x43, 0x4f, 0x4e] });
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

test('CCON requests prefer bin, fall back to cconb only on read failure, and report missing resources', async () => {
  const { installEmbeddedAssets } = await import('../runtime/embedded/engine');
  type Engine = import('../runtime/embedded/engine').EmbeddedEngine;
  const pre: Engine['assetManager']['preprocessPipe'] = (_task, done) => done();
  let handlers!: Parameters<Engine['assetManager']['downloader']['register']>[0];
  const pipeline = () => ({ pipes: [pre], insert() {} });
  const engine = { cclegacy: { internal: { decodeCCONBinary(bytes: Uint8Array) {
    if (bytes[0] === 0) throw new Error('invalid CCON header');
    return [...bytes];
  } } }, assetManager: { pipeline: pipeline(), fetchPipeline: pipeline(), preprocessPipe: pre,
    downloader: { bundleVers: {}, register(value: typeof handlers) { handlers = { ...handlers, ...value }; } } },
  } as unknown as Engine;
  const archive = new JSZip();
  archive.file('assets/new.bin', new Uint8Array([1]));
  archive.file('assets/old.cconb', new Uint8Array([2]));
  archive.file('assets/both.bin', new Uint8Array([3]));
  archive.file('assets/both.cconb', new Uint8Array([4]));
  archive.file('assets/bad.bin', new Uint8Array([0]));
  archive.file('assets/bad.cconb', new Uint8Array([5]));
  installEmbeddedAssets(engine, new EmbeddedStore(archive));
  const load = (url: string) => new Promise((resolve, reject) => {
    handlers['.cconb'](url, {}, (error, data) => error ? reject(error) : resolve(data));
  });
  assert.deepEqual(await load('assets/new.cconb'), [1]);
  assert.deepEqual(await load('assets/new.cconb?v=1#asset'), [1]);
  assert.deepEqual(await load('assets/old.cconb'), [2]);
  assert.deepEqual(await load('assets/both.cconb'), [3]);
  await assert.rejects(load('assets/bad.cconb'), /load CCONB.*invalid CCON header/);
  await assert.rejects(load('assets/missing.cconb'), /load CCONB.*Missing embedded resource.*missing.cconb/);
});
test('CCONB decoder exceptions reach the downloader callback', async () => {
  const { installEmbeddedAssets } = await import('../runtime/embedded/engine');
  type Engine = import('../runtime/embedded/engine').EmbeddedEngine;
  const pre: Engine['assetManager']['preprocessPipe'] = (_task, done) => done();
  let handlers!: Parameters<Engine['assetManager']['downloader']['register']>[0];
  const pipeline = () => ({ pipes: [pre], insert() {} });
  const engine = { cclegacy: { internal: { decodeCCONBinary() { throw new Error('invalid CCON header'); } } },
    assetManager: { pipeline: pipeline(), fetchPipeline: pipeline(), preprocessPipe: pre,
      downloader: { bundleVers: {}, register(value: typeof handlers) { handlers = { ...handlers, ...value }; } } },
  } as unknown as Engine;
  const archive = new JSZip(); archive.file('assets/bad.cconb', new Uint8Array([0]));
  installEmbeddedAssets(engine, new EmbeddedStore(archive));
  await assert.rejects(new Promise((resolve, reject) => handlers['.cconb']('assets/bad.cconb', {}, (error, data) => error ? reject(error) : resolve(data))), /load CCONB.*invalid CCON header/);
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
  const { readOptions } = await import('../src/adapters/cli/options');
  const { onAfterBuild } = require('../dist/hooks.cjs') as typeof import('../src/adapters/cli/hooks');
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
  const context: import('../src/adapters/cli/builder-types').BuildContext = { utils: { async transformCode() { return ''; } }, buildExitRes: {} };
  const result = { paths: { dir: root, applicationJS: path.join(root, 'application.js'), indexJs: path.join(root, 'index.js'), indexHTML: path.join(root, 'index.html'), systemJs: path.join(root, 'src/system.bundle.js'), importMap: path.join(root, 'src/import-map.json'), settings: path.join(root, 'src/settings.json') }, settings: { plugins: { jsList: [] }, assets: {}, screen: { orientation: 'auto' } } } as import('../src/adapters/cli/builder-types').BuildResult;
  await onAfterBuild.call(context, { packages: { playable: { outputFormat: 'single-html' } } }, result);
  const report = context.buildExitRes.custom!.playable as import('../src/types').PackageReport;
  assert.equal(report.status, 'packaged'); assert.equal(report.packageFormat, 'single-html');
  assert.equal(report.channelDefaultFormat, false);
  assert.deepEqual(fs.readFileSync(zip.archive), previousZip);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'playable-tiktok', 'report.json'), 'utf8')).packageFormat, 'directory-zip');
  const html = fs.readFileSync(report.archive, 'utf8');
  assert.ok(html.includes('src="' + channel.sdkURL + '"'));
  assert.ok(html.includes('<script>channelSDK()</script>'));
  assert.equal(html.includes('offline-preview'), false);
  assert.throws(() => readOptions({ packages: { playable: { outputFormat: 'bad' as never } } }), /Unsupported outputFormat/);
  await assert.rejects(packageBuild(root, 'tiktok', { outputFormat: 'bad' as never }), /Unsupported outputFormat/);
  assert.ok(fs.existsSync(report.archive));
  fs.writeFileSync(path.join(root, 'style.css'), '@import "other.css";');
  await assert.rejects(packageBuild(root, 'tiktok', { outputFormat: 'single-html' }), /CSS @import/);
  assert.equal(fs.existsSync(report.archive), false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'playable-tiktok', 'single-html.report.json'), 'utf8')).status, 'failed');
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
  const { readOptions } = await import('../src/adapters/cli/options');
  assert.equal(readOptions({}).embeddedEncoding, 'base64');
  assert.equal(readOptions({packages: {playable: {embeddedEncoding: 'base122'}}}).embeddedEncoding, 'base122');
  assert.throws(() => readOptions({packages: {playable: {embeddedEncoding: 'bad' as never}}}), /Unsupported embeddedEncoding/);
});


test('shared archive codec preserves bytes, defaults and rejects unknown encodings', async () => {
  const { encodeArchive, decodeArchive, embeddedEncodings } = await import('../runtime/embedded/embedded-codec');
  const { randomBytes } = await import('node:crypto');
  // Older Creator hosts expose neither browser Base64 global in Node.
  const previousBtoa = globalThis.btoa;
  try {
    Object.defineProperty(globalThis, 'btoa', { value: undefined, configurable: true, writable: true });
    for (const length of [0, 1, 2, 3, 4, 12287, 12288, 12289]) {
      const bytes = randomBytes(length);
      assert.equal(encodeArchive(bytes), bytes.toString('base64'));
    }
  } finally {
    Object.defineProperty(globalThis, 'btoa', { value: previousBtoa, configurable: true, writable: true });
  }
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
