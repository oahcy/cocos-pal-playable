'use strict';
const channels = { tiktok: require('./channels/tiktok.cjs') };
function getChannel(id) {
  if (!Object.hasOwn(channels, id)) throw new Error('Unsupported playable channel: ' + id);
  return channels[id];
}
function readOptions(options) {
  const settings = options.packages?.playable || {};
  const channel = settings.channel ?? 'tiktok';
  const orientation = settings.orientation ?? 'auto';
  getChannel(channel);
  if (!['auto', 'portrait', 'landscape'].includes(orientation)) throw new Error('Unsupported orientation: ' + orientation);
  return { channel, orientation };
}
module.exports = { getChannel, readOptions, channelIds: Object.keys(channels) };
