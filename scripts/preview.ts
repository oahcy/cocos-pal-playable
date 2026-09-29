import fs from 'node:fs';
import http from 'node:http';
import JSZip from 'jszip';
import { getChannel } from '../src/channel';
const SDK_URL = getChannel('tiktok').sdkURL;
const archive = process.argv[2];
if (!archive) throw new Error('Usage: npx tsx scripts/preview.ts <tiktok.zip> [--mock-sdk]');
const mock = process.argv.includes('--mock-sdk');
const port = Number(process.argv.find(arg => arg.startsWith('--port='))?.slice(7) || 0);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid preview port');
const types: Record<string, string> = { html: 'text/html', js: 'application/javascript', json: 'application/json', css: 'text/css',
  png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', wasm: 'application/wasm', ttf: 'font/ttf', mp3: 'audio/mpeg', ogg: 'audio/ogg' };
(async () => {
  const zip = await JSZip.loadAsync(fs.readFileSync(archive));
  const server = http.createServer(async (req, res) => {
    try {
      const name = decodeURIComponent(new URL(req.url || "/", 'http://localhost').pathname).slice(1) || 'index.html';
      res.setHeader('Cache-Control', 'no-store');
      if (mock && name === '__preview/sdk.js') {
        res.setHeader('Content-Type', 'application/javascript');
        res.end('window.playableSDK={isReady:()=>true,isMuted:()=>false,isViewable:()=>true,sendEvent(event){console.info("[Playable preview]",event)},addEventListener(){}};window.openAppStore=function(){console.info("[Playable preview] openStore (mock; no redirect)");};');
        return;
      }
      const entry = zip.file(name);
      if (!entry) { res.writeHead(404); res.end('Not found'); return; }
      let data = await entry.async('nodebuffer');
      if (mock && name === 'index.html') data = Buffer.from(data.toString().replace(SDK_URL, '/__preview/sdk.js'));
      res.setHeader('Content-Type', (types[name.split('.').pop() || ''] || 'application/octet-stream'));
      res.end(data);
    } catch (error) { res.writeHead(400); res.end('Invalid request'); }
  });
  server.listen(port, '127.0.0.1', () => {
    console.log('Preview: http://127.0.0.1:' + (server.address() as import('node:net').AddressInfo).port);
    console.log(mock ? 'SDK mock is active in this preview only; ZIP is unchanged.' : 'Using official SDK.');
  });
})().catch(error => { console.error(error); process.exitCode = 1; });
