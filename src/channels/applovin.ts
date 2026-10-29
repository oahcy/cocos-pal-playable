import type { Channel } from '../types';

// mraid.js is supplied by the advertising container, not downloaded from a CDN.
const channel: Channel = {
  id: 'applovin', displayName: 'AppLovin', sdkURL: 'mraid.js',
  runtimeFile: 'applovin-runtime.js', requiresStoreUrl: true,
  supportedOrientations: ['auto'], supportedFormats: ['single-html'],
  packageFormat: 'single-html', resourceMode: 'embedded', archiveName: 'applovin.html',
  maxBytesExclusive: 5000001, extraRootFiles: [],
  pending: ['AppLovin official preview and device validation', 'portrait and landscape layout',
    'no automatic or first-interaction redirect; call CTA from a user gesture',
    'audio muted before interaction and when hidden; game timer starts on first interaction',
    'dynamic network requests', 'WebGL initialization/context-loss fallback'],
  createFiles() { return []; },
  allowsReference(from, value) { return from === 'index.html' && value === 'mraid.js'; },
  validate(entries) {
    const html = entries.find(entry => entry.name === 'index.html')?.data.toString() || '';
    const scripts = [...html.matchAll(/<script\b[^>]*>/gi)];
    const bridge = scripts.filter(match => /\bsrc=["']mraid\.js["']/.test(match[0]));
    if (bridge.length !== 1 || /\b(?:async|defer)\b/i.test(bridge[0][0])) {
      throw new Error('AppLovin requires one blocking container mraid.js script');
    }
    if (html.indexOf('mraid.js') > html.indexOf('src="./playable-runtime.js"')) {
      throw new Error('MRAID must load before the AppLovin runtime');
    }
  },
};
export default channel;
