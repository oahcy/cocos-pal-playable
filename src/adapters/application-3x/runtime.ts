// 3.6 transitioned from factory startup to Application. Select the exported protocol,
// not a guessed Editor patch number; all compatibility stays in this adapter.
import { installStartup as installClass, prepareEmbedded as prepareClass } from '../application-class/runtime';
import { installStartup as installFactory, prepareEmbedded as prepareFactory } from '../creator-300_352/runtime';
import type { StartupContext, EmbeddedContext } from '../../../runtime/host';
export function installStartup(context: StartupContext): void {
  installClass(context);
  installFactory(context);
}
export async function prepareEmbedded(context: EmbeddedContext): Promise<void> {
  await prepareClass(context);
  await prepareFactory(context);
}
