import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import JSZip from 'jszip';
import { build } from 'esbuild';
import { prepareMockPreview, prepareAPIMockPreview } from '../preview-sdk';

export interface PreviewOptions { mockSDK?: boolean; mockAPI?: boolean; port?: number; mockAPIScript?: string }
const types: Record<string, string> = {
  html: 'text/html', js: 'application/javascript', json: 'application/json', css: 'text/css',
  png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', wasm: 'application/wasm',
  ttf: 'font/ttf', mp3: 'audio/mpeg', ogg: 'audio/ogg',
};

/** Compile once per verification session; a new session picks up source changes. */
export async function compileMockAPI(): Promise<string> {
  const bundle = await build({
    entryPoints: [path.join(__dirname, 'mock-entry.ts')], bundle: true, write: false,
    platform: 'browser', format: 'iife', target: 'es2017', minify: true,
  });
  return bundle.outputFiles[0].text;
}

export async function startPreview(archive: string, options: PreviewOptions = {}) {
  if (options.mockAPI && options.mockSDK) throw new Error('Choose either --mock-api or --mock-sdk');
  const port = options.port ?? 0;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid preview port');
  const input = fs.readFileSync(archive);
  const html = /\.html$/i.test(archive) ? input : undefined;
  const zip = html ? undefined : await JSZip.loadAsync(input, { checkCRC32: true });
  const index = html?.toString() ?? await zip?.file('index.html')?.async('string');
  if (index === undefined) throw new Error('Preview archive is missing index.html');

  let page = index;
  let script: string | undefined;
  let scriptPath: string | undefined;
  let mode = 'official-sdk';
  if (options.mockAPI) {
    page = prepareAPIMockPreview(index);
    script = options.mockAPIScript ?? await compileMockAPI();
    scriptPath = '__preview/mock-api.js';
    mode = 'mock-api';
  } else if (options.mockSDK) {
    const preview = prepareMockPreview(index);
    page = preview.html;
    script = preview.sdk;
    scriptPath = '__preview/sdk.js';
    mode = 'mock-sdk (' + preview.channel + ')';
  }

  const server = http.createServer(async (req, res) => {
    try {
      const name = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname).slice(1) || 'index.html';
      res.setHeader('Cache-Control', 'no-store');
      if (name === 'favicon.ico') { res.writeHead(204); res.end(); return; }
      if (scriptPath && name === scriptPath) {
        res.setHeader('Content-Type', 'application/javascript');
        res.end(script);
        return;
      }
      const entry = zip?.file(name);
      if (name !== 'index.html' && !entry) { res.writeHead(404); res.end('Not found'); return; }
      const data = name === 'index.html' ? Buffer.from(page) : await entry!.async('nodebuffer');
      res.setHeader('Content-Type', types[name.split('.').pop() || ''] || 'application/octet-stream');
      res.end(data);
    } catch (error) {
      console.error('[Playable preview]', error);
      res.writeHead(400);
      res.end('Invalid request');
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    url: 'http://127.0.0.1:' + (server.address() as import('node:net').AddressInfo).port,
    mode,
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    }),
  };
}
