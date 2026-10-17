import { fwht } from './linear.js';
import { createMatrix, maxAbs, spectrum } from './matrix.js';
import { inverse, isBijective } from './sbox.js';

/**
 * Boomerang Connectivity Table (Cid et al., EUROCRYPT 2018):
 * BCT[a][b] = #{ x : S⁻¹(S(x) ⊕ b) ⊕ S⁻¹(S(x ⊕ a) ⊕ b) = a }.
 * Defined for permutations only; returns null otherwise. Cost Θ(2^(3n)).
 * @param {import('./sbox.js').SBox} s
 * @returns {import('./matrix.js').Matrix | null}
 */
export function bct(s) {
  if (!isBijective(s)) return null;
  const size = 1 << s.n;
  const t = s.table;
  const inv = inverse(s).table;
  const out = createMatrix(size, size);
  const d = out.data;
  for (let a = 0; a < size; a++) {
    const base = a * size;
    for (let x = 0; x < size; x++) {
      const y0 = t[x];
      const y1 = t[x ^ a];
      for (let b = 0; b < size; b++) if ((inv[y0 ^ b] ^ inv[y1 ^ b]) === a) d[base + b]++;
    }
  }
  return out;
}

/**
 * Boomerang uniformity β = max_{a≠0, b≠0} BCT[a][b]. Lower is better; β ≥ δ always.
 * @param {import('./matrix.js').Matrix} table
 * @returns {number}
 */
export function boomerangUniformity(table) {
  return maxAbs(table, { skipRow0: true, skipCol0: true });
}

/**
 * Differential-Linear Connectivity Table (Bar-On et al., EUROCRYPT 2019):
 * DLCT[a][b] = #{ x : b·(S(x) ⊕ S(x ⊕ a)) = 0 } − 2^(n−1).
 * Equals half the autocorrelation table and is the Walsh transform of each DDT row.
 * @param {import('./matrix.js').Matrix} ddtTable  Output of ddt().
 * @returns {import('./matrix.js').Matrix}
 */
export function dlct(ddtTable) {
  const { rows, cols } = ddtTable;
  const out = createMatrix(rows, cols);
  const row = new Int32Array(cols);
  for (let a = 0; a < rows; a++) {
    for (let c = 0; c < cols; c++) row[c] = ddtTable.data[a * cols + c];
    fwht(row); // row[b] = Σ_c DDT[a][c] (−1)^(b·c) = 2·DLCT[a][b]
    for (let b = 0; b < cols; b++) out.data[a * cols + b] = row[b] / 2;
  }
  return out;
}

/**
 * Absolute indicator: max_{a≠0, b≠0} |ACT[a][b]| = 2 · max |DLCT[a][b]|.
 * Lower is better; measures the strongest differential-linear bias of one S-box.
 * @param {import('./matrix.js').Matrix} dlctTable
 * @returns {number}
 */
export function absoluteIndicator(dlctTable) {
  return 2 * maxAbs(dlctTable, { skipRow0: true, skipCol0: true });
}

/**
 * @param {import('./matrix.js').Matrix} table  BCT or DLCT.
 * @returns {Map<number, number>}
 */
export function connectivitySpectrum(table) {
  return spectrum(table, { skipRow0: true, skipCol0: true, abs: true });
}
