// Seven-bit packing with HTML-unsafe ASCII values escaped as two-byte UTF-8.
const escaped = [0, 10, 13, 34, 38, 92, 60];
export function encodeBase122(bytes: Uint8Array): string {
  let offset = 0;
  const next = (): number | undefined => {
    if (offset >= bytes.length * 8) return undefined;
    let value = 0;
    for (let i = 0; i < 7; i++, offset++) value = (value << 1) | (offset < bytes.length * 8 ? (bytes[offset >>> 3] >>> (7 - (offset & 7))) & 1 : 0);
    return value;
  };
  const result: string[] = [];
  for (let value = next(); value !== undefined; value = next()) {
    const index = escaped.indexOf(value);
    if (index < 0) result.push(String.fromCharCode(value));
    else {
      const following = next();
      result.push(String.fromCharCode(following === undefined ? 0x780 | value : (index << 8) | 0x80 | following));
    }
  }
  return result.join('');
}
export function decodeBase122(text: string): Uint8Array {
  const bytes = new Uint8Array(Math.floor(text.length * 14 / 8));
  let length = 0, accumulator = 0, bits = 0;
  const push = (value: number) => {
    accumulator = (accumulator << 7) | value; bits += 7;
    if (bits >= 8) { bits -= 8; bytes[length++] = (accumulator >>> bits) & 255; }
    accumulator &= (1 << bits) - 1;
  };
  for (const char of text) {
    const value = char.charCodeAt(0);
    if (value < 128) push(value);
    else {
      const index = (value >>> 8) & 7;
      if (value > 2047 || !(value & 128)) throw new Error('Invalid Base122 character');
      if (index !== 7) push(escaped[index]);
      push(value & 127);
    }
  }
  return bytes.slice(0, length);
}
