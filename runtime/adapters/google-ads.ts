import type { ChannelAdapter } from '../adapter';

export interface GoogleAdsHost { ExitApi?: { exit(): void } }
export function createGoogleAdsAdapter(root: GoogleAdsHost, exit: () => void = () => root.ExitApi!.exit()): ChannelAdapter {
  const requireSDK = () => {
    if (typeof root.ExitApi?.exit !== 'function') throw new Error('Google Ads Exit API is unavailable');
    return root.ExitApi;
  };
  return {
    channel: 'google-ads',
    capabilities: { openStore: true, finishNotification: false, containerLifecycle: false },
    init(sink) { requireSDK(); sink.ready(); },
    openStore() { requireSDK(); exit(); },
  };
}
