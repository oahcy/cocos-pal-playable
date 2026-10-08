import { compressImages } from './packaging/images';
import { readImageOptions, type ImageOptions } from './options';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getChannel } from './channel';
import { collect, validate } from './packaging/web-files';
import encodeDirectoryZip from './packaging/directory-zip';
import type { Entry, PackageReport } from './types';
const encoders: Record<string, (entries: Entry[]) => Promise<Buffer>> = { 'directory-zip': encodeDirectoryZip };
async function packageBuild(inputRoot: string, channelId = 'tiktok', imageOptions: ImageOptions = {}) {
  const settings = readImageOptions(imageOptions);
  const channel = getChannel(channelId);
  const encode = encoders[channel.packageFormat];
  if (!encode || channel.resourceMode !== 'files') throw new Error('Unsupported playable packaging strategy');
  const root = fs.realpathSync(inputRoot);
  const delivery = root + '-delivery';
  const marker = path.join(delivery, '.playable-owner.json');
  if (fs.existsSync(delivery)) {
    if (fs.lstatSync(delivery).isSymbolicLink() || !fs.existsSync(marker) ||
        JSON.parse(fs.readFileSync(marker, 'utf8')).source !== root) throw new Error('Delivery directory is not owned by this build: ' + delivery);
  } else {
    fs.mkdirSync(delivery);
    fs.writeFileSync(marker, JSON.stringify({ source: root }));
  }
  const archive = path.join(delivery, channel.archiveName);
  const reportFile = path.join(delivery, 'report.json');
  // Invalidate only this plugin's prior output before validating a replacement.
  if (fs.existsSync(archive)) fs.unlinkSync(archive);
  const report: PackageReport = { channel: channel.id, status: 'failed', archive, maxBytesExclusive: channel.maxBytesExclusive,
    verification: 'local-static-only', pending: [...channel.pending] };
  try {
    const originalEntries = collect(root, channel);
    validate(originalEntries, channel);
    const { entries, report: images } = await compressImages(originalEntries, settings);
    report.images = images;
    const data = await encode(entries);
    report.bytes = data.length;
    report.files = entries.map(entry => ({ path: entry.name, bytes: entry.data.length }));
    if (data.length >= channel.maxBytesExclusive) throw new Error(channel.displayName + ' ZIP must be smaller than ' + channel.maxBytesExclusive + ' bytes; got ' + data.length);
    fs.writeFileSync(archive, data);
    report.sha256 = crypto.createHash('sha256').update(data).digest('hex');
    report.status = 'packaged';
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    return report;
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    throw error;
  }
}
export { packageBuild };
