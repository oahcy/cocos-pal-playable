import { encodeBase122, decodeBase122 } from './base122';

// Shared by Node packaging and browser startup; no Node-only dependencies.
const codecs = {
  base64: {
    encode(bytes: Uint8Array): string {
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 8192) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      }
      return btoa(binary);
    },
    decode(text: string): Uint8Array {
      const binary = atob(text);
      // Avoid Uint8Array.from(string, mapper), which materializes an intermediate
      // iterable list in some engines before allocating the typed array.
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    },
  },
  base122: { encode: encodeBase122, decode: decodeBase122 },
};
export type EmbeddedEncoding = keyof typeof codecs;
export const embeddedEncodings = Object.keys(codecs) as EmbeddedEncoding[];
export const defaultEmbeddedEncoding: EmbeddedEncoding = 'base64';
export function readEmbeddedEncoding(value: unknown = defaultEmbeddedEncoding): EmbeddedEncoding {
  if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(codecs, value)) {
    throw new Error('Unsupported embeddedEncoding: ' + String(value));
  }
  return value as EmbeddedEncoding;
}
export function encodeArchive(bytes: Uint8Array, encoding: EmbeddedEncoding = defaultEmbeddedEncoding): string {
  return codecs[readEmbeddedEncoding(encoding)].encode(bytes);
}
export function decodeArchive(text: string, encoding: unknown = defaultEmbeddedEncoding): Uint8Array {
  return codecs[readEmbeddedEncoding(encoding)].decode(text);
}
