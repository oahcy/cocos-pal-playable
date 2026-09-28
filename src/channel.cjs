'use strict';
const SDK_URL = 'https://sf16-muse-va.ibytedtos.com/obj/union-fe-nc-i18n/Playable/sdk/Playable-sdk.js';
const orientations = { auto: 0, portrait: 1, landscape: 2 };
function readOptions(options) {
  const settings = options.packages?.playable || {};
  const channel = settings.channel ?? 'tiktok';
  const orientation = settings.orientation ?? 'auto';
  if (channel !== 'tiktok') throw new Error('Unsupported playable channel: ' + channel);
  if (!Object.hasOwn(orientations, orientation)) throw new Error('Unsupported orientation: ' + orientation);
  return { channel, orientation };
}
module.exports = { SDK_URL, orientations, readOptions };
