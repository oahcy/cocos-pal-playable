import type { ApplicationAdapter } from '../application';

/** 3.5's application owns a raw XHR for settings, before assetManager exists. */
export const applicationAdapter: ApplicationAdapter = {
  prepareSettings(config, selected) {
    if (config.server || (Array.isArray(config.remoteBundles) && config.remoteBundles.length)) {
      throw new Error('Remote bundles are not supported in playable builds');
    }
    config.orientation = selected.orientation;
    config.debug = false;
  },
  prepareApplication(source) {
    const marker = "var settings = 'src/settings.json';";
    // Deliberately match the known host template once, never replace global XHR APIs.
    // Unknown host templates fail explicitly instead of producing a broken HTML.
    if (source.split(marker).length !== 2) throw new Error('Unsupported Creator 3.5 application settings template');
    return source.replace(marker, `if (window.__legacyEmbeddedContext) {
      window._CCSettings = JSON.parse(JSON.stringify(window.__legacyEmbeddedContext.settings));
      return Promise.resolve();
    }
    ${marker}`);
  },
};
