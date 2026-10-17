/// <reference lib="webworker" />
import { createSearch } from '../core/search.js';
import { createSBox } from '../core/sbox.js';

/**
 * Background runner for the simulated-annealing search.
 *
 * Protocol (main → worker):
 *   { type: 'start', options: SearchWorkerOptions }
 *   { type: 'cancel' }
 * Worker → main:
 *   { type: 'progress', stats, best: number[] }   every ~100 ms
 *   { type: 'done', stats, best: number[], cancelled: boolean }
 *   { type: 'error', message }
 *
 * @typedef {Omit<import('../core/search.js').SearchOptions, 'start'> & { start?: number[] }} SearchWorkerOptions
 */

/** Time slice per chunk; between chunks the worker yields so 'cancel' can arrive. */
const SLICE_MS = 100;

let runId = 0;

/** @param {SearchWorkerOptions} options */
function run(options) {
  const id = ++runId;
  const search = createSearch({
    ...options,
    start: options.start ? createSBox(options.start, options.n) : undefined,
  });
  let chunk = 64;

  const tick = () => {
    if (id !== runId) {
      post('done', search, true);
      return;
    }
    const begin = performance.now();
    search.step(chunk);
    // Adapt the chunk size so each slice takes about SLICE_MS.
    const elapsed = performance.now() - begin;
    chunk = Math.max(16, Math.round(chunk * Math.min(4, SLICE_MS / Math.max(1, elapsed))));
    if (search.done) post('done', search, false);
    else {
      post('progress', search);
      setTimeout(tick, 0);
    }
  };
  post('progress', search);
  setTimeout(tick, 0);
}

/**
 * @param {'progress' | 'done'} type
 * @param {ReturnType<typeof createSearch>} search
 * @param {boolean} [cancelled]
 */
function post(type, search, cancelled = false) {
  self.postMessage({ type, stats: search.stats(), best: Array.from(search.bestSBox().table), cancelled });
}

self.onmessage = (/** @type {MessageEvent} */ e) => {
  const msg = e.data;
  try {
    if (msg.type === 'start') run(msg.options);
    else if (msg.type === 'cancel') runId++;
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
