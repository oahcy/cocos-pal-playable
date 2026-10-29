import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import ts from 'typescript';
import JSZip from 'jszip';
import { selectedChannels } from '../src/adapters/creator-shared/selection';
import { deliverCreatorChannels } from '../src/adapters/creator-shared/delivery';
import { createAppLovinAdapter, type Mraid } from '../runtime/adapters/applovin';
import { createPlayable } from '../runtime/core';
import { startPlayable } from '../src/adapters/application-class/startup';
import { getChannel } from '../src/channel';
import { validate } from '../src/packaging/web-files';
import { decodeArchive } from '../runtime/embedded/embedded-codec';

const storeUrl = 'https://play.google.com/store/apps/details?id=com.example.game';
function mraidFixture() {
  const events = new Map<string, (...args: any[]) => void>();
  let state = 'loading', visible = false, queries = 0;
  const opened: string[] = [];
  const sdk: Mraid = {
    getState: () => state,
    isViewable() { assert.notEqual(state, 'loading'); queries++; return visible; },
    addEventListener(name, listener) { events.set(name, listener); },
    removeEventListener(name) { events.delete(name); },
    open(url) { assert.equal(this, sdk); opened.push(url); },
  };
  return { sdk, events, opened, get queries() { return queries; },
    ready() { state = 'default'; events.get('ready')?.(); },
    visible(value: boolean) { visible = value; events.get('viewableChange')?.(value); } };
}

test('AppLovin validates store link, orientation, format and disabled channel settings', () => {
  const read = (extra = {}) => selectedChannels({ channel: 'applovin', storeUrl, ...extra });
  assert.equal(read()[0].channel, 'applovin');
  assert.throws(() => selectedChannels({ channel: 'applovin' }), /store URL/);
  assert.throws(() => read({ storeUrl: 'javascript:alert(1)' }), /HTTPS/);
  assert.throws(() => read({ orientation: 'portrait' }), /orientation=auto/);
  assert.throws(() => read({ outputFormat: 'directory-zip' }), /does not support/);
  assert.equal(selectedChannels({ channels: { tiktok: { enabled: true }, applovin: { enabled: false } } }).length, 1);
});

test('channels without store URLs ignore stale AppLovin configuration', () => {
  for (const channel of ['tiktok', 'google-ads']) {
    const result = selectedChannels({ channel, storeUrl: 'not-a-url' })[0];
    assert.equal(result.channel, channel);
    assert.equal(result.storeUrl, undefined);
  }
  assert.throws(() => selectedChannels({ channel: 'applovin', storeUrl: 'not-a-url' }), /Invalid store URL/);
});

test('MRAID waits for ready, propagates visibility/muting and never opens on finish', () => {
  const host = mraidFixture();
  const events: Record<string, () => void> = {};
  const document = { hidden: false, addEventListener(name: string, fn: () => void) { events[name] = fn; } };
  const api = createPlayable(createAppLovinAdapter({ mraid: host.sdk }, storeUrl), document as unknown as Document);
  assert.equal(api.ready, false); assert.equal(api.viewable, false); assert.equal(host.queries, 0);
  assert.throws(() => api.openStore(), /ready/);
  host.ready(); assert.equal(api.ready, true); assert.equal(api.viewable, false);
  const mute: boolean[] = []; api.onMuteChange(value => mute.push(value));
  host.visible(true); events.pointerdown();
  api.openStore(); assert.deepEqual(host.opened, [storeUrl]);
  host.visible(false); assert.throws(() => api.openStore(), /viewable/);
  assert.deepEqual(mute, [true, false, true]);
  api.finish(); api.finish(); assert.equal(host.opened.length, 1);
  assert.equal(host.events.has('ready'), false);
});

