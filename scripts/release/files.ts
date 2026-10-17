import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
export function readFiles(root: string): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  function visit(directory: string) {
    for (const name of fs.readdirSync(directory).sort()) {
      const file = path.join(directory, name), stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) throw new Error('Symlink in plugin payload: ' + file);
      if (stat.isDirectory()) visit(file);
      else if (stat.isFile()) files.set(path.relative(root, file).split(path.sep).join('/'), fs.readFileSync(file));
      else throw new Error('Unsupported plugin file: ' + file);
    }
  }
  visit(root); return files;
}
export const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
export const releaseFile = 'playable-release.json';
export interface Release { schemaVersion: number; pluginVersion: string; host: string; profile: string; nodeTarget: string; platform: string; arch: string; files: Record<string, string> }
export function verifyFiles(files: Map<string, Buffer>): Release {
  const metadata = files.get(releaseFile);
  if (!metadata) throw new Error('Missing plugin release manifest');
  const release = JSON.parse(metadata.toString()) as Release;
  if (release.schemaVersion !== 1 || !release.files || !release.pluginVersion) throw new Error('Invalid plugin release manifest');
  const actual = [...files.keys()].filter(name => name !== releaseFile).sort();
  const expected = Object.keys(release.files).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Plugin file set mismatch');
  for (const name of actual) if (hash(files.get(name)!) !== release.files[name]) throw new Error('Plugin checksum mismatch: ' + name);
  for (const name of ['package.json', 'dist/config.cjs', 'dist/hooks.cjs', 'dist/playable-runtime.js', 'dist/google-ads-runtime.js', 'dist/single-html-runtime.js', 'static/templates/index.ejs', 'i18n/en.js', 'i18n/zh.js', ...(release.host === 'cli' ? ['node_modules/sharp/package.json'] : [])]) {
    if (!files.has(name)) throw new Error('Missing required plugin file: ' + name);
  }
  const manifest = JSON.parse(files.get('package.json')!.toString());
  if (manifest.version !== release.pluginVersion) throw new Error('Plugin version mismatch');
  return release;
}
