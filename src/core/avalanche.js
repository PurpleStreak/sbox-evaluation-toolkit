import { popcount } from './bits.js';

/**
 * Strict Avalanche Criterion matrix (Webster & Tavares 1985):
 * K[i][j] = Pr_x[ bit j of S(x) ⊕ S(x ⊕ e_i) = 1 ], rows i = input bit, cols j = output bit.
 * Ideal value 0.5 everywhere.
 * @param {import('./sbox.js').SBox} s
 * @returns {{ matrix: Float64Array, rows: number, cols: number, mean: number, min: number, max: number, maxDeviation: number }}
 */
export function sac(s) {
  const size = 1 << s.n;
  const matrix = new Float64Array(s.n * s.m);
  for (let i = 0; i < s.n; i++) {
    const e = 1 << i;
    for (let x = 0; x < size; x++) {
      const d = s.table[x] ^ s.table[x ^ e];
      for (let j = 0; j < s.m; j++) if ((d >> j) & 1) matrix[i * s.m + j]++;
    }
  }
  for (let k = 0; k < matrix.length; k++) matrix[k] /= size;
  return { matrix, rows: s.n, cols: s.m, ...summarize(matrix) };
}

/**
 * Bit Independence Criterion in the two forms common in the S-box literature:
 * for every pair of output bits j < k, the XOR f_j ⊕ f_k should be highly nonlinear
 * (BIC-NL) and satisfy SAC (BIC-SAC).
 * @param {import('./sbox.js').SBox} s
 * @param {number[]} componentNl  Output of componentNonlinearities() for this S-box.
 * @returns {{ nl: { min: number, mean: number }, sac: { mean: number, min: number, max: number, maxDeviation: number } }}
 */
export function bic(s, componentNl) {
  const size = 1 << s.n;
  const nls = [];
  const sacValues = [];
  for (let j = 0; j < s.m; j++) {
    for (let k = j + 1; k < s.m; k++) {
      const mask = (1 << j) | (1 << k);
      nls.push(componentNl[mask]);
      for (let i = 0; i < s.n; i++) {
        let flips = 0;
        for (let x = 0; x < size; x++) flips += popcount((s.table[x] ^ s.table[x ^ (1 << i)]) & mask) & 1;
        sacValues.push(flips / size);
      }
    }
  }
  if (nls.length === 0) return { nl: { min: NaN, mean: NaN }, sac: { mean: NaN, min: NaN, max: NaN, maxDeviation: NaN } };
  return {
    nl: { min: Math.min(...nls), mean: nls.reduce((a, b) => a + b, 0) / nls.length },
    sac: summarize(Float64Array.from(sacValues)),
  };
}

/**
 * Average number of output bits flipped when one input bit flips, per input bit.
 * Ideal: m / 2.
 * @param {import('./sbox.js').SBox} s
 * @returns {number[]}
 */
export function avalancheWeights(s) {
  const size = 1 << s.n;
  const result = [];
  for (let i = 0; i < s.n; i++) {
    let total = 0;
    for (let x = 0; x < size; x++) total += popcount(s.table[x] ^ s.table[x ^ (1 << i)]);
    result.push(total / size);
  }
  return result;
}

/**
 * @param {Float64Array} values
 */
function summarize(values) {
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  let maxDeviation = 0;
  for (const v of values) {
    sum += v;
    min = Math.min(min, v);
    max = Math.max(max, v);
    maxDeviation = Math.max(maxDeviation, Math.abs(v - 0.5));
  }
  return { mean: sum / values.length, min, max, maxDeviation };
}
