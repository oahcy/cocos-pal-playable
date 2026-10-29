import type { EmbeddedStore } from './embedded/store';
export interface StartupContext {
  api: PlayableAPI;
  failure: Promise<never>;
  document: Document;
  reportError(error: unknown): void;
}
export interface EmbeddedContext { store: EmbeddedStore; settingsPath: string }
