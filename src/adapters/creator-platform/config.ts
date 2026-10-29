import { playableOptions } from '../creator-shared/options';

/** Requires an Editor that admits playable as an internal platform plugin. */
export const configs = {
  playable: {
    platformName: 'i18n:playable.title',
    platformType: 'HTML5',
    hooks: './hooks.cjs',
    panel: './panel.cjs',
    disableBuildStageLinking: true,
    textureCompressConfig: { platformType: 'web', support: { rgb: [], rgba: [] } },
    assetBundleConfig: { platformType: 'web', supportedCompressionTypes: ['none', 'merge_dep', 'merge_all_json'] },
    commonOptions: {
      debug: { hidden: true, default: false },
      sourceMaps: { hidden: true, default: false },
      md5Cache: { hidden: true, default: false },
      server: { hidden: true, default: '' },
      mainBundleIsRemote: { hidden: true, default: false },
      polyfills: { hidden: false, default: { asyncFunctions: true } },
      buildScriptTargets: { hidden: false },
      nativeCodeBundleMode: { default: 'asmjs' },
    },
    // Keep old saved keys readable, but let the custom panel own all visible controls.
    options: {
      ...Object.fromEntries(Object.entries(playableOptions).map(([key, option]) => [key, { default: option.default, hidden: true }])),
      channels: { default: null, hidden: true },
    },
  },
};
