/// <reference lib="webworker" />
import { affineEquivalence, invariantFingerprint, optimalClass4 } from '../core/equivalence.js';
import { createSBox } from '../core/sbox.js';

/**
 * Affine-equivalence checks off the main thread. One run per worker: the client cancels by
 * terminating the worker, so no cooperative cancellation is needed here.
 *
 * Main → worker: { sbox: number[], m: number, candidates: { key: string, table: number[], m: number }[] }
 * Worker → main: { type: 'class', result }
 *                { type: 'progress', key, done, total }
 *                { type: 'result', key, result, ms }
 *                { type: 'done' }
 *                { type: 'error', message }
 */
self.onmessage = (/** @type {MessageEvent} */ e) => {
  try {
    const { sbox, m, candidates } = e.data;
    const target = createSBox(sbox, m);
    if (target.n === 4 && target.m === 4) self.postMessage({ type: 'class', result: optimalClass4(target) });
    const fp = invariantFingerprint(target);
    for (const c of candidates) {
      const ref = createSBox(c.table, c.m);
      const start = performance.now();
      let last = 0;
      const result = affineEquivalence(ref, target, {
        fingerprints: ref.n === target.n && ref.m === target.m ? [invariantFingerprint(ref), fp] : undefined,
        onProgress: (done, total) => {
          const now = performance.now();
          if (now - last > 100) {
            last = now;
            self.postMessage({ type: 'progress', key: c.key, done, total });
          }
        },
      });
      self.postMessage({ type: 'result', key: c.key, result, ms: performance.now() - start });
    }
    self.postMessage({ type: 'done' });
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
