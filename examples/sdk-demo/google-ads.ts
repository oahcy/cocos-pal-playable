import { startDemo } from './main';
import { createGoogleAdsAdapter, type GoogleAdsHost } from '../../runtime/adapters/google-ads';

declare const ExitApi: { exit(): void };
startDemo(() => createGoogleAdsAdapter(window as Window & GoogleAdsHost, () => ExitApi.exit()));
