import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createPackPlan, executePackPlan } from '../scripts/cocos-pack';
import { readFiles } from '../scripts/release/files';
import { verifyArchive } from '../scripts/release/archive';

function fixture(t: { after(fn: () => void): void }): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playable-cocos-pack-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'cocos-engine-ccbuild.txt'),
    '3.8.5\tccbuild\t2.2.19\n3.8.3\tccbuild\t2.2.9\n3.8.4\tccbuild\t2.2.11\n3.8.3\tccbuild\t2.2.9\n3.8.6\tccbuild\t2.3.16\n');
  return root;
}

test('cocos-pack planning deduplicates and filters known versions without writing files', async t => {
  const root = fixture(t);
  const plan = createPackPlan(['--dry-run'], root);
  assert.equal(createPackPlan(['--root=' + root, '--dry-run']).root, root);
  assert.throws(() => createPackPlan(['--root=' + root, '--root=' + root]), /Repeated option/);
  assert.deepEqual(plan.targets.map(target => target.version), ['3.8.3', '3.8.4', '3.8.5', '3.8.6']);
  assert.equal(new Set(plan.targets.map(target => target.profile)).size, 2);
  await executePackPlan(plan);
  assert.deepEqual(fs.readdirSync(root), ['cocos-engine-ccbuild.txt']);
  assert.deepEqual(createPackPlan(['--from=3.8.4', '--to=3.8.5'], root).targets.map(target => target.version), ['3.8.4', '3.8.5']);
  assert.equal(createPackPlan(['3.8.6'], root).targets[0].profile, 'creator-platform');
  assert.throws(() => createPackPlan(['3.8.9'], root), /missing from/);
  assert.throws(() => createPackPlan(['--from=3.8.5', '--to=3.8.3'], root), /Invalid version range/);
  assert.throws(() => createPackPlan(['--from=3.8.10'], root), /No adapted/);
  assert.throws(() => createPackPlan(['--from=3.8.3', '--from=3.8.4'], root), /Repeated option/);
  assert.throws(() => createPackPlan(['--unknown'], root), /Unknown argument/);
});

test('cocos-pack refuses to replace an unowned plugin directory', async t => {
  const root = fixture(t);
  const directory = path.join(root, 'v3.8.3', 'playable');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'keep.txt'), 'user file');
  await assert.rejects(executePackPlan(createPackPlan(['3.8.3'], root)), /Missing plugin release manifest/);
  assert.equal(fs.readFileSync(path.join(directory, 'keep.txt'), 'utf8'), 'user file');
  assert.equal(fs.existsSync(path.join(root, 'CocosPack')), false);
});

test('cocos-pack generates all shared targets, verifies ZIPs and backs up replacements', async t => {
  const root = fixture(t);
  const plan = createPackPlan([], root);
  await executePackPlan(plan);
  const expected = new Map<string, ReturnType<typeof readFiles>>();
  for (const target of plan.targets) {
    if (!expected.has(target.profile)) expected.set(target.profile, readFiles(target.directory));
    assert.deepEqual(readFiles(target.directory), expected.get(target.profile));
    assert.equal((await verifyArchive(target.archive)).profile, target.profile);
  }
  const archive = plan.targets[2].archive;
  const previous = fs.readFileSync(archive);
  await executePackPlan(createPackPlan(['3.8.5'], root));
  assert.deepEqual(fs.readFileSync(archive), previous);
  assert.ok(fs.readdirSync(path.dirname(archive)).some(name => name.startsWith('backup-')));
  assert.deepEqual(JSON.parse(fs.readFileSync(archive + '.diff.json', 'utf8')), { added: [], removed: [], changed: [] });
});


test('cocos-pack always generates independent playable platforms', async t => {
  const root = fixture(t);
  const plan = createPackPlan(['3.8.4', '3.8.6'], root);
  await executePackPlan(plan);
  for (const target of plan.targets) {
    const config = require(path.join(target.directory, 'dist/config.cjs'));
    assert.deepEqual(Object.keys(config.configs), ['playable']);
    const release = await verifyArchive(target.archive);
    assert.equal(release.profile, target.profile);
    assert.equal(release.editorIntegration, 'playable-platform');
  }
});
