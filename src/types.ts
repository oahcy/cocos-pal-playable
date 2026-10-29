import type { EmbeddedEncoding } from '../runtime/embedded/embedded-codec';
import type { ImageReport } from './packaging/images';
export type Orientation = 'auto' | 'portrait' | 'landscape';
export interface Entry { name: string; data: Buffer }
export interface Channel {
  // Maximum number of files in a directory ZIP; exceeding it is reported, not fatal.
  maxFiles?: number;
  runtimeFile?: string;
  supportedOrientations?: Orientation[];
  requiresStoreUrl?: boolean;
  sdkPlacement?: 'head' | 'body';
  supportedFormats?: string[];
  reviewEntries?(entries: Entry[]): string[];
  headHTML?(options: { orientation: Orientation }): string;
  id: string; displayName: string; sdkURL: string; packageFormat: string; resourceMode: string;
  archiveName: string; maxBytesExclusive: number; extraRootFiles: string[]; pending: string[];
  createFiles(options: { orientation: Orientation }): Array<{name: string; data: string}>;
  allowsReference(from: string, value: string): boolean;
  validate(entries: Entry[]): void;
}
export interface PackageReport {
  channel: string; status: 'failed' | 'packaged'; archive: string; maxBytesExclusive: number; verification: 'local-static-only'; pending: string[];
  packageFormat?: string; resourceMode?: 'files' | 'embedded'; channelDefaultFormat?: boolean;
  sizeLimitExceeded?: boolean; sizeLimitError?: string;
  maxFiles?: number; fileCountLimitExceeded?: boolean; fileCountLimitError?: string;
  embeddedEncoding?: EmbeddedEncoding;
  images?: ImageReport; bytes?: number; files?: Array<{path: string; bytes: number}>; sha256?: string; error?: string;
}
