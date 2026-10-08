import type { ImageReport } from './packaging/images';
export type Orientation = 'auto' | 'portrait' | 'landscape';
export interface Entry { name: string; data: Buffer }
export interface Channel {
  id: string; displayName: string; sdkURL: string; packageFormat: string; resourceMode: string;
  archiveName: string; maxBytesExclusive: number; extraRootFiles: string[]; pending: string[];
  createFiles(options: { orientation: Orientation }): Array<{name: string; data: string}>;
  allowsReference(from: string, value: string): boolean;
  validate(entries: Entry[]): void;
}
export interface PackageReport {
  channel: string; status: 'failed' | 'packaged'; archive: string; maxBytesExclusive: number; verification: 'local-static-only'; pending: string[];
  images?: ImageReport; bytes?: number; files?: Array<{path: string; bytes: number}>; sha256?: string; error?: string;
}
