import { describe, expect, it } from 'vitest';
import { dot } from './bits.js';
import { absoluteIndicator, bct, boomerangUniformity, dlct } from './connectivity.js';
import { ddt, differentialUniformity } from './differential.js';
import { get } from './matrix.js';
import { PRESETS, getPreset } from './presets.js';

/** @param {string} id */
const preset = (id) => {
  const p = getPreset(id);
  if (!p) throw new Error(`missing preset ${id}`);
  return p.sbox;
};

describe('BCT', () => {
  it('reproduces AES boomerang uniformity 6 (Cid et al. 2018)', () => {
    const table = bct(preset('aes'));
    expect(table && boomerangUniformity(table)).toBe(6);
  });

  it('satisfies BCT ≥ DDT, trivial row/column = 2^n, and β ≥ δ', () => {
    for (const p of PRESETS) {
      const b = bct(p.sbox);
      if (!b) continue;
      const d = ddt(p.sbox);
      const size = 1 << p.sbox.n;
      for (let i = 0; i < size; i++) {
        expect(get(b, 0, i)).toBe(size);
        expect(get(b, i, 0)).toBe(size);
        for (let j = 0; j < size; j++) expect(get(b, i, j)).toBeGreaterThanOrEqual(get(d, i, j));
      }
      expect(boomerangUniformity(b)).toBeGreaterThanOrEqual(differentialUniformity(d));
    }
  });

  it('is only defined for permutations', () => {
    expect(bct(preset('des1'))).toBeNull();
  });
});

describe('DLCT', () => {
  it('matches its definition (incl. n ≠ m)', () => {
    for (const s of [preset('present'), preset('des1')]) {
      const table = dlct(ddt(s));
      for (let a = 0; a < 1 << s.n; a++) {
        for (let b = 0; b < 1 << s.m; b++) {
          let count = 0;
          for (let x = 0; x < 1 << s.n; x++) if (dot(b, s.table[x] ^ s.table[x ^ a]) === 0) count++;
          expect(get(table, a, b)).toBe(count - (1 << (s.n - 1)));
        }
      }
    }
  });

  it('gives expected absolute indicators', () => {
    // Regression value for AES; 16 = 2^4 for PRESENT reflects its quadratic
    // components having linear structures.
    expect(absoluteIndicator(dlct(ddt(preset('aes'))))).toBe(32);
    expect(absoluteIndicator(dlct(ddt(preset('present'))))).toBe(16);
  });
});
