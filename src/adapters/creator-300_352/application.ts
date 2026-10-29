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
    // Babel versions emit var or let; accept only the known local settings assignment.
    const assignment = /\b(?:var|let|const)\s+settings\s*=\s*['"]src\/settings(?:\.[a-f0-9]+)?\.json['"]\s*;/g;
    const matches = [...source.matchAll(assignment)];
    if (matches.length !== 1) throw new Error('Unsupported Creator factory application settings template');
    const marker = matches[0][0];
    return source.replace(marker, `if (window.__legacyEmbeddedContext) {
      window._CCSettings = JSON.parse(JSON.stringify(window.__legacyEmbeddedContext.settings));
      return Promise.resolve();
    }
    ${marker}`);
  },
};
