import path from 'node:path';
import { chromium } from 'playwright-core';
import { compileMockAPI, startPreview } from './server';
import { EngineLogCheck } from './verify-logs';

interface SceneHost { cc?: { ENGINE_VERSION?: string; director?: { getScene(): { name?: string } | null; getTotalFrames(): number } } }
export interface VerifyOptions { browser?: 'chrome' | 'msedge'; timeoutMs?: number; expectedVersion?: string; onLog?: (type: string, text: string) => void }

export interface VerifyTimings { prepareMs: number; sceneMs: number; framesMs: number; cleanupMs: number; totalMs: number }

export class PreviewVerificationError extends Error {
  constructor(message: string, readonly timings: VerifyTimings) { super(message); }
}

/** One browser and Mock bundle, with a fresh isolated context for every artifact. */
export async function createPreviewVerifier(options: Pick<VerifyOptions, 'browser' | 'timeoutMs'> = {}) {
  const channel = options.browser ?? 'chrome';
  const timeout = options.timeoutMs ?? 30000;
  if (!['chrome', 'msedge'].includes(channel)) throw new Error('Browser must be chrome or msedge');
  if (!Number.isInteger(timeout) || timeout <= 0) throw new Error('Timeout must be a positive integer');
  const setupStart = performance.now();
  const compileStart = performance.now();
  const mockAPIScript = await compileMockAPI();
  const mockCompileMs = Math.round(performance.now() - compileStart);
  const launchStart = performance.now();
  const browser = await chromium.launch({ channel, headless: true, timeout });
  const setupTimings = { mockCompileMs, browserLaunchMs: Math.round(performance.now() - launchStart), totalMs: Math.round(performance.now() - setupStart) };

  async function verify(archive: string, item: Pick<VerifyOptions, 'expectedVersion' | 'onLog'> = {}) {
    const started = performance.now();
    const timings: VerifyTimings = { prepareMs: 0, sceneMs: 0, framesMs: 0, cleanupMs: 0, totalMs: 0 };
    let phase: 'prepareMs' | 'sceneMs' | 'framesMs' = 'prepareMs';
    let phaseStart = started;
    const finishPhase = () => { timings[phase] = Math.round(performance.now() - phaseStart); };
    let preview: Awaited<ReturnType<typeof startPreview>> | undefined;
    let context: Awaited<ReturnType<typeof browser.newContext>> | undefined;
    let result: { archive: string; browser: string; scene: string; engineVersion: string; versionSource: string } | undefined;
    let caught: unknown;
    try {
      const engineLogs = new EngineLogCheck(item.expectedVersion);
      preview = await startPreview(archive, { mockAPI: true, mockAPIScript });
      context = await browser.newContext({ viewport: { width: 720, height: 1280 } });
      const page = await context.newPage();
      finishPhase();
      phase = 'sceneMs';
      phaseStart = performance.now();
      let rejectFailure: (error: Error) => void = () => {};
      const failure = new Promise<never>((_, reject) => { rejectFailure = reject; });
      void failure.catch(() => {});
      const fail = (message: string) => rejectFailure(new Error(message));
      page.on('pageerror', error => fail(error.message));
      page.on('console', message => {
        const text = message.text();
        item.onLog?.(message.type(), text);
        engineLogs.observe(text);
        if (message.type() === 'error') fail(text);
      });
      page.on('requestfailed', request => fail('Resource failed: ' + request.url() + ' ' + request.failure()?.errorText));
      page.on('response', response => {
        if (response.status() >= 400) fail('HTTP ' + response.status() + ': ' + response.url());
      });

      const startup = async () => {
        await page.goto(preview!.url, { waitUntil: 'domcontentloaded', timeout });
        await page.waitForFunction(() => {
          const error = document.getElementById('playable-startup-error');
          if (error) throw new Error(error.textContent || 'Playable startup failed');
          return !!(window as unknown as SceneHost).cc?.director?.getScene();
        }, undefined, { timeout });
        finishPhase();
        phase = 'framesMs';
        phaseStart = performance.now();
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
        const runtimeVersion = await page.evaluate(() => (window as unknown as SceneHost).cc?.ENGINE_VERSION);
        const hasBanner = engineLogs.hasBanner;
        const engineVersion = engineLogs.verify(runtimeVersion);
        const versionSource = hasBanner ? (runtimeVersion ? 'banner+runtime' : 'banner') : 'runtime';
        item.onLog?.('info', '[Verify] cc.ENGINE_VERSION=' + String(runtimeVersion) + '; version source=' + versionSource);
        result = { archive: path.resolve(archive), browser: channel, scene, engineVersion, versionSource };
      } finally { clearTimeout(deadline); }
    } catch (error) { caught = error; }
    finally {
      finishPhase();
      const cleanupStart = performance.now();
      try { await context?.close(); }
      catch (error) { caught ??= error; }
      try { await preview?.close(); }
      catch (error) { caught ??= error; }
      timings.cleanupMs = Math.round(performance.now() - cleanupStart);
      timings.totalMs = Math.round(performance.now() - started);
    }
    if (caught !== undefined) throw new PreviewVerificationError(caught instanceof Error ? caught.message : String(caught), timings);
    return { ...result!, timings };
  }
  return { verify, setupTimings, close: () => browser.close() };
}

export async function verifyPreview(archive: string, options: VerifyOptions = {}) {
  const verifier = await createPreviewVerifier(options);
  try { return await verifier.verify(archive, options); }
  finally { await verifier.close(); }
}
