import { createAfterBuild } from '../creator-300_352/hooks';
import { rebuildBrowserLoader } from '../creator-shared/browser-loader';

export { throwError, onBeforeInit, onAfterInit } from '../creator-300_352/hooks';

// Creator 3.7 selects the loader by platform name but still runs the legacy Web hooks.
export const onAfterBuild = createAfterBuild(rebuildBrowserLoader);
