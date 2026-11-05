import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';
import { channelIds, getChannel } from '../src/channel';

test('SDK demo command generates minimal official-SDK artifacts for all channels', async t => {
  const root = path.resolve(__dirname, '..');
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'playable-sdk-demo-'));
  t.after(() => fs.rmSync(output, { recursive: true, force: true }));
  const storeUrl = 'https://example.com/demo-test';
  const configFile = path.join(output, 'config.json');
  fs.writeFileSync(configFile, JSON.stringify({ title: 'SDK Test Config', storeUrl, outputDirectory: output }));
  execFileSync(process.execPath, [
    path.join(root, 'node_modules/tsx/dist/cli.mjs'),
    path.join(root, 'scripts/sdk-demo.ts'), '--config=' + configFile,
  ], { cwd: root, stdio: 'pipe', windowsHide: true });

  for (const id of channelIds) {
    const channel = getChannel(id);
    const file = path.join(output, 'playable-' + id, channel.archiveName);
    const data = fs.readFileSync(file);
    assert.ok(data.length < channel.maxBytesExclusive);
    let html: string, runtime: string;
    if (channel.packageFormat === 'directory-zip') {
      const zip = await JSZip.loadAsync(data, { checkCRC32: true });
      assert.deepEqual(Object.keys(zip.files).sort(),
        ['index.html', 'playable-runtime.js', ...(id === 'tiktok' ? ['config.json'] : [])].sort());
      html = await zip.file('index.html')!.async('string');
      runtime = await zip.file('playable-runtime.js')!.async('string');
    } else {
      html = data.toString();
      runtime = html.match(/<script data-playable-runtime>([\s\S]*?)<\/script>/)![1];
      assert.equal([...html.matchAll(/<script\b[^>]*\bsrc=/g)].length, 1);
      assert.ok(runtime.includes(storeUrl));
    }
    assert.ok(html.includes('<title>SDK Test Config</title>'));
    assert.ok(html.includes('src="' + channel.sdkURL + '"'));
    assert.equal([...html.matchAll(/<script data-playable-runtime\b/g)].length, 1);
    for (const button of ['download', 'finish', 'read', 'subscribe', 'unsubscribe']) {
      assert.ok(html.includes('id="' + button + '"'));
    }
    assert.equal(runtime.includes('__preview/mock-api.js'), false);
    if (id === 'google-ads') assert.ok(runtime.includes('ExitApi.exit()'));
  }
});
