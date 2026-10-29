import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { getChannel } from '../src/channel';
import { prepareMockPreview } from '../scripts/preview-sdk';

test('preview mocks expose only the selected SDK and never perform a real redirect', () => {
  const expected: Record<string, string[]> = {
    tiktok: ['openAppStore', 'playableSDK'], 'google-ads': ['ExitApi'], applovin: ['mraid'],
  };
  for (const [channel, globals] of Object.entries(expected)) {
    const input = `<script src="${getChannel(channel).sdkURL}"></script>`;
    const preview = prepareMockPreview(input);
    assert.equal(preview.channel, channel);
    assert.equal(preview.html, '<script src="/__preview/sdk.js"></script>');
    const window: any = {}, messages: unknown[][] = [];
    vm.runInNewContext(preview.sdk, { window, console: { info: (...args: unknown[]) => messages.push(args) } });
    assert.deepEqual(Object.keys(window).sort(), globals);
    if (channel === 'tiktok') window.openAppStore();
    if (channel === 'google-ads') window.ExitApi.exit();
    if (channel === 'applovin') window.mraid.open('https://example.com');
    assert.equal(messages.length, 1);
    assert.match(String(messages[0][0]), /mock; no redirect/);
  }
});

test('preview rejects ambiguous SDKs and rewrites only the actual SDK script attribute', () => {
  const sdk = getChannel('tiktok').sdkURL;
  const inline = `<script>const source = '${sdk}';</script>`;
  const importTag = `<script src = '${sdk}'></script>`;
  assert.equal(prepareMockPreview(inline + importTag).html, inline + "<script src = '/__preview/sdk.js'></script>");
  assert.throws(() => prepareMockPreview(inline), /exactly one/);
  assert.throws(() => prepareMockPreview(`<script data-src="${sdk}"></script>`), /exactly one/);
  assert.throws(() => prepareMockPreview(importTag + importTag), /exactly one/);
  assert.throws(() => prepareMockPreview(importTag + '<script src="mraid.js"></script>'), /exactly one/);
});
