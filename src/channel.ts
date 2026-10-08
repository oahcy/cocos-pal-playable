import tiktok from './channels/tiktok';
import type { Channel } from './types';
const channels: Record<string, Channel> = { tiktok };
const channelIds = Object.keys(channels);
function getChannel(id: string) {
  if (!Object.hasOwn(channels, id)) throw new Error('Unsupported playable channel: ' + id);
  return channels[id];
}
export { getChannel, channelIds };
