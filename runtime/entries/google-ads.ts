import { installRuntime } from '../index';
import { createGoogleAdsAdapter, type GoogleAdsHost } from '../adapters/google-ads';

// Keep the official global call explicit in the shipped bundle for Google validation.
declare const ExitApi: { exit(): void };
installRuntime(() => createGoogleAdsAdapter(window as Window & GoogleAdsHost, () => ExitApi.exit()));
