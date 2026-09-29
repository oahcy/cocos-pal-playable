import { createPlayable } from './core';
import { createTikTokAdapter, type TikTokHost } from './adapters/tiktok';
import { startPlayable, showStartupError, type PlayableApplication, type PlayableEngine } from './startup';

declare global {
  interface Window extends TikTokHost {
    playable: PlayableAPI;
    __startPlayable(application: PlayableApplication, loadEngine: () => Promise<PlayableEngine>): Promise<void>;
  }
}
let fail: (error: Error) => void = () => {};
const failure = new Promise<never>((_, reject) => { fail = reject; });
// An SDK query can fail before SystemJS has loaded the entry point.
void failure.catch(error => showStartupError(document, error));
try { window.playable = createPlayable(createTikTokAdapter(window), document, fail); }
catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
window.__startPlayable = async (application, loadEngine) => {
  try { await startPlayable(application, loadEngine, window.playable, failure, document); }
  catch (error) { showStartupError(document, error); }
};
