import { EmbeddedStore, VIRTUAL_ROOT, resourceError } from './store';

/** Route only our reserved package origin. SDK and other network requests stay native. */
export function installEmbeddedFetch(
  target: { fetch: typeof fetch }, store: EmbeddedStore, onError: (error: Error) => void,
): void {
  const nativeFetch = target.fetch.bind(target);
  const origin = new URL(VIRTUAL_ROOT).origin;
  target.fetch = (input, init) => {
    const value = input instanceof Request ? input.url : String(input);
    let url: URL;
    try { url = new URL(value); } catch { return nativeFetch(input, init); }
    if (url.origin !== origin) return nativeFetch(input, init);
    return (async () => {
      try {
        const request = new Request(input, init);
        if (request.method !== 'GET') throw new Error('Embedded resources only support GET');
        const blobURL = await store.url(url.href);
        // Preserve headers, credentials and cancellation without making a network request.
        return await nativeFetch(new Request(blobURL, request));
      } catch (cause) {
        const error = resourceError('fetch resource', value, cause);
        // Some Creator WASM loaders swallow rejected fetches and otherwise hang forever.
        if (!(cause instanceof Error && cause.name === 'AbortError')) onError(error);
        throw error;
      }
    })();
  };
}
