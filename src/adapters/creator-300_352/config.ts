import { playableOptions } from '../creator-shared/options';

// Creator 3.5 uses boolean common-option visibility, rather than 3.8 overrides.
export const configs = {
  playable: {
    platformName: 'i18n:playable.title', platformType: 'HTML5',
    hooks: './hooks.cjs', panel: './panel.cjs',
    textureCompressConfig: { platformType: 'web', support: { rgb: [], rgba: [] } },
    assetBundleConfig: { supportedCompressionTypes: ['none', 'merge_dep', 'merge_all_json'] },
    commonOptions: { debug: false, sourceMaps: false, md5Cache: false, server: false, mainBundleIsRemote: false },
    options: {
      ...Object.fromEntries(Object.entries(playableOptions).map(([key, option]) => [key, { default: option.default, hidden: true }])),
      channels: { default: null, hidden: true },
    },
  },
};
