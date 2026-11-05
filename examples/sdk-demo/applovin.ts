import { startDemo } from './main';
import { createAppLovinAdapter, type AppLovinHost } from '../../runtime/adapters/applovin';

declare const __PLAYABLE_STORE_URL__: string;
startDemo(() => createAppLovinAdapter(window as Window & AppLovinHost, __PLAYABLE_STORE_URL__));
