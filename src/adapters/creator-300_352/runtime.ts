// Browser entry: never import hooks, Editor, fs or the build-time application adapter here.
import type { StartupContext, EmbeddedContext } from '../../../runtime/host';
import { startCreator35 } from './startup';

export function installStartup(context: StartupContext): void {
  window.__startLegacyPlayable = async factory => {
    try { await startCreator35(factory, context.api, context.failure, context.document); }
    catch (error) { context.reportError(error); }
  };
}
export async function prepareEmbedded({ store, settingsPath }: EmbeddedContext): Promise<void> {
  if (typeof window.__startLegacyPlayable !== 'function') throw new Error('Channel runtime is missing');
  window.__legacyEmbeddedContext = { store, settings: await store.json<Record<string, unknown>>(settingsPath) };
}
