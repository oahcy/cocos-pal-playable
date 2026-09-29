import { channelIds } from './channel';
export default {
  displayName: 'i18n:playable.title', platformType: 'HTML5',
  textureCompressConfig: { platformType: 'web', support: { rgb: [], rgba: [] } },
  assetBundleConfig: { supportedCompressionTypes: ['none', 'merge_dep', 'merge_all_json'], platformType: 'web' },
  commonOptions: {
    polyfills: { default: { asyncFunctions: true } },
    nativeCodeBundleMode: { default: 'asmjs' },
    md5Cache: { default: false },
    sourceMaps: { default: false },
  },
  options: {
    channel: { label: 'i18n:playable.options.channel', type: 'enum', items: channelIds, default: 'tiktok' },
    orientation: { label: 'i18n:playable.options.orientation', type: 'enum', items: ['auto', 'portrait', 'landscape'].map(value => ({ value, label: 'i18n:playable.options.' + value })), default: 'auto' },
  },
};
