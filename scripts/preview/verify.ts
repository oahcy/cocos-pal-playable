import path from 'node:path';
import { chromium } from 'playwright-core';
import { startPreview } from './server';

interface SceneHost { cc?: { director?: { getScene(): { name?: string } | null; getTotalFrames(): number } } }
export interface VerifyOptions { browser?: 'chrome' | 'msedge'; timeoutMs?: number }

export async function verifyPreview(archive: string, options: VerifyOptions = {}) {
  const channel = options.browser ?? 'chrome';
  const timeout = options.timeoutMs ?? 30000;
  if (!['chrome', 'msedge'].includes(channel)) throw new Error('Browser must be chrome or msedge');
  if (!Number.isInteger(timeout) || timeout <= 0) throw new Error('Timeout must be a positive integer');
  const preview = await startPreview(archive, { mockAPI: true });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ channel, headless: true, timeout });
    const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
    let rejectFailure: (error: Error) => void = () => {};
    const failure = new Promise<never>((_, reject) => { rejectFailure = reject; });
    void failure.catch(() => {});
    const fail = (message: string) => rejectFailure(new Error(message));
    page.on('pageerror', error => fail(error.message));
    page.on('console', message => { if (message.type() === 'error') fail(message.text()); });
    page.on('requestfailed', request => fail('Resource failed: ' + request.url() + ' ' + request.failure()?.errorText));
    page.on('response', response => {
      if (response.status() >= 400) fail('HTTP ' + response.status() + ': ' + response.url());
    });

    const startup = async () => {
      await page.goto(preview.url, { waitUntil: 'domcontentloaded', timeout });
      await page.waitForFunction(() => {
        const error = document.getElementById('playable-startup-error');
        if (error) throw new Error(error.textContent || 'Playable startup failed');
        return !!(window as unknown as SceneHost).cc?.director?.getScene();
      }, undefined, { timeout });
      // Require engine frames, since browser animation callbacks alone can run
      // while the game is paused or has not rendered the loaded scene.
      const frame = await page.evaluate(() => (window as unknown as SceneHost).cc!.director!.getTotalFrames());
      await page.waitForFunction(previous => {
        return (window as unknown as SceneHost).cc!.director!.getTotalFrames() >= previous + 2;
      }, frame, { timeout });
      return page.evaluate(() => (window as unknown as SceneHost).cc!.director!.getScene()!.name || '(unnamed)');
    };
    const deadline = setTimeout(() => fail('Startup timed out after ' + timeout + ' ms'), timeout);
    try {
      const scene = await Promise.race([startup(), failure]);
      return { archive: path.resolve(archive), browser: channel, scene };
    } finally { clearTimeout(deadline); }
  } finally {
    try { await browser?.close(); }
    finally { await preview.close(); }
  }
}
