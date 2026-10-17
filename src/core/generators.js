import { dot } from './bits.js';
import { getField } from './gf.js';
import { createRng, randomInt } from './random.js';
import { createSBox } from './sbox.js';

/**
 * Uniformly random n-bit permutation (Fisher–Yates).
 * @param {number} n
 * @param {number} seed
 * @returns {import('./sbox.js').SBox}
 */
export function randomPermutation(n, seed) {
  const rng = createRng(seed);
  const t = Array.from({ length: 1 << n }, (_, i) => i);
  for (let i = t.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    [t[i], t[j]] = [t[j], t[i]];
  }
  return createSBox(t, n);
}

/**
 * Uniformly random n→m function (generally not bijective).
 * @param {number} n
 * @param {number} m
 * @param {number} seed
 * @returns {import('./sbox.js').SBox}
 */
export function randomFunction(n, m, seed) {
  const rng = createRng(seed);
  return createSBox(
    Array.from({ length: 1 << n }, () => randomInt(rng, 1 << m)),
    m,
  );
}

/* ------------------------------------------------------------------ */
/* Affine maps over GF(2)^n                                            */
/* ------------------------------------------------------------------ */

/**
 * A linear map over GF(2)^n stored as n row masks: output bit i = parity(rows[i] & x).
 * @typedef {number[]} BitMatrix
 */

/**
 * @typedef {object} AffineMap
 * @property {BitMatrix} matrix
 * @property {number} constant
 */

/**
 * @param {BitMatrix} rows
 * @param {number} x
 * @returns {number}
 */
export function applyLinear(rows, x) {
  let y = 0;
  for (let i = 0; i < rows.length; i++) y |= dot(rows[i], x) << i;
  return y;
}

/**
 * @param {AffineMap} map
 * @param {number} x
 * @returns {number}
 */
export function applyAffine(map, x) {
  return applyLinear(map.matrix, x) ^ map.constant;
}

/**
 * @param {number} n
 * @returns {BitMatrix}
 */
export function identityMatrix(n) {
  return Array.from({ length: n }, (_, i) => 1 << i);
}

/**
 * Rank of a GF(2) matrix given as row masks.
 * @param {BitMatrix} rows
 * @returns {number}
 */
export function matrixRank(rows) {
  const r = [...rows];
  let rank = 0;
  for (let bit = 0; bit < 32 && rank < r.length; bit++) {
    const pivot = r.findIndex((v, i) => i >= rank && (v >> bit) & 1);
    if (pivot < 0) continue;
    [r[rank], r[pivot]] = [r[pivot], r[rank]];
    for (let i = 0; i < r.length; i++) if (i !== rank && (r[i] >> bit) & 1) r[i] ^= r[rank];
    rank++;
  }
  return rank;
}

/**
 * Random invertible n×n matrix over GF(2) (rejection sampling; ~29% acceptance).
 * @param {number} n
 * @param {import('./random.js').Rng} rng
 * @returns {BitMatrix}
 */
export function randomInvertibleMatrix(n, rng) {
  for (;;) {
    const rows = Array.from({ length: n }, () => randomInt(rng, 1 << n));
    if (matrixRank(rows) === n) return rows;
  }
}

/**
 * Random affine bijection of GF(2)^n.
 * @param {number} n
 * @param {number} seed
 * @returns {AffineMap}
 */
export function randomAffineMap(n, seed) {
  const rng = createRng(seed);
  return { matrix: randomInvertibleMatrix(n, rng), constant: randomInt(rng, 1 << n) };
}

/** The AES affine output map: b ⊕ rotl(b,1) ⊕ … ⊕ rotl(b,4) ⊕ 0x63. */
export const AES_AFFINE = Object.freeze({
  matrix: Array.from({ length: 8 }, (_, i) => ((0xf1 << i) | (0xf1 >> (8 - i))) & 0xff),
  constant: 0x63,
});

/* ------------------------------------------------------------------ */
/* Power maps                                                          */
/* ------------------------------------------------------------------ */

/**
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * Exponents with well-studied cryptographic properties for GF(2^n).
 * @param {number} n
 * @returns {{ exponent: number, name: string, note: string }[]}
 */
export function notableExponents(n) {
  const q = 1 << n;
  /** @type {{ exponent: number, name: string, note: string }[]} */
  const list = [{ exponent: q - 2, name: 'Inverse', note: 'x⁻¹ — used by AES; optimal for even n.' }];
  for (let k = 1; k < n; k++) {
    if (gcd(k, n) === 1) {
      list.push({ exponent: (1 << k) + 1, name: `Gold (k=${k})`, note: 'Quadratic APN map; degree 2.' });
      const kas = (1 << (2 * k)) - (1 << k) + 1;
      if (kas < q - 1 && k > 1) list.push({ exponent: kas, name: `Kasami (k=${k})`, note: 'APN for odd n.' });
    }
  }
  list.push({ exponent: 3, name: 'Cube', note: 'x³ — simplest quadratic map.' });
  const seen = new Set();
  return list.filter((e) => e.exponent < q - 1 && !seen.has(e.exponent) && seen.add(e.exponent));
}

/**
 * @typedef {object} PowerMapOptions
 * @property {number} n
 * @property {number} exponent
 * @property {number} [poly]          Field polynomial (default per gf.js).
 * @property {AffineMap} [inputMap]   Applied before exponentiation.
 * @property {AffineMap} [outputMap]  Applied after exponentiation.
 */

/**
 * S(x) = B( (A(x))^d ) with optional affine maps A, B — the AES construction family.
 * Bijective iff gcd(d, 2^n − 1) = 1.
 * @param {PowerMapOptions} opts
 * @returns {{ sbox: import('./sbox.js').SBox, bijective: boolean }}
 */
export function powerMap({ n, exponent, poly, inputMap, outputMap }) {
  const f = getField(n, poly);
  const table = Array.from({ length: f.size }, (_, x) => {
    const xin = inputMap ? applyAffine(inputMap, x) : x;
    const y = f.pow(xin, exponent);
    return outputMap ? applyAffine(outputMap, y) : y;
  });
  return { sbox: createSBox(table, n), bijective: gcd(exponent, f.size - 1) === 1 };
}

/**
 * Affine-equivalent copy B∘S∘A. Preserves every affine-invariant metric.
 * @param {import('./sbox.js').SBox} s
 * @param {AffineMap} inputMap
 * @param {AffineMap} outputMap
 * @returns {import('./sbox.js').SBox}
 */
export function affineTransform(s, inputMap, outputMap) {
  return createSBox(
    Array.from(s.table, (_, x) => applyAffine(outputMap, s.table[applyAffine(inputMap, x)])),
    s.m,
  );
}
