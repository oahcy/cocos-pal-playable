import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { build } from 'esbuild';
import { chromium, type Page } from 'playwright-core';
import { compileCreatorPanel } from '../release/compile';
import { selectProfile } from '../release/profile';

const versions = ['3.5.2', '3.8.3', '3.8.8'];
const channels = ['tiktok', 'google-ads', 'applovin'];
const control = (page: Page, channel: string, key: string) => page.locator('[data-channel="' + channel + '"][data-key="' + key + '"]');
async function snapshot(page: Page) {
  return page.evaluate(() => window.panelTest.collectTask());
}
async function number(page: Page, channel: string, value: string) {
  await control(page, channel, 'imageQuality').fill(value);
  await control(page, channel, 'imageQuality').dispatchEvent('change');
}
async function checkPanel(page: Page, url: string) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(url);
  await page.waitForFunction(() => !!window.panelTest);
  assert.equal(await control(page, 'tiktok', 'enabled').isChecked(), true);
  assert.equal(await control(page, 'google-ads', 'enabled').isChecked(), false);
  assert.equal(await control(page, 'google-ads', 'imageCompression').count(), 0);

  await control(page, 'google-ads', 'enabled').check();
  await control(page, 'applovin', 'enabled').check();
  assert.match((await page.evaluate(() => window.panelTest.error())) ?? '', /store URL/);
  await assert.rejects(() => snapshot(page), /store URL/);
  await control(page, 'applovin', 'storeUrl').fill('http://example.com/store');
  await control(page, 'applovin', 'storeUrl').dispatchEvent('change');
  await assert.rejects(() => snapshot(page), /HTTPS/);
  await control(page, 'applovin', 'storeUrl').fill('https://example.com/store');
  await control(page, 'applovin', 'storeUrl').dispatchEvent('change');
  assert.equal(await page.evaluate(() => window.panelTest.error()), null);

  // Native browser actions drive the real change handler and its dispatch payload.
  await control(page, 'tiktok', 'outputFormat').selectOption('single-html');
  await control(page, 'tiktok', 'embeddedEncoding').selectOption('base122');
  await control(page, 'tiktok', 'orientation').selectOption('portrait');
  await control(page, 'tiktok', 'imageCompression').selectOption('lossy');
  await number(page, 'tiktok', '1');
  await control(page, 'google-ads', 'imageCompression').selectOption('webp');
  await number(page, 'google-ads', '60');
  await control(page, 'applovin', 'imageCompression').selectOption('webp');
  await number(page, 'applovin', '100');
  assert.equal(await control(page, 'google-ads', 'outputFormat').locator('option[value="single-html"]').count(), 0);
  assert.equal(await control(page, 'applovin', 'orientation').locator('option').count(), 1);
  const expected = await snapshot(page);
  const selected = expected.packages.playable.channels!;
  assert.equal(expected.platform, 'playable');
  assert.deepEqual(expected.packages.unrelated, { untouched: true });
  assert.equal(selected.tiktok.imageQuality, 1);
  assert.equal(selected.tiktok.imageCompression, 'lossy');
  assert.equal(selected.tiktok.outputFormat, 'single-html');
  assert.equal(selected.tiktok.embeddedEncoding, 'base122');
  assert.equal(selected.tiktok.orientation, 'portrait');
  assert.equal(selected['google-ads'].imageQuality, 60);
  assert.equal(selected['google-ads'].imageCompression, 'webp');
  assert.equal(selected.applovin.imageQuality, 100);
  assert.equal(selected.applovin.storeUrl, 'https://example.com/store');
  assert.equal(channels.every(id => selected[id].enabled === true), true);
  const events = await page.evaluate(() => window.panelTest.events);
  assert.ok(events.length > 0);
  assert.ok(events.every(event => event.name === 'update' && event.path === 'packages.playable.channels'));
  assert.deepEqual(events.at(-1)!.value, selected);

  // Reopen the page, re-execute the compiled module and restore only persisted host data.
  await page.reload();
  await page.waitForFunction(() => !!window.panelTest);
  assert.deepEqual(await snapshot(page), expected);
  assert.equal(await control(page, 'tiktok', 'imageQuality').inputValue(), '1');
  assert.equal(await control(page, 'tiktok', 'embeddedEncoding').inputValue(), 'base122');
  assert.equal(await control(page, 'google-ads', 'imageQuality').inputValue(), '60');
  assert.equal(await control(page, 'applovin', 'imageQuality').inputValue(), '100');

  await control(page, 'google-ads', 'imageCompression').selectOption('none');
  assert.equal(await control(page, 'google-ads', 'imageQuality').count(), 0);
  await control(page, 'google-ads', 'imageCompression').selectOption('webp');
  assert.equal(await control(page, 'google-ads', 'imageQuality').inputValue(), '60');
  await control(page, 'google-ads', 'enabled').uncheck();
  assert.equal(await control(page, 'google-ads', 'imageCompression').count(), 0);
  assert.equal((await snapshot(page)).packages.playable.channels!['google-ads'].enabled, false);
  await control(page, 'google-ads', 'enabled').check();
  assert.equal(await control(page, 'google-ads', 'imageQuality').inputValue(), '60');

  for (const invalid of ['0', '101', '1.5']) {
    await number(page, 'tiktok', invalid);
    assert.match((await page.evaluate(() => window.panelTest.error())) ?? '', /integer from 1 to 100/);
    await assert.rejects(() => snapshot(page), /integer from 1 to 100/);
  }
  await control(page, 'tiktok', 'enabled').uncheck();
  assert.equal(await page.evaluate(() => window.panelTest.error()), null);
  await control(page, 'tiktok', 'enabled').check();
  assert.match((await page.evaluate(() => window.panelTest.error())) ?? '', /integer from 1 to 100/);
  await number(page, 'tiktok', '1');
  for (const id of channels) await control(page, id, 'enabled').uncheck();
  await assert.rejects(() => snapshot(page), /at least one/);
  await control(page, 'tiktok', 'enabled').check();
  assert.equal(await page.evaluate(() => window.panelTest.error()), null);

  // A host update for another plugin must not replace a focused input.
  await control(page, 'tiktok', 'imageQuality').focus();
  await page.evaluate(() => {
    const host = window.panelTest;
    const options = host.snapshot(); options.packages.unrelated = { changed: true };
    host.externalUpdate(options);
  });
  assert.equal(await control(page, 'tiktok', 'imageQuality').evaluate(element => element.getRootNode() instanceof ShadowRoot && (element.getRootNode() as ShadowRoot).activeElement === element), true);
  await page.evaluate(() => {
    const host = window.panelTest;
    const options = host.snapshot(); options.packages.playable.channels!.tiktok.imageQuality = 42;
    host.externalUpdate(options);
  });
  assert.equal(await control(page, 'tiktok', 'imageQuality').inputValue(), '42');

  const beforeClose = await page.evaluate(() => ({ task: window.panelTest.snapshot(), count: window.panelTest.events.length }));
  await page.evaluate(() => window.panelTest.close());
  await number(page, 'tiktok', '50');
  assert.deepEqual(await page.evaluate(() => ({ task: window.panelTest.snapshot(), count: window.panelTest.events.length })), beforeClose);

  await page.goto(url + '&mode=check');
  await page.waitForFunction(() => !!window.panelTest);
  assert.equal(await control(page, 'tiktok', 'enabled').isDisabled(), true);
  const readOnlyBefore = await page.evaluate(() => window.panelTest.snapshot());
  await control(page, 'tiktok', 'enabled').dispatchEvent('change');
  assert.deepEqual(await page.evaluate(() => window.panelTest.snapshot()), readOnlyBefore);
  assert.deepEqual(errors, []);
}

