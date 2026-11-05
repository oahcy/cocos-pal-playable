import { startDemo } from './main';
import { createTikTokAdapter, type TikTokHost } from '../../runtime/adapters/tiktok';

startDemo(() => createTikTokAdapter(window as Window & TikTokHost));
