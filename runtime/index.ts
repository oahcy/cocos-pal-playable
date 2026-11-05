import { installStartup } from '@playable/host-runtime';
import { createPlayable } from './core';
import type { ChannelAdapter } from './adapter';
import { showStartupError } from './errors';

declare global {
  interface Window {
    playable: PlayableAPI;
    /** Set before runtime initialization by the explicit local preview mode. */
    __playablePreview?: { createAdapter(): ChannelAdapter };
  }
}
// The channel supplies its SDK; the release-selected host adapter supplies startup.
export function installRuntime(createAdapter: () => ChannelAdapter): void {
  let fail: (error: Error) => void = () => {};
  const failure = new Promise<never>((_, reject) => { fail = reject; });
  const reportError = (error: unknown) => showStartupError(document, error);
  // An SDK query can fail before SystemJS has loaded the entry point.
  void failure.catch(reportError);
  try {
    const adapter = window.__playablePreview ? window.__playablePreview.createAdapter() : createAdapter();
    window.playable = createPlayable(adapter, document, fail);
  }
  catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
  installStartup({ api: window.playable, failure, document, reportError });
}
