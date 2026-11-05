import { channelIds, getChannel } from '../src/channel';

// Browser-only source, served by the local preview. Never included in delivery files.
const mocks: Record<string, string> = {
  tiktok: `
window.playableSDK = {
  isReady: () => true,
  isMuted: () => false,
  isViewable: () => true,
  sendEvent(event) { console.info('[Playable preview]', event); },
  addEventListener() {},
};
window.openAppStore = function () {
  console.info('[Playable preview] openStore (mock; no redirect)');
};`,
  'google-ads': `
window.ExitApi = {
  exit() { console.info('[Playable preview] ExitApi.exit (mock; no redirect)'); },
};`,
  applovin: `
window.mraid = {
  getState: () => 'default',
  isViewable: () => true,
  addEventListener() {},
  removeEventListener() {},
  open(url) { console.info('[Playable preview] mraid.open (mock; no redirect)', url); },
};`,
};

export function prepareMockPreview(html: string) {
  const matched: string[] = [];
  // Inspect complete script elements so SDK strings inside inline JS/embedded data
  // cannot be mistaken for an SDK import. This targets our generated HTML only.
  const output = html.replace(/<script\b([^>]*)>[\s\S]*?<\/script\s*>/gi, (tag, attributes: string) => {
    const source = /(?:^|\s)src\s*=\s*(["'])([^"']+)\1/i.exec(attributes);
    if (!source) return tag;
    const channel = channelIds.find(id => getChannel(id).sdkURL === source[2]);
    if (!channel) return tag;
    matched.push(channel);
    const replacement = attributes.replace(source[0], source[0].replace(source[2], '/__preview/sdk.js'));
    return tag.replace(attributes, replacement);
  });
  if (matched.length !== 1) throw new Error('Mock preview requires exactly one supported channel SDK script');
  const channel = matched[0];
  if (!Object.prototype.hasOwnProperty.call(mocks, channel)) throw new Error('No preview mock for channel: ' + channel);
  return { html: output, sdk: mocks[channel], channel };
}

/** Inject before the declared runtime; SDK imports are optional in this mode. */
export function prepareAPIMockPreview(html: string): string {
  let runtimes = 0;
  const output = html.replace(/<script\b([^>]*)>[\s\S]*?<\/script\s*>/gi, (tag, attributes: string) => {
    const source = /(?:^|\s)src\s*=\s*(["'])([^"']+)\1/i.exec(attributes);
    if (source && channelIds.some(id => getChannel(id).sdkURL === source[2])) return '';
    if (/(?:^|\s)data-playable-runtime(?=\s|=|$)/i.test(attributes)) {
      runtimes++;
      return '<script src="/__preview/mock-api.js"></script>\n' + tag;
    }
    return tag;
  });
  if (runtimes !== 1) {
    throw new Error('Unified Mock requires exactly one data-playable-runtime script; rebuild this artifact with the current plugin');
  }
  return output;
}
