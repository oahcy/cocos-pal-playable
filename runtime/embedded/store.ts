import JSZip from 'jszip';
export const VIRTUAL_ROOT = 'https://playable.invalid/';
const mime: Record<string, string> = { js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', ttf: 'font/ttf', woff: 'font/woff', woff2: 'font/woff2' };
export function resourceName(value: string): string {
  const url = new URL(value, VIRTUAL_ROOT);
  if (url.origin !== new URL(VIRTUAL_ROOT).origin) throw new Error('External embedded resource: ' + value);
  return decodeURIComponent(url.pathname.slice(1));
}
/** Blob URLs stay alive for audio/font consumers until this document is destroyed. */
export class EmbeddedStore {
  private urls = new Map<string, string>();
  private scripts = new Map<string, Promise<void>>();
  constructor(private zip: JSZip) {}
  async prepare(): Promise<void> {
    await Promise.all(Object.values(this.zip.files).filter(file => !file.dir).map(async file => {
      const bytes = await file.async('arraybuffer');
      this.urls.set(file.name, URL.createObjectURL(new Blob([bytes], { type: mime[file.name.split('.').pop()!] || 'application/octet-stream' })));
    }));
  }
  url(value: string): string {
    const name = resourceName(value), url = this.urls.get(name);
    if (!url) throw new Error('Missing embedded resource: ' + name);
    return url;
  }
  async json<T>(value: string): Promise<T> {
    const file = this.zip.file(resourceName(value));
    if (!file) throw new Error('Missing embedded JSON: ' + value);
    return JSON.parse(await file.async('string')) as T;
  }
  script(value: string): Promise<void> {
    const name = resourceName(value);
    let pending = this.scripts.get(name);
    if (!pending) {
      pending = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = this.url(name); script.async = false;
        script.onload = () => { script.remove(); resolve(); };
        script.onerror = () => { script.remove(); reject(new Error('Embedded script failed: ' + name)); };
        document.head.appendChild(script);
      });
      this.scripts.set(name, pending);
    }
    return pending;
  }
}
