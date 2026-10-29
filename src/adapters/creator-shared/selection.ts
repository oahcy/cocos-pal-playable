import { channelIds, getChannel } from '../../channel';
import { defaults, normalizeOptions, type PlayableOptions } from '../../options';

export interface ChannelSelection extends Omit<PlayableOptions, 'channel'> { enabled: boolean }
export interface CreatorPlayableOptions extends PlayableOptions {
  channels?: Record<string, ChannelSelection> | null;
}

/** No channel map means an existing single-channel task; an empty map means none selected. */
export function readChannelSelections(options: CreatorPlayableOptions = {}): Record<string, ChannelSelection> {
  if (options.channels != null) {
    if (typeof options.channels !== 'object' || Array.isArray(options.channels)) throw new Error('Invalid playable channel settings');
    for (const [id, value] of Object.entries(options.channels)) {
      getChannel(id);
      if (!value || typeof value.enabled !== 'boolean') throw new Error('Invalid channel selection: ' + id);
    }
    return options.channels;
  }
  const channel = options.channel ?? defaults.channel;
  getChannel(channel);
  // Do not validate field values here: the panel must still render invalid saved values
  // so the user can fix them. selectedChannels validates before building.
  const selected = {
    outputFormat: options.outputFormat ?? defaults.outputFormat,
    embeddedEncoding: options.embeddedEncoding ?? defaults.embeddedEncoding,
    orientation: options.orientation ?? defaults.orientation,
    imageCompression: options.imageCompression ?? defaults.imageCompression,
    imageQuality: options.imageQuality ?? defaults.imageQuality,
    ...(options.storeUrl ? { storeUrl: options.storeUrl } : {}),
  };
  return Object.fromEntries(channelIds.map(id => [id, id === channel
    ? { ...selected, enabled: true }
    : { enabled: false }]));
}

export function selectedChannels(options: CreatorPlayableOptions = {}) {
  const selections = readChannelSelections(options);
  const selected = Object.entries(selections).filter(([, value]) => value.enabled).map(([channel, value]) => {
    const normalized = normalizeOptions({ ...value, channel });
    const definition = getChannel(channel);
    const format = normalized.outputFormat === 'channel-default' ? definition.packageFormat : normalized.outputFormat;
    if (definition.supportedFormats && !definition.supportedFormats.includes(format)) {
      throw new Error(definition.displayName + ' does not support ' + format);
    }
    return normalized;
  });
  if (!selected.length) throw new Error('Select at least one playable channel');
  return selected;
}
