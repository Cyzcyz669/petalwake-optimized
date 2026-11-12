import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { loadBinary, loadJson, loadBlob } from '../src/core/resource.js';
const original = globalThis.fetch;
try {
  const bytes = Buffer.from('same detailed island geometry');
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    if (calls === 1) throw new TypeError('Load failed');
    assert.equal(url, 'asset.bin.gz');
    return new Response(gzipSync(bytes));
  };
  assert.deepEqual(Buffer.from(await loadBinary('asset.bin')), bytes);
  assert.equal(calls, 2, 'failed compressed transfer must be retried');
  calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    return url.endsWith('.gz') ? new Response('bad gzip') : new Response(bytes);
  };
  const warn = console.warn; console.warn = () => {};
  try { assert.deepEqual(Buffer.from(await loadBinary('asset.bin')), bytes); }
  finally { console.warn = warn; }
  assert.equal(calls, 4, 'after compressed retries, fallback to original');
  calls = 0;
  globalThis.fetch = async () => ++calls === 1 ? new Response('', {status: 503}) : new Response('{"ok":true}');
  assert.deepEqual(await loadJson('index.json'), {ok:true}); assert.equal(calls,2);
  globalThis.fetch = async () => new Response(bytes);
  assert.deepEqual(Buffer.from(await (await loadBlob('img')).arrayBuffer()), bytes);
  console.log('PASS: compressed transfer, retry, fallback, JSON and image fetch');
} finally { globalThis.fetch = original; }
