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
  // Keep a bounded character buffer instead of one array slot per archive character.
  // Large archives otherwise allocate hundreds of millions of array slots before join().
  const chunks: string[] = [];
  const characters = new Uint16Array(8192);
  let used = 0;
  const append = (value: number) => {
    characters[used++] = value;
    if (used === characters.length) {
      chunks.push(String.fromCharCode(...characters));
      used = 0;
    }
  };
  for (let value = next(); value !== undefined; value = next()) {
    const index = escaped.indexOf(value);
    if (index < 0) append(value);
    else {
      const following = next();
      append(following === undefined ? 0x780 | value : (index << 8) | 0x80 | following);
    }
  }
  if (used) chunks.push(String.fromCharCode(...characters.subarray(0, used)));
  return chunks.join('');
}
export function decodeBase122(text: string): Uint8Array {
  // Count seven-bit groups before allocating: most characters carry one, escapes carry two.
  // Allocating for the worst case and slicing afterwards doubles peak archive memory.
  let groups = text.length;
  for (let i = 0; i < text.length; i++) {
    const value = text.charCodeAt(i);
    if (value < 128) continue;
    if (value > 2047 || !(value & 128)) throw new Error('Invalid Base122 character');
    if (((value >>> 8) & 7) !== 7) groups++;
  }
  const bytes = new Uint8Array(Math.floor(groups * 7 / 8));
  let length = 0, accumulator = 0, bits = 0;
  const push = (value: number) => {
    accumulator = (accumulator << 7) | value; bits += 7;
    if (bits >= 8) { bits -= 8; bytes[length++] = (accumulator >>> bits) & 255; }
    accumulator &= (1 << bits) - 1;
  };
  for (let i = 0; i < text.length; i++) {
    const value = text.charCodeAt(i);
    if (value < 128) push(value);
    else {
      const index = (value >>> 8) & 7;
      if (index !== 7) push(escaped[index]);
      push(value & 127);
    }
  }
  return bytes;
}
