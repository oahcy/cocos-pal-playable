import tiktok from './channels/tiktok';
import type { BuildOptions, Channel } from './types';
const channels: Record<string, Channel> = { tiktok };
const channelIds = Object.keys(channels);
function getChannel(id: string) {
  if (!Object.hasOwn(channels, id)) throw new Error('Unsupported playable channel: ' + id);
  return channels[id];
}
function readOptions(options: BuildOptions) {
  const settings = options.packages?.playable || {};
  const channel = settings.channel ?? 'tiktok';
  const orientation = settings.orientation ?? 'auto';
  getChannel(channel);
  if (!['auto', 'portrait', 'landscape'].includes(orientation)) throw new Error('Unsupported orientation: ' + orientation);
  return { channel, orientation };
}
export { getChannel, readOptions, channelIds };
