// Seven-bit packing with HTML-unsafe ASCII values escaped as two-byte UTF-8.
// These values would interfere with HTML text/script parsing: NUL, LF, CR, ", &, \, <.
const escaped = [0, 10, 13, 34, 38, 92, 60];
const groupBits = 7;
const groupMask = 0x7f;
const escapeMarker = 0x80;
const finalEscapeIndex = 7;

export function encodeBase122(bytes: Uint8Array): string {
  const totalBits = bytes.length * 8;
  let offset = 0;
  const nextGroup = (): number | undefined => {
    if (offset >= totalBits) return undefined;
    let value = 0;
    for (let i = 0; i < groupBits; i++, offset++) {
      // Read most-significant bit first; pad the last incomplete group with zeroes.
      const byteIndex = offset >>> 3;
      const bitInByte = 7 - (offset & 7);
      const bit = offset < totalBits ? (bytes[byteIndex] >>> bitInByte) & 1 : 0;
      value = (value << 1) | bit;
    }
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
  for (let value = nextGroup(); value !== undefined; value = nextGroup()) {
    const index = escaped.indexOf(value);
    if (index < 0) {
      append(value);
      continue;
    }

    // Escaped character layout: [3-bit escape index][marker bit][7-bit payload].
    // Index 0..6 restores the unsafe group; the payload stores the following group.
    // Index 7 marks an unsafe final group with no following group, stored as payload.
    const following = nextGroup();
    if (following === undefined) {
      append((finalEscapeIndex << 8) | escapeMarker | value);
    } else {
      append((index << 8) | escapeMarker | following);
    }
  }
  if (used) chunks.push(String.fromCharCode(...characters.subarray(0, used)));
  return chunks.join('');
}

export function decodeBase122(text: string): Uint8Array {
  // Count groups before allocating: normal characters carry one, non-final escapes two.
  // Allocating for the worst case and slicing afterwards doubles peak archive memory.
  let groups = text.length;
  for (let i = 0; i < text.length; i++) {
    const value = text.charCodeAt(i);
    if (value < 128) continue;
    if (value > 2047 || !(value & escapeMarker)) throw new Error('Invalid Base122 character');
    const escapeIndex = (value >>> 8) & 7;
    if (escapeIndex !== finalEscapeIndex) groups++;
  }
  const bytes = new Uint8Array(Math.floor(groups * groupBits / 8));
  let length = 0;
  let accumulator = 0;
  let bits = 0;
  const pushGroup = (value: number) => {
    accumulator = (accumulator << groupBits) | value;
    bits += groupBits;
    if (bits >= 8) {
      bits -= 8;
      bytes[length++] = (accumulator >>> bits) & 255;
    }
    // Keep only the leftover bits for the next byte. Final padding is never emitted.
    accumulator &= (1 << bits) - 1;
  };
  for (let i = 0; i < text.length; i++) {
    const value = text.charCodeAt(i);
    if (value < 128) {
      pushGroup(value);
    } else {
      const escapeIndex = (value >>> 8) & 7;
      if (escapeIndex !== finalEscapeIndex) pushGroup(escaped[escapeIndex]);
      pushGroup(value & groupMask);
    }
  }
  return bytes;
}
