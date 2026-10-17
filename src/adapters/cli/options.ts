import { normalizeOptions } from '../../options';
import type { BuildOptions } from './builder-types';

export function readOptions(options: BuildOptions) {
  return normalizeOptions(options.packages?.playable);
}
