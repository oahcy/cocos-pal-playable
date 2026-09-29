type PlayableUnsubscribe = () => void;
interface PlayableAPI {
  /** Channel selected at build time. Currently only tiktok is implemented. */
  readonly channel: string;
  readonly capabilities: { readonly openStore: boolean; readonly finishNotification: boolean; readonly containerLifecycle: boolean };
  /** SDK ready only; does not imply assets loaded or ad visible. */
  readonly ready: boolean;
  /** Both the page and advertising container allow display. False until queried. */
  readonly viewable: boolean;
  /** Once per subscription; invokes immediately if already ready. */
  onReady(callback: () => void): PlayableUnsubscribe;
  /** Call from a real user gesture. Does not synthesize pause. */
  openStore(): void;
  /** Idempotent; local marker when finishNotification=false. Never redirects. */
  finish(): void;
  /** Combined page/container visibility; future transitions only. Read viewable for initial state. */
  onPause(callback: () => void): PlayableUnsubscribe;
  onResume(callback: () => void): PlayableUnsubscribe;
  /** Immediately supplies current policy, then changes. Does not override user audio settings. */
  onMuteChange(callback: (muted: boolean) => void): PlayableUnsubscribe;
}
declare const playable: PlayableAPI;
