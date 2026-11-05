import { verifyPreview, type VerifyOptions } from './preview/verify';

async function main() {
  const [archive, ...args] = process.argv.slice(2);
  if (!archive) throw new Error('Usage: npm run verify:preview -- <playable.zip|playable.html> [--browser=chrome|msedge] [--timeout=30000]');
  const options: VerifyOptions = {};
  for (const arg of args) {
    if (arg.startsWith('--browser=')) options.browser = arg.slice(10) as VerifyOptions['browser'];
    else if (arg.startsWith('--timeout=')) options.timeoutMs = Number(arg.slice(10));
    else throw new Error('Unknown argument: ' + arg);
  }
  const result = await verifyPreview(archive, options);
  console.log('[Playable verify] PASS ' + result.archive + ' (scene: ' + result.scene + ', ' + result.browser + ')');
}
void main().catch(error => {
  console.error('[Playable verify] FAIL', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
