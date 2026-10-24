// Inlined (bundled into this module and started from a Blob URL) so it also works when the
// app is opened straight from disk as a single HTML file, where file:// workers are blocked.
import SearchWorker from '../workers/search.worker.js?worker&inline';
import { createSBox } from '../core/sbox.js';

/**
 * @typedef {object} SearchUpdate
 * @property {import('../core/search.js').SearchStats} stats
 * @property {import('../core/sbox.js').SBox} best
 * @property {boolean} done
 * @property {boolean} cancelled
 */

/**
 * Run the simulated-annealing search in a Web Worker.
 * @param {import('../workers/search.worker.js').SearchWorkerOptions} options
 * @param {(update: SearchUpdate) => void} onUpdate
 * @param {(message: string) => void} [onError]
 * @returns {{ cancel: () => void }}
 */
export function startSearch(options, onUpdate, onError) {
  const worker = new SearchWorker();
  worker.onmessage = (e) => {
    const msg = e.data;
    if (msg.type === 'error') {
      onError?.(msg.message);
      worker.terminate();
      return;
    }
    const done = msg.type === 'done';
    onUpdate({ stats: msg.stats, best: createSBox(msg.best, options.n), done, cancelled: msg.cancelled });
    if (done) worker.terminate();
  };
  worker.onerror = (e) => {
    onError?.(e.message);
    worker.terminate();
  };
  worker.postMessage({ type: 'start', options });
  return {
    cancel: () => worker.postMessage({ type: 'cancel' }),
  };
}
