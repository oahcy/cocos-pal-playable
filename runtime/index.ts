import { createPlayable } from './core';
import type { ChannelAdapter } from './adapter';
import { startPlayable, showStartupError, type PlayableApplication, type PlayableEngine } from './startup';

declare global {
  interface Window {
    playable: PlayableAPI;
    __startPlayable(application: PlayableApplication, loadEngine: () => Promise<PlayableEngine>): Promise<void>;
  }
}
// The channel entry supplies its adapter; this module only wires shared runtime behavior.
export function installRuntime(createAdapter: () => ChannelAdapter): void {
  let fail: (error: Error) => void = () => {};
  const failure = new Promise<never>((_, reject) => { fail = reject; });
  // An SDK query can fail before SystemJS has loaded the entry point.
  void failure.catch(error => showStartupError(document, error));
  try { window.playable = createPlayable(createAdapter(), document, fail); }
  catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
  window.__startPlayable = async (application, loadEngine) => {
    try { await startPlayable(application, loadEngine, window.playable, failure, document); }
    catch (error) { showStartupError(document, error); }
  };
}
