interface PlayableAPI {
  readonly capabilities: { readonly openStore: boolean; readonly finishNotification: boolean; readonly containerLifecycle: boolean };
  openStore(): void;
  /** Idempotent local finish marker; TikTok has no finish notification in this adapter. */
  finish(): void;
  onPause(callback: () => void): () => void;
  onResume(callback: () => void): () => void;
  onMuteChange(callback: (muted: boolean) => void): () => void;
}
declare const playable: PlayableAPI;
