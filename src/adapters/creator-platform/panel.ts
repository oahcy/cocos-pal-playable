import { channelIds, getChannel } from '../../channel';
import { defaults, embeddedEncodings, orientations, imageCompressionModes, type OutputFormat } from '../../options';
import { readChannelSelections, selectedChannels, type ChannelSelection, type CreatorPlayableOptions } from '../creator-shared/selection';

declare const Editor: { I18n: { t(key: string): string } };
interface BuildOptions { packages?: { playable?: CreatorPlayableOptions } }
interface Panel {
  $: { root: HTMLElement };
  options: BuildOptions;
  readOnly: boolean;
  listener?: (event: Event) => void;
  dispatch(name: string, path: string, value: unknown, error: string | null): void;
}
export const $ = { root: '.playable-channels' };
export const template = '<div class="playable-channels"></div>';
export const style = `
  .playable-channels fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
  .playable-channels section { border: 1px solid var(--color-normal-border, #555); border-radius: 4px; padding: 10px; margin: 8px 0; }
  .playable-channels .heading { display: flex; align-items: center; gap: 6px; font-weight: bold; }
  .playable-channels .details { padding: 6px 0 0 20px; }
  .playable-channels .row { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
  .playable-channels .row span { flex: 1; }
  .playable-channels select, .playable-channels input:not([type=checkbox]) { box-sizing: border-box; width: 180px; max-width: 50%; padding: 3px; color: inherit; background: var(--color-normal-fill, #333); border: 1px solid var(--color-normal-border, #555); border-radius: 3px; }
  .playable-channels .hint { opacity: .7; font-size: 12px; }
  .playable-channels .error { color: var(--color-danger-fill, #ef7777); }
`;
function label(key: string) { return Editor.I18n.t('playable.options.' + key); }
function validation(options: CreatorPlayableOptions): string | null {
  try { selectedChannels(options); return null; }
  catch (error) { return error instanceof Error ? error.message : String(error); }
}
function field(details: HTMLElement, id: string, key: string, value: string | number, values?: readonly string[]) {
  const row = document.createElement('label'); row.className = 'row';
  const text = document.createElement('span'); text.textContent = label(key); row.appendChild(text);
  let control: HTMLSelectElement | HTMLInputElement;
  if (values) {
    const select = document.createElement('select');
    for (const choice of values) {
      const option = document.createElement('option'); option.value = choice;
      option.textContent = key === 'embeddedEncoding' ? choice : label(choice);
      select.appendChild(option);
    }
    control = select;
  } else {
    const input = document.createElement('input'); input.type = key === 'storeUrl' ? 'url' : 'number';
    if (input.type === 'number') { input.min = '1'; input.max = '100'; input.step = '1'; }
    control = input;
  }
  control.dataset.channel = id; control.dataset.key = key; control.value = String(value);
  row.appendChild(control); details.appendChild(row);
}
function render(panel: Panel) {
  const root = panel.$.root;
  const active = (root.getRootNode() as Document | ShadowRoot).activeElement as HTMLElement | null;
  const focus = active && root.contains(active) ? { channel: active.dataset.channel, key: active.dataset.key } : undefined;
  root.textContent = '';
  const fieldset = document.createElement('fieldset'); fieldset.disabled = panel.readOnly;
  root.appendChild(fieldset);
  const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = label('channelsHint'); fieldset.appendChild(hint);
  const options = panel.options.packages?.playable || {};
  let selections: Record<string, ChannelSelection>;
  try { selections = readChannelSelections(options); }
  catch (error) { root.textContent = error instanceof Error ? error.message : String(error); return; }
  for (const id of channelIds) {
    const channel = getChannel(id);
    const selected = { ...defaults, ...selections[id] };
    const section = document.createElement('section');
    const heading = document.createElement('label'); heading.className = 'heading';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox';
    checkbox.dataset.channel = id; checkbox.dataset.key = 'enabled'; checkbox.checked = selected.enabled === true;
    heading.appendChild(checkbox); heading.appendChild(document.createTextNode(channel.displayName)); section.appendChild(heading);
    fieldset.appendChild(section);
    if (!checkbox.checked) continue;
    const details = document.createElement('div'); details.className = 'details'; section.appendChild(details);
    const formats = channel.supportedFormats || ['directory-zip', 'single-html'];
    field(details, id, 'outputFormat', selected.outputFormat, ['channel-default', ...formats]);
    const format = selected.outputFormat === 'channel-default' ? channel.packageFormat : selected.outputFormat;
    if (format === 'single-html' || !embeddedEncodings.includes(selected.embeddedEncoding)) {
      field(details, id, 'embeddedEncoding', selected.embeddedEncoding, embeddedEncodings);
    }
    field(details, id, 'orientation', selected.orientation, channel.supportedOrientations || orientations);
    if (channel.requiresStoreUrl) field(details, id, 'storeUrl', selected.storeUrl || '');
    field(details, id, 'imageCompression', selected.imageCompression, imageCompressionModes);
    const invalidQuality = !Number.isInteger(selected.imageQuality) || selected.imageQuality < 1 || selected.imageQuality > 100;
    if (selected.imageCompression !== 'none' || invalidQuality) field(details, id, 'imageQuality', selected.imageQuality);
  }
  const error = validation(options);
  if (error) { const message = document.createElement('p'); message.className = 'error'; message.textContent = error; fieldset.appendChild(message); }
  if (focus?.channel && focus.key) {
    const controls = root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-channel][data-key]');
    [...controls].find(control => control.dataset.channel === focus.channel && control.dataset.key === focus.key)?.focus();
  }
}
function change(panel: Panel, event: Event) {
  if (panel.readOnly) return;
  const target = event.target as HTMLInputElement | HTMLSelectElement;
  const id = target.dataset?.channel;
  const key = target.dataset?.key;
  if (!id || !key) return;
  const options = panel.options.packages?.playable || {};
  const channels = { ...readChannelSelections(options) };
  const selected: ChannelSelection = { ...channels[id], enabled: channels[id]?.enabled ?? false };
  // Only these controls can update the saved configuration; never assign an arbitrary path.
  switch (key) {
    case 'enabled': selected.enabled = (target as HTMLInputElement).checked; break;
    case 'outputFormat': selected.outputFormat = target.value as OutputFormat; break;
    case 'embeddedEncoding': selected.embeddedEncoding = target.value as ChannelSelection['embeddedEncoding']; break;
    case 'storeUrl': selected.storeUrl = target.value; break;
    case 'orientation': selected.orientation = target.value; break;
    case 'imageCompression': selected.imageCompression = target.value as ChannelSelection['imageCompression']; break;
    case 'imageQuality': selected.imageQuality = Number(target.value); break;
    default: return;
  }
  channels[id] = selected;
  const updated = { ...options, channels };
  panel.options.packages = { ...panel.options.packages, playable: updated };
  render(panel);
  panel.dispatch('update', 'packages.playable.channels', channels, validation(updated));
}
export function ready(this: Panel, options: BuildOptions, type: string) {
  this.options = options; this.readOnly = type === 'check';
  this.listener = event => change(this, event);
  this.$.root.addEventListener('change', this.listener);
  render(this);
}
export function update(this: Panel, options: BuildOptions) {
  // Creator notifies every plugin about all build options. Unrelated changes must not
  // replace the form while the user is editing a field or navigating with the keyboard.
  const changed = JSON.stringify(this.options.packages?.playable) !== JSON.stringify(options.packages?.playable);
  this.options = options;
  if (changed) render(this);
}
export function close(this: Panel) {
  if (this.listener) this.$.root.removeEventListener('change', this.listener);
  this.listener = undefined;
}
