import type { ChannelAdapter } from '../adapter';

interface TikTokSDK {
  isReady(): boolean;
  addEventListener(event: 'muteChange', callback: (event: { muted: boolean; isInit?: boolean }) => void): void;
  addEventListener(event: 'visibilityChange', callback: (event: { viewable: boolean; isInit?: boolean }) => void): void;
  isViewable(): boolean | Promise<boolean>;
  sendEvent(event: 'finishPlayPlayable'): void;
  isMuted?(): boolean | Promise<boolean>;
}
export interface TikTokHost {
  playableSDK?: TikTokSDK;
  openAppStore?: () => void;
}
export function createTikTokAdapter(root: TikTokHost): ChannelAdapter {
  return {
    channel: 'tiktok',
    capabilities: { openStore: true, finishNotification: true, containerLifecycle: true },
    openStore() {
      if (typeof root.openAppStore !== 'function') throw new Error('TikTok Playable SDK is unavailable');
      root.openAppStore();
    },
    finish() {
      if (typeof root.playableSDK?.sendEvent !== 'function') throw new Error('TikTok finish notification is unavailable');
      root.playableSDK.sendEvent('finishPlayPlayable');
    },
    init(sink) {
      const sdk = root.playableSDK;
      if (!sdk || typeof sdk.isReady !== 'function' || typeof sdk.addEventListener !== 'function' || typeof sdk.isViewable !== 'function' || typeof sdk.sendEvent !== 'function') {
        throw new Error('TikTok Playable SDK is unavailable');
      }
      // The blocking SDK script precedes this runtime and exposes synchronous isReady().
      if (sdk.isReady() !== true) throw new Error('TikTok Playable SDK is not ready');
      let visibilityRevision = 0;
      sdk.addEventListener('visibilityChange', event => {
        if (!event || typeof event.viewable !== 'boolean') return;
        visibilityRevision++; sink.viewable(event.viewable);
      });
      const initialVisibilityRevision = visibilityRevision;
      const queryFailed = (error: unknown) => {
        if (visibilityRevision !== initialVisibilityRevision) return;
        sink.error(new Error('TikTok container visibility query failed: ' + String(error)));
      };
      try {
        Promise.resolve(sdk.isViewable()).then(value => {
          if (visibilityRevision !== initialVisibilityRevision) return;
          if (typeof value !== 'boolean') { queryFailed('invalid response'); return; }
          sink.viewable(value);
        }).catch(queryFailed);
      } catch (error) { queryFailed(error); }
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
