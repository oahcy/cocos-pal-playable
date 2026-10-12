import { defaults, orientations, imageCompressionModes, outputFormats } from './options';
import { channelIds } from './channel';
export default {
  displayName: 'i18n:playable.title', platformType: 'HTML5',
  textureCompressConfig: { platformType: 'web', support: { rgb: [], rgba: [] } },
  assetBundleConfig: { supportedCompressionTypes: ['none', 'merge_dep', 'merge_all_json'], platformType: 'web' },
  commonOptions: {
    debug: { default: false },
    polyfills: { default: { asyncFunctions: true } },
    nativeCodeBundleMode: { default: 'asmjs' },
    md5Cache: { default: false },
    sourceMaps: { default: false },
  },
  options: {
    outputFormat: { label: 'i18n:playable.options.outputFormat', type: 'enum', items: outputFormats.map(value => ({ value, label: 'i18n:playable.options.' + value })), default: defaults.outputFormat },
    imageCompression: { label: 'i18n:playable.options.imageCompression', type: 'enum', items: imageCompressionModes.map(value => ({ value, label: 'i18n:playable.options.' + value })), default: defaults.imageCompression },
    imageQuality: { label: 'i18n:playable.options.imageQuality', type: 'number', default: defaults.imageQuality },
    channel: { label: 'i18n:playable.options.channel', type: 'enum', items: channelIds, default: defaults.channel },
    orientation: { label: 'i18n:playable.options.orientation', type: 'enum', items: orientations.map(value => ({ value, label: 'i18n:playable.options.' + value })), default: defaults.orientation },
  },
};