test('compiled AppLovin runtime accepts an already ready container and uses configured URL', () => {
  const host = mraidFixture(); host.ready(); host.visible(true);
  const window: any = { mraid: host.sdk, __playableStoreUrl: storeUrl };
  const document = { hidden: false, addEventListener() {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/applovin-runtime.js'), 'utf8'), { window, document });
  assert.equal(window.playable.channel, 'applovin');
  assert.equal(window.playable.ready, true);
  window.playable.openStore(); assert.deepEqual(host.opened, [storeUrl]);
  assert.throws(() => createAppLovinAdapter({}, storeUrl).init({} as never), /MRAID is unavailable/);
});

test('three channels share one build; AppLovin defaults to self-contained HTML with isolated SDK', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'applovin-multi-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src'));
  const sources: Record<string, string> = {
    'application.js': 'System.register([],function(){return {execute:function(){}}});',
    'src/system.bundle.js': '', 'src/import-map.json': '{"imports":{}}',
    'src/settings.json': '{"assets":{},"screen":{"orientation":"auto"},"profiling":{"showFPS":true}}',
  };
  for (const [name, data] of Object.entries(sources)) fs.writeFileSync(path.join(root, name), data);
  const globals = globalThis as any, previous = globals.Build;
  globals.Build = { Utils: { async transformCode(source: string) {
    return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.System } }).outputText;
  } } };
  t.after(() => { if (previous === undefined) delete globals.Build; else globals.Build = previous; });
  const result = { paths: { dir: root, applicationJS: path.join(root, 'application.js'),
    systemJs: path.join(root, 'src/system.bundle.js'), importMap: path.join(root, 'src/import-map.json'),
    settings: path.join(root, 'src/settings.json') } };
  const selections = selectedChannels({ channels: {
    tiktok: { enabled: true }, 'google-ads': { enabled: true },
    applovin: { enabled: true, storeUrl },
  } });
  const reports = await deliverCreatorChannels({ platform: 'playable' }, result, selections);
  assert.equal(reports.length, 3);
  const report = reports.find(report => report.channel === 'applovin')!;
  assert.equal(report.channelDefaultFormat, true); assert.equal(report.packageFormat, 'single-html');
  assert.equal(path.basename(report.archive), 'applovin.html');
  const html = fs.readFileSync(report.archive, 'utf8');
  assert.deepEqual([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]), ['mraid.js']);
  assert.ok(html.includes(storeUrl));
  assert.ok(!html.includes(getChannel('tiktok').sdkURL));
  assert.ok(!html.includes(getChannel('google-ads').sdkURL));
  const embedded = html.match(/id="embedded-archive"[^>]*>([\s\S]*?)<\/script>/)![1];
  const zip = await JSZip.loadAsync(decodeArchive(embedded, 'base64'), { checkCRC32: true });
  assert.equal(await zip.file('application.js')!.async('string'), sources['application.js']);
  assert.equal(zip.file('config.json'), null);
  assert.ok(!Object.keys(zip.files).some(name => name.startsWith('playable-')));
  for (const [name, data] of Object.entries(sources)) assert.equal(fs.readFileSync(path.join(root, name), 'utf8'), data);
  for (const other of reports.filter(report => report.channel !== 'applovin')) {
    const otherZip = await JSZip.loadAsync(fs.readFileSync(other.archive));
    assert.ok(!(await otherZip.file('index.html')!.async('string')).includes('mraid.js'));
  }
  const entries = [{ name: 'index.html', data: Buffer.from('<script src="mraid.js"></script><script src="./playable-runtime.js"></script><img src="https://example.com/a.png">') },
    { name: 'playable-runtime.js', data: Buffer.from('') }];
  assert.throws(() => validate(entries, getChannel('applovin')), /External/);
});


test('bootstrap waits for SDK readiness before reading layout and rejects early SDK failure', async () => {
  let layoutReads = 0, engineLoads = 0, unsubscribed = false;
  let fail!: (error: Error) => void;
  const failure = new Promise<never>((_, reject) => { fail = reject; });
  const api = { onReady() { return () => { unsubscribed = true; }; } } as unknown as PlayableAPI;
  const document = { getElementById() { layoutReads++; return null; } } as unknown as Document;
  const started = startPlayable({} as never, async () => { engineLoads++; return {} as never; }, api, failure, document);
  await Promise.resolve();
  assert.equal(layoutReads, 0); assert.equal(engineLoads, 0);
  fail(new Error('SDK failed'));
  await assert.rejects(started, /SDK failed/);
  assert.equal(unsubscribed, true);
});
