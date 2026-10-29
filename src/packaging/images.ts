import { deflateRawSync } from 'node:zlib';
import { imageFormat } from '../../runtime/embedded/image-format';
import type { Entry } from '../types';
import { readImageOptions, type ImageOptions, type ImageCompression } from '../options';

export interface ImageReport {
  mode: ImageCompression; quality: number;
  files: Array<{ path: string; before: number; after: number; status: 'compressed' | 'kept'; reason?: string; outputFormat?: 'png' | 'jpeg' | 'webp' }>;
}

function hasAnimation(data: Buffer) {
  // Some PNG decoders expose only the first APNG frame in metadata.
  for (let offset = 8; offset + 12 <= data.length;) {
    if (data.toString('ascii', offset + 4, offset + 8) === 'acTL') return true;
    offset += 12 + data.readUInt32BE(offset);
  }
  return false;
}

// Re-encode only delivery copies. Keep asset paths and dimensions so Cocos references stay valid.
export async function compressImages(entries: Entry[], options: ImageOptions = {}) {
  const { imageCompression, imageQuality } = readImageOptions(options);
  const report: ImageReport = { mode: imageCompression, quality: imageQuality, files: [] };
  if (imageCompression === 'none') return { entries, report };
  const sharp = (await import('sharp')).default;
  const output = entries.slice();
  const images = entries.map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => /\.(?:png|jpe?g|webp)$/i.test(entry.name));
  const startedAt = Date.now();
  // Keep native image processing serial to limit peak memory in Creator's build worker.
  for (const [reportIndex, { entry, index }] of images.entries()) {
    const item: ImageReport['files'][number] = { path: entry.name, before: entry.data.length, after: entry.data.length, status: 'kept' };
    const format = imageFormat(entry.data);
    const supported = format === 'png' || format === 'jpeg';
    if (!supported) {
      item.reason = 'Not a supported source image';
    } else if (format === 'png' && hasAnimation(entry.data)) {
      item.reason = 'Animated PNG';
    } else {
      const metadata = await sharp(entry.data).metadata().catch(error => {
        throw new Error('Cannot read image ' + entry.name + ': ' + (error instanceof Error ? error.message : String(error)));
      });
      if ((metadata.pages ?? 1) > 1 || metadata.depth !== 'uchar') {
        item.reason = 'Unsupported animation or bit depth';
      } else {
        const image = sharp(entry.data);
        // WebP preserves alpha and dimensions. Existing WebP is skipped to avoid repeated lossy encoding.
        let encoder;
        if (imageCompression === 'webp') encoder = image.webp({ quality: imageQuality });
        else if (format === 'jpeg') encoder = image.jpeg({ quality: imageQuality });
        else encoder = image.png({ palette: true, quality: imageQuality, compressionLevel: 9 });
        const data = await encoder.toBuffer().catch(error => {
          throw new Error('Cannot compress image ' + entry.name + ': ' + (error instanceof Error ? error.message : String(error)));
        });
        // Image size alone is insufficient: DEFLATE can reverse the saving in the ZIP.
        if (data.length < entry.data.length && deflateRawSync(data, { level: 9 }).length < deflateRawSync(entry.data, { level: 9 }).length) {
          output[index] = { name: entry.name, data };
          item.after = data.length;
          item.status = 'compressed';
          item.outputFormat = imageCompression === 'webp' ? 'webp' : format === 'jpeg' ? 'jpeg' : 'png';
        } else {
          item.reason = 'No size saving';
        }
      }
    }
    report.files.push(item);
    const completed = reportIndex + 1;
    if (completed % 10 === 0 || completed === images.length) {
      console.log(`[Playable] Image compression ${completed}/${images.length} images (${Math.round((Date.now() - startedAt) / 1000)}s).`);
    }
  }
  return { entries: output, report };
}
