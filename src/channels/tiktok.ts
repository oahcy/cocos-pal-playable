import type { Channel } from '../types';
const SDK_URL = 'https://sf16-muse-va.ibytedtos.com/obj/union-fe-nc-i18n/playable/sdk/playable-sdk.js';
const orientations: Record<string, number> = { auto: 0, portrait: 1, landscape: 2 };
const channel: Channel = {
  id: 'tiktok',
  displayName: 'TikTok',
  sdkURL: SDK_URL,
  packageFormat: 'directory-zip',
  resourceMode: 'files',
  archiveName: 'tiktok.zip',
  maxBytesExclusive: 5000000,
  extraRootFiles: ['config.json'],
  pending: ['TikTok official preview', 'device/container lifecycle', 'package-local HTTP loading', 'dynamic network requests', 'sound and safe areas', 'SDK ready-resource manifest (startup dependency list)'],
  createFiles({ orientation }) {
    if (!Object.hasOwn(orientations, orientation)) throw new Error('Unsupported orientation: ' + orientation);
    return [{ name: 'config.json', data: JSON.stringify({ Playable_orientation: orientations[orientation] }) }];
  },
  allowsReference(from, value) {
    return from === 'index.html' && value === SDK_URL;
  },
  validate(entries) {
    const byName = new Map(entries.map(entry => [entry.name, entry.data]));
    if (!byName.has('config.json')) throw new Error('Missing required file: config.json');
    const config = JSON.parse(byName.get('config.json')!.toString());
    if (![0, 1, 2].includes(config.Playable_orientation)) throw new Error('Invalid Playable_orientation');
    const html = byName.get('index.html')!.toString();
    if (!html.includes('src="' + SDK_URL + '"')) throw new Error('Missing official TikTok SDK');
    if (html.indexOf(SDK_URL) > html.indexOf('src="./playable-runtime.js"')) throw new Error('SDK must load before runtime');
    for (const entry of entries) {
      if (!/\.(?:html|css|json|js)$/i.test(entry.name)) continue;
      const text = entry.data.toString();
      if (/\bmraid\s*\./.test(text) || /mraid\.js/i.test(text)) throw new Error('MRAID is not allowed: ' + entry.name);
    }
  },
};

export default channel;
