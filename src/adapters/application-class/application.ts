import type { ApplicationAdapter } from '../application';
export const applicationAdapter: ApplicationAdapter = {
  prepareSettings(config, selected) {
    const assets = config.assets as { server?: string; remoteBundles?: string[] } | undefined;
    if (assets?.server || assets?.remoteBundles?.length) throw new Error('Remote bundles are not supported in playable builds');
    config.screen = { ...config.screen as object, orientation: selected.orientation };
    config.profiling = { ...config.profiling as object, showFPS: false };
  },
  prepareApplication: source => source,
};
