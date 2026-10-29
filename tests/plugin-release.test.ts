import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { selectProfile, projectRoot } from '../scripts/release/profile';
import { createPackPlan } from '../scripts/cocos-pack';
import { generatePlugin } from '../scripts/release/generate';
import { packPlugin, verifyArchive } from '../scripts/release/archive';
import { verifyFiles, readFiles } from '../scripts/release/files';

test('unsupported Creator targets fail without generating a package', () => {
  assert.equal(selectProfile().adapter, 'cli');
  assert.throws(() => selectProfile('creator', '3.8.10'), /not adapted/);
  assert.equal(selectProfile('creator', '3.8.6').editorIntegration, 'playable-platform');
  assert.deepEqual(selectProfile('creator', '3.8.3'), selectProfile('creator', '3.8.4'));
  assert.notEqual(selectProfile('creator', '3.8.3').nodeTarget, selectProfile('creator', '3.8.5').nodeTarget);
  assert.equal(selectProfile('creator', '3.8.4').adapter, 'creator-platform');
  assert.throws(() => selectProfile('other'), /Unsupported host/);
});
test('standalone plugin carries native dependencies, validates hashes and backs up releases', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playable-release-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const plugin = path.join(root, 'plugin');
  await generatePlugin(plugin);
  const release = verifyFiles(readFiles(plugin));
  assert.equal(release.host, 'cli');
  assert.equal(JSON.parse(fs.readFileSync(path.join(plugin, 'package.json'), 'utf8')).editor, undefined);
  assert.ok(release.files['node_modules/sharp/package.json']);
  assert.ok(!fs.existsSync(path.join(plugin, 'src')));
  assert.ok(!fs.existsSync(path.join(plugin, 'tests')));
  await assert.rejects(generatePlugin(plugin), /already exists/);
  const zip = path.join(root, 'playable.zip');
  await packPlugin(plugin, zip);
  assert.equal((await verifyArchive(zip)).pluginVersion, release.pluginVersion);
  const original = fs.readFileSync(zip);
  await packPlugin(plugin, zip);
  assert.deepEqual(fs.readFileSync(zip), original);
  assert.ok(fs.readdirSync(root).some(name => name.startsWith('backup-')));
  assert.deepEqual(JSON.parse(fs.readFileSync(zip + '.diff.json', 'utf8')), { added: [], removed: [], changed: [] });
  fs.appendFileSync(path.join(plugin, 'dist/hooks.cjs'), '//changed');
  await assert.rejects(packPlugin(plugin, zip), /checksum mismatch/);
  assert.deepEqual(fs.readFileSync(zip), original);
  fs.writeFileSync(path.join(plugin, 'unexpected.txt'), 'unexpected');
  assert.throws(() => verifyFiles(readFiles(plugin)), /file set mismatch/);
});

test('all Creator versions select the standalone platform without entry switches', t => {
  for (const version of ['3.8.3', '3.8.4', '3.8.5', '3.8.6', '3.8.7', '3.8.8', '3.8.9']) {
    const profile = selectProfile('creator', version, projectRoot);
    assert.equal(profile.adapter, 'creator-platform');
    assert.equal(profile.editorIntegration, 'playable-platform');
    assert.equal(profile.nodeTarget, ['3.8.3', '3.8.4'].includes(version) ? 'node14.16' : 'node20');
    assert.ok(profile.editor?.split(' || ').includes(version));
  }
  assert.equal(selectProfile('creator', '3.8.4').adapter, 'creator-platform');
  assert.throws(() => selectProfile('cli', '3.8.3'), /CLI does not accept/);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playable-plan-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'cocos-engine-ccbuild.txt'), '3.8.3\tccbuild\n3.8.6\tccbuild\n3.8.9\tccbuild\n');
  const plan = createPackPlan(['--dry-run'], root);
  assert.deepEqual(plan.targets.map(target => target.version), ['3.8.3', '3.8.6', '3.8.9']);
  assert.throws(() => createPackPlan(['--creator-entry=web-mobile'], root), /Unknown argument/);
});

test('release commands reject the removed entry selector', () => {
  for (const command of ['generate', 'pack', 'verify']) {
    const result = spawnSync(process.execPath, [
      path.join(projectRoot, 'node_modules/tsx/dist/cli.mjs'),
      path.join(projectRoot, 'scripts/plugin.ts'), command, '--creator-entry=platform',
    ], { encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown or repeated argument/);
  }
});

test('Creator releases reject missing or mismatched Dashboard compatibility fields', () => {
  const check = (manifest: object) => {
    const data = Buffer.from(JSON.stringify(manifest));
    const files = new Map<string, Buffer>([['package.json', data]]);
    for (const name of ['dist/config.cjs', 'dist/hooks.cjs', 'dist/playable-runtime.js', 'dist/google-ads-runtime.js', 'dist/single-html-runtime.js', 'static/templates/index.ejs', 'i18n/en.js', 'i18n/zh.js']) files.set(name, Buffer.alloc(0));
    const crypto = require('node:crypto');
    files.set('playable-release.json', Buffer.from(JSON.stringify({
      schemaVersion: 1, host: 'creator', pluginVersion: '0.1.0',
      files: Object.fromEntries([...files].map(([name, bytes]) => [name, crypto.createHash('sha256').update(bytes).digest('hex')])),
    })));
    return verifyFiles(files);
  };
  assert.throws(() => check({ version: '0.1.0', editor: '3.5.2' }), /engines.creator/);
  assert.throws(() => check({ version: '0.1.0', editor: '3.5.2', engines: { creator: '>=2.0.0' } }), /engines.creator/);
  assert.equal(check({ version: '0.1.0', editor: '3.5.2', engines: { creator: '3.5.2' } }).host, 'creator');
});
