import path from 'node:path';
import { encodeArchive, defaultEmbeddedEncoding, readEmbeddedEncoding, type EmbeddedEncoding } from '../../runtime/embedded/embedded-codec';
import Ejs from 'ejs';
import encodeDirectoryZip from './directory-zip';
import type { Entry } from '../types';
const base = 'https://playable.invalid/';
export async function encodeSingleHTML(entries: Entry[], runtime: string, sdkURL: string, template = path.join(__dirname, '../../static/templates/single-html.ejs'), embeddedEncoding: EmbeddedEncoding = defaultEmbeddedEncoding): Promise<Buffer> {
  readEmbeddedEncoding(embeddedEncoding);
  const files = new Map(entries.map(entry => [entry.name, entry.data]));
  const read = (name: string) => { const data = files.get(name); if (!data) throw new Error('Missing single HTML input: ' + name); return data.toString(); };
  const one = (pattern: RegExp) => { const names = [...files.keys()].filter(name => pattern.test(name)); if (names.length !== 1) throw new Error('Expected one single HTML input matching ' + pattern); return names[0]; };
  const system = one(/^src\/system(?:\.[\da-f]+)?\.bundle\.js$/i);
  const maps = one(/^src\/import-map(?:\.[\da-f]+)?\.json$/i);
  const settings = one(/^src\/settings(?:\.[\da-f]+)?\.json$/i);
  const entry = one(/^index(?:\.[\da-f]+)?\.js$/i);
  const polyfills = [...files.keys()].find(name => /^src\/polyfills(?:\.[\da-f]+)?\.bundle\.js$/i.test(name));
  const importMap = JSON.parse(read(maps)) as { imports: Record<string, string>; scopes?: unknown };
  if (importMap.scopes) throw new Error('Single HTML prototype does not yet support scoped import maps');
  for (const [key, value] of Object.entries(importMap.imports)) importMap.imports[key] = new URL(value, new URL(maps, base)).href;
  let css = read(one(/^style(?:\.[\da-f]+)?\.css$/i));
  if (/@import\b/i.test(css)) throw new Error('Single HTML does not support CSS @import');
  css = css.replace(/url\(\s*["']?([^"')\s]+)["']?\s*\)/gi, (match, value: string) => {
    if (value.startsWith('data:')) return match;
    const url = new URL(value, base), name = decodeURIComponent(url.pathname.slice(1));
    const data = files.get(name);
    if (url.origin !== new URL(base).origin || !data) throw new Error('Unsupported CSS resource: ' + value);
    const mime: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' };
    const type = mime[name.split('.').pop()!];
    if (!type) throw new Error('Unsupported CSS resource type: ' + name);
    return 'url("data:' + type + ';base64,' + data.toString('base64') + '")';
  });
  console.log('[Playable] Single HTML: compressing embedded ZIP.');
  const data = await encodeDirectoryZip(entries.filter(entry => !/^(index\.html|playable-runtime\.js)$/.test(entry.name) && !/\.css$/.test(entry.name)));
  console.log(`[Playable] Single HTML: ZIP ready (${data.length} bytes); encoding ${embeddedEncoding}.`);
  const archive = encodeArchive(data, embeddedEncoding);
  console.log(`[Playable] Single HTML: archive encoded (${archive.length} characters); rendering HTML.`);
  const escapeScript = (value: string) => value.replace(/<\/script/gi, '<\\/script');
  return Buffer.from(await Ejs.renderFile(template, {
    sdkURL, channelRuntime: escapeScript(read('playable-runtime.js')),
    css: css.replace(/<\/style/gi, '<\\/style'), runtime: escapeScript(runtime),
    manifest: JSON.stringify({ system, polyfills, importMap, settings, entry }).replace(/</g, '\\u003c'), embeddedEncoding, archive,
  }));
}