export async function verifyPanels(browserChannel: 'chrome' | 'msedge' = 'chrome') {
  const started = performance.now();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'playable-panel-'));
  let server: http.Server | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    const bundles = new Map<string, string>();
    for (const version of versions) {
      const output = path.join(directory, version);
      await compileCreatorPanel(output, selectProfile('creator', version));
      bundles.set(version, fs.readFileSync(path.join(output, 'dist/panel.cjs'), 'utf8'));
    }
    const host = await build({ entryPoints: [path.join(__dirname, 'host.ts')], bundle: true, write: false, platform: 'browser', format: 'iife', target: 'es2017' });
    server = http.createServer((request, response) => {
      const url = new URL(request.url || '/', 'http://localhost');
      if (url.pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
      response.setHeader('Cache-Control', 'no-store');
      if (url.pathname === '/host.js') { response.setHeader('Content-Type', 'application/javascript'); response.end(host.outputFiles[0].text); return; }
      const version = url.searchParams.get('version') || '';
      if (!bundles.has(version)) { response.writeHead(404); response.end(); return; }
      if (url.pathname === '/panel.cjs') { response.setHeader('Content-Type', 'application/javascript'); response.end(bundles.get(version)); return; }
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end('<!doctype html><meta charset="utf-8"><div id="panel"></div><script>var module={exports:{}};var exports=module.exports;</script><script src="/panel.cjs?version=' + version + '"></script><script src="/host.js"></script>');
    });
    await new Promise<void>((resolve, reject) => { server!.once('error', reject); server!.listen(0, '127.0.0.1', resolve); });
    const base = 'http://127.0.0.1:' + (server.address() as import('node:net').AddressInfo).port;
    browser = await chromium.launch({ channel: browserChannel, headless: true });
    for (const version of versions) {
      const context = await browser.newContext();
      try {
        const page = await context.newPage(); page.setDefaultTimeout(5000);
        await checkPanel(page, base + '/?version=' + version);
        console.log('[Panel verify] PASS ' + version + ' compiled panel: controls, payload, persistence, validation, read-only and cleanup');
      } finally { await context.close(); }
    }
    console.log('[Panel verify] ' + versions.length + '/' + versions.length + ' passed in ' + Math.round(performance.now() - started) + ' ms (no Creator/build)');
  } finally {
    try { await browser?.close(); }
    finally {
      if (server) await new Promise<void>((resolve, reject) => { server!.close(error => error ? reject(error) : resolve()); server!.closeAllConnections(); });
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
}
