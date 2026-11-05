import path from 'node:path';
import { createPreviewVerifier, PreviewVerificationError, type VerifyOptions } from './preview/verify';
import { readVerifyCases } from './preview/batch';

async function main() {
  const [input, ...args] = process.argv.slice(2);
  if (!input) throw new Error('Usage: npm run verify:preview -- <archive|--batch=config.json> [--browser=chrome|msedge] [--timeout=30000] [--expected-version=2.4.12]');
  const options: VerifyOptions = {};
  for (const arg of args) {
    if (arg.startsWith('--browser=')) options.browser = arg.slice(10) as VerifyOptions['browser'];
    else if (arg.startsWith('--expected-version=')) options.expectedVersion = arg.slice(19);
    else if (arg.startsWith('--timeout=')) options.timeoutMs = Number(arg.slice(10));
    else throw new Error('Unknown argument: ' + arg);
  }
  const batch = input.startsWith('--batch=');
  if (batch && options.expectedVersion !== undefined) throw new Error('Set expectedVersion per case in batch config');
  const cases = batch ? readVerifyCases(input.slice(8)) : [{ archive: input, expectedVersion: options.expectedVersion }];
  const verifier = await createPreviewVerifier(options);
  console.log('[Playable verify] Shared setup (ms):', verifier.setupTimings);
  const results: Array<Record<string, string | number>> = [];
  try {
    for (const [index, item] of cases.entries()) {
      const label = '[' + (index + 1) + '/' + cases.length + ']';
      console.log('[Playable verify] ' + label + ' START ' + item.archive);
      try {
        const result = await verifier.verify(item.archive, {
          expectedVersion: item.expectedVersion,
          onLog: (type, text) => console.log(label + ' [Browser ' + type + '] ' + text),
        });
        console.log('[Playable verify] ' + label + ' PASS (Creator: ' + result.engineVersion + ', scene: ' + result.scene + ')');
        results.push({ archive: item.archive, status: 'PASS', version: result.engineVersion, source: result.versionSource, ...result.timings });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[Playable verify] ' + label + ' FAIL ' + message);
        const timings = error instanceof PreviewVerificationError ? error.timings : {};
        results.push({ archive: item.archive, status: 'FAIL', error: message, ...timings });
        process.exitCode = 1;
      }
    }
  } finally { await verifier.close(); }
  // Full artifact paths and errors are printed above; keep the timing summary readable.
  console.table(results.map(({ archive, error, ...row }, index) => ({
    case: index + 1, artifact: path.basename(String(archive)), ...row,
  })));
  console.log('[Playable verify] ' + results.filter(row => row.status === 'PASS').length + '/' + cases.length + ' passed');
}
void main().catch(error => {
  console.error('[Playable verify] FAIL', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
