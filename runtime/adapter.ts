export interface AdapterSink {
  ready(): void;
  mute(value: boolean): void;
}
export interface ChannelAdapter {
  readonly channel: string;
  readonly capabilities: PlayableAPI['capabilities'];
  init(sink: AdapterSink): void;
  openStore(): void;
  /** Required when finishNotification is true. */
  finish?: () => void;
}
