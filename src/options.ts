import { getChannel } from './channel';
import type { BuildOptions } from './builder-types';
import type { Orientation } from './types';

export interface ImageOptions { imageCompression?: 'none' | 'lossy'; imageQuality?: number }
export const outputFormats = ['channel-default', 'directory-zip', 'single-html'] as const;
export type OutputFormat = typeof outputFormats[number];
export interface PackageOptions extends ImageOptions { outputFormat?: OutputFormat }
export function readOutputFormat(value: OutputFormat = 'channel-default'): OutputFormat {
  if (!outputFormats.includes(value)) throw new Error('Unsupported outputFormat: ' + value);
  return value;
}
export const defaults = { channel: 'tiktok', outputFormat: 'channel-default', orientation: 'auto', imageCompression: 'none', imageQuality: 80 } as const;
export const orientations: Orientation[] = ['auto', 'portrait', 'landscape'];
export const imageCompressionModes = ['none', 'lossy'] as const;

export function readImageOptions(options: ImageOptions = {}) {
  const imageCompression = options.imageCompression ?? defaults.imageCompression;
  const imageQuality = options.imageQuality ?? defaults.imageQuality;
  if (imageCompression !== 'none' && imageCompression !== 'lossy') throw new Error('imageCompression must be none or lossy');
  if (!Number.isInteger(imageQuality) || imageQuality < 1 || imageQuality > 100) throw new Error('imageQuality must be an integer from 1 to 100');
  return { imageCompression, imageQuality };
}
export function readOptions(options: BuildOptions): { channel: string; orientation: Orientation; outputFormat: OutputFormat } & Required<ImageOptions> {
  const settings = options.packages?.playable || {};
  const channel = settings.channel ?? defaults.channel;
  const orientation = settings.orientation ?? defaults.orientation;
  getChannel(channel);
  if (orientation !== 'auto' && orientation !== 'portrait' && orientation !== 'landscape') throw new Error('Unsupported orientation: ' + orientation);
  return { channel, orientation, outputFormat: readOutputFormat(settings.outputFormat), ...readImageOptions(settings) };
}
