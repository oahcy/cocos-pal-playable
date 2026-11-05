/** Read the engine's own startup banner; do not infer the version from artifact names. */
export class EngineLogCheck {
  private readonly versions = new Set<string>();

  constructor(private readonly expectedVersion?: string) {
    if (expectedVersion !== undefined && !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(expectedVersion)) {
      throw new Error('Expected version must be a full Creator version, e.g. 2.4.12');
    }
  }

  observe(text: string) {
    // Creator uses console styling (%c); scan for the banner within the complete message.
    const banners = text.matchAll(/Cocos Creator v(\d+\.\d+\.\d+(?:-[\w.-]+)?)(?![\w.-])/g);
    for (const banner of banners) this.versions.add(banner[1]);
  }

  get hasBanner(): boolean { return this.versions.size > 0; }

  verify(runtimeVersion?: unknown): string {
    // Some release engines omit the banner. Read the running engine, never the expected value.
    if (runtimeVersion !== undefined && runtimeVersion !== null) {
      if (typeof runtimeVersion !== 'string' || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(runtimeVersion)) {
        throw new Error('Invalid runtime cc.ENGINE_VERSION');
      }
      this.versions.add(runtimeVersion);
    }
    if (this.versions.size === 0) throw new Error('Missing engine version evidence: Cocos Creator v<version> log and cc.ENGINE_VERSION unavailable');
    if (this.versions.size !== 1) throw new Error('Conflicting Creator versions in browser logs: ' + [...this.versions].join(', '));
    const actual = [...this.versions][0];
    if (this.expectedVersion !== undefined && actual !== this.expectedVersion) {
      throw new Error('Creator version mismatch: expected ' + this.expectedVersion + ', got ' + actual);
    }
    return actual;
  }
}
