/**
 * Bit-level helpers shared by all analysis modules.
 * All values are small non-negative integers (at most {@link MAX_BITS} bits).
 */

/** Largest supported input/output width in bits. */
export const MAX_BITS = 8;

const POPCOUNT = new Uint8Array(1 << MAX_BITS);
for (let i = 1; i < POPCOUNT.length; i++) POPCOUNT[i] = (i & 1) + POPCOUNT[i >> 1];

/**
 * Hamming weight of `x` (x < 2^MAX_BITS).
 * @param {number} x
 * @returns {number}
 */
export function popcount(x) {
  return POPCOUNT[x];
}

/**
 * Parity of the bitwise dot product a·x over GF(2), returned as 0 or 1.
 * @param {number} a
 * @param {number} x
 * @returns {number}
 */
export function dot(a, x) {
  return POPCOUNT[a & x] & 1;
}

/**
 * Number of bits needed to represent `x` (0 for x = 0).
 * @param {number} x
 * @returns {number}
 */
export function bitLength(x) {
  let n = 0;
  while (x > 0) {
    n++;
    x >>>= 1;
  }
  return n;
}

/**
 * Exact base-2 logarithm, or -1 if `x` is not a power of two.
 * @param {number} x
 * @returns {number}
 */
export function log2Exact(x) {
  if (x < 1 || (x & (x - 1)) !== 0) return -1;
  return bitLength(x) - 1;
}
