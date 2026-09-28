'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { getChannel } = require('./channel.cjs');
const { collect, validate } = require('./packaging/web-files.cjs');
const encoders = { 'directory-zip': require('./packaging/directory-zip.cjs') };
async function packageBuild(inputRoot, channelId = 'tiktok') {
  const channel = getChannel(channelId);
  const encode = encoders[channel.packageFormat];
  if (!encode || channel.resourceMode !== 'files') throw new Error('Unsupported playable packaging strategy');
  const root = fs.realpathSync(inputRoot);
  const delivery = root + '-delivery';
  const marker = path.join(delivery, '.playable-owner.json');
  if (fs.existsSync(delivery)) {
    if (fs.lstatSync(delivery).isSymbolicLink() || !fs.existsSync(marker) ||
        JSON.parse(fs.readFileSync(marker)).source !== root) throw new Error('Delivery directory is not owned by this build: ' + delivery);
  } else {
    fs.mkdirSync(delivery);
    fs.writeFileSync(marker, JSON.stringify({ source: root }));
  }
  const archive = path.join(delivery, channel.archiveName);
  const reportFile = path.join(delivery, 'report.json');
  // Invalidate only this plugin's prior output before validating a replacement.
  if (fs.existsSync(archive)) fs.unlinkSync(archive);
  const report = { channel: channel.id, status: 'failed', archive, maxBytesExclusive: channel.maxBytesExclusive,
    verification: 'local-static-only', pending: [...channel.pending] };
  try {
    const entries = collect(root, channel);
    validate(entries, channel);
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
    report.error = error.message;
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    throw error;
  }
}
module.exports = { packageBuild };
