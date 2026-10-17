import { defaultResources, type PackagingResources } from './resources';
import { compressImages } from './packaging/images';
import { readImageOptions, readOutputFormat, readEmbeddedEncoding, type PackageOptions } from './options';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getChannel } from './channel';
import { collect, validate } from './packaging/web-files';
import { encodeSingleHTML } from './packaging/single-html';
import encodeDirectoryZip from './packaging/directory-zip';
import type { Entry, PackageReport } from './types';
const encoders: Record<string, (entries: Entry[]) => Promise<Buffer>> = { 'directory-zip': encodeDirectoryZip };
async function packageBuild(inputRoot: string, channelId = 'tiktok', imageOptions: PackageOptions = {}, resources: PackagingResources = defaultResources) {
  const embeddedEncoding = readEmbeddedEncoding(imageOptions.embeddedEncoding);
  const settings = readImageOptions(imageOptions);
  const channel = getChannel(channelId);
  const requested = readOutputFormat(imageOptions.outputFormat);
  const format = requested === 'channel-default' ? channel.packageFormat : requested;
  if (channel.supportedFormats && !channel.supportedFormats.includes(format)) throw new Error(channel.displayName + ' does not support ' + format + '; supported formats: ' + channel.supportedFormats.join(', '));
  const channelDefaultFormat = format === channel.packageFormat;
  const encode = format === 'single-html'
    ? (entries: Entry[]) => encodeSingleHTML(entries,
      fs.readFileSync(path.join(resources.runtime, 'single-html-runtime.js'), 'utf8'), channel.sdkURL,
      path.join(resources.templates, 'single-html.ejs'), embeddedEncoding)
    : encoders[format];
  if (!encode) throw new Error('Unsupported playable packaging strategy: ' + format);
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
  const archive = path.join(delivery, channelDefaultFormat ? channel.archiveName : channel.id + '.experimental.' + (format === 'single-html' ? 'html' : 'zip'));
  const reportFile = path.join(delivery, channelDefaultFormat ? 'report.json' : format + '.report.json');
  // Invalidate only this plugin's prior output before validating a replacement.
  if (fs.existsSync(archive)) fs.unlinkSync(archive);
  const report: PackageReport = { channel: channel.id, status: 'failed', archive, maxBytesExclusive: channel.maxBytesExclusive,
    ...(format === 'single-html' ? { embeddedEncoding } : {}),
    packageFormat: format, resourceMode: format === 'single-html' ? 'embedded' : 'files', channelDefaultFormat,
    verification: 'local-static-only', pending: [...channel.pending, ...(channelDefaultFormat ? [] : ['Format verification only: not the channel default delivery format; size cap is retained conservatively'])] };
  try {
    const originalEntries = collect(root, channel);
    report.pending.push(...(channel.reviewEntries?.(originalEntries) || []));
    validate(originalEntries, channel);
    const { entries, report: images } = await compressImages(originalEntries, settings);
    report.images = images;
    const data = await encode(entries);
    report.bytes = data.length;
    report.files = entries.map(entry => ({ path: entry.name, bytes: entry.data.length }));
    if (data.length >= channel.maxBytesExclusive) throw new Error(channel.displayName + ' ' + format + ' must be smaller than ' + channel.maxBytesExclusive + ' bytes; got ' + data.length);
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
