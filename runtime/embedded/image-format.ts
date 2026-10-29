/** Inspect raster bytes rather than trusting a Cocos asset's retained extension. */
export function imageFormat(bytes: Uint8Array): 'png' | 'jpeg' | 'webp' | undefined {
  if (bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
    && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) return 'png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpeg';
  if (bytes.length >= 12 && bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70
    && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80) return 'webp';
  return undefined;
}
export function imageMime(bytes: Uint8Array): string | undefined {
  const format = imageFormat(bytes);
  return format ? 'image/' + format : undefined;
}
