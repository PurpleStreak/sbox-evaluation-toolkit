/**
 * Build-time precomputation (run with `npm run precompute`; output is committed):
 *
 *   src/data/presets.json   scalar metrics of every reference S-box
 *   src/data/baseline.json  metric distributions over random permutations, per size
 *
 * The baseline lets the app say "better than 97% of random 8-bit permutations"
 * without computing anything at runtime. Work is spread over all CPU cores.
 */
import { writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { analyze } from '../src/core/analyze.js';
import { randomPermutation } from '../src/core/generators.js';
import { METRICS } from '../src/core/metrics.js';
import { PRESETS } from '../src/core/presets.js';

const SIZES = [3, 4, 5, 6, 7, 8];
const SAMPLES = 10000;
const BASE_SEED = 0x5b0c; // fixed so the committed baseline is reproducible

/**
 * Scalar metric values of one analysis, rounded to keep the JSON compact.
 * @param {import('../src/core/analyze.js').Analysis} a
 * @returns {Record<string, number | null>}
 */
function scalars(a) {
  /** @type {Record<string, number | null>} */
  const out = {};
  for (const m of METRICS) {
    const v = m.get(a);
    out[m.id] = v === null ? null : Math.round(v * 1e6) / 1e6;
  }
  return out;
}

if (isMainThread) {
  const started = performance.now();

  // Presets.
  const presets = PRESETS.map((p) => {
    const a = analyze(p.sbox);
    return {
      id: p.id,
      properties: a.properties,
      metrics: scalars(a),
      cycles: a.structure.cycles,
      fixedPoints: a.structure.fixedPoints,
    };
  });
  writeFileSync(new URL('../src/data/presets.json', import.meta.url), JSON.stringify(presets, null, 1) + '\n');
  console.log(`presets.json: ${presets.length} S-boxes`);

  // Baseline: split each size's samples across workers.
  const threads = availableParallelism();
  /** @type {Record<number, { samples: number, metrics: Record<string, [number, number][]> }>} */
  const baseline = {};
  for (const n of SIZES) {
    const t = performance.now();
    const per = Math.ceil(SAMPLES / threads);
    const parts = await Promise.all(
      Array.from({ length: threads }, (_, i) => {
        const from = i * per;
        const to = Math.min(SAMPLES, from + per);
        return new Promise((resolve, reject) => {
          const w = new Worker(new URL(import.meta.url), { workerData: { n, from, to } });
          w.once('message', resolve);
          w.once('error', reject);
        });
      }),
    );
    // Merge histograms: metric → [value, count][] sorted by value.
    /** @type {Record<string, Map<number, number>>} */
    const merged = {};
    for (const part of /** @type {Record<string, [number, number][]>[]} */ (parts)) {
      for (const [id, pairs] of Object.entries(part)) {
        merged[id] ??= new Map();
        for (const [v, c] of pairs) merged[id].set(v, (merged[id].get(v) ?? 0) + c);
      }
    }
    baseline[n] = {
      samples: SAMPLES,
      metrics: Object.fromEntries(
        Object.entries(merged).map(([id, map]) => [id, [...map].sort((a, b) => a[0] - b[0])]),
      ),
    };
    console.log(`baseline n=${n}: ${SAMPLES} samples in ${((performance.now() - t) / 1000).toFixed(1)} s`);
  }
  writeFileSync(
    new URL('../src/data/baseline.json', import.meta.url),
    JSON.stringify({ seed: BASE_SEED, generated: 'random permutations (Fisher–Yates)', sizes: baseline }) + '\n',
  );
  console.log(`done in ${((performance.now() - started) / 1000).toFixed(1)} s`);
} else {
  const { n, from, to } = workerData;
  /** @type {Record<string, Map<number, number>>} */
  const hist = {};
  for (let i = from; i < to; i++) {
    const values = scalars(analyze(randomPermutation(n, BASE_SEED + n * 1_000_003 + i)));
    for (const [id, v] of Object.entries(values)) {
      if (v === null) continue;
      hist[id] ??= new Map();
      hist[id].set(v, (hist[id].get(v) ?? 0) + 1);
    }
  }
  parentPort?.postMessage(Object.fromEntries(Object.entries(hist).map(([id, m]) => [id, [...m]])));
}
