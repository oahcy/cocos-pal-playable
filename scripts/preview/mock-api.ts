import type { AdapterSink, ChannelAdapter } from '../../runtime/adapter';

export interface MockPreview {
  createAdapter(): ChannelAdapter;
  ready(): void;
  setViewable(value: boolean): void;
  setMuted(value: boolean): void;
  readonly calls: Array<'openStore' | 'finish'>;
}

// This entry is bundled by the preview server, outside the delivery build.
export function installMockPreview(root: Window): MockPreview {
  const parameters = new URL(root.location.href).searchParams;
  let sink: AdapterSink | undefined;
  let ready = parameters.get('ready') !== 'manual';
  let viewable = parameters.get('viewable') !== 'false';
  let muted = parameters.get('muted') === 'true';
  const calls: MockPreview['calls'] = [];
  function record(call: 'openStore' | 'finish') {
    calls.push(call);
    console.info('[Playable mock]', call);
  }
  const adapter: ChannelAdapter = {
    channel: 'mock',
    capabilities: { openStore: true, finishNotification: true, containerLifecycle: true },
    init(target) {
      sink = target;
      sink.viewable(viewable);
      sink.mute(muted);
      if (ready) sink.ready();
    },
    openStore() { record('openStore'); },
    finish() { record('finish'); },
  };
  const preview: MockPreview = {
    calls,
    createAdapter() { return adapter; },
    ready() {
      ready = true;
      sink?.ready();
    },
    setViewable(value) {
      if (typeof value !== 'boolean') throw new TypeError('viewable must be boolean');
      viewable = value;
      sink?.viewable(value);
    },
    setMuted(value) {
      if (typeof value !== 'boolean') throw new TypeError('muted must be boolean');
      muted = value;
      sink?.mute(value);
    },
  };
  root.__playablePreview = preview;
  return preview;
}
