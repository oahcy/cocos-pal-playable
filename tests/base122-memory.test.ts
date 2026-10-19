import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildSync } from 'esbuild';
import { runInNewContext } from 'node:vm';

test('archive codecs round-trip large payloads within a bounded heap and preserve Base122 encoding', () => {
  // Run bundled JS in isolation so the heap limit measures the codec, not the TS/test runner.
  // The previous per-character array implementation exhausts this heap at 16 MiB input.
  const code = buildSync({ entryPoints: [path.join(__dirname, '../runtime/embedded/embedded-codec.ts')],
    bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
  const result = spawnSync(process.execPath, ['--max-old-space-size=128', '-e', code + `
    const assert = require('node:assert/strict');
    const { randomBytes, createHash } = require('node:crypto');
    const codec = module.exports;
    const reference = Buffer.from(Array.from({ length: 131071 }, (_, i) => (i * 37 + (i >>> 8)) & 255));
    assert.equal(createHash('sha256').update(codec.encodeArchive(reference, 'base122')).digest('hex'),
      '1cdfe747fe32993cb4141670601781817ca4ca009d7dd54c59748154a2345ec1');
    const input = randomBytes(16 * 1024 * 1024 + 3);
    for (const encoding of codec.embeddedEncodings) {
      const text = codec.encodeArchive(input, encoding);
      assert.deepEqual(Buffer.from(codec.decodeArchive(text, encoding)), input);
    }
    console.log('bounded-heap round-trip passed');
  `], { encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /bounded-heap round-trip passed/);
});

// Track ArrayBuffer allocations independently of GC timing or the machine's RAM.
test('Base122 decoding uses one archive-sized buffer without a second output copy', () => {
  const code = buildSync({ entryPoints: [path.join(__dirname, '../runtime/embedded/base122.ts')],
    bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
  const allocated: number[] = [];
  const tracked = new Proxy(Uint8Array, { construct(target, args) {
    const bytes = Reflect.construct(target, args) as Uint8Array;
    allocated.push(bytes.byteLength);
    const slice = bytes.slice.bind(bytes);
    bytes.slice = (start, end) => { const copy = slice(start, end); allocated.push(copy.byteLength); return copy; };
    return bytes;
  } });
  const module = { exports: {} as typeof import('../runtime/embedded/base122') };
  runInNewContext(code, { module, Uint8Array: tracked });
  const input = Buffer.alloc(1024 * 1024 + 3, 0xfe);
  const text = module.exports.encodeBase122(input);
  allocated.length = 0;
  assert.deepEqual(Buffer.from(module.exports.decodeBase122(text)), input);
  assert.deepEqual(allocated, [input.byteLength]);
});
