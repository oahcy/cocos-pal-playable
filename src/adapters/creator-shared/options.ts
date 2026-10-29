import { defaults, outputFormats, embeddedEncodings, orientations, imageCompressionModes } from '../../options';
import { channelIds } from '../../channel';
const select = (label: string, value: string, items: readonly string[]) => ({ label, default: value,
  render: { ui: 'ui-select-pro', items: items.map(value => ({ label: value, value })) } });
export const playableOptions = {
  storeUrl: { label: 'Store URL (AppLovin)', default: '', render: { ui: 'ui-input' } },
  channel: select('Channel', defaults.channel, channelIds),
  outputFormat: select('Output format', defaults.outputFormat, outputFormats),
  embeddedEncoding: select('Embedded encoding', defaults.embeddedEncoding, embeddedEncodings),
  orientation: select('Orientation', defaults.orientation, orientations),
  imageCompression: select('Image compression', defaults.imageCompression, imageCompressionModes),
  imageQuality: { label: 'Image quality', default: defaults.imageQuality,
    render: { ui: 'ui-num-input', attributes: { min: 1, max: 100, step: 1 } } },
};
