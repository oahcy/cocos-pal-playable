import path from 'node:path';
import { encodeArchive, defaultEmbeddedEncoding, readEmbeddedEncoding, type EmbeddedEncoding } from '../../runtime/embedded/embedded-codec';
import Ejs from 'ejs';
import encodeDirectoryZip from './directory-zip';
import type { Entry } from '../types';
// Virtual URLs preserve module-relative resolution; the runtime maps them to ZIP entries.
const base = 'https://playable.invalid/';
// CSS inlining accepts images/fonts only; this is narrower than the runtime Blob MIME table.
const cssMimeTypes: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
};

export async function encodeSingleHTML(
  entries: Entry[],
  runtime: string,
  sdkURL: string,
  template = path.join(__dirname, '../../static/templates/single-html.ejs'),
  embeddedEncoding: EmbeddedEncoding = defaultEmbeddedEncoding,
): Promise<Buffer> {
  readEmbeddedEncoding(embeddedEncoding);
  const files = new Map(entries.map(entry => [entry.name, entry.data]));
  const readText = (name: string) => {
    const data = files.get(name);
    if (!data) throw new Error('Missing single HTML input: ' + name);
    return data.toString();
  };
  const requireSingleFile = (pattern: RegExp) => {
    const names = [...files.keys()].filter(name => pattern.test(name));
    if (names.length !== 1) {
      throw new Error('Expected one single HTML input matching ' + pattern);
    }
    return names[0];
  };
  // Match plain and cache-hashed build files, e.g. system.bundle.js / system.a1b2.bundle.js.
  // Multiple matches are ambiguous: never pick an old entry left by a previous build.
  const system = requireSingleFile(/^src\/system(?:\.[\da-f]+)?\.bundle\.js$/i);
  const maps = requireSingleFile(/^src\/import-map(?:\.[\da-f]+)?\.json$/i);
  const settings = requireSingleFile(/^src\/settings(?:\.[\da-f]+)?\.json$/i);
  const entry = requireSingleFile(/^index(?:\.[\da-f]+)?\.js$/i);
  const polyfills = [...files.keys()].find(name => /^src\/polyfills(?:\.[\da-f]+)?\.bundle\.js$/i.test(name));
  const importMap = JSON.parse(readText(maps)) as { imports: Record<string, string>; scopes?: unknown };
  if (importMap.scopes) throw new Error('Single HTML prototype does not yet support scoped import maps');
  const importMapURL = new URL(maps, base);
  for (const [key, value] of Object.entries(importMap.imports)) {
    importMap.imports[key] = new URL(value, importMapURL).href;
  }
  let css = readText(requireSingleFile(/^style(?:\.[\da-f]+)?\.css$/i));
  if (/@import\b/i.test(css)) throw new Error('Single HTML does not support CSS @import');
  // Inline generated CSS url(...) references; existing data URLs are already self-contained.
  css = css.replace(/url\(\s*["']?([^"')\s]+)["']?\s*\)/gi, (match, value: string) => {
    if (value.startsWith('data:')) return match;
    const url = new URL(value, base);
    const name = decodeURIComponent(url.pathname.slice(1));
    const data = files.get(name);
    if (url.origin !== new URL(base).origin || !data) throw new Error('Unsupported CSS resource: ' + value);
    const extension = name.split('.').pop()!;
    const type = cssMimeTypes[extension];
    if (!type) throw new Error('Unsupported CSS resource type: ' + name);
    return 'url("data:' + type + ';base64,' + data.toString('base64') + '")';
  });
  console.log('[Playable] Single HTML: compressing embedded ZIP.');
  // HTML, channel runtime and CSS are rendered directly into the page, not stored twice.
  const archiveEntries = entries.filter(entry => {
    const renderedInPage = /^(index\.html|playable-runtime\.js)$/.test(entry.name);
    const isStylesheet = /\.css$/.test(entry.name);
    return !renderedInPage && !isStylesheet;
  });
  const data = await encodeDirectoryZip(archiveEntries);
  console.log(`[Playable] Single HTML: ZIP ready (${data.length} bytes); encoding ${embeddedEncoding}.`);
  const archive = encodeArchive(data, embeddedEncoding);
  console.log(`[Playable] Single HTML: archive encoded (${archive.length} characters); rendering HTML.`);
  // HTML parses closing tags even inside JS strings; escape them before placing code in <script>.
  const escapeScript = (value: string) => value.replace(/<\/script/gi, '<\\/script');
  const manifest = JSON.stringify({ system, polyfills, importMap, settings, entry }).replace(/</g, '\\u003c');
  const html = await Ejs.renderFile(template, {
    sdkURL,
    channelRuntime: escapeScript(readText('playable-runtime.js')),
    css: css.replace(/<\/style/gi, '<\\/style'),
    runtime: escapeScript(runtime),
    manifest,
    embeddedEncoding,
    archive,
  });
  return Buffer.from(html);
}
