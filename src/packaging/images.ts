import { deflateRawSync } from 'node:zlib';
import type { Entry, ImageOptions, ImageReport } from '../types';

export function readImageOptions(options: ImageOptions = {}) {
  const imageCompression = options.imageCompression ?? 'none';
  const imageQuality = options.imageQuality ?? 80;
  if (imageCompression !== 'none' && imageCompression !== 'lossy') throw new Error('imageCompression must be none or lossy');
  if (!Number.isInteger(imageQuality) || imageQuality < 1 || imageQuality > 100) throw new Error('imageQuality must be an integer from 1 to 100');
  return { imageCompression, imageQuality };
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
  const output: Entry[] = [];
  for (const entry of entries) {
    if (!/\.png$/i.test(entry.name)) { output.push(entry); continue; }
    const item: ImageReport['files'][number] = { path: entry.name, before: entry.data.length, after: entry.data.length, status: 'kept' };
    if (hasAnimation(entry.data)) {
      item.reason = 'Animated PNG';
      output.push(entry);
      report.files.push(item);
      continue;
    }
    const metadata = await sharp(entry.data).metadata().catch(error => {
      throw new Error('Cannot read PNG ' + entry.name, { cause: error });
    });
    if (metadata.format !== 'png' || (metadata.pages ?? 1) > 1 || metadata.depth !== 'uchar') {
      item.reason = 'Unsupported PNG format, animation or bit depth';
      output.push(entry);
    } else {
      const data = await sharp(entry.data).png({ palette: true, quality: imageQuality, compressionLevel: 9 }).toBuffer();
      // PNG size alone is insufficient: DEFLATE can reverse the saving in the ZIP.
      if (data.length < entry.data.length && deflateRawSync(data, { level: 9 }).length < deflateRawSync(entry.data, { level: 9 }).length) {
        output.push({ name: entry.name, data });
        item.after = data.length;
        item.status = 'compressed';
      } else {
        output.push(entry);
        item.reason = 'No size saving';
      }
    }
    report.files.push(item);
  }
  return { entries: output, report };
}
