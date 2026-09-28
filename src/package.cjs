'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const JSZip = require('jszip');
const { SDK_URL } = require('./channel.cjs');
const MAX_BYTES = 5000000; // Conservative decimal MB; official requirement is strictly less than 5 MB.
const roots = new Set(['assets', 'cocos-js', 'src']);
const rootFile = /^(?:index(?:\.[\da-f]+)?\.js|application(?:\.[\da-f]+)?\.js|style(?:\.[\da-f]+)?\.css|index\.html|config\.json|playable-runtime\.js)$/i;
function collect(root) {
  const entries = [];
  function walk(directory, prefix) {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const name = prefix + item.name;
      if (item.isSymbolicLink()) throw new Error('Symlinks are not allowed: ' + name);
      if (!prefix && !roots.has(item.name) && !rootFile.test(item.name)) continue;
      if (item.isDirectory()) walk(path.join(directory, item.name), name + '/');
      else if (item.isFile() && !/\.map$/i.test(name) && !item.name.startsWith('.')) {
        entries.push({ name, data: fs.readFileSync(path.join(directory, item.name)) });
      }
    }
  }
  walk(root, '');
  return entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
}
function validate(entries) {
  const byName = new Map(entries.map(entry => [entry.name, entry.data]));
  for (const name of ['index.html', 'config.json', 'playable-runtime.js']) {
    if (!byName.has(name)) throw new Error('Missing required file: ' + name);
  }
  const config = JSON.parse(byName.get('config.json'));
  if (![0, 1, 2].includes(config.Playable_orientation)) throw new Error('Invalid Playable_orientation');
  const html = byName.get('index.html').toString();
  if (!html.includes('src="' + SDK_URL + '"')) throw new Error('Missing official TikTok SDK');
  if (html.indexOf(SDK_URL) > html.indexOf('src="./playable-runtime.js"')) throw new Error('SDK must load before runtime');
  function reference(from, value) {
    if (!value || /^(?:data:|blob:|#)/i.test(value)) return;
    if (value === SDK_URL && from === 'index.html') return;
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/i.test(value)) throw new Error('External or absolute reference in ' + from + ': ' + value);
    const decoded = decodeURIComponent(value.split(/[?#]/)[0]);
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(from), decoded));
    if (resolved.startsWith('../') || !byName.has(resolved)) throw new Error('Missing or escaping reference in ' + from + ': ' + value);
  }
  for (const entry of entries) {
    const text = /\.(?:html|css|json|js)$/i.test(entry.name) ? entry.data.toString() : '';
    if (/\.html$/i.test(entry.name)) {
      for (const match of text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) reference(entry.name, match[1]);
    }
    if (/\.css$/i.test(entry.name)) {
      for (const match of text.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/gi)) reference(entry.name, match[1]);
    }
    if (/import-map.*\.json$/i.test(entry.name)) {
      const map = JSON.parse(text);
      for (const values of [map.imports || {}, ...Object.values(map.scopes || {})]) {
        for (const value of Object.values(values)) reference(entry.name, value);
      }
    }
    if (/settings.*\.json$/i.test(entry.name)) {
      const settings = JSON.parse(text);
      if (settings.assets?.server || settings.assets?.remoteBundles?.length) throw new Error('External asset configuration: ' + entry.name);
    }
    if (/\bmraid\s*\./.test(text) || /mraid\.js/i.test(text)) throw new Error('MRAID is not allowed: ' + entry.name);
  }
}
async function packageBuild(inputRoot) {
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
  const archive = path.join(delivery, 'tiktok.zip');
  const reportFile = path.join(delivery, 'report.json');
  // Invalidate only this plugin's prior output before validating a replacement.
  if (fs.existsSync(archive)) fs.unlinkSync(archive);
  const report = { channel: 'tiktok', status: 'failed', archive, maxBytesExclusive: MAX_BYTES,
    verification: 'local-static-only', pending: ['TikTok official preview', 'device/container lifecycle', 'package-local HTTP loading', 'dynamic network requests', 'sound and safe areas'] };
  try {
    const entries = collect(root);
    validate(entries);
    const zip = new JSZip();
    for (const entry of entries) zip.file(entry.name, entry.data, { date: new Date('2000-01-01T00:00:00Z'), createFolders: false });
    const data = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    report.bytes = data.length;
    report.files = entries.map(entry => ({ path: entry.name, bytes: entry.data.length }));
    if (data.length >= MAX_BYTES) throw new Error('TikTok ZIP must be smaller than ' + MAX_BYTES + ' bytes; got ' + data.length);
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
module.exports = { packageBuild, collect, validate, MAX_BYTES };
