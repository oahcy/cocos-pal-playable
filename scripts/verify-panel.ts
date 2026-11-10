import { verifyPanels } from './panel/verify';
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && !['--browser=chrome', '--browser=msedge'].includes(args[0]))) {
  throw new Error('Usage: npm run verify:panel -- [--browser=chrome|msedge]');
}
void verifyPanels(args[0] === '--browser=msedge' ? 'msedge' : 'chrome').catch(error => {
  console.error('[Panel verify] FAIL', error);
  process.exitCode = 1;
});
