import type { ChannelAdapter } from '../adapter';

export interface Mraid {
  getState(): string;
  isViewable(): boolean;
  addEventListener(event: string, listener: (...args: any[]) => void): void;
  removeEventListener(event: string, listener: (...args: any[]) => void): void;
  open(url: string): void;
}
export interface AppLovinHost { mraid?: Mraid }
export function createAppLovinAdapter(root: AppLovinHost, storeUrl: string): ChannelAdapter {
  let initialized = false;
  let viewable = false;
  return {
    channel: 'applovin',
    capabilities: { openStore: true, finishNotification: false, containerLifecycle: true },
    init(sink) {
      const sdk = root.mraid;
      if (!sdk || typeof sdk.getState !== 'function' || typeof sdk.open !== 'function') {
        throw new Error('AppLovin MRAID is unavailable; use a MRAID preview or advertising container');
      }
      if (!storeUrl) throw new Error('AppLovin store URL is missing');
      const visible = (value: boolean) => { viewable = value; sink.viewable(value); };
      const ready = () => {
        if (initialized) return;
        try {
          sdk.removeEventListener('ready', ready);
          sdk.addEventListener('viewableChange', visible);
          visible(sdk.isViewable());
          initialized = true;
          sink.ready();
        } catch (error) { sink.error(error instanceof Error ? error : new Error(String(error))); }
      };
      // Query visibility only after ready. Preloaded ads must not start while hidden.
      if (sdk.getState() === 'loading') sdk.addEventListener('ready', ready);
      else ready();
    },
    openStore() {
      if (!initialized || !viewable) throw new Error('AppLovin is not ready and viewable');
      root.mraid!.open(storeUrl);
    },
  };
}
