import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import JSZip from 'jszip';
import { installMockPreview } from '../scripts/preview/mock-api';
import { prepareAPIMockPreview } from '../scripts/preview-sdk';
import { startPreview } from '../scripts/preview/server';
import { getChannel } from '../src/channel';

test('unified mock enters through the real runtime and supports controlled lifecycle', () => {
  const events: Record<string, () => void> = {};
  const document = { hidden: false, addEventListener(name: string, listener: () => void) { events[name] = listener; } };
  const window = { location: { href: 'http://localhost/?ready=manual&viewable=false' } } as unknown as Window;
  const preview = installMockPreview(window);
  // No ExitApi is supplied: the real channel factory must be bypassed.
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/google-ads-runtime.js'), 'utf8'),
    { window, document, console });
  const api = window.playable;
  assert.equal(api.channel, 'mock');
  assert.equal(api.ready, false);
  assert.equal(api.viewable, false);
  let ready = 0, paused = 0, resumed = 0;
  api.onReady(() => ready++);
  api.onPause(() => paused++);
  api.onResume(() => resumed++);
  const mute: boolean[] = [];
  api.onMuteChange(value => mute.push(value));

  preview.ready();
  preview.ready();
  assert.equal(ready, 1);
  assert.equal(api.ready, true);
  preview.setViewable(true);
  events.pointerdown();
  preview.setMuted(true);
  preview.setMuted(false);
  preview.setViewable(false);
  preview.setViewable(true);
  assert.equal(paused, 1);
  assert.equal(resumed, 2);
  assert.deepEqual(mute, [true, false, true, false, true, false]);
  api.openStore();
  api.finish();
  api.finish();
  assert.deepEqual(preview.calls, ['openStore', 'finish']);
  assert.throws(() => preview.setMuted('false' as never), /boolean/);
});

test('unified injection uses the runtime marker with or without an SDK script', () => {
  for (const runtime of [
    '<script data-playable-runtime src="./playable-runtime.js"></script>',
    '<script data-playable-runtime>startRuntime()</script>',
  ]) {
    const expected = '<script src="/__preview/mock-api.js"></script>\n' + runtime;
    assert.equal(prepareAPIMockPreview(runtime), expected);
    for (const channel of ['tiktok', 'google-ads', 'applovin']) {
      assert.equal(prepareAPIMockPreview('<script src="' + getChannel(channel).sdkURL + '"></script>' + runtime), expected);
    }
    const inline = '<script>const text = "data-playable-runtime";</script>';
    assert.equal(prepareAPIMockPreview(inline + runtime), inline + expected);
    assert.throws(() => prepareAPIMockPreview(runtime + runtime), /exactly one/);
  }
  assert.throws(() => prepareAPIMockPreview('<script data-other-playable-runtime></script>'), /exactly one/);
  assert.throws(() => prepareAPIMockPreview('<script src="./playable-runtime.js"></script>'), /rebuild/);
});

test('ZIP and HTML preview inject only in responses and preserve delivery bytes', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playable-api-preview-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const index = '<html><script data-playable-runtime>originalRuntime()</script></html>';
  const zip = new JSZip();
  zip.file('index.html', index);
  zip.file('assets/file.bin', Buffer.from([0, 128, 255]));
  const zipFile = path.join(root, 'game.zip');
  const htmlFile = path.join(root, 'game.html');
  fs.writeFileSync(zipFile, await zip.generateAsync({ type: 'nodebuffer' }));
  fs.writeFileSync(htmlFile, index);
  for (const file of [zipFile, htmlFile]) {
    const original = fs.readFileSync(file);
    const server = await startPreview(file, { mockAPI: true });
    try {
      const html = await (await fetch(server.url)).text();
      assert.equal(html, prepareAPIMockPreview(index));
      const script = await fetch(server.url + '/__preview/mock-api.js');
      assert.equal(script.status, 200);
      assert.match(await script.text(), /createAdapter/);
      assert.equal((await fetch(server.url + '/missing.js')).status, 404);
      if (file === zipFile) {
        assert.deepEqual(Buffer.from(await (await fetch(server.url + '/assets/file.bin')).arrayBuffer()), Buffer.from([0, 128, 255]));
      }
      assert.deepEqual(fs.readFileSync(file), original);
    } finally { await server.close(); }
  }
  await assert.rejects(startPreview(zipFile, { mockAPI: true, mockSDK: true }), /either/);
});
