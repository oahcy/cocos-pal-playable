import { packageBuild } from '../src/package';
async function main() {
  const [input, quality] = process.argv.slice(2);
  if (!input) throw new Error('Usage: npm run single-html -- <playable build directory> [image quality 1..100]');
  const report = await packageBuild(input, 'tiktok', { outputFormat: 'single-html',
    ...(quality === undefined ? {} : { imageCompression: 'lossy' as const, imageQuality: Number(quality) }) });
  console.log(JSON.stringify(report, null, 2));
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
