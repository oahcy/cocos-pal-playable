import type { ChannelAdapter } from '../adapter';

interface TikTokSDK {
  isReady(): boolean;
  addEventListener(event: 'muteChange', callback: (event: { muted: boolean; isInit?: boolean }) => void): void;
  isMuted?(): boolean | Promise<boolean>;
}
export interface TikTokHost {
  playableSDK?: TikTokSDK;
  openAppStore?: () => void;
}
export function createTikTokAdapter(root: TikTokHost): ChannelAdapter {
  return {
    channel: 'tiktok',
    capabilities: { openStore: true, finishNotification: false, containerLifecycle: false },
    openStore() {
      if (typeof root.openAppStore !== 'function') throw new Error('TikTok Playable SDK is unavailable');
      root.openAppStore();
    },
    init(sink) {
      const sdk = root.playableSDK;
      if (!sdk || typeof sdk.isReady !== 'function' || typeof sdk.addEventListener !== 'function') {
        throw new Error('TikTok Playable SDK is unavailable');
      }
      // The blocking SDK script precedes this runtime and exposes synchronous isReady().
      if (sdk.isReady() !== true) throw new Error('TikTok Playable SDK is not ready');
      let revision = 0;
      sdk.addEventListener('muteChange', event => {
        if (!event || typeof event.muted !== 'boolean') return;
        revision++; sink.mute(event.muted);
      });
      if (typeof sdk.isMuted === 'function') {
        const initialRevision = revision;
        try {
          Promise.resolve(sdk.isMuted()).then(value => {
            if (revision === initialRevision) sink.mute(value);
          }).catch(() => {}); // Keep browser gesture/visibility protection on query failure.
        } catch (_) { /* Same fallback for synchronous query failure. */ }
      }
      sink.ready();
    },
  };
}
