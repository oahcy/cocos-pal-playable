import type { Channel } from '../types';

const SDK_URL = 'https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js';
// These hosts are explicitly permitted by Google's App campaign specification.
const external = [
  /^https:\/\/fonts\.googleapis\.com\//,
  /^https:\/\/fonts\.gstatic\.com\//,
  /^https:\/\/ajax\.googleapis\.com\/ajax\/libs\/jquery\//,
  /^https:\/\/s0\.2mdn\.net\/ads\/studio\/cached_libs\/(?:tweenlite|tweenmax|cssplugin|easepack|timelinelite|timelinemax|tweenjs|easeljs|createjs)[^/]*\.js(?:[?#].*)?$/i,
];
const channel: Channel = {
  id: 'google-ads', displayName: 'Google Ads Playable', sdkURL: SDK_URL,
  runtimeFile: 'google-ads-runtime.js', sdkPlacement: 'head',
  supportedFormats: ['directory-zip'],
  packageFormat: 'directory-zip', resourceMode: 'files', archiveName: 'google-ads.zip',
  // The shared packager uses an exclusive cap; Google permits at most 5 MB.
  maxBytesExclusive: 5000001, extraRootFiles: [],
  pending: ['Google Ads upload/review', 'real-device CTA and visibility', 'dynamic network requests and storage usage', 'audio gesture policy and responsive layout', 'explicit SVG end tags'],
  createFiles() { return []; },
  headHTML({ orientation }) {
    return '<meta name="ad.orientation" content="' + (orientation === 'auto' ? 'portrait,landscape' : orientation) + '">';
  },
  allowsReference(from, value) {
    return (from === 'index.html' && value === SDK_URL) || external.some(rule => rule.test(value));
  },
  reviewEntries(entries) {
    const fonts = entries.filter(entry => /\.(?:ttf|otf|woff2?|eot|ttc)$/i.test(entry.name));
    return fonts.map(entry => 'Verify Google web font provenance and upload acceptance: ' + entry.name);
  },
  validate(entries) {
    if (entries.length > 512) throw new Error('Google Ads ZIP must contain no more than 512 files');
    const html = entries.find(entry => entry.name === 'index.html')?.data.toString() || '';
    // Require the explicit document structure expected by the upload validator.
    const hasDocumentTags = /^\s*<!doctype\s+html\s*>/i.test(html)
      && /<html\b/i.test(html)
      && /<body\b/i.test(html)
      && /<\/html\s*>/i.test(html)
      && /<\/body\s*>/i.test(html);
    if (!hasDocumentTags) {
      throw new Error('Google Ads requires DOCTYPE html and explicit html/body tags');
    }
    const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i)?.[1] || '';
    const metaTags = [...head.matchAll(/<meta\b[^>]*>/gi)];
    const orientation = metaTags.filter(match => /\bname\s*=\s*["']ad\.orientation["']/i.test(match[0]));
    const hasValidOrientation = orientation.length === 1
      && /\bcontent\s*=\s*["'](?:portrait|landscape|portrait,landscape)["']/i.test(orientation[0][0]);
    if (!hasValidOrientation) {
      throw new Error('Google Ads requires one valid ad.orientation meta tag in head');
    }
    const scriptTags = [...head.matchAll(/<script\b[^>]*>/gi)];
    const sdk = scriptTags.filter(match => match[0].includes(SDK_URL));
    // Escape URL punctuation before matching it literally in a quoted src attribute.
    const escapedSdkURL = SDK_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const officialSdkSource = new RegExp('\\bsrc\\s*=\\s*["\\\']' + escapedSdkURL + '["\\\']');
    const hasOneOfficialSdk = sdk.length === 1 && officialSdkSource.test(sdk[0][0]);
    // ExitApi must exist before our runtime starts; async/defer would break that order.
    const loadsAsynchronously = sdk.length === 1 && /\b(?:async|defer)\b/i.test(sdk[0][0]);
    if (!hasOneOfficialSdk || loadsAsynchronously) {
      throw new Error('Google Ads requires the blocking official Exit API script in head');
    }
    if (html.indexOf(SDK_URL) > html.indexOf('src="./playable-runtime.js"')) throw new Error('SDK must load before runtime');
  },
};
export default channel;
