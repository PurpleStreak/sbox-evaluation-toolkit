import { describe, expect, it } from 'vitest';
import { ddt, differentialBranchNumber, differentialPairs, differentialSpectrum, differentialUniformity } from './differential.js';
import { get } from './matrix.js';
import { getPreset } from './presets.js';
import { createSBox } from './sbox.js';

/** @param {string} id */
const preset = (id) => {
  const p = getPreset(id);
  if (!p) throw new Error(`missing preset ${id}`);
  return p.sbox;
};

/**
 * Deterministic pseudo-random S-box for cross-checks.
 * @param {number} n
 * @param {number} m
 * @param {number} seed
 */
function randomSBox(n, m, seed) {
  let state = seed;
  const next = () => (state = (state * 1103515245 + 12345) >>> 0) >>> 16;
  return createSBox(Array.from({ length: 1 << n }, () => next() % (1 << m)), m);
}

describe('DDT', () => {
  it('matches a naive definition on random S-boxes (incl. n ≠ m)', () => {
    for (const [n, m] of [[3, 3], [5, 5], [4, 2], [3, 5]]) {
      const s = randomSBox(n, m, n * 31 + m);
      const table = ddt(s);
      for (let a = 0; a < 1 << n; a++)
        for (let b = 0; b < 1 << m; b++)
          expect(get(table, a, b)).toBe(differentialPairs(s, a, b).length);
    }
  });

  it('has rows summing to 2^n and DDT[0][0] = 2^n', () => {
    const table = ddt(preset('present'));
    expect(get(table, 0, 0)).toBe(16);
    for (let a = 0; a < 16; a++) {
      let sum = 0;
      for (let b = 0; b < 16; b++) sum += get(table, a, b);
      expect(sum).toBe(16);
    }
  });

  it('reproduces known AES values', () => {
    const table = ddt(preset('aes'));
    expect(differentialUniformity(table)).toBe(4);
    // Inversion-based: each non-trivial row has 129 zeros, 126 twos and a single four.
    expect(differentialSpectrum(table)).toEqual(new Map([[0, 255 * 129], [2, 255 * 126], [4, 255]]));
    expect(differentialBranchNumber(preset('aes'))).toBe(2);
  });

  it('reproduces known 4-bit values', () => {
    for (const id of ['present', 'skinny4', 'serpent0', 'prince', 'midori0'])
      expect(differentialUniformity(ddt(preset(id)))).toBe(4);
    expect(differentialUniformity(ddt(preset('gift')))).toBe(6);
    expect(differentialBranchNumber(preset('present'))).toBe(3);
  });

  it('reproduces the DES S1 differential used by Biham–Shamir', () => {
    const table = ddt(preset('des1'));
    expect(table.cols).toBe(16);
    expect(differentialUniformity(table)).toBe(16);
    expect(get(table, 0x34, 0x2)).toBe(16);
  });
});
