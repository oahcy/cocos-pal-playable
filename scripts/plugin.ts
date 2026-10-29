import path from 'node:path';
import { generatePlugin } from './release/generate';
import { packPlugin, verifyArchive } from './release/archive';
import { projectRoot, selectProfile } from './release/profile';
import { readFiles, verifyFiles } from './release/files';
async function main() {
  const [command, ...args] = process.argv.slice(2);
  const options: Record<string, string> = {};
  let dryRun = false;
  for (const arg of args) {
    if (arg === '--dry-run') { dryRun = true; continue; }
    const match = /^--(out|input|host|creator-version)=(.+)$/.exec(arg);
    if (!match || options[match[1]]) throw new Error('Unknown or repeated argument: ' + arg);
    options[match[1]] = match[2];
  }
  if (command !== 'generate' && (options.host || options['creator-version'])) {
    throw new Error('Host and Creator version options are only supported by generate; pack and verify use the existing plugin manifest');
  }
  if (command === 'generate') {
    const host = options.host || 'cli';
    const profile = selectProfile(host, options['creator-version'], projectRoot);
    if (!options.out) throw new Error('generate requires --out=<fresh plugin directory>');
    const output = path.resolve(options.out);
    if (dryRun) { console.log({ command, profile, output }); return; }
    console.log('Generated plugin:', await generatePlugin(output, host, options['creator-version']));
  } else if (command === 'pack') {
    if (!options.input || !options.out) throw new Error('pack requires --input=<plugin directory> --out=<zip>');
    if (dryRun) { const release = verifyFiles(readFiles(path.resolve(options.input))); console.log({ command, version: release.pluginVersion, output: path.resolve(options.out) }); return; }
    console.log(await packPlugin(path.resolve(options.input), path.resolve(options.out)));
  } else if (command === 'verify') {
    if (!options.input || dryRun) throw new Error('verify requires --input=<zip>');
    const release = await verifyArchive(path.resolve(options.input));
    console.log({ verified: true, version: release.pluginVersion, files: Object.keys(release.files).length, host: release.host, platform: release.platform, arch: release.arch });
  } else throw new Error('Usage: npm run plugin -- generate|pack|verify --input=... --out=... [--host=cli] [--dry-run]');
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
