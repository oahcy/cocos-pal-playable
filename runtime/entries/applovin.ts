import { installRuntime } from '../index';
import { createAppLovinAdapter, type AppLovinHost } from '../adapters/applovin';

const host = window as Window & AppLovinHost & { __playableStoreUrl?: string };
installRuntime(() => createAppLovinAdapter(host, host.__playableStoreUrl || ''));
