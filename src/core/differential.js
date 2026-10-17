import { popcount } from './bits.js';
import { createMatrix, maxAbs, spectrum } from './matrix.js';

/**
 * Difference Distribution Table:
 * DDT[a][b] = #{ x : S(x) ⊕ S(x ⊕ a) = b }, with a an input and b an output difference.
 * Rows are indexed by a (2^n), columns by b (2^m).
 * @param {import('./sbox.js').SBox} s
 * @returns {import('./matrix.js').Matrix}
 */
export function ddt(s) {
  const size = 1 << s.n;
  const cols = 1 << s.m;
  const t = s.table;
  const out = createMatrix(size, cols);
  const d = out.data;
  for (let a = 0; a < size; a++) {
    const base = a * cols;
    for (let x = 0; x < size; x++) d[base + (t[x] ^ t[x ^ a])]++;
  }
  return out;
}

/**
 * Differential uniformity δ = max_{a≠0, b} DDT[a][b]. Lower is better;
 * 2 (APN) is optimal, 4 is the best known for 8-bit permutations.
 * @param {import('./matrix.js').Matrix} table  Output of {@link ddt}.
 * @returns {number}
 */
export function differentialUniformity(table) {
  return maxAbs(table, { skipRow0: true });
}

/**
 * Histogram of DDT values over the non-trivial rows (a ≠ 0). Affine-invariant.
 * @param {import('./matrix.js').Matrix} table
 * @returns {Map<number, number>}
 */
export function differentialSpectrum(table) {
  return spectrum(table, { skipRow0: true });
}

/**
 * Inputs x satisfying S(x) ⊕ S(x ⊕ a) = b — the concrete pairs behind DDT[a][b].
 * Each unordered pair {x, x ⊕ a} appears twice.
 * @param {import('./sbox.js').SBox} s
 * @param {number} a
 * @param {number} b
 * @returns {number[]}
 */
export function differentialPairs(s, a, b) {
  const result = [];
  for (let x = 0; x < s.table.length; x++) if ((s.table[x] ^ s.table[x ^ a]) === b) result.push(x);
  return result;
}

/**
 * Differential branch number: min over x ≠ y of wt(x ⊕ y) + wt(S(x) ⊕ S(y)).
 * Higher means a single active S-box spreads differences over more bits.
 * @param {import('./sbox.js').SBox} s
 * @returns {number}
 */
export function differentialBranchNumber(s) {
  const t = s.table;
  let best = Infinity;
  for (let a = 1; a < t.length; a++) {
    const wa = popcount(a);
    for (let x = 0; x < t.length; x++) {
      const w = wa + popcount(t[x] ^ t[x ^ a]);
      if (w < best) best = w;
    }
  }
  return best;
}
