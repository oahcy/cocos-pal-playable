import JSZip from 'jszip';
export const VIRTUAL_ROOT = 'https://playable.invalid/';
// Blob MIME is used by media decoders and WebAssembly streaming compilation.
const mime: Record<string, string> = {
  js: 'application/javascript',
  mjs: 'application/javascript',
  json: 'application/json',
  wasm: 'application/wasm',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  pvr: 'application/octet-stream',
  pkm: 'application/octet-stream',
  astc: 'application/octet-stream',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
  avi: 'video/x-msvideo',
  m3u8: 'application/vnd.apple.mpegurl',
  ttf: 'font/ttf',
  otf: 'font/otf',
  ttc: 'font/collection',
  eot: 'application/vnd.ms-fontobject',
  woff: 'font/woff',
  woff2: 'font/woff2',
};
export function resourceName(value: string): string {
  const url = new URL(value, VIRTUAL_ROOT);
  if (url.origin !== new URL(VIRTUAL_ROOT).origin) throw new Error('External embedded resource: ' + value);
  return decodeURIComponent(url.pathname.slice(1));
}
export function resourceError(stage: string, value: string, cause: unknown): Error {
  return new Error('[Playable embedded] ' + stage + ' "' + value + '": ' + (cause instanceof Error ? cause.message : String(cause)));
}
/** Decode only requested files. Keep Blob URLs alive for later audio/font reuse. */
export class EmbeddedStore {
  private urls = new Map<string, string>();
  private pendingURLs = new Map<string, Promise<string>>();
  private texts = new Map<string, Promise<string>>();
  private scripts = new Map<string, Promise<void>>();
  constructor(private zip: JSZip) {}
  private file(name: string): JSZip.JSZipObject {
    const file = this.zip.file(name);
    if (!file) throw new Error('Missing embedded resource: ' + name);
    return file;
  }
  async url(value: string): Promise<string> {
    try {
      const name = resourceName(value);
      let pending = this.pendingURLs.get(name);
      if (!pending) {
        pending = this.file(name).async('arraybuffer').then(bytes => {
          const extension = name.split('.').pop()!;
          const type = mime[extension] || 'application/octet-stream';
          const blob = new Blob([bytes], { type });
          const url = URL.createObjectURL(blob);
          this.urls.set(name, url);
          return url;
        });
        // Cache the in-flight read as well as the result so concurrent requests share one Blob.
        this.pendingURLs.set(name, pending);
        // Failed reads may be retried; do not leave a rejected Promise in the cache.
        void pending.catch(() => this.pendingURLs.delete(name));
      }
      return await pending;
    } catch (error) { throw resourceError('decode Blob', value, error); }
  }
  /** Used only by synchronous SystemJS createScript after instantiate has awaited url(). */
  readyURL(value: string): string {
    try {
      const name = resourceName(value);
      const url = this.urls.get(name);
      if (!url) throw new Error('Resource was not prepared');
      return url;
    } catch (error) { throw resourceError('resolve script', value, error); }
  }
  async json<T>(value: string): Promise<T> {
    try {
      const name = resourceName(value);
      let pending = this.texts.get(name);
      if (!pending) {
        pending = this.file(name).async('string');
        this.texts.set(name, pending);
        void pending.catch(() => this.texts.delete(name));
      }
      // Cocos parsers may mutate JSON. Cache decoded text, never the shared parsed object.
      return JSON.parse(await pending) as T;
    } catch (error) { throw resourceError('read JSON', value, error); }
  }
  async arrayBuffer(value: string): Promise<ArrayBuffer> {
    try {
      const name = resourceName(value);
      return await this.file(name).async('arraybuffer');
    } catch (error) { throw resourceError('read binary', value, error); }
  }
  async script(value: string): Promise<void> {
    try {
      const name = resourceName(value);
      let pending = this.scripts.get(name);
      if (!pending) {
        pending = this.url(name).then(url => new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = url;
          script.async = false;
          script.onload = () => {
            script.remove();
            resolve();
          };
          script.onerror = () => {
            script.remove();
            reject(new Error('Browser failed to load script'));
          };
          document.head.appendChild(script);
        }));
        this.scripts.set(name, pending);
        void pending.catch(() => this.scripts.delete(name));
      }
      await pending;
    } catch (error) { throw resourceError('load script', value, error); }
  }
}
