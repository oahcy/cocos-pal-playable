import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderPlayableTemplate } from '../src/template';
import { normalizeOptions } from '../src/options';
import { getChannel } from '../src/channel';
import { defaultResources } from '../src/resources';
import type { BuildContext, InitializedOptions, BuildResult } from '../src/adapters/cli/builder-types';

test('shared template accepts explicit resources and plain inputs without host mutation', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playable-template-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const resources = { templates: path.join(root, 'templates'), runtime: path.join(root, 'runtime') };
  fs.cpSync(defaultResources.templates, resources.templates, { recursive: true });
  fs.mkdirSync(resources.runtime);
  fs.writeFileSync(path.join(resources.runtime, 'playable-runtime.js'), 'customRuntime()');
  const input = Object.freeze({ root, applicationJS: path.join(root, 'application space.js'),
    systemJs: path.join(root, 'system.js'), importMap: path.join(root, 'map.json'), orientation: 'portrait' as const });
  const settings = Object.freeze({ imageQuality: 60, embeddedEncoding: 'base122' as const });
  assert.equal(normalizeOptions(settings).imageQuality, 60);
  assert.deepEqual(settings, { imageQuality: 60, embeddedEncoding: 'base122' });
  const files = await renderPlayableTemplate(input, getChannel('tiktok'), async source => {
    assert.ok(source.includes('application%20space.js')); return 'compiled()';
  }, resources);
  assert.equal(files.find(file => file.name === 'playable-runtime.js')!.data.toString(), 'customRuntime()');
  assert.equal(fs.existsSync(path.join(root, 'index.html')), false);
  await assert.rejects(renderPlayableTemplate(input, getChannel('tiktok'), async () => undefined, resources), /compile playable bootstrap/);
});

test('compiled CLI template adapter maps compiler context and writes expected outputs', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playable-cli-template-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const { onBeforeCopyBuildTemplate } = require('../dist/hooks.cjs') as typeof import('../src/adapters/cli/hooks');
  class HostPaths {
    get dir() { return root; }
    get applicationJS() { return path.join(root, 'application.js'); }
    get systemJs() { return path.join(root, 'system.js'); }
    get importMap() { return path.join(root, 'import-map.json'); }
  }
  const result = { paths: new HostPaths() } as BuildResult;
  const options = { packages: { playable: { orientation: 'portrait' } }, md5CacheOptions: { includes: [], excludes: [], replaceOnly: [] } } as unknown as InitializedOptions;
  const context: BuildContext = { buildExitRes: {}, utils: { async transformCode(source, format) {
    assert.ok(source.includes('application.js')); assert.equal(format.importMapFormat, 'systemjs'); return 'compiled()';
  } } };
  await onBeforeCopyBuildTemplate.call(context, options, result);
  assert.equal(fs.readFileSync(result.paths.indexJs, 'utf8'), 'compiled()');
  assert.ok(fs.readFileSync(result.paths.indexHTML, 'utf8').includes(getChannel('tiktok').sdkURL));
  assert.deepEqual(fs.readFileSync(path.join(root, 'playable-runtime.js')), fs.readFileSync(path.join(defaultResources.runtime, 'playable-runtime.js')));
  assert.ok(options.md5CacheOptions.includes.includes('index.js'));
});
