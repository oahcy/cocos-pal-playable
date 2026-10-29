import tiktok from './channels/tiktok';
import googleAds from './channels/google-ads';
import applovin from './channels/applovin';
import type { Channel } from './types';
const channels: Record<string, Channel> = { tiktok, 'google-ads': googleAds, applovin };
const channelIds = Object.keys(channels);
function getChannel(id: string) {
  if (!Object.prototype.hasOwnProperty.call(channels, id)) throw new Error('Unsupported playable channel: ' + id);
  return channels[id];
}
export { getChannel, channelIds };
