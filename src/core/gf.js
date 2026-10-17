/**
 * Arithmetic in the binary finite field GF(2^n), 2 ≤ n ≤ 8, using full
 * multiplication / inverse tables (at most 64 KiB) for speed.
 */

/**
 * Default irreducible polynomial for each field size (bit i = coefficient of x^i).
 * n = 8 uses the AES polynomial x^8 + x^4 + x^3 + x + 1.
 * @type {Readonly<Record<number, number>>}
 */
export const DEFAULT_POLY = Object.freeze({
  2: 0b111, // x^2 + x + 1
  3: 0b1011, // x^3 + x + 1
  4: 0b10011, // x^4 + x + 1
  5: 0b100101, // x^5 + x^2 + 1
  6: 0b1000011, // x^6 + x + 1
  7: 0b10000011, // x^7 + x + 1
  8: 0x11b, // x^8 + x^4 + x^3 + x + 1 (AES)
});

/**
 * @typedef {object} Field
 * @property {number} n
 * @property {number} poly
 * @property {number} size          2^n
 * @property {(a: number, b: number) => number} mul
 * @property {(a: number) => number} inv   Multiplicative inverse, with inv(0) = 0.
 * @property {(a: number, e: number) => number} pow
 */

/**
 * Carry-less multiplication modulo `poly`.
 * @param {number} a
 * @param {number} b
 * @param {number} n
 * @param {number} poly
 * @returns {number}
 */
function slowMul(a, b, n, poly) {
  let r = 0;
  const top = 1 << n;
  while (b) {
    if (b & 1) r ^= a;
    b >>>= 1;
    a <<= 1;
    if (a & top) a ^= poly;
  }
  return r;
}

/**
 * True when `poly` (degree n) is irreducible over GF(2).
 * @param {number} poly
 * @param {number} n
 * @returns {boolean}
 */
export function isIrreducible(poly, n) {
  if (poly >> n !== 1) return false;
  // Irreducible ⇔ every non-zero element has a multiplicative inverse (no zero divisors).
  const size = 1 << n;
  for (let a = 1; a < size; a++) {
    let hasInverse = false;
    for (let b = 1; b < size && !hasInverse; b++) hasInverse = slowMul(a, b, n, poly) === 1;
    if (!hasInverse) return false;
  }
  return true;
}

/** @type {Map<string, Field>} */
const cache = new Map();

/**
 * Get (cached) field arithmetic for GF(2^n) with the given modulus.
 * @param {number} n
 * @param {number} [poly]  Irreducible polynomial of degree n; defaults to {@link DEFAULT_POLY}[n].
 * @returns {Field}
 */
export function getField(n, poly = DEFAULT_POLY[n]) {
  if (!(n >= 2 && n <= 8)) throw new Error(`Field size must be 2..8 bits (got ${n})`);
  const key = `${n}:${poly}`;
  const cached = cache.get(key);
  if (cached) return cached;
  if (!isIrreducible(poly, n)) throw new Error(`Polynomial 0x${poly.toString(16)} is not irreducible of degree ${n}`);

  const size = 1 << n;
  const mulTable = new Uint8Array(size * size);
  const invTable = new Uint8Array(size);
  for (let a = 0; a < size; a++) {
    for (let b = a; b < size; b++) {
      const p = slowMul(a, b, n, poly);
      mulTable[a * size + b] = p;
      mulTable[b * size + a] = p;
      if (p === 1) {
        invTable[a] = b;
        invTable[b] = a;
      }
    }
  }

  /** @type {Field} */
  const field = {
    n,
    poly,
    size,
    mul: (a, b) => mulTable[a * size + b],
    inv: (a) => invTable[a],
    pow: (a, e) => {
      // Square-and-multiply; uses 0^0 = 1.
      let r = 1;
      let base = a;
      while (e > 0) {
        if (e & 1) r = mulTable[r * size + base];
        base = mulTable[base * size + base];
        e = Math.floor(e / 2);
      }
      return r;
    },
  };
  cache.set(key, field);
  return field;
}
