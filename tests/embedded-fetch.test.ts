import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { EmbeddedStore, VIRTUAL_ROOT } from '../runtime/embedded/store';
import { installEmbeddedFetch } from '../runtime/embedded/fetch';

test('engine module-relative WASM fetch uses embedded bytes, including streaming MIME', async t => {
  const bytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
  const archive = new JSZip(); archive.file('cocos-js/assets/test.wasm', bytes);
  const store = new EmbeddedStore(archive);
  const errors: Error[] = [];
  const host = { fetch };
  installEmbeddedFetch(host, store, error => errors.push(error));
  // Same resolution as Creator 3.8.4 PAL's fetchBuffer, outside assetManager.
  const url = new URL('assets/test.wasm', VIRTUAL_ROOT + 'cocos-js/engine.js');
  const response = await host.fetch(url);
  assert.equal(response.headers.get('content-type'), 'application/wasm');
  assert.deepEqual(new Uint8Array(await response.clone().arrayBuffer()), bytes);
  assert.ok((await WebAssembly.instantiateStreaming(response)).instance instanceof WebAssembly.Instance);
  assert.equal(errors.length, 0);
  t.after(() => URL.revokeObjectURL(store.readyURL(url.href)));
});

test('embedded fetch preserves Request options and leaves every other request untouched', async t => {
  const archive = new JSZip(); archive.file('data.bin', 'data');
  const store = new EmbeddedStore(archive);
  const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
  const native: typeof fetch = async (input, init) => { calls.push([input, init]); return new Response('ok'); };
  const host = { fetch: native };
  installEmbeddedFetch(host, store, error => { throw error; });
  const controller = new AbortController();
  const input = new Request(VIRTUAL_ROOT + 'data.bin', { headers: { 'x-test': 'kept' }, signal: controller.signal });
  await host.fetch(input, { credentials: 'omit' });
  const routed = calls[0][0] as Request;
  assert.match(routed.url, /^blob:/);
  assert.equal(routed.headers.get('x-test'), 'kept');
  assert.equal(routed.credentials, 'omit');
  controller.abort(); assert.equal(routed.signal.aborted, true);
  t.after(() => URL.revokeObjectURL(routed.url));
  for (const external of ['https://sdk.example/sdk.js', 'https://playable.invalid.evil/a', './local.json', 'file:///test.json', new Request('https://sdk.example/a')]) {
    const init = { cache: 'no-store' as RequestCache };
    await host.fetch(external, init);
    assert.equal(calls.at(-1)![0], external); assert.equal(calls.at(-1)![1], init);
  }
});

test('missing embedded fetch reports the filename even if the engine swallows rejection', async () => {
  const errors: Error[] = [];
  const host = { fetch: (async () => { throw new Error('must not hit network'); }) as typeof fetch };
  installEmbeddedFetch(host, new EmbeddedStore(new JSZip()), error => errors.push(error));
  await assert.rejects(host.fetch(VIRTUAL_ROOT + 'missing.wasm'), /fetch resource.*missing.wasm.*Missing/);
  assert.equal(errors.length, 1);
  await assert.rejects(host.fetch(VIRTUAL_ROOT + 'data.bin', { method: 'POST', body: 'data' }), /only support GET/);
});
