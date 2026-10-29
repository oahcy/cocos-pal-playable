import fs from 'node:fs';
import path from 'node:path';
import { projectRoot, selectProfile } from './release/profile';
import { generatePlugin } from './release/generate';
import { packPlugin, verifyArchive } from './release/archive';
import { readFiles, verifyFiles } from './release/files';

interface Target { version: string; profile: string; directory: string; archive: string }
export interface PackPlan { root: string; dryRun: boolean; targets: Target[] }
const versionPattern = /^\d+\.\d+\.\d+$/;

function compareVersions(left: string, right: string): number {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/** Planning is read-only: versions come from cocos-pack, support comes from the plugin. */
export function createPackPlan(args: string[], root = path.resolve(projectRoot, '../cocos-pack')): PackPlan {
  const rootOptions = args.filter(argument => argument.startsWith('--root='));
  if (rootOptions.length > 1) throw new Error('Repeated option: root');
  if (rootOptions.length) {
    const value = rootOptions[0].slice('--root='.length);
    if (!value) throw new Error('Missing cocos-pack root');
    root = path.resolve(value);
    args = args.filter(argument => !argument.startsWith('--root='));
  }
  root = fs.realpathSync(root);
  let from: string | undefined;
  let to: string | undefined;
  let dryRun = false;
  const requested: string[] = [];
  for (const argument of args) {
    if (argument === '--dry-run') { dryRun = true; continue; }
    const option = /^--(from|to)=(.+)$/.exec(argument);
    if (option) {
      const value = option[2];
      if (!versionPattern.test(value)) throw new Error('Invalid version: ' + value);
      if (option[1] === 'from' && from === undefined) from = value;
      else if (option[1] === 'to' && to === undefined) to = value;
      else throw new Error('Repeated option: ' + option[1]);
    } else if (versionPattern.test(argument)) requested.push(argument);
    else throw new Error('Unknown argument: ' + argument);
  }
  if (from && to && compareVersions(from, to) > 0) throw new Error('Invalid version range');

  const versions = new Set(fs.readFileSync(path.join(root, 'cocos-engine-ccbuild.txt'), 'utf8')
    .split(/\r?\n/).map(line => line.split('\t')[0].trim()).filter(value => versionPattern.test(value)));
  const compatibility = JSON.parse(fs.readFileSync(path.join(projectRoot, 'compatibility.json'), 'utf8'));
  // Explicit unsupported versions are errors; default/range selection uses only adapted versions.
  for (const version of requested) {
    if (!versions.has(version)) throw new Error('Version is missing from cocos-engine-ccbuild.txt: ' + version);
    selectProfile('creator', version, projectRoot);
  }
  const adaptedVersions = compatibility.creatorVersions;
  const candidates = requested.length ? [...new Set(requested)]
    : [...versions].filter(version => Object.prototype.hasOwnProperty.call(adaptedVersions, version));
  const selected = candidates.filter(version => (!from || compareVersions(version, from) >= 0)
    && (!to || compareVersions(version, to) <= 0)).sort(compareVersions);
  if (!selected.length) throw new Error('No adapted Creator versions matched');
  const targets = selected.map(version => ({
    version,
    profile: selectProfile('creator', version, projectRoot).id,
    directory: path.join(root, 'v' + version, 'playable'),
    archive: path.join(root, 'CocosPack', 'v' + version + '-playable.zip'),
  }));
  return { root, dryRun, targets };
}

function checkExistingDirectory(directory: string): void {
  if (!fs.existsSync(directory)) return;
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Unsafe directory: ' + directory);
}

/** Use existing release integrity checks and backups; do not merge into engine/platform packages. */
export async function executePackPlan(plan: PackPlan): Promise<void> {
  for (const target of plan.targets) {
    console.log(`[Playable] ${target.version} -> ${target.profile} -> ${target.archive}`);
  }
  if (plan.dryRun) return;

  // Preflight all targets before generating or replacing any version's files.
  checkExistingDirectory(path.join(plan.root, 'CocosPack'));
  for (const target of plan.targets) {
    checkExistingDirectory(path.dirname(target.directory));
    checkExistingDirectory(target.directory);
    if (fs.existsSync(target.directory)) {
      const release = verifyFiles(readFiles(target.directory));
      const manifest = JSON.parse(fs.readFileSync(path.join(target.directory, 'package.json'), 'utf8'));
      if (release.host !== 'creator' || manifest.name !== 'playable') throw new Error('Not a Creator Playable plugin: ' + target.directory);
    }
    if (fs.existsSync(target.archive)) await verifyArchive(target.archive);
  }

  // Stage on the output volume so the final directory rename also works across drives.
  const local = path.join(plan.root, '.local');
  checkExistingDirectory(local);
  fs.mkdirSync(local, { recursive: true });
  const run = fs.mkdtempSync(path.join(local, 'cocos-pack-'));
  const generated = new Map<string, string>();
  for (const target of plan.targets) {
    if (generated.has(target.profile)) continue;
    const directory = path.join(run, target.profile);
    await generatePlugin(directory, 'creator', target.version);
    generated.set(target.profile, directory);
  }

  for (const target of plan.targets) {
    // Prepare and verify a complete replacement before moving the existing version directory.
    fs.mkdirSync(path.dirname(target.directory), { recursive: true });
    const prepared = path.join(run, 'prepared-' + target.version);
    fs.cpSync(generated.get(target.profile)!, prepared, { recursive: true });
    verifyFiles(readFiles(prepared));
    const backup = path.join(run, 'backup-' + target.version);
    const hadPrevious = fs.existsSync(target.directory);
    if (hadPrevious) fs.renameSync(target.directory, backup);
    try {
      fs.renameSync(prepared, target.directory);
    } catch (error) {
      if (hadPrevious) fs.renameSync(backup, target.directory);
      throw error;
    }
    if (hadPrevious) console.log('[Playable] Previous plugin directory: ' + backup);
    // packPlugin verifies contents, backs up an existing ZIP, and writes its file diff.
    const result = await packPlugin(target.directory, target.archive);
    await verifyArchive(result.output);
    console.log(`[Playable] Verified ${result.output} (${result.bytes} bytes).`);
  }
}

if (require.main === module) {
  void Promise.resolve().then(() => executePackPlan(createPackPlan(process.argv.slice(2))))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
