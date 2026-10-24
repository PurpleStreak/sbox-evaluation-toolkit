/**
 * @typedef {(
 *   { type: 'class', result: import('../core/equivalence.js').ClassResult } |
 *   { type: 'progress', key: string, done: number, total: number } |
 *   { type: 'result', key: string, result: import('../core/equivalence.js').EquivalenceResult, ms: number } |
 *   { type: 'done' } |
 *   { type: 'error', message: string }
 * )} EquivalenceEvent
 */

/**
 * Run affine-equivalence checks of `sbox` against `candidates` in a fresh Web Worker.
 * @param {import('../core/sbox.js').SBox} sbox
 * @param {{ key: string, sbox: import('../core/sbox.js').SBox }[]} candidates
 * @param {(event: EquivalenceEvent) => void} onEvent
 * @returns {{ cancel: () => void }}  Cancelling terminates the worker immediately.
 */
export function runEquivalence(sbox, candidates, onEvent) {
  const worker = new Worker(new URL('../workers/equivalence.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    onEvent(e.data);
    if (e.data.type === 'done' || e.data.type === 'error') worker.terminate();
  };
  worker.onerror = (e) => {
    onEvent({ type: 'error', message: e.message });
    worker.terminate();
  };
  worker.postMessage({
    sbox: Array.from(sbox.table),
    m: sbox.m,
    candidates: candidates.map((c) => ({ key: c.key, table: Array.from(c.sbox.table), m: c.sbox.m })),
  });
  return { cancel: () => worker.terminate() };
}
