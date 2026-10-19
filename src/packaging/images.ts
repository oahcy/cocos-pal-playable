import { deflateRawSync } from 'node:zlib';
import type { Entry } from '../types';
import { readImageOptions, type ImageOptions } from '../options';

export interface ImageReport {
  mode: 'none' | 'lossy'; quality: number;
  files: Array<{ path: string; before: number; after: number; status: 'compressed' | 'kept'; reason?: string }>;
}

function hasAnimation(data: Buffer) {
  // Some PNG decoders expose only the first APNG frame in metadata.
  for (let offset = 8; offset + 12 <= data.length;) {
    if (data.toString('ascii', offset + 4, offset + 8) === 'acTL') return true;
    offset += 12 + data.readUInt32BE(offset);
  }
  return false;
}

// Quantize PNG colours only at delivery time. Original build assets remain untouched.
export async function compressImages(entries: Entry[], options: ImageOptions = {}) {
  const { imageCompression, imageQuality } = readImageOptions(options);
  const report: ImageReport = { mode: imageCompression, quality: imageQuality, files: [] };
  if (imageCompression === 'none') return { entries, report };
  const sharp = (await import('sharp')).default;
  const output = entries.slice();
  const pngEntries = entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => /\.png$/i.test(entry.name));
  const startedAt = Date.now();
  // Keep native image processing serial to limit peak memory in Creator's build worker.
  for (const [reportIndex, { entry, index }] of pngEntries.entries()) {
    const item: ImageReport['files'][number] = { path: entry.name, before: entry.data.length, after: entry.data.length, status: 'kept' };
    if (hasAnimation(entry.data)) {
      item.reason = 'Animated PNG';
    } else {
      const metadata = await sharp(entry.data).metadata().catch(error => {
        throw new Error('Cannot read PNG ' + entry.name + ': ' + (error instanceof Error ? error.message : String(error)));
      });
      if (metadata.format !== 'png' || (metadata.pages ?? 1) > 1 || metadata.depth !== 'uchar') {
        item.reason = 'Unsupported PNG format, animation or bit depth';
      } else {
        const data = await sharp(entry.data).png({ palette: true, quality: imageQuality, compressionLevel: 9 }).toBuffer().catch(error => {
          throw new Error('Cannot compress PNG ' + entry.name + ': ' + (error instanceof Error ? error.message : String(error)));
        });
        // PNG size alone is insufficient: DEFLATE can reverse the saving in the ZIP.
        if (data.length < entry.data.length && deflateRawSync(data, { level: 9 }).length < deflateRawSync(entry.data, { level: 9 }).length) {
          output[index] = { name: entry.name, data };
          item.after = data.length;
          item.status = 'compressed';
        } else {
          item.reason = 'No size saving';
        }
      }
    }
    report.files.push(item);
    const completed = reportIndex + 1;
    if (completed % 10 === 0 || completed === pngEntries.length) {
      console.log(`[Playable] Image compression ${completed}/${pngEntries.length} PNGs (${Math.round((Date.now() - startedAt) / 1000)}s).`);
    }
  }
  return { entries: output, report };
}
