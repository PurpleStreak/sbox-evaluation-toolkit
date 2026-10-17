import { dot, popcount } from './bits.js';
import { createMatrix, maxAbs, spectrum } from './matrix.js';

/**
 * In-place fast Walsh–Hadamard transform of a length-2^k array.
 * @param {Int32Array} v
 */
export function fwht(v) {
  for (let h = 1; h < v.length; h <<= 1) {
    for (let i = 0; i < v.length; i += h << 1) {
      for (let j = i; j < i + h; j++) {
        const x = v[j];
        const y = v[j + h];
        v[j] = x + y;
        v[j + h] = x - y;
      }
    }
  }
}

/**
 * Walsh spectrum W[a][b] = Σ_x (-1)^(b·S(x) ⊕ a·x), rows a (input mask, 2^n),
 * columns b (output mask, 2^m). Computed with one FWHT per output mask.
 * @param {import('./sbox.js').SBox} s
 * @returns {import('./matrix.js').Matrix}
 */
export function walsh(s) {
  const size = 1 << s.n;
  const cols = 1 << s.m;
  const out = createMatrix(size, cols);
  const col = new Int32Array(size);
  for (let b = 0; b < cols; b++) {
    for (let x = 0; x < size; x++) col[x] = dot(b, s.table[x]) ? -1 : 1;
    fwht(col);
    for (let a = 0; a < size; a++) out.data[a * cols + b] = col[a];
  }
  return out;
}

/**
 * Linear Approximation Table in bias form:
 * LAT[a][b] = #{ x : a·x = b·S(x) } − 2^(n−1) = W[a][b] / 2.
 * @param {import('./sbox.js').SBox} s
 * @param {import('./matrix.js').Matrix} [w]  Precomputed Walsh spectrum.
 * @returns {import('./matrix.js').Matrix}
 */
export function lat(s, w = walsh(s)) {
  const out = createMatrix(w.rows, w.cols);
  for (let i = 0; i < w.data.length; i++) out.data[i] = w.data[i] / 2;
  return out;
}

/**
 * Linearity L = max over a and b ≠ 0 of |W[a][b]|.
 * @param {import('./matrix.js').Matrix} w  Walsh spectrum.
 * @returns {number}
 */
export function linearity(w) {
  return maxAbs(w, { skipCol0: true });
}

/**
 * Nonlinearity NL = 2^(n−1) − L/2: the minimum Hamming distance from any non-trivial
 * component b·S to the affine functions. Higher is better (AES: 112 of a possible ~120).
 * @param {import('./matrix.js').Matrix} w  Walsh spectrum.
 * @returns {number}
 */
export function nonlinearity(w) {
  return w.rows / 2 - linearity(w) / 2;
}

/**
 * Nonlinearity of each component function b·S (index b; entry 0 is meaningless and set to 0).
 * @param {import('./matrix.js').Matrix} w
 * @returns {number[]}
 */
export function componentNonlinearities(w) {
  const result = [0];
  for (let b = 1; b < w.cols; b++) {
    let max = 0;
    for (let a = 0; a < w.rows; a++) max = Math.max(max, Math.abs(w.data[a * w.cols + b]));
    result.push(w.rows / 2 - max / 2);
  }
  return result;
}

/**
 * Histogram of |W[a][b]| for b ≠ 0 (extended Walsh spectrum). Affine-invariant.
 * @param {import('./matrix.js').Matrix} w
 * @returns {Map<number, number>}
 */
export function walshSpectrum(w) {
  return spectrum(w, { skipCol0: true, abs: true });
}

/**
 * Linear branch number: min of wt(a) + wt(b) over b ≠ 0 with W[a][b] ≠ 0.
 * @param {import('./matrix.js').Matrix} w
 * @returns {number}
 */
export function linearBranchNumber(w) {
  let best = Infinity;
  for (let a = 0; a < w.rows; a++)
    for (let b = 1; b < w.cols; b++)
      if (w.data[a * w.cols + b] !== 0) best = Math.min(best, popcount(a) + popcount(b));
  return best;
}
