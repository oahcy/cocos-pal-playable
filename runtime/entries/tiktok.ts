import { installRuntime } from '../index';
import { createTikTokAdapter, type TikTokHost } from '../adapters/tiktok';

installRuntime(() => createTikTokAdapter(window as Window & TikTokHost));
