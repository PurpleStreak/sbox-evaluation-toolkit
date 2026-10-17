/**
 * Seeded pseudo-random number generation so that every generated S-box can be
 * reproduced from its seed. NOT cryptographically secure — only used to build
 * candidate S-boxes for study.
 */

/**
 * @typedef {() => number} Rng  Returns a uniform float in [0, 1).
 */

/**
 * Mulberry32: small, fast 32-bit PRNG with good statistical quality.
 * @param {number} seed  Any 32-bit integer.
 * @returns {Rng}
 */
export function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A fresh random 32-bit seed (from the platform CSPRNG when available).
 * @returns {number}
 */
export function randomSeed() {
  if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  return Math.floor(Math.random() * 2 ** 32);
}

/**
 * Uniform integer in [0, max).
 * @param {Rng} rng
 * @param {number} max
 * @returns {number}
 */
export function randomInt(rng, max) {
  return Math.floor(rng() * max);
}
