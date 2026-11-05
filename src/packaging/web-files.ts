import type { Entry, Channel } from '../types';
import fs from 'node:fs';
import path from 'node:path';
// Only these build directories and known entry files belong to the delivery package.
const roots = new Set(['assets', 'cocos-js', 'src', 'res', 'subpackages']);
// Optional hexadecimal suffixes cover names such as index.a1b2.js and style.1234.css.
const creator2RootFile = /^(?:cocos2d-js(?:-min)?\.js|physics(?:-min)?\.js|main\.js|creator2-manifest\.json)$/i;
const rootFile = /^(?:index(?:\.[\da-f]+)?\.js|application(?:\.[\da-f]+)?\.js|style(?:\.[\da-f]+)?\.css|index\.html|playable-runtime\.js)$/i;
// A local-only reference cannot be a scheme, absolute path, or fragment.
const nonLocalReference = /^(?:[a-z][a-z\d+.-]*:|[\\/#])/i;
const selfContainedReference = /^(?:data:|blob:|#)/i;
// External URLs and root-relative paths cannot be resolved within the package.
const absoluteReference = /^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/i;
// Static references in generated HTML/CSS only; these are not general-purpose parsers.
const htmlReference = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
const cssReference = /url\(\s*["']?([^"')\s]+)["']?\s*\)/gi;

function collect(root: string, channel: Channel) {
  const entries: Entry[] = [];
  function walk(directory: string, prefix: string) {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const name = prefix + item.name;
      if (item.isSymbolicLink()) throw new Error('Symlinks are not allowed: ' + name);
      const allowedAtRoot = roots.has(item.name) || rootFile.test(item.name) || creator2RootFile.test(item.name) || channel.extraRootFiles.includes(item.name);
      if (!prefix && !allowedAtRoot) continue;
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
  // Creator 3.7.0 maps prerequisite imports to named modules in bundle scripts.
  // These identifiers are resolved by SystemJS, without a network request.
  const registeredChunks = new Set<string>();
  for (const entry of entries) {
    if (!entry.name.endsWith('.js')) continue;
    const registrations = entry.data.toString().matchAll(/\bSystem\.register\s*\(\s*(["'])(chunks:\/\/\/_virtual\/[^"']+)\1\s*,/g);
    for (const match of registrations) registeredChunks.add(match[2]);
  }
  function reference(from: string, value: string, base = path.posix.dirname(from), localOnly = false) {
    if (localOnly && (!value || nonLocalReference.test(value))) {
      throw new Error('Invalid local reference in ' + from + ': ' + value);
    }
    if (!value || selfContainedReference.test(value)) return;
    if (channel.allowsReference(from, value)) return;
    if (absoluteReference.test(value)) throw new Error('External or absolute reference in ' + from + ': ' + value);
    // Queries/hashes select the same file. Decode before normalizing to catch encoded ../ paths.
    const pathname = value.split(/[?#]/)[0];
    const decoded = decodeURIComponent(pathname);
    const resolved = path.posix.normalize(path.posix.join(base, decoded));
    if (resolved.startsWith('../') || !byName.has(resolved)) throw new Error('Missing or escaping reference in ' + from + ': ' + value);
  }
  for (const entry of entries) {
    const text = /\.(?:html|css|json|js)$/i.test(entry.name) ? entry.data.toString() : '';
    if (/\.html$/i.test(entry.name)) {
      for (const match of text.matchAll(htmlReference)) {
        reference(entry.name, match[1]);
      }
    }
    if (/\.css$/i.test(entry.name)) {
      for (const match of text.matchAll(cssReference)) {
        reference(entry.name, match[1]);
      }
    }
    if (/import-map.*\.json$/i.test(entry.name)) {
      const map = JSON.parse(text) as { imports?: Record<string, string>; scopes?: Record<string, Record<string, string>> };
      const mappings = [map.imports || {}, ...Object.values(map.scopes || {})];
      for (const values of mappings) {
        for (const value of Object.values(values)) {
          if (registeredChunks.has(value)) continue;
          reference(entry.name, value);
        }
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
        // A bundle is a directory name, not a URL, path or query.
        if (!/^[^/\\?#:]+$/.test(bundle) || bundle === '.' || bundle === '..') {
          throw new Error('Invalid local bundle in ' + entry.name + ': ' + bundle);
        }
        const versionSuffix = version ? '.' + version : '';
        const bundleFiles = ['config' + versionSuffix + '.json', 'index' + versionSuffix + '.js'];
        for (const file of bundleFiles) {
          reference(entry.name + ' bundle ' + bundle, 'assets/' + bundle + '/' + file, '', true);
        }
      }
    }
  }
}

export { collect, validate };
