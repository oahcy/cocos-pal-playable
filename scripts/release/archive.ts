import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { readFiles, verifyFiles } from './files';
export async function verifyArchive(file: string) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file), { checkCRC32: true });
  const files = new Map<string, Buffer>();
  for (const entry of Object.values(zip.files)) {
    if (entry.name.startsWith('/') || entry.name.includes('\\') || entry.name.split('/').includes('..') || (entry.unsafeOriginalName && entry.unsafeOriginalName !== entry.name)) throw new Error('Unsafe archive path: ' + entry.name);
    if (!entry.dir) files.set(entry.name, await entry.async('nodebuffer'));
  }
  return verifyFiles(files);
}
export async function packPlugin(input: string, output: string) {
  const files = readFiles(input), release = verifyFiles(files);
  if (path.resolve(output).startsWith(path.resolve(input) + path.sep)) throw new Error('Archive must be outside plugin directory');
  const zip = new JSZip();
  for (const [name, data] of files) zip.file(name, data, { date: new Date('2000-01-01T00:00:00Z'), createFolders: false });
  const data = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  let previous: Awaited<ReturnType<typeof verifyArchive>> | undefined;
  if (fs.existsSync(output)) {
    if (!fs.lstatSync(output).isFile() || fs.lstatSync(output).isSymbolicLink()) throw new Error('Unsafe archive destination');
    previous = await verifyArchive(output);
    const backup = fs.mkdtempSync(path.join(path.dirname(output), 'backup-'));
    fs.copyFileSync(output, path.join(backup, path.basename(output)));
  }
  // Validate the in-memory ZIP before publishing. Manifest hashes are integrity checks, not signatures.
  const unpacked = await JSZip.loadAsync(data, { checkCRC32: true });
  const checked = new Map<string, Buffer>();
  for (const entry of Object.values(unpacked.files)) checked.set(entry.name, await entry.async('nodebuffer'));
  verifyFiles(checked);
  fs.writeFileSync(output, data);
  if (previous) {
    const changes = {
      added: Object.keys(release.files).filter(name => !(name in previous!.files)),
      removed: Object.keys(previous.files).filter(name => !(name in release.files)),
      changed: Object.keys(release.files).filter(name => name in previous!.files && previous!.files[name] !== release.files[name]),
    };
    fs.writeFileSync(output + '.diff.json', JSON.stringify(changes, null, 2));
  }
  return { output, bytes: data.length, files: files.size, version: release.pluginVersion };
}
