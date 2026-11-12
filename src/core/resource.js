// Retry the entire transfer, including reading/decompressing the response body. This matters when
// a mobile connection drops after the server has already sent response headers.
async function readWithRetry(url, read, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await read(response);
    } catch (error) {
      last = error;
      if (i + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)));
    }
  }
  throw new Error(`${url}: ${last?.message || 'network error'}`);
}
export const loadJson = (url) => readWithRetry(url, (r) => r.json());
export const loadBlob = (url) => readWithRetry(url, (r) => r.blob());
export const loadRawBinary = (url) => readWithRetry(url, (r) => r.arrayBuffer());
export async function loadBinary(url) {
  if (typeof DecompressionStream === 'function') {
    try {
      return await readWithRetry(`${url}.gz`, (r) => {
        if (!r.body) throw new Error('Streaming unavailable');
        return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      });
    } catch (error) {
      // Older browsers, proxies, or incomplete deployments can still use the original file.
      console.warn(`Compressed resource unavailable, trying original: ${url}`, error);
    }
  }
  return loadRawBinary(url);
}
