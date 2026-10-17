import baselineData from '../data/baseline.json';
import presetData from '../data/presets.json';
import { getMetric } from './metrics.js';

/**
 * @typedef {object} BaselineComparison
 * @property {number} samples     Number of random permutations in the baseline.
 * @property {number} betterThan  Fraction of random permutations strictly worse than `value`.
 * @property {number} equalTo     Fraction with exactly this value.
 * @property {number} percentile  Mid-rank percentile in [0, 1]: betterThan + equalTo / 2.
 * @property {number} min
 * @property {number} max
 * @property {number} median
 */

/** @type {Record<string, { samples: number, metrics: Record<string, [number, number][]> }>} */
const SIZES = /** @type {any} */ (baselineData).sizes;

/**
 * Sizes (n) for which a random-permutation baseline exists.
 * @returns {number[]}
 */
export function baselineSizes() {
  return Object.keys(SIZES).map(Number);
}

/**
 * Raw histogram ([value, count] pairs sorted by value) of a metric over random n-bit permutations.
 * @param {string} metricId
 * @param {number} n
 * @returns {[number, number][] | null}
 */
export function baselineHistogram(metricId, n) {
  return SIZES[n]?.metrics[metricId] ?? null;
}

/**
 * Compare a metric value with random n-bit permutations, respecting the metric's
 * "better" direction. Returns null when no baseline exists or the metric has no direction.
 * @param {string} metricId
 * @param {number} n
 * @param {number | null} value
 * @returns {BaselineComparison | null}
 */
export function compareToBaseline(metricId, n, value) {
  const hist = baselineHistogram(metricId, n);
  const metric = getMetric(metricId);
  if (!hist || value === null || metric.better === 'none') return null;

  /** @param {number} v  Larger score = better. */
  const score = (v) =>
    metric.better === 'higher' ? v : metric.better === 'lower' ? -v : -Math.abs(v - 0.5);
  const target = score(value);
  const eps = 1e-9;

  let total = 0;
  let worse = 0;
  let equal = 0;
  for (const [v, c] of hist) {
    total += c;
    const s = score(v);
    if (Math.abs(s - target) < eps) equal += c;
    else if (s < target) worse += c;
  }

  let acc = 0;
  let median = hist[0][0];
  for (const [v, c] of hist) {
    acc += c;
    if (acc >= total / 2) {
      median = v;
      break;
    }
  }

  return {
    samples: total,
    betterThan: worse / total,
    equalTo: equal / total,
    percentile: (worse + equal / 2) / total,
    min: hist[0][0],
    max: hist[hist.length - 1][0],
    median,
  };
}

/**
 * @typedef {object} PresetSummary
 * @property {string} id
 * @property {{ n: number, m: number, bijective: boolean, balanced: boolean, involution: boolean }} properties
 * @property {Record<string, number | null>} metrics
 * @property {number[] | null} cycles
 * @property {number[]} fixedPoints
 */

/** @type {PresetSummary[]} */
export const PRESET_SUMMARIES = presetData;

/**
 * Precomputed scalar metrics of a reference S-box (no runtime analysis needed).
 * @param {string} id
 * @returns {PresetSummary | undefined}
 */
export function getPresetSummary(id) {
  return PRESET_SUMMARIES.find((p) => p.id === id);
}
