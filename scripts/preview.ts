import { startPreview } from './preview/server';

async function main() {
  const [archive, ...args] = process.argv.slice(2);
  if (!archive) throw new Error('Usage: npm run preview -- <playable.zip|playable.html> [--mock-api|--mock-sdk] [--port=0]');
  const preview = await startPreview(archive, {
    mockAPI: args.includes('--mock-api'),
    mockSDK: args.includes('--mock-sdk'),
    port: Number(args.find(arg => arg.startsWith('--port='))?.slice(7) || 0),
  });
  console.log('Preview: ' + preview.url);
  console.log('Mode: ' + preview.mode);
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
