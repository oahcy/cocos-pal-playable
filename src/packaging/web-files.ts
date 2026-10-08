import type { Entry, Channel } from '../types';
import fs from 'node:fs';
import path from 'node:path';
const roots = new Set(['assets', 'cocos-js', 'src']);
const rootFile = /^(?:index(?:\.[\da-f]+)?\.js|application(?:\.[\da-f]+)?\.js|style(?:\.[\da-f]+)?\.css|index\.html|playable-runtime\.js)$/i;
function collect(root: string, channel: Channel) {
  const entries: Entry[] = [];
  function walk(directory: string, prefix: string) {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const name = prefix + item.name;
      if (item.isSymbolicLink()) throw new Error('Symlinks are not allowed: ' + name);
      if (!prefix && !roots.has(item.name) && !rootFile.test(item.name) && !channel.extraRootFiles.includes(item.name)) continue;
      if (item.isDirectory()) walk(path.join(directory, item.name), name + '/');
      else if (item.isFile() && !/\.map$/i.test(name) && !item.name.startsWith('.')) {
        entries.push({ name, data: fs.readFileSync(path.join(directory, item.name)) });
      }
    }
  }
  walk(root, '');
  return entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
}
function validate(entries: Entry[], channel: Channel) {
  const byName = new Map(entries.map(entry => [entry.name, entry.data]));
  for (const name of ['index.html', 'playable-runtime.js']) {
    if (!byName.has(name)) throw new Error('Missing required file: ' + name);
  }
  channel.validate(entries);
  function reference(from: string, value: string, base = path.posix.dirname(from), localOnly = false) {
    if (localOnly && (!value || /^(?:[a-z][a-z\d+.-]*:|[\\/#])/i.test(value))) {
      throw new Error('Invalid local reference in ' + from + ': ' + value);
    }
    if (!value || /^(?:data:|blob:|#)/i.test(value)) return;
    if (channel.allowsReference(from, value)) return;
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/i.test(value)) throw new Error('External or absolute reference in ' + from + ': ' + value);
    const decoded = decodeURIComponent(value.split(/[?#]/)[0]);
    const resolved = path.posix.normalize(path.posix.join(base, decoded));
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
      const map = JSON.parse(text) as { imports?: Record<string, string>; scopes?: Record<string, Record<string, string>> };
      for (const values of [map.imports || {}, ...Object.values(map.scopes || {})]) {
        for (const value of Object.values(values)) reference(entry.name, value);
      }
    }
    if (/settings.*\.json$/i.test(entry.name)) {
      const settings = JSON.parse(text);
      if (settings.assets?.server || settings.assets?.remoteBundles?.length) throw new Error('External asset configuration: ' + entry.name);
      // game.ts loads plugin scripts relative to src/, not to the settings file.
      for (const script of settings.plugins?.jsList || []) {
        reference(entry.name + ' plugins.jsList', script, 'src', true);
      }
      // Match downloader.downloadBundle's versioned config and script pair.
      const bundles = new Map<string, string | undefined>();
      for (const bundle of settings.assets?.projectBundles || []) {
        bundles.set(bundle, settings.assets?.bundleVers?.[bundle]);
      }
      for (const { bundle, version } of settings.assets?.preloadBundles || []) {
        bundles.set(bundle, version || settings.assets?.bundleVers?.[bundle]);
      }
      for (const [bundle, version] of bundles) {
        if (!/^[^/\\?#:]+$/.test(bundle) || bundle === '.' || bundle === '..') {
          throw new Error('Invalid local bundle in ' + entry.name + ': ' + bundle);
        }
        for (const file of ['config.' + (version ? version + '.' : '') + 'json', 'index.' + (version ? version + '.' : '') + 'js']) {
          reference(entry.name + ' bundle ' + bundle, 'assets/' + bundle + '/' + file, '', true);
        }
      }
    }
  }
}

export { collect, validate };
