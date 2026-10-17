import { defaultEmbeddedEncoding, readEmbeddedEncoding, type EmbeddedEncoding } from '../runtime/embedded/embedded-codec';
export { embeddedEncodings, readEmbeddedEncoding, type EmbeddedEncoding } from '../runtime/embedded/embedded-codec';
import { getChannel } from './channel';
import type { Orientation } from './types';

export interface ImageOptions { imageCompression?: 'none' | 'lossy'; imageQuality?: number }
export const outputFormats = ['channel-default', 'directory-zip', 'single-html'] as const;
export type OutputFormat = typeof outputFormats[number];
export interface PackageOptions extends ImageOptions { outputFormat?: OutputFormat; embeddedEncoding?: EmbeddedEncoding }
export function readOutputFormat(value: OutputFormat = 'channel-default'): OutputFormat {
  if (!outputFormats.includes(value)) throw new Error('Unsupported outputFormat: ' + value);
  return value;
}
export const defaults = { channel: 'tiktok', outputFormat: 'channel-default', embeddedEncoding: defaultEmbeddedEncoding, orientation: 'auto', imageCompression: 'none', imageQuality: 80 } as const;
export const orientations: Orientation[] = ['auto', 'portrait', 'landscape'];
export const imageCompressionModes = ['none', 'lossy'] as const;

export function readImageOptions(options: ImageOptions = {}) {
  const imageCompression = options.imageCompression ?? defaults.imageCompression;
  const imageQuality = options.imageQuality ?? defaults.imageQuality;
  if (imageCompression !== 'none' && imageCompression !== 'lossy') throw new Error('imageCompression must be none or lossy');
  if (!Number.isInteger(imageQuality) || imageQuality < 1 || imageQuality > 100) throw new Error('imageQuality must be an integer from 1 to 100');
  return { imageCompression, imageQuality };
}
export interface PlayableOptions extends PackageOptions { channel?: string; orientation?: string }
export function normalizeOptions(settings: PlayableOptions = {}): { channel: string; orientation: Orientation; outputFormat: OutputFormat; embeddedEncoding: EmbeddedEncoding } & Required<ImageOptions> {
  const channel = settings.channel ?? defaults.channel;
  const orientation = settings.orientation ?? defaults.orientation;
  getChannel(channel);
  if (orientation !== 'auto' && orientation !== 'portrait' && orientation !== 'landscape') throw new Error('Unsupported orientation: ' + orientation);
  return { channel, orientation, outputFormat: readOutputFormat(settings.outputFormat), embeddedEncoding: readEmbeddedEncoding(settings.embeddedEncoding), ...readImageOptions(settings) };
}
