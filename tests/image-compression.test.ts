import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import type { Entry } from '../src/types';
import JSZip from 'jszip';
import { compressImages } from '../src/packaging/images';
import { normalizeOptions } from '../src/options';
import { imageFormat } from '../runtime/embedded/image-format';
import { EmbeddedStore } from '../runtime/embedded/store';
import { encodeSingleHTML } from '../src/packaging/single-html';

async function raster() {
  const pixels = Buffer.alloc(128 * 128 * 4);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const offset = (y * 128 + x) * 4;
    pixels.set([x * 2, y * 2, (x + y) & 255, x * 2], offset);
  }
  return sharp(pixels, { raw: { width: 128, height: 128, channels: 4 } });
}

test('WebP converts PNG disguised as JPEG, preserves alpha/dimensions/paths and leaves inputs untouched', async () => {
  const original = await (await raster()).png({ compressionLevel: 0 }).toBuffer();
  const input = [{ name: 'assets/texture.jpg', data: original }];
  const { entries, report } = await compressImages(input, { imageCompression: 'webp', imageQuality: 60 });
  assert.equal(normalizeOptions({ imageCompression: 'webp' }).imageCompression, 'webp');
  assert.equal(entries[0].name, input[0].name);
  assert.equal(input[0].data, original);
  assert.equal(imageFormat(entries[0].data), 'webp');
  assert.ok(entries[0].data.length < original.length);
  const meta = await sharp(entries[0].data).metadata();
  assert.equal(meta.width, 128); assert.equal(meta.height, 128); assert.equal(meta.hasAlpha, true);
  const before = await sharp(original).ensureAlpha().raw().toBuffer();
  const after = await sharp(entries[0].data).ensureAlpha().raw().toBuffer();
  for (let i = 3; i < before.length; i += 4) assert.equal(after[i], before[i]);
  assert.equal(report.files[0].outputFormat, 'webp');
  const png = await compressImages(input, { imageCompression: 'lossy', imageQuality: 60 });
  assert.equal(imageFormat(png.entries[0].data), 'png');
});

test('WebP handles JPEG and skips existing WebP, APNG, unsupported sources', async () => {
  const jpeg = await (await raster()).flatten({ background: '#fff' }).jpeg({ quality: 100 }).toBuffer();
  const webp = await (await raster()).webp().toBuffer();
  const png = await (await raster()).png().toBuffer();
  // APNG marker is enough for the guard: do not send animation through a single-frame encoder.
  const apng = Buffer.concat([png.subarray(0, 8), Buffer.from([0, 0, 0, 0]), Buffer.from('acTL'), Buffer.alloc(4)]);
  const input = [{ name: 'photo.jpeg', data: jpeg }, { name: 'existing.webp', data: webp },
    { name: 'animated.png', data: apng }, { name: 'other.png', data: Buffer.from('not a raster') }];
  const { entries, report } = await compressImages(input, { imageCompression: 'webp', imageQuality: 60 });
  assert.equal(imageFormat(entries[0].data), 'webp');
  for (let i = 1; i < input.length; i++) assert.equal(entries[i], input[i]);
  assert.equal(report.files[2].reason, 'Animated PNG');
  const disabled = await compressImages(input);
  assert.equal(disabled.entries, input);
});

test('transcoded images use actual WebP MIME for embedded Blob and CSS despite retained PNG path', async t => {
  const bytes = await (await raster()).webp({ quality: 60 }).toBuffer();
  const zip = new JSZip().file('assets/picture.png', bytes);
  let blob: Blob | undefined;
  t.mock.method(URL, 'createObjectURL', (value: Blob) => { blob = value; return 'blob:test'; });
  const store = new EmbeddedStore(zip);
  await store.url('assets/picture.png');
  assert.equal(blob?.type, 'image/webp');
  const input: Entry[] = Object.entries({ 'index.html': '', 'index.js': 'entry', 'style.css': 'body{background:url(assets/picture.png)}',
    'playable-runtime.js': '', 'src/system.bundle.js': '', 'src/settings.json': '{}',
    'src/import-map.json': '{"imports":{"cc":"../cocos-js/cc.js"}}', 'cocos-js/cc.js': '' })
    .map(([name, value]) => ({ name, data: Buffer.from(value) }));
  input.push({ name: 'assets/picture.png', data: bytes });
  const html = (await encodeSingleHTML(input, '', '')).toString();
  assert.ok(html.includes('data:image/webp;base64,'));
});


test('PNG mode also recompresses actual JPEG while keeping PNG alpha and existing WebP', async () => {
  const original = await (await raster()).flatten({ background: '#fff' }).jpeg({ quality: 100 }).toBuffer();
  const png = await (await raster()).png().toBuffer();
  const webp = await (await raster()).webp().toBuffer();
  const input = [{ name: 'assets/photo.png', data: original }, { name: 'assets/alpha.jpg', data: png }, { name: 'assets/old.webp', data: webp }];
  const { entries, report } = await compressImages(input, { imageCompression: 'lossy', imageQuality: 40 });
  assert.equal(normalizeOptions({ imageCompression: 'lossy' }).imageCompression, 'lossy');
  assert.equal(imageFormat(entries[0].data), 'jpeg');
  assert.equal(entries[0].name, input[0].name);
  assert.ok(entries[0].data.length < original.length);
  assert.equal(input[0].data, original);
  const metadata = await sharp(entries[0].data).metadata();
  assert.equal(metadata.width, 128); assert.equal(metadata.height, 128);
  assert.equal(report.files[0].outputFormat, 'jpeg');
  assert.equal(imageFormat(entries[1].data), 'png');
  assert.equal((await sharp(entries[1].data).metadata()).hasAlpha, true);
  assert.equal(entries[2], input[2]);
});

test('PNG mode keeps an already equally compressed JPEG source instead of replacing it', async () => {
  const original = await (await raster()).flatten({ background: '#fff' }).jpeg({ quality: 1 }).toBuffer();
  const input = [{ name: 'assets/small.jpg', data: original }];
  const { entries, report } = await compressImages(input, { imageCompression: 'lossy', imageQuality: 1 });
  assert.equal(entries[0], input[0]);
  assert.equal(report.files[0].status, 'kept');
  assert.equal(report.files[0].reason, 'No size saving');
});
