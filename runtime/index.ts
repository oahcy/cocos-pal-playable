import { createPlayable } from './core';
import { createTikTokAdapter, type TikTokHost } from './adapters/tiktok';

declare global {
  interface Window extends TikTokHost {
    playable: PlayableAPI;
  }
}
window.playable = createPlayable(createTikTokAdapter(window), document);
