import { isBijective } from './sbox.js';

/**
 * Inputs with S(x) = x. Fixed points can be exploited by slide-like and
 * invariant attacks; AES chose its affine constant 0x63 to avoid them.
 * @param {import('./sbox.js').SBox} s
 * @returns {number[]}
 */
export function fixedPoints(s) {
  if (s.n !== s.m) return [];
  const result = [];
  for (let x = 0; x < s.table.length; x++) if (s.table[x] === x) result.push(x);
  return result;
}

/**
 * Inputs with S(x) = x̄ (bitwise complement).
 * @param {import('./sbox.js').SBox} s
 * @returns {number[]}
 */
export function oppositeFixedPoints(s) {
  if (s.n !== s.m) return [];
  const mask = (1 << s.n) - 1;
  const result = [];
  for (let x = 0; x < s.table.length; x++) if (s.table[x] === (x ^ mask)) result.push(x);
  return result;
}

/**
 * True when S(S(x)) = x for all x.
 * @param {import('./sbox.js').SBox} s
 * @returns {boolean}
 */
export function isInvolution(s) {
  if (s.n !== s.m) return false;
  return s.table.every((y, x) => s.table[y] === x);
}

/**
 * Cycle decomposition of a permutation, cycle lengths sorted descending; null if not bijective.
 * Short cycles mean low order under iteration.
 * @param {import('./sbox.js').SBox} s
 * @returns {number[] | null}
 */
export function cycleStructure(s) {
  if (!isBijective(s)) return null;
  const seen = new Uint8Array(s.table.length);
  const lengths = [];
  for (let start = 0; start < s.table.length; start++) {
    if (seen[start]) continue;
    let len = 0;
    for (let x = start; !seen[x]; x = s.table[x]) {
      seen[x] = 1;
      len++;
    }
    lengths.push(len);
  }
  return lengths.sort((a, b) => b - a);
}

/**
 * @typedef {object} LinearStructure
 * @property {number} a         Input difference.
 * @property {number} b         Output mask.
 * @property {0 | 1} constant   b·(S(x) ⊕ S(x ⊕ a)) for every x.
 */

/**
 * Linear structures: pairs (a ≠ 0, b ≠ 0) where the derivative of component b·S in
 * direction a is constant, i.e. |DLCT[a][b]| = 2^(n−1). They give probability-1
 * differential-linear relations and are the building blocks of invariant subspaces.
 * @param {import('./matrix.js').Matrix} dlctTable  Output of dlct().
 * @returns {LinearStructure[]}
 */
export function linearStructures(dlctTable) {
  const half = dlctTable.rows / 2;
  /** @type {LinearStructure[]} */
  const result = [];
  for (let a = 1; a < dlctTable.rows; a++) {
    for (let b = 1; b < dlctTable.cols; b++) {
      const v = dlctTable.data[a * dlctTable.cols + b];
      if (Math.abs(v) === half) result.push({ a, b, constant: v > 0 ? 0 : 1 });
    }
  }
  return result;
}
